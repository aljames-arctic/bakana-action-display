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
    /**
     * @param {BaseSystemAdapter} adapter Owning system adapter instance
     */
    constructor(adapter) {
        this.adapter = adapter;
    }

    /**
     * Hook to modify the rendering context before template rendering.
     * @param {Object} context The Handlebars rendering context
     * @param {ApplicationV2} app Active HUD application
     */
    modifyContext(context, app) {}

    /**
     * Get the sort priority order for a left-side parent item tab.
     * @param {string} parentId
     * @returns {number}
     */
    getItemTypeSortOrder(parentId) {
        return SORT_ORDERS.item_type[parentId] ?? 999;
    }

    /**
     * Get the sort priority order for a left-side item sub-tab.
     * @param {string} parentId
     * @param {string} subId
     * @returns {number}
     */
    getItemSubTabSortOrder(parentId, subId) {
        if (subId === 'all') return 0;
        if (subId === 'itemCharges') return 99;
        const num = Number.parseInt(subId, 10);
        return Number.isNaN(num) ? 999 : num + 1;
    }

    /**
     * Get the sort priority order for a right-side action parent tab.
     * @param {string} parentId
     * @returns {number}
     */
    getActionTypeSortOrder(parentId) {
        return SORT_ORDERS.action_type[parentId] ?? 999;
    }

    /**
     * Get the sort priority order for a right-side action sub-tab.
     * @param {string} parentId
     * @param {string} subId
     * @returns {number}
     */
    getActionSubTabSortOrder(parentId, subId) {
        return subId === 'all' ? 0 : 999;
    }

    /**
     * Get the localized display label for a left-side parent item tab.
     * @param {string} parentId
     * @returns {string}
     */
    getItemTypeLabel(parentId) {
        switch (parentId) {
            case 'all': return localize('BAD.core.allItems', 'All Items');
            case 'other': return localize('BAD.core.other', 'Other');
            case 'hidden': return localize('BAD.core.hidden', 'Hidden');
            case 'savingThrow': return localize('BAD.page2.savingThrow', 'Saving Throw');
            case 'abilityCheck': return localize('BAD.page2.abilityCheck', 'Ability Check');
            default: {
                const configLabel = CONFIG.Item?.typeLabels?.[parentId];
                if (configLabel) {
                    const localized = localize(configLabel, '');
                    if (localized) return localized;
                }
                return parentId.charAt(0).toUpperCase() + parentId.slice(1);
            }
        }
    }

    /**
     * Get the CSS icon class for a left-side parent item tab.
     * @param {string} parentId
     * @returns {string}
     */
    getItemTypeIcon(parentId) {
        if (parentId === 'savingThrow') return 'fas fa-shield-alt';
        if (parentId === 'abilityCheck') return 'fas fa-dice-d20';
        const typeMap = {
            arma: 'fas fa-sword',
            armadura: 'fas fa-shield-halved',
            magia: 'fas fa-wand-magic-sparkles',
            poder: 'fas fa-award',
            equipamento: 'fas fa-shield-halved',
            consumivel: 'fas fa-flask-potion',
            weapon: 'fas fa-sword',
            spell: 'fas fa-wand-magic-sparkles',
            feat: 'fas fa-award',
            equipment: 'fas fa-shield-halved',
            consumable: 'fas fa-flask-potion'
        };
        return ICONS.item_type[parentId] ?? typeMap[parentId] ?? 'fas fa-question';
    }

    /**
     * Get the localized display label for a left-side item sub-tab.
     * @param {string} parentId
     * @param {string} subId
     * @returns {string}
     */
    getItemSubTabLabel(parentId, subId) {
        return subId.toUpperCase();
    }

    /**
     * Get the localized display label for a right-side action parent tab.
     * @param {string} parentId
     * @returns {string}
     */
    getActionTypeLabel(parentId) {
        switch (parentId) {
            case 'all': return localize('BAD.core.allActions', 'All Actions');
            case 'none': return localize('BAD.core.none', 'None');
            case 'ability': return localize('BAD.page2.ability', 'Ability');
            default: return parentId.toUpperCase();
        }
    }

    /**
     * Get the CSS icon class for a right-side action parent tab.
     * @param {string} parentId
     * @returns {string}
     */
    getActionTypeIcon(parentId) {
        if (parentId === 'ability') return 'fas fa-fist-raised';
        return ICONS.action_type[parentId] ?? 'fas fa-question';
    }

    /**
     * Get the localized display label for a right-side action sub-tab.
     * @param {string} subId
     * @returns {string}
     */
    getActionSubTabLabel(subId) {
        const abilityLabels = {
            all: localize('BAD.core.allActions', 'All'),
            str: localize('DND5E.AbilityStr', 'Strength'),
            dex: localize('DND5E.AbilityDex', 'Dexterity'),
            con: localize('DND5E.AbilityCon', 'Constitution'),
            int: localize('DND5E.AbilityInt', 'Intelligence'),
            wis: localize('DND5E.AbilityWis', 'Wisdom'),
            cha: localize('DND5E.AbilityCha', 'Charisma')
        };
        return abilityLabels[subId] ?? subId.toUpperCase();
    }
}
