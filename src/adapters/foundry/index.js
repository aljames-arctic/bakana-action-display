import { BaseFoundryAdapter } from './base-foundry-adapter.js';
import { FoundryVTTV12Adapter } from './foundry-v12-adapter.js';
import { FoundryVTTV14Adapter } from './foundry-v14-adapter.js';
import { log } from '../../lib/logger.js';

export { BaseFoundryAdapter, FoundryVTTV12Adapter, FoundryVTTV14Adapter };

/**
 * Initialize and return the active Foundry VTT platform adapter.
 * @returns {FoundryVTTV14Adapter|FoundryVTTV12Adapter}
 */
export function initializeFoundryAdapter() {
    const generation = game.release?.generation ?? 12;
    const adapter = generation >= 14 ? new FoundryVTTV14Adapter() : new FoundryVTTV12Adapter();
    log.info(`Initialized Foundry Platform Adapter (v${adapter.generation})`);
    return adapter;
}
