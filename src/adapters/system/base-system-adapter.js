import { localize, toSet } from '../../lib/utils.js';
import { MODULE_ID } from '../../constants.js';
import { KeyboardManager } from '../../lib/compat.js';

const ICONS = {
    item_type: {
        'all': 'fas fa-border-all',
        'other': 'fas fa-ellipsis',
        'hidden': 'fas fa-eye-slash'
    },
    action_type: {
        'all': 'fas fa-border-all',
        'none': 'fas fa-ban'
    }
};

const SORT_ORDERS = {
    item_type: {
        'all': 0,
        'weapon': 1,
        'spell': 2,
        'feat': 3,
        'buff': 4,
        'equipment': 5,
        'consumable': 6,
        'tool': 7,
        'backpack': 8,
        'loot': 9,
        'other': 10,
        'hidden': 11
    },
    action_type: {
        'all': 0,
        'economy': 1,
        'components': 2,
        'standard': 3,
        'action': 4,
        'bonus': 5,
        'reaction': 6,
        'free': 7,
        'time': 8,
        'monster': 9,
        'vehicle': 10,
        'special': 11,
        'none': 12
    }
};

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

        const modifierKeys = {
            altKey: KeyboardManager.MODIFIER_KEYS.ALT,
            ctrlKey: KeyboardManager.MODIFIER_KEYS.CONTROL,
            shiftKey: KeyboardManager.MODIFIER_KEYS.SHIFT
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

    modifyContext(context, app) {
        return this.contextModifier.modifyContext(context, app);
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

    // #endregion
}
