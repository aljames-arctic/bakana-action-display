import { adapter } from './adapters/index.js';
import { BaseSystemAdapter } from './adapters/system/base-system-adapter.js';
import { BaseModuleAdapter } from './adapters/module/base-module-adapter.js';
import { log } from './lib/logger.js';

/**
 * Core coordinator class for Bakana's Action Display.
 * Integrates directly with the unified Adapter singleton for Foundry, System, and Module layers.
 */
class ActionDisplay {
    /**
     * Unified adapter instance.
     * @type {Adapter}
     */
    get adapter() {
        return adapter;
    }

    /**
     * Active system adapter delegate.
     * @type {BaseSystemAdapter}
     */
    get activeSystemAdapter() {
        return adapter.system;
    }

    set activeSystemAdapter(sys) {
        adapter.system = sys;
    }

    /**
     * Active module adapters map delegate.
     * @type {Map<string, BaseModuleAdapter>}
     */
    get moduleAdapters() {
        return adapter.modules;
    }

    /**
     * Initialize the coordinator and verify adapter readiness.
     */
    init() {
        log.info("Initializing ActionDisplay core");
        if (!adapter.system) {
            const currentSystemId = globalThis.game?.system?.id ?? 'unknown';
            log.warn(`No system adapter registered for system: ${currentSystemId}. Falling back to default adapter.`);
            adapter.system = new BaseSystemAdapter(currentSystemId);
        }
    }

    /**
     * Register and activate a system adapter.
     * @param {BaseSystemAdapter} sysAdapter
     */
    registerSystemAdapter(sysAdapter) {
        if (!(sysAdapter instanceof BaseSystemAdapter)) {
            throw new Error("System adapter must be an instance of BaseSystemAdapter");
        }
        adapter.system = sysAdapter;
        log.info(`Activated system adapter for: ${sysAdapter.systemId}`);
    }

    /**
     * Register a module adapter.
     * @param {BaseModuleAdapter} modAdapter
     */
    registerModuleAdapter(modAdapter) {
        if (!(modAdapter instanceof BaseModuleAdapter)) {
            throw new Error("Module adapter must be an instance of BaseModuleAdapter");
        }
        adapter.modules.set(modAdapter.moduleId, modAdapter);
        log.info(`Registered module adapter for: ${modAdapter.moduleId}`);
    }

    /**
     * Run the pipeline to get actions for a given actor via the unified adapter.
     * @param {Actor} actor The actor to extract actions for
     * @returns {Promise<Action[]>} The processed actions
     */
    async getActions(actor) {
        if (!actor) return [];
        return adapter.getActions(actor);
    }
}

// Export a singleton instance of the coordinator
export const actionDisplay = new ActionDisplay();
