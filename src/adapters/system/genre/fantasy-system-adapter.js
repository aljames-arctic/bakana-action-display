import { BaseSystemAdapter } from '../base-system-adapter.js';

const SORT_ORDERS = {
    spell_subtab: {
        'all': 0,
        '0': 1, 'level_0': 1,
        '1': 2, 'level_1': 2,
        '2': 3, 'level_2': 3,
        '3': 4, 'level_3': 4,
        '4': 5, 'level_4': 5,
        '5': 6, 'level_5': 6,
        '6': 7, 'level_6': 7,
        '7': 8, 'level_7': 8,
        '8': 9, 'level_8': 9,
        '9': 10, 'level_9': 10,
        'itemCharges': 99
    }
};

const ICONS = {
    item_type: {
        'weapon': 'fas fa-sword',
        'spell': 'fas fa-wand-magic-sparkles',
        'feat': 'fas fa-award',
        'consumable': 'fas fa-flask'
    }
};

/**
 * Intermediate adapter for fantasy-based systems (D&D 5e, PF1e, PF2e).
 * Provides shared fantasy defaults like common item type labels (Weapons, Spells, Feats, Consumables),
 * their corresponding icons, and numerical spell level sorting.
 */
export class FantasySystemAdapter extends BaseSystemAdapter {
    constructor(systemId) {
        super(systemId);
    }

    /**
     * Get the default CSS icon class for a left-side item type (parent tab) in fantasy systems.
     */
    getItemTypeIcon(parentId) {
        return ICONS.item_type[parentId] ?? super.getItemTypeIcon(parentId);
    }

    /**
     * Get the sort index for left-side item sub-tabs in fantasy systems.
     * Easily readable list determining the exact display order for spell levels.
     */
    getItemSubTabSortOrder(parentId, subId) {
        return parentId === 'spell'
            ? (SORT_ORDERS.spell_subtab[subId] ?? 999)
            : super.getItemSubTabSortOrder(parentId, subId);
    }
}
