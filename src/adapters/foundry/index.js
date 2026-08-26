import { BaseFoundryAdapter, USER_PERMISSION_TIERS } from './base-foundry-adapter.js';
import { FoundryCurrentAdapter } from './foundry-current-adapter.js';
import { log } from '../../lib/logger.js';

export { BaseFoundryAdapter, FoundryCurrentAdapter, USER_PERMISSION_TIERS };

/**
 * Initialize and return the active Foundry VTT platform adapter.
 * Uses FoundryCurrentAdapter on modern Foundry releases (v13+) and BaseFoundryAdapter on oldest baseline (v12).
 * @returns {FoundryCurrentAdapter|BaseFoundryAdapter}
 */
export function initializeFoundryAdapter() {
    const generation = game.release.generation;
    const adapter = generation >= 13 ? new FoundryCurrentAdapter() : new BaseFoundryAdapter();
    log.info(`Initialized Foundry Platform Adapter (v${adapter.generation})`);
    return adapter;
}
