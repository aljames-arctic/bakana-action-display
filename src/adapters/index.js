import { initializeFoundryAdapter, BaseFoundryAdapter, FoundryCurrentAdapter } from './foundry/index.js';
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
        this.system = await initializeSystemAdapter(game.system?.id, this.foundry);
        this.modules = initializeModuleAdapters();
        this._initialized = true;
        const systemLabel = this.system.isSupported ? this.system.systemId : `${this.system.systemId} (unsupported)`;
        log.info(`Unified Adapter initialized [Foundry: v${this.foundry.generation}, System: ${systemLabel}, Modules: ${this.modules.size}]`);
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
                actions = await this.system.modifyActions(actions, actor);
            } catch (error) {
                log.error(`Error in system adapter "${this.system.systemId}":`, error);
            }
        }

        // 3. Module Transformations
        for (const [moduleId, modAdapter] of this.modules.entries()) {
            try {
                actions = await modAdapter.modifyActions(actions);
            } catch (error) {
                log.error(`Error in module adapter "${moduleId}":`, error);
            }
        }

        // 4. Hidden items filtering
        const rawHidden = actor.getFlag?.(MODULE_ID, 'hiddenItems');
        const hiddenMap = Array.isArray(rawHidden)
            ? rawHidden.reduce((acc, id) => { acc[id] = true; return acc; }, {})
            : (rawHidden ?? {});
        const filtered = [];

        for (const action of actions) {
            if (action.hidden) {
                log.debug(`Adapter.getActions | Skipping "${action.name}" (ID: ${action.id}) — action.hidden === true`);
                continue;
            }

            const itemId = action.originalItem?.id ?? action.id;
            if (Boolean(hiddenMap[itemId])) {
                log.debug(`Adapter.getActions | Marking "${action.name}" (ID: ${itemId}) as hidden — item is in actor's hiddenItems flag map`);
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

        const items = Array.from(actor.items.values());
        for (const item of items) {
            if (!item?.name) {
                log.debug(`Adapter._extractBaseActions | Skipping item (ID: ${item?.id}) — item.name is missing or falsy`);
                continue;
            }
            if (this.system && !this.system.shouldExtractItem(item)) {
                continue;
            }
            actions.push(new Action({
                id: item.id,
                name: item.name,
                img: item.img,
                type: item.type,
                originalItem: item,
                left: item.type ? [item.type] : ['other'],
                roll: (event) => item.use?.({}, { event }) ?? item.roll?.({ event }) ?? item.sheet?.render(true)
            }));
        }
        return actions;
    }

    /* -------------------------------------------- */
    /*  System Layer Delegates                      */
    /* -------------------------------------------- */

    /**
     * Open the sheet for an item or activity.
     * @param {Object} action
     * @returns {void}
     */
    openEditSheet(action) {
        return this.system?.openEditSheet?.(action);
    }

    /**
     * Retrieve system-specific context menu items.
     * @param {ApplicationV2} app Active HUD application
     * @returns {Object[]}
     */
    getContextMenuItems(app) {
        return this.system?.getContextMenuItems?.(app) ?? [];
    }

    /**
     * Check if a parent tab acts as an exclusion filter.
     * @param {string} parentId
     * @returns {boolean}
     */
    isExclusionTab(parentId) {
        return this.system?.isExclusionTab?.(parentId) ?? false;
    }

    /**
     * Delegate tab right-click handling to the system adapter.
     * @param {ApplicationV2} app
     * @param {HTMLElement} tab
     * @param {Event} event
     * @returns {boolean}
     */
    onTabRightClick(app, tab, event) {
        return this.system?.onTabRightClick?.(app, tab, event) ?? false;
    }

    /**
     * Get the localized label for a left-side parent item tab.
     * @param {string} id
     * @returns {string}
     */
    getItemTypeLabel(id) {
        return this.system?.getItemTypeLabel?.(id) ?? id;
    }

    /**
     * Get the CSS icon class for a left-side parent item tab.
     * @param {string} id
     * @returns {string}
     */
    getItemTypeIcon(id) {
        return this.system?.getItemTypeIcon?.(id) ?? '';
    }

    /**
     * Get the sort priority order for a left-side parent item tab.
     * @param {string} id
     * @returns {number}
     */
    getItemTypeSortOrder(id) {
        return this.system?.getItemTypeSortOrder?.(id) ?? 999;
    }

    /**
     * Get the localized label for a left-side item sub-tab.
     * @param {string} parentId
     * @param {string} subId
     * @returns {string}
     */
    getItemSubTabLabel(parentId, subId) {
        return this.system?.getItemSubTabLabel?.(parentId, subId) ?? subId;
    }

    /**
     * Get the sort priority order for a left-side item sub-tab.
     * @param {string} parentId
     * @param {string} subId
     * @returns {number}
     */
    getItemSubTabSortOrder(parentId, subId) {
        return this.system?.getItemSubTabSortOrder?.(parentId, subId) ?? 999;
    }

    /**
     * Get the localized label for a right-side action parent tab.
     * @param {string} id
     * @returns {string}
     */
    getActionTypeLabel(id) {
        return this.system?.getActionTypeLabel?.(id) ?? id;
    }

    /**
     * Get the CSS icon class for a right-side action parent tab.
     * @param {string} id
     * @returns {string}
     */
    getActionTypeIcon(id) {
        return this.system?.getActionTypeIcon?.(id) ?? '';
    }

    /**
     * Get the sort priority order for a right-side action parent tab.
     * @param {string} id
     * @returns {number}
     */
    getActionTypeSortOrder(id) {
        return this.system?.getActionTypeSortOrder?.(id) ?? 999;
    }

    /**
     * Get the localized label for a right-side action sub-tab.
     * @param {string} subId
     * @returns {string}
     */
    getActionSubTabLabel(subId) {
        return this.system?.getActionSubTabLabel?.(subId) ?? subId;
    }

    /**
     * Get the sort priority order for a right-side action sub-tab.
     * @param {string} parentId
     * @param {string} subId
     * @returns {number}
     */
    getActionSubTabSortOrder(parentId, subId) {
        return this.system?.getActionSubTabSortOrder?.(parentId, subId) ?? 999;
    }

    /**
     * Get default active left-side sub-tab IDs for initial HUD column state.
     * @returns {string[]}
     */
    getDefaultActiveLeftSubTypes() {
        return this.system?.getDefaultActiveLeftSubTypes?.() ?? [];
    }

    /**
     * Get default active right-side sub-tab IDs for initial HUD column state.
     * @returns {string[]}
     */
    getDefaultActiveSubTypes() {
        return this.system?.getDefaultActiveSubTypes?.() ?? [];
    }

    /**
     * Filter subactions through the system adapter.
     * @param {Actor} actor
     * @param {Object[]} subactions
     * @param {string[]} leftTab
     * @param {string[]} rightTab
     * @returns {Object[]}
     */
    filterSubactions(actor, subactions, leftTab, rightTab) {
        return this.system?.filterSubactions?.(actor, subactions, leftTab, rightTab) ?? subactions;
    }

    /**
     * Evaluate if an action matches active right-side economy/action tabs.
     * @param {Object} action
     * @param {Object} filterContext
     * @returns {boolean}
     */
    matchesEconomyTabs(action, filterContext) {
        return this.system?.matchesEconomyTabs(action, filterContext) ?? true;
    }

    /**
     * Allow system adapter to modify Handlebars context before rendering.
     * @param {Object} context
     * @param {Object} options
     * @returns {void}
     */
    modifyContext(context, options) {
        return this.system?.modifyContext?.(context, options);
    }

    /**
     * Get system-specific default preset categories.
     * @returns {Object[]|null}
     */
    getDefaultCategories() {
        return this.system?.getDefaultCategories?.() ?? null;
    }

    /**
     * Get system-specific configurable action economy types and default colors.
     * @returns {{ id: string, label: string, defaultColor: string }[]}
     */
    getEconomyTypes() {
        return this.system?.getEconomyTypes?.() ?? [];
    }

    /**
     * Determine if an economy type is enabled.
     * @param {Object} type
     * @param {Record<string, any>} [userColors]
     * @returns {boolean}
     */
    isEconomyTypeEnabled(type, userColors) {
        return this.system?.isEconomyTypeEnabled?.(type, userColors) ?? false;
    }

    /**
     * Get mapped color for an economy type.
     * @param {string} type
     * @param {Record<string, any>} [userColors]
     * @returns {string|null}
     */
    getEconomyColor(type, userColors) {
        return this.system?.getEconomyColor?.(type, userColors) ?? null;
    }

    /**
     * Extract economy indicators for a given action.
     * @param {Object} action
     * @param {Record<string, any>} [userColors]
     * @returns {{ type: string, label: string, active: boolean, color: string|null }[]}
     */
    extractEconomyIndicators(action, userColors) {
        return this.system?.extractEconomyIndicators?.(action, userColors) ?? [];
    }

    /**
     * Get item summary data for rich tooltips.
     * @param {Object} action
     * @param {Object} [item]
     * @param {Object} [actor]
     * @returns {Promise<Object|null>}
     */
    async getItemSummary(action, item, actor) {
        return this.system?.getItemSummary?.(action, item, actor) ?? null;
    }

    /**
     * Enrich an HTML string with Foundry enrichers, roll data, and document links.
     * @param {string} content HTML string to enrich
     * @param {Object} [options={}] Enrichment options (rollData, secrets, relativeTo, etc.)
     * @returns {Promise<string>}
     */
    async enrichHTML(content, options = {}) {
        return this.foundry?.enrichHTML?.(content, options) ?? content;
    }

    /**
     * Safely resolve a document from UUID synchronously via the active Foundry adapter.
     * @param {string} uuid Document UUID
     * @param {Object} [options={}] Resolution options
     * @returns {Document|null}
     */
    fromUuidSync(uuid, options = {}) {
        return this.foundry?.fromUuidSync?.(uuid, options) ?? null;
    }

    /**
     * Safely resolve a document from UUID asynchronously via the active Foundry adapter.
     * @param {string} uuid Document UUID
     * @param {Object} [options={}] Resolution options
     * @returns {Promise<Document|null>}
     */
    async fromUuid(uuid, options = {}) {
        return (await this.foundry?.fromUuid?.(uuid, options)) ?? null;
    }
}

export const adapter = new Adapter();
export { Adapter, BaseFoundryAdapter, FoundryCurrentAdapter, BaseSystemAdapter, BaseModuleAdapter };
