import { MODULE_ID } from '../../constants.js';
import { BaseSystemContextMenuManager } from './context-menu/base-system-context-menu-manager.js';
import { BaseSystemTabFilterManager } from './filter/base-system-tab-filter-manager.js';
import { BaseSystemContextModifier } from './context-modifier/base-system-context-modifier.js';

/**
 * Base class for all system-specific adapters.
 * System adapters are responsible for modifying, filtering, and sorting
 * the base list of usable items extracted by the core.
 * They also define the localization labels and icons for the HUD tabs.
 */
export class BaseSystemAdapter {
    constructor(systemId) {
        this.systemId = systemId;
        this.contextMenuManager = new BaseSystemContextMenuManager(this);
        this.filterManager = new BaseSystemTabFilterManager(this);
        this.contextModifier = new BaseSystemContextModifier(this);
    }

    getContextMenuItems(app) {
        return this.contextMenuManager.getContextMenuItems(app);
    }

    onTabRightClick(app, el, event) {
        return this.contextMenuManager.onTabRightClick(app, el, event);
    }

    // #region User Interaction Events & Helpers

    /**
     * Create a proxy around a browser event to inject keyboard modifiers (Alt/Ctrl/Shift)
     * while preserving all other native event properties and methods (like target, preventDefault).
     * @param {Event} event The original browser event
     * @returns {Event|object} A proxy event or empty object
     * @protected
     */
    _createRollEvent(event) {
        if (!event) return {};

        const KeyboardManagerClass = foundry?.helpers?.interaction?.KeyboardManager ?? (typeof KeyboardManager !== 'undefined' ? KeyboardManager : null);
        const modifierKeys = {
            altKey: KeyboardManagerClass?.MODIFIER_KEYS?.ALT ?? 'Alt',
            ctrlKey: KeyboardManagerClass?.MODIFIER_KEYS?.CONTROL ?? 'Control',
            shiftKey: KeyboardManagerClass?.MODIFIER_KEYS?.SHIFT ?? 'Shift'
        };

        return new Proxy(event, {
            get: (target, prop) => {
                if (prop in modifierKeys) {
                    const modifier = modifierKeys[prop];
                    return Boolean(event[prop] || game.keyboard?.isModifierActive(modifier));
                }
                const val = Reflect.get(target, prop);
                return typeof val === 'function' ? val.bind(target) : val;
            }
        });
    }

    // #endregion

    // #region Core Action Modification

    /**
     * Determine if a specific item should be extracted as a base action.
     * Overridden by system adapters to prevent allocating objects for items that will be discarded.
     * @param {Item} item The Foundry Item instance
     * @returns {boolean} True if the item should be extracted
     */
    shouldExtractItem(item) {
        return true;
    }

    /**
     * Check if an action's uses resource is completely depleted.
     * @param {Object} action The action or subaction item
     * @returns {boolean} True if available uses is 0 or less
     * @protected
     */
    _isResourceDepleted(action) {
        return this.filterManager.isResourceDepleted(action);
    }

    /**
     * Modify the base list of actions.
     * @param {Object[]} actions Base actions extracted by the core
     * @param {Actor} actor The actor these actions belong to
     * @returns {Object[]} The modified/filtered/sorted actions list
     */
    async modifyActions(actions, actor) {
        if (!game.settings.get(MODULE_ID, 'filterNoResources')) return actions;

        return actions.filter(action => {
            // Never hide weapons, even if they are out of ammo or charges
            if (action.originalItem?.type === 'weapon') return true;
            return !this._isResourceDepleted(action);
        });
    }

    extractCheckActions(actor) {
        return [];
    }

    /**
     * Open the sheet or edit dialog for an action or its underlying item/activity.
     * @param {Object} action The Action instance to edit
     */
    openEditSheet(action) {
        const entity = action?.originalActivity ?? action?.originalItem;
        if (typeof entity?.sheet?.render === "function") {
            entity.sheet.render(true);
        } else if (typeof entity?.edit === "function") {
            entity.edit();
        } else if (typeof action?.originalItem?.sheet?.render === "function") {
            action.originalItem.sheet.render(true);
        }
    }

    /**
     * Apply a flat layout template to the HUD context.
     * @param {Object} context The Handlebars render context
     */
    formatFlatLayout(context) {
        context.layout = 'flat';
    }

    /**
     * Apply a split section layout template (two sections separated by a line bar) to the HUD context.
     * @param {Object} context The Handlebars render context
     * @param {Object} [options]
     * @param {Function} [options.topFilter] Filter function for top section items
     * @param {Function} [options.bottomFilter] Filter function for bottom section items
     * @param {boolean} [options.sort=true] Whether to sort each section alphabetically
     */
    formatSplitLayout(context, { topFilter = a => a.section === 'core', bottomFilter = a => a.section === 'other', sort = true } = {}) {
        context.layout = 'split';
        const items = context.items ?? [];
        const coreItems = items.filter(topFilter);
        const otherItems = items.filter(bottomFilter);
        if (sort) {
            coreItems.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
            otherItems.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
        }
        context.coreItems = coreItems;
        context.otherItems = otherItems;
        context.showSeparator = coreItems.length > 0 && otherItems.length > 0;
    }

