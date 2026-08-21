import { toSet } from '../../../lib/utils.js';

/**
 * Manages tab filtering, set-algebraic combinators (union, intersection, difference),
 * and resource depletion checks for a system adapter.
 */
export class BaseSystemTabFilterManager {
    /**
     * @param {BaseSystemAdapter} adapter Owning system adapter instance
     */
    constructor(adapter) {
        this.adapter = adapter;
    }

    /**
     * Check if an action's uses resource is completely depleted.
     * @param {Object} action The action or subaction item
     * @returns {boolean} True if available uses is 0 or less
     */
    isResourceDepleted(action) {
        return action.uses?.available != null && action.uses.available <= 0;
    }

    /**
     * Determine the set combinator strategy for a right-side tab ('union' | 'intersection' | 'difference').
     * @param {string} parentId Parent tab ID
     * @returns {'union'|'intersection'|'difference'}
     */
    getTabCombinator(parentId) {
        return 'union';
    }

    /**
     * Check if a parent tab acts as an exclusion / difference filter.
     * @param {string} parentId Parent tab ID
     * @returns {boolean}
     */
    isExclusionTab(parentId) {
        return this.getTabCombinator(parentId) === 'difference';
    }

    /**
     * Check if a parent tab acts as an intersection / conjunction filter.
     * @param {string} parentId Parent tab ID
     * @returns {boolean}
     */
    isIntersectionTab(parentId) {
        return this.getTabCombinator(parentId) === 'intersection';
    }

    /**
     * Set-algebraic filter tree evaluator.
     * @param {Object} action Action card to evaluate
     * @param {Object} filterContext Active filter state
     * @returns {boolean} True if action matches active right-side tab filters
     */
    matchesEconomyTabs(action, filterContext) {
        if (!action) return false;
        const rightContext = filterContext?.right ?? {};
        const activeParents = rightContext.activeParents ?? new Set();
        const activeSubs = rightContext.activeSubTypes ?? new Set();
        const parentGroups = rightContext.groups;

        if (action.subactions?.length) {
            return this.filterSubactions(action.subactions, filterContext).length > 0;
        }

        const right = action.right;
        if (!right || right.length === 0) return false;

        // 1. Evaluate DIFFERENCE (exclusion) parent groups first
        for (const parentId of activeParents) {
            if (!this.isExclusionTab(parentId)) continue;

            const group = parentGroups?.[parentId];
            const validSubIds = group?.getAllSubTabIds ? group.getAllSubTabIds() : toSet(group?.subTabs, t => t.id);

            const hasExcludedTab = right.some(
                tab => tab.root === parentId && (activeSubs.has(tab.label) || (tab.parent && activeSubs.has(tab.parent.label))) && validSubIds.has(tab.label)
            );
            if (hasExcludedTab) return false;
        }

        // 2. Evaluate UNION / INTERSECTION (category) parent groups
        const showAllCategory = activeParents.has('all') ||
            Array.from(activeParents).every(p => p === 'all' || this.isExclusionTab(p));

        if (showAllCategory) return true;

        return right.some(tab => {
            const actionParentId = tab.root;
            if (!activeParents.has(actionParentId)) return false;
            if (this.isExclusionTab(actionParentId)) return false;

            const parentGroup = parentGroups?.[actionParentId];
            const validSubIds = parentGroup?.getAllSubTabIds ? parentGroup.getAllSubTabIds() : toSet(parentGroup?.subTabs, t => t.id);
            const activeSubsForParent = Array.from(activeSubs).filter(id => validSubIds.has(id));

            if (activeSubsForParent.length === 0) return true;

            if (this.isIntersectionTab(actionParentId)) {
                return activeSubsForParent.every(subId =>
                    right.some(t => {
                        if (t.root !== actionParentId) return false;
                        if (t.label === subId) return true;
                        let p = t.parent;
                        while (p && p.label !== actionParentId) {
                            if (p.label === subId) return true;
                            p = p.parent;
                        }
                        return false;
                    })
                );
            }

            return right.some(t => {
                if (t.root !== actionParentId) return false;
                if (activeSubs.has(t.label)) return true;
                let p = t.parent;
                while (p && p.label !== actionParentId) {
                    if (activeSubs.has(p.label)) return true;
                    p = p.parent;
                }
                return false;
            });
        });
    }

    /**
     * Collect currently active sub-tabs under difference / exclusion parent tabs.
     * @param {Object} filterContext Active filter state
     * @returns {string[]} Array of active exclusion sub-tab IDs
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
            const validSubIds = group?.getAllSubTabIds ? group.getAllSubTabIds() : toSet(group?.subTabs, t => t.id);

            if (validSubIds.size === 0) {
                activeExclusionSubs.push(...activeSubs);
            } else {
                for (const subId of activeSubs) {
                    if (validSubIds.has(subId)) activeExclusionSubs.push(subId);
                }
            }
        }

        return activeExclusionSubs;
    }

    /**
     * Filter subactions/activities based on active left/right tabs and resource availability.
     * @param {Object[]} subactions Array of subaction items
     * @param {Object} filterContext Active filter state
     * @returns {Object[]} Qualifying subactions
     */
    filterSubactions(subactions, filterContext) {
        if (!subactions?.length) return [];
        const { filterNoResources, left } = filterContext;

        return subactions.filter(sub => {
            if (left && sub.left?.length > 0) {
                const activeLeft = left.activeParents;
                if (activeLeft && !activeLeft.has('all')) {
                    if (!sub.left.some(type => activeLeft.has(type))) {
                        return false;
                    }
                }
            }
            return this.matchesEconomyTabs(sub, filterContext) &&
                (!filterNoResources || !this.isResourceDepleted(sub));
        });
    }
}
