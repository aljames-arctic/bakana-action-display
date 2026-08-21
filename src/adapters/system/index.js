import { BaseSystemAdapter } from './base-system-adapter.js';
import { MODULE_ID, GITHUB_ISSUES_URL } from '../../constants.js';
import { log } from '../../lib/logger.js';

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
 * @param {string} [systemId]
 * @returns {Promise<BaseSystemAdapter>}
 */
export async function initializeSystemAdapter(systemId = game.system?.id) {
    if (!systemId) {
        return new BaseSystemAdapter('unknown', false);
    }

    const systemPath = `./${systemId}-system-adapter.js`;
    const systemClassName = `${toPascalCase(systemId)}SystemAdapter`;

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


