import { adapter } from './adapters/index.js';
import { BaseSystemAdapter } from './adapters/system/base-system-adapter.js';
import { BaseModuleAdapter } from './adapters/module/base-module-adapter.js';
import { log } from './lib/logger.js';
import { createAPI } from './api/index.js';

/**
 * Core coordinator class for Bakana's Action Display.
 * Integrates directly with the unified Adapter singleton for Foundry, System, and Module layers.
 */
export class ActionDisplay {
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
            const currentSystemId = game.system?.id ?? 'unknown';
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
     * Active HUD application instance.
     * @type {ActionDisplayApp|null}
     */
    activeApp = null;

    /**
     * Handler delegate for HUD toggling.
     * @type {Function|null}
     */
    toggleHandler = null;

    /**
     * API instance delegate.
     * @type {ActionDisplayAPI|null}
     */
    #api = null;

    /**
     * Official API instance.
     * @type {ActionDisplayAPI}
     */
    get api() {
        if (!this.#api) {
            this.#api = createAPI(this);
        }
        return this.#api;
    }

    set api(instance) {
        this.#api = instance;
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

    /**
     * Open the HUD for a specific token with optional page and tab configurations.
     * @param {*} tokenOrOptions Target token or configuration options
     * @param {Object} [options] Options passed to the API
     * @returns {Promise<ActionDisplayApp|null>}
     */
    async open(tokenOrOptions, options = {}) {
        return this.api.open(tokenOrOptions, options);
    }

    /**
     * Toggle the Action Display HUD for a token or the currently controlled token.
     * @param {Token} [explicitToken=null] Optional token to toggle HUD for
     * @returns {boolean} True if toggled, false otherwise
     */
    toggle(explicitToken = null) {
        return this.toggleHandler?.(explicitToken) ?? false;
    }
}

// Export a singleton instance of the coordinator
export const actionDisplay = new ActionDisplay();
