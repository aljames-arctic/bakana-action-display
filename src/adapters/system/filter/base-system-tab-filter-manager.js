import { toSet } from '../../../lib/utils.js';

/**
 * Manages tab filtering, set-algebraic combinators (union, intersection, difference),
 * and resource depletion checks for a system adapter.
 */
export class BaseSystemTabFilterManager {
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

    getTabCombinator(parentId) {
        return 'union';
    }

    isExclusionTab(parentId) {
        return this.getTabCombinator(parentId) === 'difference';
    }

    isIntersectionTab(parentId) {
        return this.getTabCombinator(parentId) === 'intersection';
    }

    /**
     * Set-algebraic filter tree evaluator.
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
            const validSubIds = toSet(group?.subTabs, t => t.id);

            const hasExcludedTab = right.some(
                tab => tab.root === parentId && activeSubs.has(tab.label) && validSubIds.has(tab.label)
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
            const validSubIds = toSet(parentGroup?.subTabs, t => t.id);
            const activeSubsForParent = Array.from(activeSubs).filter(id => validSubIds.has(id));

            if (activeSubsForParent.length === 0) return true;

            if (this.isIntersectionTab(actionParentId)) {
                return activeSubsForParent.every(subId =>
                    right.some(t => t.root === actionParentId && t.label === subId)
                );
            }

            const actionSubId = tab.parent ? tab.label : undefined;
            return activeSubs.has(actionSubId);
        });
    }

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
