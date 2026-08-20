import { BaseSystemAdapter } from './base-system-adapter.js';
import { log } from '../../lib/logger.js';

function toPascalCase(str) {
    return str.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}

/**
 * Dynamically loads and instantiates the active system adapter.
 * @param {string} [systemId]
 * @returns {Promise<BaseSystemAdapter>}
 */
export async function initializeSystemAdapter(systemId = globalThis.game?.system?.id) {
    if (!systemId) {
        return new BaseSystemAdapter('unknown');
    }

    const systemPath = `./${systemId}-system-adapter.js`;
    const systemClassName = `${toPascalCase(systemId)}SystemAdapter`;

    try {
        const systemModule = await import(systemPath);
        const AdapterClass = systemModule[systemClassName];
        if (AdapterClass) {
            log.info(`Initialized system adapter for: ${systemId}`);
            return new AdapterClass();
        }
        log.warn(`Class ${systemClassName} not found in ${systemPath}. Falling back to default adapter.`);
    } catch (error) {
        log.warn(`No system adapter found for ${systemId} at ${systemPath}. Falling back to default adapter.`);
        log.debug("System adapter load error:", error);
    }

    return new BaseSystemAdapter(systemId);
}

export { BaseSystemAdapter };
