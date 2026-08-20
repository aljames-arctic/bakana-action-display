import { log } from '../lib/logger.js';
import { toSet } from '../lib/utils.js';

/**
 * Encapsulates tab column state management and interaction rules for a single HUD column (left or right).
 * Handles parent focus, multi-select toggles, sub-tab isolation/toggling, and system default resets.
 */
export class HUDTabColumn {
    /**
     * @param {Object} options
     * @param {'left'|'right'} options.side Left or right side column identifier
     * @param {Object} [options.cached] Persisted tab state from cache
     * @param {Function} [options.getDefaultSubTypes] Function returning default active sub-types from system adapter
     */
    constructor({ side, cached, defaultParent = 'all', getDefaultSubTypes = () => [] } = {}) {
        this.side = side;
        this.defaultParent = defaultParent;
        this.getDefaultSubTypes = getDefaultSubTypes;

        const initialParents = cached?.parents ?? [defaultParent];
        this.activeParents = new Set(initialParents);

        this.focusedParent = cached?.focusedParent ?? (initialParents.includes(defaultParent) ? defaultParent : initialParents[0]);

        const initialSubs = cached?.subTypes ?? [];
        this.activeSubTypes = new Set(initialSubs);

        // Populate adapter defaults if fresh initialization
        if (!cached) {
            const defaults = this.getDefaultSubTypes();
            for (const sub of defaults) {
                this.activeSubTypes.add(sub);
            }
        }
    }

    /**
     * Reset parent tabs and sub-tabs on this column to default state ('all' and default sub-types).
     */
    resetToDefault() {
        this.focusedParent = this.defaultParent;
        this.activeParents.clear();
        this.activeParents.add(this.defaultParent);
        this.activeSubTypes.clear();
        const defaults = this.getDefaultSubTypes();
        for (const sub of defaults) {
            this.activeSubTypes.add(sub);
        }
    }

    /**
     * Handle left-click selection of a parent tab.
     * Rules:
     * - Left-clicking 'all' resets column to default.
     * - Left-clicking a tab deselects other parent tabs and clears their subtabs (exclusive selection).
     * - Left-clicking the sole active parent tab with NO active subtabs disables it and resets column to default.
     * - Left-clicking the sole active parent tab WITH active subtabs keeps it active and focuses it.
     * @param {string} parentId The parent tab ID
     * @param {Object} groups Available tab groups
     */
    selectParent(parentId, groups) {
        if (parentId === 'all') {
            this.resetToDefault();
            return;
        }

        const group = groups?.[parentId];
        const validSubIds = toSet(group?.subTabs, t => t.id);
        const hasActiveSubs = Array.from(this.activeSubTypes).some(id => validSubIds.has(id));

        const isSoleActive = this.activeParents.size === 1 && this.activeParents.has(parentId);

        if (!isSoleActive) {
            // Deselect other parent tabs and clear their sub-tabs
            this.activeParents.clear();
            this.activeParents.add(parentId);
            this.focusedParent = parentId;
            for (const subId of this.activeSubTypes) {
                if (!validSubIds.has(subId)) {
                    this.activeSubTypes.delete(subId);
                }
            }
        } else if (hasActiveSubs) {
            // Already sole active parent with active subtabs: change focus to it
            this.focusedParent = parentId;
        } else {
            // Already sole active parent with NO active subtabs: disable it and reset to default
            this.resetToDefault();
        }
    }

    /**
     * Handle right-click toggling of a parent tab (multi-select / clearing subtabs).
     * @param {string} parentId The parent tab ID
     * @param {Object} groups Available tab groups
     */
    toggleParent(parentId, groups) {
        if (parentId === 'all') {
            this.resetToDefault();
            return;
        }

        const group = groups?.[parentId];
        let hadActiveSubs = false;
        if (group) {
            const validSubIds = toSet(group.subTabs, t => t.id);
            for (const subId of this.activeSubTypes) {
                if (validSubIds.has(subId)) {
                    hadActiveSubs = true;
                    this.activeSubTypes.delete(subId);
                }
            }
        }

        if (hadActiveSubs) {
            this.activeParents.add(parentId);
            this.activeParents.delete('all');
            this.focusedParent = parentId;
        } else {
            if (this.activeParents.has(parentId)) {
                this.activeParents.delete(parentId);
            } else {
                this.activeParents.add(parentId);
                this.activeParents.delete('all');
                this.focusedParent = parentId;
            }
        }
        if (this.activeParents.size === 0) {
            this.resetToDefault();
            return;
        }
    }