    // #endregion

    // #region Internal Filtering Logic

    /**
     * Set-algebraic filter tree evaluator.
     * Evaluates an Action instance against active UI filter groups using parent tab combinators:
     * - 'difference' (AND NOT): If action matches any active difference sub-tab, return false.
     * - 'union' (OR): Action must match at least one active union parent group.
     * - 'intersection' (AND): Action must match all active intersection sub-tabs.
     * 
     * @param {Action} action Action instance to evaluate
     * @param {Object} filterContext Current HUD filter context { left, right, filterNoResources }
     * @returns {boolean} True if the action matches current filter selection
     */
    matchesEconomyTabs(action, filterContext) {
        return this.filterManager.matchesEconomyTabs(action, filterContext);
    }

    getActiveExclusionSubs(filterContext) {
        return this.filterManager.getActiveExclusionSubs(filterContext);
    }

    filterSubactions(subactions, filterContext) {
        return this.filterManager.filterSubactions(subactions, filterContext);
    }

    getTabCombinator(parentId) {
        return this.filterManager.getTabCombinator(parentId);
    }

    isExclusionTab(parentId) {
        return this.filterManager.isExclusionTab(parentId);
    }

    isIntersectionTab(parentId) {
        return this.filterManager.isIntersectionTab(parentId);
    }

    // #endregion

    // #region Localizations & UI Formatting

    /**
     * Modify the UI context object before template rendering.
     * Overridable by system adapters to choose layout templates (flat, split, etc.).
     * @param {Object} context The Handlebars render context
     * @param {ActionDisplayApp} app The UI application instance
     * @returns {Object} The modified context
     */
    modifyContext(context, app) {
        this.formatFlatLayout(context);
        return this.contextModifier.modifyContext(context, app) ?? context;
    }

    getItemTypeSortOrder(parentId) {
        return this.contextModifier.getItemTypeSortOrder(parentId);
    }

    getItemSubTabSortOrder(parentId, subId) {
        return this.contextModifier.getItemSubTabSortOrder(parentId, subId);
    }

    getActionTypeSortOrder(parentId) {
        return this.contextModifier.getActionTypeSortOrder(parentId);
    }

    getActionSubTabSortOrder(parentId, subId) {
        return this.contextModifier.getActionSubTabSortOrder(parentId, subId);
    }

    getItemTypeLabel(parentId) {
        return this.contextModifier.getItemTypeLabel(parentId);
    }

    getItemTypeIcon(parentId) {
        return this.contextModifier.getItemTypeIcon(parentId);
    }

    getItemSubTabLabel(parentId, subId) {
        return this.contextModifier.getItemSubTabLabel(parentId, subId);
    }

    getActionTypeLabel(parentId) {
        return this.contextModifier.getActionTypeLabel(parentId);
    }

    getActionTypeIcon(parentId) {
        return this.contextModifier.getActionTypeIcon(parentId);
    }

    getActionSubTabLabel(subId) {
        return this.contextModifier.getActionSubTabLabel(subId);
    }

    getDefaultActiveLeftSubTypes() {
        return [];
    }

    getDefaultActiveSubTypes() {
        return [];
    }

    /**
     * Get the default HUD categorization structure for this system.
     * @returns {Object[]} Array of category definition objects
     */
    getDefaultCategories() {
        return [
            {
                id: 'cat_favorites',
                name: 'Favorites',
                expression: `actor.getFlag('bakana-action-display', 'favorites')?.[item.id]`,
                subcategories: []
            },
            {
                id: 'cat_weapons',
                name: 'Weapons',
                expression: `item.type === 'weapon'`,
                subcategories: []
            },
            {
                id: 'cat_spells',
                name: 'Spells',
                expression: `item.type === 'spell'`,
                subcategories: []
            },
            {
                id: 'cat_features',
                name: 'Features',
                expression: `item.type === 'feat'`,
                subcategories: []
            }
        ];
    }

    // #endregion

    // #region Favorites Integration

    /**
     * Whether this system adapter supports native favoriting.
     * @returns {boolean}
     */
    hasFavorites() {
        return false;
    }

    /**
     * Check if an item is favorited on the actor using system-specific logic.
     *
     * @param {Object} actor Actor document
     * @param {Item} item Item document
     * @returns {boolean} True if the item is favorited
     */
    isFavorite(actor, item) {
        return false;
    }

    /**
     * Set or unset favorite status on an item in a system-specific manner.
     *
     * @param {Object} actor Actor document
     * @param {Item} item Item document
     * @param {boolean} favorite True to favorite, false to unfavorite
     * @returns {Promise<any>|null} Result of update or null if unsupported
     */
    async setFavorite(actor, item, favorite) {
        return null;
    }

    // #endregion
}
