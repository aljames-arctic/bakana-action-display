import { BaseSystemAdapter } from '../base-system-adapter.js';

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
        const icons = {
            'weapon': 'fas fa-sword',
            'spell': 'fas fa-wand-magic-sparkles',
            'feat': 'fas fa-award',
            'consumable': 'fas fa-flask'
        };
        return icons[parentId] || super.getItemTypeIcon(parentId);
    }

    /**
     * Get the sort index for left-side item sub-tabs in fantasy systems.
     * Easily readable list determining the exact display order for spell levels.
     */
    getItemSubTabSortOrder(parentId, subId) {
        if (parentId === 'spell') {
            const spellOrder = [
                'all',
                'level_0',
                'level_1',
                'level_2',
                'level_3',
                'level_4',
                'level_5',
                'level_6',
                'level_7',
                'level_8',
                'level_9',
                'itemCharges'
            ];
            const idx = spellOrder.indexOf(subId);
            return idx !== -1 ? idx : 999;
        }
        return super.getItemSubTabSortOrder(parentId, subId);
    }
}
