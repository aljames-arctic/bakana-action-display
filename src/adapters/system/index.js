import { BaseSystemAdapter } from './base-system-adapter.js';
import { MODULE_ID, GITHUB_ISSUES_URL } from '../../constants.js';
import { log } from '../../lib/logger.js';

/**
 * Cached set of system adapter filenames found in the system adapters directory.
 * @type {Set<string>|null}
 */
let adapterFileCache = null;

/**
 * Inspect the system adapters directory to query all available adapter filenames.
 * Uses Foundry's FilePicker.browse to query the module directory at runtime.
 * @returns {Promise<Set<string>|null>}
 */
async function getAvailableAdapterFiles() {
    if (adapterFileCache !== null) return adapterFileCache;

    const FilePickerClass = globalThis.FilePicker ?? globalThis.foundry?.applications?.apps?.FilePicker;
    if (typeof FilePickerClass?.browse === 'function') {
        const dirPath = `modules/${MODULE_ID}/src/adapters/system`;
        for (const source of ['data', 'public', 'client']) {
            try {
                const result = await FilePickerClass.browse(source, dirPath);
                if (Array.isArray(result?.files) && result.files.length > 0) {
                    adapterFileCache = new Set(result.files.map(file => file.split('/').pop().toLowerCase()));
                    log.debug(`Discovered ${adapterFileCache.size} system adapters in directory [${source}:${dirPath}]`);
                    return adapterFileCache;
                }
            } catch {
                // Ignore errors and try next source
            }
        }
    }
    return null;
}

/**
 * Convert hyphenated system ID strings to PascalCase class names (e.g. 'dnd5e' -> 'Dnd5e', 'custom-rpg' -> 'CustomRpg').
 * @param {string} str
 * @returns {string}
 */
function toPascalCase(str) {
    return str.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}

/**
 * Dynamically loads and instantiates the active system adapter.
 * Automatically inspects the adapter directory and loads matching `./${systemId}-system-adapter.js`.
 * @param {string} [systemId]
 * @returns {Promise<BaseSystemAdapter>}
 */
export async function initializeSystemAdapter(systemId = game.system?.id) {
    if (!systemId) {
        return new BaseSystemAdapter('unknown', false);
    }

    const targetFileName = `${systemId}-system-adapter.js`.toLowerCase();
    const systemPath = `./${systemId}-system-adapter.js`;
    const systemClassName = `${toPascalCase(systemId)}SystemAdapter`;

    // Inspect directory to verify file presence before attempting dynamic import
    const availableFiles = await getAvailableAdapterFiles();
    if (availableFiles && !availableFiles.has(targetFileName)) {
        log.debug(`No system adapter found for "${systemId}" in adapter directory. Falling back to default adapter.`);
        const issuesUrl = game.modules?.get?.(MODULE_ID)?.bugs ?? GITHUB_ISSUES_URL;
        log.info(`System "${systemId}" is not natively supported and will use the default adapter. If you experience issues or would like to request support, please visit: ${issuesUrl}`);
        return new BaseSystemAdapter(systemId, false);
    }

    try {
        const systemModule = await import(systemPath);
        const AdapterClass = systemModule[systemClassName] ?? systemModule.default;
        if (AdapterClass) {
            log.info(`Initialized system adapter for: ${systemId}`);
            return new AdapterClass();
        }
        log.debug(`Class "${systemClassName}" not found in ${systemPath}. Falling back to default adapter.`);
    } catch (error) {
        log.debug(`No system adapter found for "${systemId}" at ${systemPath}. Falling back to default adapter.`, error);
    }

    const issuesUrl = game.modules?.get?.(MODULE_ID)?.bugs ?? GITHUB_ISSUES_URL;
    log.info(`System "${systemId}" is not natively supported and will use the default adapter. If you experience issues or would like to request support, please visit: ${issuesUrl}`);

    return new BaseSystemAdapter(systemId, false);
}

export { BaseSystemAdapter };





