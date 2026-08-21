import { BaseSystemAdapter } from './base-system-adapter.js';
import { Dnd5eSystemAdapter } from './dnd5e-system-adapter.js';
import { Pf1SystemAdapter } from './pf1-system-adapter.js';
import { Pf2eSystemAdapter } from './pf2e-system-adapter.js';
import { MODULE_ID, GITHUB_ISSUES_URL } from '../../constants.js';
import { log } from '../../lib/logger.js';

/**
 * Registry of known system adapters.
 * Maps system IDs to their corresponding adapter classes.
 */
export const SYSTEM_ADAPTERS = {
    'dnd5e': Dnd5eSystemAdapter,
    'pf1': Pf1SystemAdapter,
    'pf2e': Pf2eSystemAdapter
};

/**
 * Loads and instantiates the active system adapter.
 * For unsupported systems, falls back immediately to BaseSystemAdapter with zero network requests.
 * @param {string} [systemId]
 * @returns {Promise<BaseSystemAdapter>}
 */
export async function initializeSystemAdapter(systemId = game.system?.id) {
    if (!systemId) {
        return new BaseSystemAdapter('unknown', false);
    }

    const AdapterClass = SYSTEM_ADAPTERS[systemId];
    if (AdapterClass) {
        log.info(`Initialized system adapter for: ${systemId}`);
        return new AdapterClass();
    }

    log.debug(`No system adapter registered for "${systemId}". Falling back to default adapter.`);

    const issuesUrl = game.modules?.get?.(MODULE_ID)?.bugs ?? GITHUB_ISSUES_URL;
    log.warn(`System "${systemId}" is not currently supported and will use the default adapter. If you experience issues or would like to request support, please visit: ${issuesUrl} and request support for the system.`);

    return new BaseSystemAdapter(systemId, false);
}

export { BaseSystemAdapter };

