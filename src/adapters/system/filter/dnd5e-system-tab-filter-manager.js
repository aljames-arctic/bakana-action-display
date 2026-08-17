import { BaseSystemTabFilterManager } from './base-system-tab-filter-manager.js';
import { TabRef } from '../../../ui/tab-ref.js';

function containerHasComponent(container, component) {
    if (!container) return false;
    const target = container.value ?? container;
    if (target instanceof Set) return target.has(component);
    if (Array.isArray(target)) return target.includes(component);
    if (typeof target === 'object') return Boolean(target[component]);
    return false;
}

function docHasComponent(doc, component) {
    if (!doc) return false;
    return containerHasComponent(doc, component) ||
           containerHasComponent(doc.system?.properties ?? doc.properties, component) ||
           containerHasComponent(doc.system?.components ?? doc.components, component);
}

export class Dnd5eSystemTabFilterManager extends BaseSystemTabFilterManager {
    constructor(adapter) {
        super(adapter);
    }

    requiresComponent(sub, component) {
        if (!sub) return false;
        const rootDoc = this.adapter.resolveRootSpellDocument?.(sub) ?? null;
        const docsToCheck = [sub, sub.linkedAction, sub.originalActivity, sub.originalItem, rootDoc];
        return docsToCheck.some(doc => docHasComponent(doc, component));
    }

    getComponentTabs(doc) {
        return ['vocal', 'somatic', 'material']
            .filter(comp => this.requiresComponent(doc, comp))
            .map(comp => TabRef.from('components', comp));
    }

    getTabCombinator(parentId) {
        return parentId === 'components' ? 'difference' : super.getTabCombinator(parentId);
    }

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
