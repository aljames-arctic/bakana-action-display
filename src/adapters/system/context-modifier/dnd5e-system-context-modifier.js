import { BaseSystemContextModifier } from './base-system-context-modifier.js';
import { localize } from '../../../lib/utils.js';
import { MODULE_ID } from '../../../constants.js';

const SORT_ORDERS = {
    tabs: {
        'spell': {
            'all': 0, 'level_0': 1, 'level_1': 2, 'level_2': 3, 'level_3': 4,
            'level_4': 5, 'level_5': 6, 'level_6': 7, 'level_7': 8, 'level_8': 9,
            'level_9': 10, 'itemCharges': 99
        },
        'weapon': {
            'all': 0, 'simpleM': 1, 'martialM': 2, 'simpleR': 3, 'martialR': 4,
            'natural': 5, 'improv': 6, 'siege': 7
        },
        'equipment': {
            'all': 0, 'light': 1, 'medium': 2, 'heavy': 3, 'shield': 4,
            'clothing': 5, 'trinket': 6, 'ring': 7, 'rod': 8, 'wand': 9,
            'wondrous': 10, 'vehicle': 11, 'natural': 12
        },
        'economy': {
            'all': 0, 'action': 1, 'bonus': 2, 'reaction': 3, 'other': 4,
            'special': 5, 'legendary': 6, 'mythic': 7, 'crew': 8, 'lair': 9,
            'minute': 10, 'hour': 11, 'day': 12, 'none': 13
        },
        'components': { 'vocal': 0, 'somatic': 1, 'material': 2 },
        'ability': { 'all': 0, 'str': 1, 'dex': 2, 'con': 3, 'int': 4, 'wis': 5, 'cha': 6 }
    },
    item_type: {
        'savingThrow': 1,
        'abilityCheck': 2,
        'weapon': 3,
        'equipment': 4,
        'spell': 5,
        'consumable': 6,
        'tool': 7,
        'backpack': 8,
        'loot': 9,
        'feat': 10
    }
};

const ICONS = {
    item_type: {
        'equipment': 'fas fa-shield',
        'tool': 'fas fa-hammer',
        'backpack': 'fas fa-sack',
        'loot': 'fas fa-gem'
    },
    action_type: {
        'economy': 'fas fa-stopwatch',
        'components': 'fas fa-magic'
    }
};

const LABEL_KEYS = {
    item_type: {
        'all': ['BAD.core.allItems', 'All Items'],
        'weapon': ['DND5E.ItemTypeWeapon', 'Weapon'],
        'equipment': ['DND5E.ItemTypeEquipment', 'Equipment'],
        'consumable': ['DND5E.ItemTypeConsumable', 'Consumable'],
        'tool': ['DND5E.ItemTypeTool', 'Tool'],
        'backpack': ['DND5E.ItemTypeContainer', 'Container'],
        'loot': ['DND5E.ItemTypeLoot', 'Loot'],
        'feat': ['DND5E.ItemTypeFeat', 'Feature'],
        'spell': ['DND5E.ItemTypeSpell', 'Spell'],
        'other': ['DND5E.ActionOther', 'Other'],
        'hidden': ['BAD.core.hidden', 'Hidden']
    },
    action_type: {
        'economy': ['BAD.common.actionEconomy', 'Action Economy'],
        'components': ['BAD.common.spellComponents', 'Spell Components']
    },
    action_subtab: {
        'all': ['BAD.core.allActions', 'All Actions'],
        'action': ['DND5E.Action', 'Action'],
        'bonus': ['DND5E.BonusAction', 'Bonus Action'],
        'reaction': ['DND5E.Reaction', 'Reaction'],
        'minute': ['DND5E.TimeMinute', 'Minute'],
        'hour': ['DND5E.TimeHour', 'Hour'],
        'day': ['DND5E.TimeDay', 'Day'],
        'legendary': ['DND5E.LegendaryAction', 'Legendary'],
        'mythic': ['DND5E.MythicAction', 'Mythic'],
        'lair': ['DND5E.LairAction', 'Lair'],
        'crew': ['DND5E.CrewAction', 'Crew'],
        'special': ['DND5E.Special', 'Special'],
        'none': ['DND5E.None', 'None'],
        'vocal': ['DND5E.ComponentVerbal', 'Verbal'],
        'somatic': ['DND5E.ComponentSomatic', 'Somatic'],
        'material': ['DND5E.ComponentMaterial', 'Material']
    }
};

