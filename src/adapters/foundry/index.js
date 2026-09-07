import { BaseFoundryAdapter, USER_PERMISSION_TIERS } from './base-foundry-adapter.js';
import { FoundryV12Adapter } from './foundry-v12-adapter.js';
import { FoundryV13Adapter } from './foundry-v13-adapter.js';
import { FoundryV14Adapter } from './foundry-v14-adapter.js';
import { log } from '../../lib/logger.js';

export { BaseFoundryAdapter, FoundryV12Adapter, FoundryV13Adapter, FoundryV14Adapter, USER_PERMISSION_TIERS };

/**
 * Initialize and return the active Foundry VTT platform adapter.
 * Selects FoundryV14Adapter for v14+, FoundryV13Adapter for v13, and FoundryV12Adapter for v12 baseline.
 * @returns {FoundryV14Adapter|FoundryV13Adapter|FoundryV12Adapter}
 */
export function initializeFoundryAdapter() {
    const generation = Number(game.release?.generation);
    if (!Number.isFinite(generation) || generation < 12) {
        throw new Error(`Unsupported Foundry VTT generation: v${generation}. Bakana's Action Display requires Foundry VTT v12 or newer.`);
    }

    let adapter;
    if (generation >= 14) {
        adapter = new FoundryV14Adapter();
    } else if (generation === 13) {
        adapter = new FoundryV13Adapter();
    } else {
        adapter = new FoundryV12Adapter();
    }
    log.info(`Initialized Foundry Platform Adapter (v${adapter.generation})`);
    return adapter;
}