    /**
     * Handle left-click selection of a sub-tab.
     * @param {string} parentId Parent group ID
     * @param {string} type Sub-tab ID
     * @param {Object} groups Available tab groups
     * @param {boolean} [isExclusion=false] Whether this parent tab is an exclusion filter
     */
    selectSub(parentId, type, groups, isExclusion = false) {
        if (parentId) {
            this.activeParents.add(parentId);
            if (!isExclusion) {
                this.activeParents.delete('all');
            }
            this.focusedParent = parentId;
        }

        if (type === 'all') {
            if (parentId && groups?.[parentId]) {
                const validSubIds = toSet(groups[parentId].subTabs, t => t.id);
                for (const subId of this.activeSubTypes) {
                    if (validSubIds.has(subId)) {
                        this.activeSubTypes.delete(subId);
                    }
                }
            } else {
                this.activeSubTypes.clear();
            }
        } else {
            if (parentId && groups?.[parentId]) {
                const validSubIds = toSet(groups[parentId].subTabs, t => t.id);
                const activeSubsForParent = Array.from(this.activeSubTypes).filter(id => validSubIds.has(id));

                if (activeSubsForParent.length > 1) {
                    for (const subId of activeSubsForParent) {
                        if (subId !== type) this.activeSubTypes.delete(subId);
                    }
                    this.activeSubTypes.add(type);
                } else if (activeSubsForParent.length === 1 && activeSubsForParent[0] === type) {
                    this.activeSubTypes.delete(type);
                } else {
                    for (const subId of activeSubsForParent) {
                        this.activeSubTypes.delete(subId);
                    }
                    this.activeSubTypes.add(type);
                }
            } else {
                if (this.activeSubTypes.has(type) && this.activeSubTypes.size === 1) {
                    this.activeSubTypes.clear();
                } else {
                    this.activeSubTypes.clear();
                    this.activeSubTypes.add(type);
                }
            }
        }
    }

    /**
     * Handle right-click toggling of a sub-tab (for multi-select).
     * @param {string} parentId Parent group ID
     * @param {string} type Sub-tab ID
     * @param {Object} groups Available tab groups
     * @param {boolean} [isExclusion=false] Whether this parent tab is an exclusion filter
     */
    toggleSub(parentId, type, groups, isExclusion = false) {
        if (parentId) {
            this.activeParents.add(parentId);
            if (!isExclusion) {
                this.activeParents.delete('all');
            }
            this.focusedParent = parentId;
        }

        if (type === 'all') {
            if (parentId && groups?.[parentId]) {
                const validSubIds = toSet(groups[parentId].subTabs, t => t.id);
                for (const subId of this.activeSubTypes) {
                    if (validSubIds.has(subId)) {
                        this.activeSubTypes.delete(subId);
                    }
                }
            } else {
                this.activeSubTypes.clear();
            }
        } else {
            if (this.activeSubTypes.has(type)) {
                this.activeSubTypes.delete(type);
            } else {
                this.activeSubTypes.add(type);
            }
        }
    }

    /**
     * Prune sub-types that are no longer available in any active parent.
     * @param {Object} groups Available tab groups
     * @param {Function} [isExclusionFn] Function returning true if a parentId is an exclusion filter
     */
    prune(groups, isExclusionFn = () => false) {
        const allAvailableSubs = new Set();
        for (const parentId in groups) {
            if (isExclusionFn(parentId) || this.activeParents.has(parentId)) {
                const group = groups[parentId];
                if (group && group.subTabs.length > 0) {
                    for (const sub of group.subTabs) {
                        allAvailableSubs.add(sub.id);
                    }
                }
            }
        }
        for (const activeSub of this.activeSubTypes) {
            if (activeSub !== 'all' && !allAvailableSubs.has(activeSub)) {
                this.activeSubTypes.delete(activeSub);
            }
        }
    }

    /**
     * Serialize tab state for caching per actor.
     * @returns {Object}
     */
    serialize() {
        return {
            parents: Array.from(this.activeParents),
            focusedParent: this.focusedParent,
            subTypes: Array.from(this.activeSubTypes)
        };
    }
}
