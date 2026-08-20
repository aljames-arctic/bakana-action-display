import { BaseFoundryAdapter } from './base-foundry-adapter.js';
import { FoundryCurrentAdapter } from './foundry-current-adapter.js';
import { log } from '../../lib/logger.js';

export { BaseFoundryAdapter, FoundryCurrentAdapter };

/**
 * Initialize and return the active Foundry VTT platform adapter.
 * @returns {FoundryCurrentAdapter}
 */
export function initializeFoundryAdapter() {
    const adapter = new FoundryCurrentAdapter();
    log.info(`Initialized Foundry Platform Adapter (v${adapter.generation})`);
    return adapter;
}
