import { BaseSystemTabFilterManager } from './base-system-tab-filter-manager.js';
import { requiresComponent } from '../dnd5e/activities.js';

export class Dnd5eSystemTabFilterManager extends BaseSystemTabFilterManager {
    constructor(adapter) {
        super(adapter);
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
            const hasPropertyMatch = activeCompSubs.some(comp => requiresComponent(sub, comp));
            const hasTabMatch = sub.tabs?.some(tab => tab.root === 'components' && activeCompSubs.includes(tab.label));
            return !hasPropertyMatch && !hasTabMatch;
        });
    }
}
