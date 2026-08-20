import { BaseFoundryAdapter } from './base-foundry-adapter.js';
import { FoundryV12Adapter } from './foundry-v12-adapter.js';
import { FoundryV13Adapter } from './foundry-v13-adapter.js';
import { FoundryV14Adapter } from './foundry-v14-adapter.js';
import { log } from '../../lib/logger.js';

export { BaseFoundryAdapter, FoundryV12Adapter, FoundryV13Adapter, FoundryV14Adapter };

/**
 * Initialize and return the active Foundry VTT version adapter.
 * @returns {BaseFoundryAdapter}
 */
export function initializeFoundryAdapter() {
    const rawVersion = globalThis.game?.version ?? '12';
    const gen = globalThis.game?.release?.generation ?? parseInt(String(rawVersion).split('.')[0], 10);

    if (gen >= 14) {
        log.info(`Initialized Foundry V14+ Adapter (v${rawVersion})`);
        return new FoundryV14Adapter();
    }
    if (gen === 13) {
        log.info(`Initialized Foundry V13 Adapter (v${rawVersion})`);
        return new FoundryV13Adapter();
    }
    log.info(`Initialized Foundry V12 Adapter (v${rawVersion})`);
    return new FoundryV12Adapter();
}
