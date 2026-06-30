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
     * Get the default label for a left-side item type (parent tab) in fantasy systems.
     */
    getItemTypeLabel(parentId) {
        const labels = {
            'weapon': 'Weapons',
            'spell': 'Spells',
            'feat': 'Feats',
            'consumable': 'Consumables'
        };
        return labels[parentId] || super.getItemTypeLabel(parentId);
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
     * Modify the template context before rendering.
     * Default fantasy behavior: sort spell sub-tabs numerically (ascending).
     */
    modifyContext(context, app) {
        super.modifyContext(context, app);
        const spellParent = context.itemTypes.find(t => t.id === 'spell');
        if (spellParent && spellParent.subTabs.length > 0) {
            spellParent.subTabs.sort((a, b) => {
                const valA = parseInt(a.id, 10);
                const valB = parseInt(b.id, 10);
                if (isNaN(valA) && isNaN(valB)) return a.id.localeCompare(b.id);
                if (isNaN(valA)) return 1;
                if (isNaN(valB)) return -1;
                return valA - valB;
            });
        }
    }
}
