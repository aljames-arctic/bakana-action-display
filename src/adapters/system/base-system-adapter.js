import { localize, toSet } from '../../lib/utils.js';
import { MODULE_ID } from '../../constants.js';
import { KeyboardManager } from '../../lib/compat.js';

const ITEM_TYPE_ICONS = {
    'all': 'fas fa-border-all',
    'other': 'fas fa-ellipsis',
    'hidden': 'fas fa-eye-slash'
};

const ACTION_TYPE_ICONS = {
    'all': 'fas fa-border-all',
    'none': 'fas fa-ban'
};

const ITEM_TYPE_SORT_ORDER = {
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
};

const ACTION_TYPE_SORT_ORDER = {
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
};

/**
 * Base class for all system-specific adapters.
 * System adapters are responsible for modifying, filtering, and sorting
 * the base list of usable items extracted by the core.
 * They also define the localization labels and icons for the HUD tabs.
 */
export class BaseSystemAdapter {
    constructor(systemId) {
        this.systemId = systemId;
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
        return action.uses?.available != null && action.uses.available <= 0;
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
        if (!action) return false;
        const rightContext = filterContext?.right ?? {};
        const activeParents = rightContext.activeParents ?? new Set();
        const activeSubs = rightContext.activeSubTypes ?? new Set();
        const parentGroups = rightContext.groups;

        // If an Action instance with subactions is passed, card passes if at least one subaction qualifies
        if (action.subactions?.length > 0) {
            const qualifyingSubactions = this.filterSubactions(action.subactions, filterContext);
            return qualifyingSubactions.length > 0;
        }

        const tabs = action.tabs;
        if (!tabs || tabs.length === 0) return false;

        // 1. Evaluate DIFFERENCE (exclusion) parent groups first
        for (const parentId of activeParents) {
            if (this.getTabCombinator(parentId) === 'difference') {
                const group = parentGroups?.[parentId];
                const validSubIds = toSet(group?.subTabs, t => t.id);

                const hasExcludedTab = tabs.some(
                    tab => tab.root === parentId && activeSubs.has(tab.label) && validSubIds.has(tab.label)
                );
                if (hasExcludedTab) return false;
            }
        }

        // 2. Evaluate UNION / INTERSECTION (category) parent groups
        const showAllCategory = activeParents.has('all') ||
            Array.from(activeParents).every(p => p === 'all' || this.getTabCombinator(p) === 'difference');

        if (showAllCategory) return true;

        return tabs.some(tab => {
            const actionParentId = tab.root;
            if (!activeParents.has(actionParentId)) return false;

            const combinator = this.getTabCombinator(actionParentId);
            if (combinator === 'difference') return false;

            const parentGroup = parentGroups?.[actionParentId];
            const validSubIds = toSet(parentGroup?.subTabs, t => t.id);
            const activeSubsForParent = Array.from(activeSubs).filter(id => validSubIds.has(id));

            // If no sub-tabs are active under this parent, matching the parent tab matches all its items
            if (activeSubsForParent.length === 0) return true;

            // Intersection (AND): item must match every active sub-tab for this parent
            if (combinator === 'intersection') {
                return activeSubsForParent.every(subId =>
                    tabs.some(t => t.root === actionParentId && t.label === subId)
                );
            }

            // Union (OR): item matches if its sub-tab is currently active
            const actionSubId = tab.parent ? tab.label : undefined;
            return activeSubs.has(actionSubId);
        });
    }

    /**
     * Helper to get active sub-type IDs under exclusion tabs (e.g. banned spell components).
     * @param {Object} filterContext Current HUD filter context { left, right, filterNoResources }
     * @returns {string[]} Array of active exclusion sub-type IDs
     */
    getActiveExclusionSubs(filterContext) {
        const rightContext = filterContext?.right ?? {};
        const activeParents = rightContext.activeParents ?? new Set();
        const activeSubs = rightContext.activeSubTypes ?? new Set();
        const parentGroups = rightContext.groups;
        const activeExclusionSubs = [];

        for (const parentId of activeParents) {
            if (!this.isExclusionTab(parentId)) continue;

            const group = parentGroups?.[parentId];
            const validSubIds = toSet(group?.subTabs, t => t.id);
            for (const subId of activeSubs) {
                if (validSubIds.size === 0 || validSubIds.has(subId)) {
                    activeExclusionSubs.push(subId);
                }
            }
        }

        return activeExclusionSubs;
    }

    /**
     * Filter a list of sub-actions (activities) for a dropdown menu based on current UI filter state.
     * @param {Action[]} subactions The array of child Action instances
     * @param {Object} filterContext Current HUD filter context { left, right, filterNoResources }
     * @returns {Action[]} Qualifying sub-actions to show in the dropdown menu
     */
    filterSubactions(subactions, filterContext) {
        if (!subactions?.length) return [];
        const { filterNoResources } = filterContext;

        return subactions.filter(sub => {
            if (!this.matchesEconomyTabs(sub, filterContext)) return false;
            if (filterNoResources && this._isResourceDepleted(sub)) return false;
            return true;
        });
    }