export class Dnd5eSystemContextModifier extends BaseSystemContextModifier {
    constructor(adapter) {
        super(adapter);
    }

    modifyContext(context, app) {
        const findParent = id => context.itemTypes.find(t => t.id === id);

        this.#ensureAllSubTab(findParent('spell'), app, localize('BAD.common.allSpells', 'All Spells'), 'showUnprepared', true);
        this.#ensureAllSubTab(findParent('weapon'), app, localize('BAD.common.allWeapons', 'All Weapons'), 'showUnequipped_weapon');
        this.#ensureAllSubTab(findParent('equipment'), app, localize('BAD.common.allEquipment', 'All Equipment'), 'showUnequipped_equipment');
    }

    #ensureAllSubTab(parent, app, label, flagKey, requireSubTabs = false) {
        if (!parent || (requireSubTabs && parent.subTabs.length === 0)) return;
        const showUnprepared = app.actor.getFlag(MODULE_ID, flagKey) ?? false;
        parent.addSubTab({
            id: 'all',
            label,
            active: app.leftTabs.activeParents.has(parent.id) && app.leftTabs.activeSubTypes.size === 0,
            showUnprepared
        });
        parent.updateOrder(Object.keys(SORT_ORDERS.tabs[parent.id]));
    }

    getItemTypeSortOrder(parentId) {
        return SORT_ORDERS.item_type[parentId] ?? super.getItemTypeSortOrder(parentId);
    }

    getActionSubTabSortOrder(parentId, subId) {
        return SORT_ORDERS.tabs[parentId]?.[subId] ?? super.getActionSubTabSortOrder(parentId, subId);
    }

    getItemTypeLabel(parentId) {
        const config = LABEL_KEYS.item_type[parentId];
        return config ? localize(config[0], config[1]) : super.getItemTypeLabel(parentId);
    }

    getItemTypeIcon(parentId) {
        return ICONS.item_type[parentId] ?? super.getItemTypeIcon(parentId);
    }

    getItemSubTabLabel(parentId, subId) {
        if (parentId === 'spell') {
            if (subId === 'all') {
                return localize('BAD.common.allSpells', 'All Spells');
            }
            if (subId === 'itemCharges') {
                return localize('BAD.common.itemCharges', 'Item Charges');
            }
            if (subId.startsWith('level_')) {
                const num = subId.replace('level_', '');
                if (num === '0') return localize('DND5E.SpellCantrip', 'Cantrip');
                const key = `DND5E.SpellLevel${num}`;
                const ordinals = { '1': '1st', '2': '2nd', '3': '3rd' };
                const ord = ordinals[num] || `${num}th`;
                return localize(key, `${ord} Level`);
            }
        }
        if (parentId === 'weapon' || parentId === 'equipment') {
            if (subId === 'all') {
                const labelKey = parentId === 'weapon' ? 'allWeapons' : 'allEquipment';
                const fallback = parentId === 'weapon' ? 'All Weapons' : 'All Equipment';
                return localize(`BAD.common.${labelKey}`, fallback);
            }
            const prefix = parentId.charAt(0).toUpperCase() + parentId.slice(1);
            const subTitle = subId.charAt(0).toUpperCase() + subId.slice(1);
            const configMap = parentId === 'weapon' ? CONFIG?.DND5E?.weaponTypes : CONFIG?.DND5E?.equipmentTypes;
            return localize(`DND5E.${prefix}${subTitle}`, configMap?.[subId] ?? subId);
        }
        return super.getItemSubTabLabel(parentId, subId);
    }

    getActionTypeLabel(parentId) {
        const config = LABEL_KEYS.action_type[parentId];
        return config ? localize(config[0], config[1]) : super.getActionTypeLabel(parentId);
    }

    getActionTypeIcon(parentId) {
        return ICONS.action_type[parentId] ?? super.getActionTypeIcon(parentId);
    }

    getActionSubTabLabel(subId) {
        const config = LABEL_KEYS.action_subtab[subId];
        return config ? localize(config[0], config[1]) : super.getActionSubTabLabel(subId);
    }
}
