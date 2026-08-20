import { BaseSystemTabFilterManager } from './base-system-tab-filter-manager.js';
import { TabRef } from '../../../ui/tab-ref.js';

/**
 * Check if a container (Set, Array, or Object map) contains a specific spell component identifier.
 * @param {Set|Array|Object} container
 * @param {string} component Component identifier (e.g. 'vocal', 'somatic', 'material')
 * @returns {boolean}
 */
function containerHasComponent(container, component) {
    if (!container) return false;
    const target = container.value ?? container;
    if (target instanceof Set) return target.has(component);
    if (Array.isArray(target)) return target.includes(component);
    if (typeof target === 'object') return Boolean(target[component]);
    return false;
}

/**
 * Check if a document or its system properties/components include a given spell component.
 * @param {Object} doc Item, activity, or spell document
 * @param {string} component Component identifier
 * @returns {boolean}
 */
function docHasComponent(doc, component) {
    if (!doc) return false;
    return containerHasComponent(doc, component) ||
           containerHasComponent(doc.system?.properties ?? doc.properties, component) ||
           containerHasComponent(doc.system?.components ?? doc.components, component);
}

/**
 * Tab filter manager for D&D 5th Edition.
 * Handles spell component exclusion logic (e.g. Silence, restrained).
 */
export class Dnd5eSystemTabFilterManager extends BaseSystemTabFilterManager {
    /**
     * @param {Dnd5eSystemAdapter} adapter Owning D&D 5e adapter instance
     */
    constructor(adapter) {
        super(adapter);
    }

    /**
     * Check if a spell, item, or activity requires a given verbal/somatic/material component.
     * @param {Object} sub Subaction, activity, or item object
     * @param {string} component Component identifier ('vocal'|'somatic'|'material')
     * @returns {boolean}
     */
    requiresComponent(sub, component) {
        if (!sub) return false;
        const rootDoc = this.adapter.resolveRootSpellDocument?.(sub) ?? null;
        const docsToCheck = [sub, sub.linkedAction, sub.originalActivity, sub.originalItem, rootDoc];
        return docsToCheck.some(doc => docHasComponent(doc, component));
    }

    /**
     * Build TabRef objects for each spell component required by a document.
     * @param {Object} doc Document or activity
     * @returns {TabRef[]}
     */
    getComponentTabs(doc) {
        return ['vocal', 'somatic', 'material']
            .filter(comp => this.requiresComponent(doc, comp))
            .map(comp => TabRef.from('components', comp));
    }

    /**
     * Get the set-combinator for right-side tabs ('difference' for components in D&D 5e).
     * @param {string} parentId Parent tab ID
     * @returns {'union'|'intersection'|'difference'}
     */
    getTabCombinator(parentId) {
        return parentId === 'components' ? 'difference' : super.getTabCombinator(parentId);
    }

    /**
     * Filter subactions taking D&D 5e spell component exclusions into account.
     * @param {Object[]} subactions Array of subactions
     * @param {Object} filterContext Active filter state
     * @returns {Object[]} Qualifying subactions
     */
    filterSubactions(subactions, filterContext) {
        const baseFiltered = super.filterSubactions(subactions, filterContext);
        const activeCompSubs = this.getActiveExclusionSubs(filterContext);

        if (activeCompSubs.length === 0) {
            return baseFiltered;
        }

        return baseFiltered.filter(sub => {
            const hasPropertyMatch = activeCompSubs.some(comp => this.requiresComponent(sub, comp));
            const hasTabMatch = sub.right?.some(tab => tab.root === 'components' && activeCompSubs.includes(tab.label));
            return !hasPropertyMatch && !hasTabMatch;
        });
    }
}
