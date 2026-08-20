import { initializeFoundryAdapter, BaseFoundryAdapter } from './foundry/index.js';
import { initializeSystemAdapter, BaseSystemAdapter } from './system/index.js';
import { initializeModuleAdapters, BaseModuleAdapter } from './module/index.js';
import { MODULE_ID } from '../constants.js';
import { log } from '../lib/logger.js';
import { Action } from '../ui/action.js';

/**
 * Unified Adapter Singleton for Bakana's Action Display.
 * Centralizes and abstracts Foundry-level, System-level, and Module-level capabilities.
 */
class Adapter {
    constructor() {
        this.foundry = new BaseFoundryAdapter();
        this.system = new BaseSystemAdapter('default');
        this.modules = new Map();
        this._initialized = false;
    }

    /**
     * Backward-compatible getter for active system adapter.
     * @type {BaseSystemAdapter}
     */
    get activeSystemAdapter() {
        return this.system;
    }

    set activeSystemAdapter(sys) {
        this.system = sys;
    }

    /**
     * Initialize all adapter layers (Foundry, System, Module).
     * @returns {Promise<void>}
     */
    async init() {
        this.foundry = initializeFoundryAdapter();
        this.system = await initializeSystemAdapter(globalThis.game?.system?.id);
        this.modules = initializeModuleAdapters();
        this._initialized = true;
        log.info(`Unified Adapter initialized [Foundry: v${this.foundry.generation}, System: ${this.system.systemId}, Modules: ${this.modules.size}]`);
    }

    /* -------------------------------------------- */
    /*  Action Processing Pipeline                  */
    /* -------------------------------------------- */

    /**
     * Extract and process all actions for a given actor through System and Module layers.
     * @param {Actor} actor
     * @returns {Promise<Action[]>}
     */
    async getActions(actor) {
        if (!actor) return [];

        // 1. Core Base Extraction
        let actions = this._extractBaseActions(actor);

        // 2. System Transformation
        if (this.system) {
            try {
                if (typeof this.system.modifyActions === 'function') {
                    actions = await this.system.modifyActions(actions, actor);
                }
            } catch (error) {
                log.error(`Error in system adapter "${this.system.systemId}":`, error);
            }
        }

        // 3. Module Transformations
        for (const [moduleId, modAdapter] of this.modules.entries()) {
            try {
                if (typeof modAdapter.modifyActions === 'function') {
                    actions = await modAdapter.modifyActions(actions);
                }
            } catch (error) {
                log.error(`Error in module adapter "${moduleId}":`, error);
            }
        }

        // 4. Hidden items filtering
        const rawHidden = typeof actor.getFlag === 'function' ? actor.getFlag(MODULE_ID, 'hiddenItems') : undefined;
        const hiddenMap = Array.isArray(rawHidden)
            ? rawHidden.reduce((acc, id) => { acc[id] = true; return acc; }, {})
            : (rawHidden ?? {});
        const filtered = [];

        for (const action of actions) {
            if (action.hidden) continue;

            const itemId = action.originalItem?.id ?? action.id;
            if (Boolean(hiddenMap[itemId])) {
                action.isHidden = true;
                action.left = ['hidden'];
                action.right = ['all'];
                filtered.push(action);
                continue;
            }

            action.isHidden = false;
            filtered.push(action);
        }

        return filtered;
    }

    /**
     * Internal base action extractor.
     * @param {Actor} actor
     * @returns {Action[]}
     * @private
     */
    _extractBaseActions(actor) {
        const actions = [];
        if (!actor?.items) return actions;

        const items = actor.items instanceof Map ? Array.from(actor.items.values()) : (Array.isArray(actor.items) ? actor.items : Array.from(actor.items));
        for (const item of items) {
            if (!item?.name) continue;
            if (typeof this.system.shouldExtractItem === 'function' && !this.system.shouldExtractItem(item)) continue;
            actions.push(new Action({
                id: item.id,
                name: item.name,
                img: item.img,
                type: item.type,
                originalItem: item,
                roll: (event) => item.use?.({}, { event }) ?? item.roll?.({ event })
            }));
        }
        return actions;
    }

    /* -------------------------------------------- */
    /*  System Layer Delegates                      */
    /* -------------------------------------------- */

    openEditSheet(action) {
        return this.system?.openEditSheet?.(action);
    }

    getContextMenuItems(app) {
        return this.system?.getContextMenuItems?.(app) ?? [];
    }

    isExclusionTab(parentId) {
        return this.system?.isExclusionTab?.(parentId) ?? false;
    }

    onTabRightClick(app, tab, event) {
        return this.system?.onTabRightClick?.(app, tab, event) ?? false;
    }

    getItemTypeLabel(id) {
        return this.system?.getItemTypeLabel?.(id) ?? id;
    }

    getItemTypeIcon(id) {
        return this.system?.getItemTypeIcon?.(id) ?? '';
    }

    getItemTypeSortOrder(id) {
        return this.system?.getItemTypeSortOrder?.(id) ?? 999;
    }

    getItemSubTabLabel(parentId, subId) {
        return this.system?.getItemSubTabLabel?.(parentId, subId) ?? subId;
    }

    getItemSubTabSortOrder(parentId, subId) {
        return this.system?.getItemSubTabSortOrder?.(parentId, subId) ?? 999;
    }

    getActionTypeLabel(id) {
        return this.system?.getActionTypeLabel?.(id) ?? id;
    }

    getActionTypeIcon(id) {
        return this.system?.getActionTypeIcon?.(id) ?? '';
    }

    getActionTypeSortOrder(id) {
        return this.system?.getActionTypeSortOrder?.(id) ?? 999;
    }

    getActionSubTabLabel(subId) {
        return this.system?.getActionSubTabLabel?.(subId) ?? subId;
    }

    getActionSubTabSortOrder(subId) {
        return this.system?.getActionSubTabSortOrder?.(subId) ?? 999;
    }

    getDefaultActiveLeftSubTypes() {
        return this.system?.getDefaultActiveLeftSubTypes?.() ?? [];
    }

    getDefaultActiveSubTypes() {
        return this.system?.getDefaultActiveSubTypes?.() ?? [];
    }

    filterSubactions(actor, subactions, leftTab, rightTab) {
        return this.system?.filterSubactions?.(actor, subactions, leftTab, rightTab) ?? subactions;
    }

    matchesEconomyTabs(action, filterContext) {
        return typeof this.system?.matchesEconomyTabs === 'function'
            ? this.system.matchesEconomyTabs(action, filterContext)
            : true;
    }

    modifyContext(context, options) {
        return this.system?.modifyContext?.(context, options);
    }

    getDefaultCategories() {
        if (typeof this.system?.getDefaultCategories === 'function') {
            return this.system.getDefaultCategories();
        }
        return null;
    }
}

export const adapter = new Adapter();
export { Adapter, BaseFoundryAdapter, BaseSystemAdapter, BaseModuleAdapter };
