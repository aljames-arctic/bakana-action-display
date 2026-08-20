import { FoundryCurrAdapter } from './foundry-curr-adapter.js';
import { log } from '../../lib/logger.js';

export { FoundryCurrAdapter };

/**
 * Initialize and return the active Foundry VTT platform adapter.
 * @returns {FoundryCurrAdapter}
 */
export function initializeFoundryAdapter() {
    const adapter = new FoundryCurrAdapter();
    log.info(`Initialized Foundry Platform Adapter (v${adapter.generation})`);
    return adapter;
}
