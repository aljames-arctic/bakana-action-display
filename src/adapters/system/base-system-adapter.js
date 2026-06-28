/**
 * Helper to safely localize a key, falling back to a default string if the key is not found.
 */
export function localize(key, fallback) {
    return (game.i18n && game.i18n.has(key)) ? game.i18n.localize(key) : fallback;
}

/**
 * Base class for all system-specific adapters.
 * System adapters are responsible for modifying, filtering, and sorting
 * the base list of usable items extracted by the core.
 * They also define the localization labels and icons for the HUD tabs.
 */
export class BaseSystemAdapter {
    constructor(systemId) {
        this.systemId = systemId;
    }

    /**
     * Determine if this adapter is compatible with the current system.
     * @returns {boolean}
     */
    isCompatible() {
        return game.system.id === this.systemId;
    }

    /**
     * Modify the base list of actions.
     * @param {Object[]} actions Base actions extracted by the core
     * @param {Actor} actor The actor these actions belong to
     * @returns {Object[]} The modified/filtered/sorted actions list
     */
    modifyActions(actions, actor) {
        return actions;
    }

    /**
     * Get the localized label for a left-side item type (parent tab).
     * @param {string} parentId 
     * @returns {string}
     */
    getItemTypeLabel(parentId) {
        const labels = {
            'all': localize('BAD.itemTypes.all', 'All Items'),
            'weapon': localize('BAD.itemTypes.weapon', 'Weapon'),
            'equipment': localize('BAD.itemTypes.equipment', 'Equipment'),
            'consumable': localize('BAD.itemTypes.consumable', 'Consumable'),
            'tool': localize('BAD.itemTypes.tool', 'Tool'),
            'backpack': localize('BAD.itemTypes.backpack', 'Container'),
            'loot': localize('BAD.itemTypes.loot', 'Loot'),
            'feat': localize('BAD.itemTypes.feat', 'Feature'),
            'spell': localize('BAD.itemTypes.spell', 'Spell'),
            'other': localize('BAD.itemTypes.other', 'Other'),
            'hidden': localize('BAD.hud.hidden', 'Hidden')
        };
        return labels[parentId] || parentId.toUpperCase();
    }

    /**
     * Get the CSS icon class for a left-side item type (parent tab).
     * @param {string} parentId 
     * @returns {string}
     */
    getItemTypeIcon(parentId) {
        const icons = {
            'all': 'fas fa-border-all',
            'weapon': 'fas fa-sword',
            'spell': 'fas fa-wand-magic-sparkles',
            'feat': 'fas fa-award',
            'equipment': 'fas fa-shield',
            'consumable': 'fas fa-flask',
            'tool': 'fas fa-hammer',
            'backpack': 'fas fa-sack',
            'loot': 'fas fa-gem',
            'other': 'fas fa-ellipsis',
            'hidden': 'fas fa-eye-slash'
        };
        return icons[parentId] || 'fas fa-question';
    }

    /**
     * Get the localized label for a spell level (left-side sub-tab).
     * @param {string} level 
     * @returns {string}
     */
    getSpellLevelLabel(level) {
        if (level === '0') {
            return localize('BAD.spellLevels.cantrip', 'Cantrip');
        }
        return (game.i18n && game.i18n.has('BAD.spellLevels.levelN'))
            ? game.i18n.format('BAD.spellLevels.levelN', { level })
            : `${level} Level`;
    }

    /**
     * Get the localized label for a right-side action type (parent tab).
     * @param {string} parentId 
     * @returns {string}
     */
    getActionTypeLabel(parentId) {
        const labels = {
            'all': localize('BAD.actions.all', 'All Actions'),
            'standard': localize('BAD.actions.standard', 'Standard'),
            'time': localize('BAD.actions.time', 'Time'),
            'monster': localize('BAD.actions.monster', 'Monster'),
            'vehicle': localize('BAD.actions.vehicle', 'Vehicle'),
            'special': localize('BAD.actions.special', 'Special'),
            'none': localize('BAD.actions.none', 'None')
        };
        return labels[parentId] || parentId.toUpperCase();
    }

    /**
     * Get the CSS icon class for a right-side action type (parent tab).
     * @param {string} parentId 
     * @returns {string}
     */
    getActionTypeIcon(parentId) {
        const icons = {
            'all': 'fas fa-border-all',
            'standard': 'fas fa-hand-fist',
            'time': 'fas fa-clock',
            'monster': 'fas fa-dragon',
            'vehicle': 'fas fa-ship',
            'special': 'fas fa-star',
            'none': 'fas fa-ban'
        };
        return icons[parentId] || 'fas fa-question';
    }

    /**
     * Get the localized label for a right-side action sub-tab.
     * @param {string} subId 
     * @returns {string}
     */
    getActionSubTabLabel(subId) {
        const labels = {
            'action': localize('BAD.actionSubGroups.action', 'Action'),
            'bonus': localize('BAD.actionSubGroups.bonus', 'Bonus Action'),
            'reaction': localize('BAD.actionSubGroups.reaction', 'Reaction'),
            'minute': localize('BAD.actionSubGroups.minute', 'Minute'),
            'hour': localize('BAD.actionSubGroups.hour', 'Hour'),
            'day': localize('BAD.actionSubGroups.day', 'Day'),
            'legendary': localize('BAD.actionSubGroups.legendary', 'Legendary'),
            'mythic': localize('BAD.actionSubGroups.mythic', 'Mythic'),
            'lair': localize('BAD.actionSubGroups.lair', 'Lair'),
            'crew': localize('BAD.actionSubGroups.crew', 'Crew')
        };
        return labels[subId] || subId.toUpperCase();
    }
}