    /**
     * Get the set-algebraic combinator operator for a parent tab group.
     * Options:
     * - 'union': Action matches if it has ANY of the active sub-tabs (default OR behavior).
     * - 'intersection': Action matches if it has ALL of the active sub-tabs (AND behavior).
     * - 'difference': Action matches if it has NONE of the active sub-tabs (AND NOT / Exclusion behavior).
     * @param {string} parentId
     * @returns {string} 'union'|'intersection'|'difference'
     */
    getTabCombinator(parentId) {
        return 'union';
    }

    /**
     * Determine if a parent tab acts as an exclusion/modifier filter (e.g. 'components').
     * Exclusion tabs operate alongside standard category tabs and should not clear default 'all' category selection.
     * @param {string} parentId
     * @returns {boolean}
     */
    isExclusionTab(parentId) {
        return this.getTabCombinator(parentId) === 'difference';
    }

    // #endregion

    // #region Localizations & UI Formatting

    /**
     * Get the localized label for a left-side item type (parent tab).
     * @param {string} parentId 
     * @returns {string}
     */
    getItemTypeLabel(parentId) {
        switch (parentId) {
            case 'all': return localize('BAD.core.allItems', 'All Items');
            case 'other': return localize('BAD.core.other', 'Other');
            case 'hidden': return localize('BAD.core.hidden', 'Hidden');
            default: return parentId.toUpperCase();
        }
    }

    /**
     * Get the CSS icon class for a left-side item type (parent tab).
     * @param {string} parentId 
     * @returns {string}
     */
    getItemTypeIcon(parentId) {
        return ITEM_TYPE_ICONS[parentId] ?? 'fas fa-question';
    }

    /**
     * Get the localized label for a left-side item sub-tab.
     * @param {string} parentId The parent tab ID (e.g. 'spell', 'weapon')
     * @param {string} subId The sub-tab ID (e.g. '0', 'melee')
     * @returns {string}
     */
    getItemSubTabLabel(parentId, subId) {
        return subId.toUpperCase();
    }

    /**
     * Get the localized label for a right-side action type (parent tab).
     * @param {string} parentId 
     * @returns {string}
     */
    getActionTypeLabel(parentId) {
        switch (parentId) {
            case 'all': return localize('BAD.core.allActions', 'All Actions');
            case 'none': return localize('BAD.core.none', 'None');
            default: return parentId.toUpperCase();
        }
    }

    /**
     * Get the CSS icon class for a right-side action type (parent tab).
     * @param {string} parentId 
     * @returns {string}
     */
    getActionTypeIcon(parentId) {
        return ACTION_TYPE_ICONS[parentId] ?? 'fas fa-question';
    }

    /**
     * Get the localized label for a right-side action sub-tab.
     * @param {string} subId 
     * @returns {string}
     */
    getActionSubTabLabel(subId) {
        return subId.toUpperCase();
    }

    /**
     * Get system-specific context menu items for action items.
     * @param {ApplicationV2} app The ActionDisplayApp instance
     * @returns {Object[]} An array of context menu item configurations
     */
    getContextMenuItems(app) {
        return [];
    }

    /**
     * Modify the template context before rendering.
     * @param {Object} context The template context
     * @param {ApplicationV2} app The ActionDisplayApp instance
     */
    modifyContext(context, app) {
        // Default implementation does nothing
    }

    /**
     * Get the default active left sub-tabs for this system.
     * @returns {string[]}
     */
    getDefaultActiveLeftSubTypes() {
        return [];
    }

    /**
     * Get the default active sub-tabs (right side) for this system.
     * @returns {string[]}
     */
    getDefaultActiveSubTypes() {
        return [];
    }

    /**
     * Get the sort index for a left-side item parent tab.
     * @param {string} parentId 
     * @returns {number}
     */
    getItemTypeSortOrder(parentId) {
        return ITEM_TYPE_SORT_ORDER[parentId] ?? 999;
    }

    /**
     * Get the sort index for a left-side item sub-tab.
     * @param {string} parentId 
     * @param {string} subId 
     * @returns {number}
     */
    getItemSubTabSortOrder(parentId, subId) {
        if (subId === 'all') return 0;
        if (subId === 'itemCharges') return 99;
        const num = Number.parseInt(subId, 10);
        return Number.isNaN(num) ? 999 : num + 1;
    }

    /**
     * Get the sort index for a right-side action parent tab.
     * @param {string} parentId 
     * @returns {number}
     */
    getActionTypeSortOrder(parentId) {
        return ACTION_TYPE_SORT_ORDER[parentId] ?? 999;
    }

    /**
     * Get the sort index for a right-side action sub-tab.
     * @param {string} parentId 
     * @param {string} subId 
     * @returns {number}
     */
    getActionSubTabSortOrder(parentId, subId) {
        if (subId === 'all') return 0;
        return 999;
    }

    /**
     * Handle right-click on a tab.
     * @param {ApplicationV2} app The ActionDisplayApp instance
     * @param {HTMLElement} el The tab element that was right-clicked
     * @param {Event} event The event
     * @returns {boolean} True if the event was handled and default behavior should be prevented
     */
    onTabRightClick(app, el, event) {
        return false;
    }

    // #endregion
}
