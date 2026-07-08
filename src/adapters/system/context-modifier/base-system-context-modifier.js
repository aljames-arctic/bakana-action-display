import { localize } from '../../../lib/utils.js';

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
        'none': 2
    }
};

/**
 * Manages UI context modifications, tab label/icon localization, and sort orders
 * for a system adapter.
 */
export class BaseSystemContextModifier {
    constructor(adapter) {
        this.adapter = adapter;
    }

    modifyContext(context, app) {}

    getItemTypeSortOrder(parentId) {
        return SORT_ORDERS.item_type[parentId] ?? 999;
    }

    getItemSubTabSortOrder(parentId, subId) {
        if (subId === 'all') return 0;
        if (subId === 'itemCharges') return 99;
        const num = Number.parseInt(subId, 10);
        return Number.isNaN(num) ? 999 : num + 1;
    }

    getActionTypeSortOrder(parentId) {
        return SORT_ORDERS.action_type[parentId] ?? 999;
    }

    getActionSubTabSortOrder(parentId, subId) {
        return subId === 'all' ? 0 : 999;
    }

    getItemTypeLabel(parentId) {
        switch (parentId) {
            case 'all': return localize('BAD.core.allItems', 'All Items');
            case 'other': return localize('BAD.core.other', 'Other');
            case 'hidden': return localize('BAD.core.hidden', 'Hidden');
            default: return parentId.toUpperCase();
        }
    }

    getItemTypeIcon(parentId) {
        return ICONS.item_type[parentId] ?? 'fas fa-question';
    }

    getItemSubTabLabel(parentId, subId) {
        return subId.toUpperCase();
    }

    getActionTypeLabel(parentId) {
        switch (parentId) {
            case 'all': return localize('BAD.core.allActions', 'All Actions');
            case 'none': return localize('BAD.core.none', 'None');
            default: return parentId.toUpperCase();
        }
    }

    getActionTypeIcon(parentId) {
        return ICONS.action_type[parentId] ?? 'fas fa-question';
    }

    getActionSubTabLabel(subId) {
        return subId.toUpperCase();
    }
}
