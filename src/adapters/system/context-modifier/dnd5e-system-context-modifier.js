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
            'all': 0,
            'standard': 1,
            'time': 2,
            'rest': 3,
            'combat': 4,
            'monster': 5,
            'vehicle': 6,
            'special': 7,
            'other': 8,
            'none': 9
        },
        'standard': { 'all': 0, 'action': 1, 'bonus': 2, 'reaction': 3 },
        'time': { 'all': 0, 'minute': 1, 'hour': 2, 'day': 3 },
        'rest': { 'all': 0, 'longRest': 1, 'shortRest': 2, 'long': 1, 'short': 2 },
        'combat': { 'all': 0, 'encounter': 1, 'turnStart': 2, 'turnEnd': 3 },
        'monster': { 'all': 0, 'legendary': 1, 'mythic': 2, 'lair': 3 },
        'vehicle': { 'all': 0, 'crew': 1 },
        'components': { 'vocal': 0, 'somatic': 1, 'material': 2 },
        'ability': { 'all': 0, 'str': 1, 'dex': 2, 'con': 3, 'int': 4, 'wis': 5, 'cha': 6 }
    },
    item_type: {
        'save': 1,
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
        'standard': ['DND5E.ActivityActivationStandard', 'Standard', 'DND5E.Standard'],
        'time': ['DND5E.ActivityActivationTime', 'Time', 'DND5E.Time'],
        'rest': ['DND5E.ActivityActivationRest', 'Rest', 'DND5E.Rest'],
        'combat': ['DND5E.ActivityActivationCombat', 'Combat', 'DND5E.Combat'],
        'monster': ['DND5E.ActivityActivationMonster', 'Monster', 'DND5E.Monster'],
        'vehicle': ['DND5E.ActivityActivationVehicle', 'Vehicle', 'DND5E.Vehicle'],
        'action': ['DND5E.Action', 'Action', 'DND5E.ActionAction'],
        'bonus': ['DND5E.BonusAction', 'Bonus Action', 'DND5E.ActionBonus'],
        'reaction': ['DND5E.Reaction', 'Reaction', 'DND5E.ActionReaction'],
        'minute': ['DND5E.TimeMinute', 'Minute'],
        'hour': ['DND5E.TimeHour', 'Hour'],
        'day': ['DND5E.TimeDay', 'Day'],
        'shortRest': ['DND5E.ActivityActivationShortRest', 'End of a Short Rest'],
        'longRest': ['DND5E.ActivityActivationLongRest', 'End of a Long Rest'],
        'short': ['DND5E.ActivityActivationShortRest', 'End of a Short Rest'],
        'long': ['DND5E.ActivityActivationLongRest', 'End of a Long Rest'],
        'encounter': ['DND5E.ActivityActivationStartEncounter', 'Start of Encounter'],
        'turnStart': ['DND5E.ActivityActivationTurnStart', 'Start of Turn'],
        'turnEnd': ['DND5E.ActivityActivationTurnEnd', 'End of Turn'],
        'legendary': ['DND5E.LegendaryAction', 'Legendary Action'],
        'mythic': ['DND5E.MythicAction', 'Mythic Action'],
        'lair': ['DND5E.LairAction', 'Lair Action'],
        'crew': ['DND5E.CrewAction', 'Crew Action'],
        'special': ['DND5E.Special', 'Special'],
        'other': ['DND5E.ActionOther', 'Other'],
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
        const findParent = id => context.itemTypes?.find(t => t.id === id);

        const showAll = app.actor?.getFlag(MODULE_ID, 'showAll') ?? false;

        const allParent = findParent('all');
        if (allParent) {
            allParent.showUnprepared = showAll;
        }

        const spellParent = findParent('spell');
        if (spellParent) {
            const showUnprepared = app.actor?.getFlag(MODULE_ID, 'showUnprepared') ?? false;
            spellParent.showUnprepared = Boolean(showUnprepared || showAll);
        }

        const weaponParent = findParent('weapon');
        if (weaponParent) {
            const showUnequippedWeapon = app.actor?.getFlag(MODULE_ID, 'showUnequipped_weapon') ?? false;
            weaponParent.showUnprepared = Boolean(showUnequippedWeapon || showAll);
        }

        const equipmentParent = findParent('equipment');
        if (equipmentParent) {
            const showUnequippedEquipment = app.actor?.getFlag(MODULE_ID, 'showUnequipped_equipment') ?? false;
            equipmentParent.showUnprepared = Boolean(showUnequippedEquipment || showAll);
        }

        const consumableParent = findParent('consumable');
        if (consumableParent) {
            const showUnequippedConsumable = app.actor?.getFlag(MODULE_ID, 'showUnequipped_consumable') ?? false;
            consumableParent.showUnprepared = Boolean(showUnequippedConsumable || showAll);
        }

        const toolParent = findParent('tool');
        if (toolParent) {
            const showUnequippedTool = app.actor?.getFlag(MODULE_ID, 'showUnequipped_tool') ?? false;
            toolParent.showUnprepared = Boolean(showUnequippedTool || showAll);
        }

        const backpackParent = findParent('backpack');
        if (backpackParent) {
            const showUnequippedBackpack = app.actor?.getFlag(MODULE_ID, 'showUnequipped_backpack') ?? false;
            backpackParent.showUnprepared = Boolean(showUnequippedBackpack || showAll);
        }

        const lootParent = findParent('loot');
        if (lootParent) {
            const showUnequippedLoot = app.actor?.getFlag(MODULE_ID, 'showUnequipped_loot') ?? false;
            lootParent.showUnprepared = Boolean(showUnequippedLoot || showAll);
        }

        this.#ensureAllSubTab(findParent('spell'), app, localize('BAD.common.allSpells', 'All Spells'), 'showUnprepared', true, showAll);
        this.#ensureAllSubTab(findParent('weapon'), app, localize('BAD.common.allWeapons', 'All Weapons'), 'showUnequipped_weapon', false, showAll);
        this.#ensureAllSubTab(findParent('equipment'), app, localize('BAD.common.allEquipment', 'All Equipment'), 'showUnequipped_equipment', false, showAll);
    }

    /**
     * Helper to inject an "All" sub-tab into a parent tab group.
     * @param {HUDTab} parent Parent tab group
     * @param {ApplicationV2} app Active HUD application
     * @param {string} label Localized tab label
     * @param {string} flagKey Actor flag key for unprepared/unequipped display toggle
     * @param {boolean} [requireSubTabs=false] Only inject if parent has existing subtabs
     * @param {boolean} [forceShow=false] Force orange indicator if showAll is true
     */
    #ensureAllSubTab(parent, app, label, flagKey, requireSubTabs = false, forceShow = false) {
        if (!parent || (requireSubTabs && parent.subTabs.length === 0)) return;
        const flagValue = app.actor?.getFlag(MODULE_ID, flagKey) ?? false;
        const showUnprepared = Boolean(forceShow || flagValue);
        parent.addSubTab({
            id: 'all',
            label,
            active: app.leftTabs.activeParents.has(parent.id) && app.leftTabs.activeSubTypes.size === 0,
            showUnprepared
        });
        parent.updateOrder(Object.keys(SORT_ORDERS.tabs[parent.id]));
    }

    /**
     * Get the sort priority order for a left-side parent item tab in D&D 5e.
     * @param {string} parentId
     * @returns {number}
     */
    getItemTypeSortOrder(parentId) {
        return SORT_ORDERS.item_type[parentId] ?? super.getItemTypeSortOrder(parentId);
    }

    /**
     * Get the sort priority order for a right-side action sub-tab in D&D 5e.
     * @param {string} parentId
     * @param {string} subId
     * @returns {number}
     */
    getActionSubTabSortOrder(parentId, subId) {
        return SORT_ORDERS.tabs[parentId]?.[subId] ?? super.getActionSubTabSortOrder(parentId, subId);
    }

    /**
     * Get the localized display label for a left-side parent item tab in D&D 5e.
     * @param {string} parentId
     * @returns {string}
     */
    getItemTypeLabel(parentId) {
        const config = LABEL_KEYS.item_type[parentId];
        return config ? localize(config[0], config[1]) : super.getItemTypeLabel(parentId);
    }

    /**
     * Get the CSS icon class for a left-side parent item tab in D&D 5e.
     * @param {string} parentId
     * @returns {string}
     */
    getItemTypeIcon(parentId) {
        return ICONS.item_type[parentId] ?? super.getItemTypeIcon(parentId);
    }

    /**
     * Get the localized display label for a left-side item sub-tab in D&D 5e.
     * @param {string} parentId
     * @param {string} subId
     * @returns {string}
     */
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
                const ord = ordinals[num] ?? `${num}th`;
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

    /**
     * Get the localized display label for a right-side action parent tab in D&D 5e.
     * @param {string} parentId
     * @returns {string}
     */
    getActionTypeLabel(parentId) {
        const config = LABEL_KEYS.action_type[parentId];
        return config ? localize(config[0], config[1]) : super.getActionTypeLabel(parentId);
    }

    /**
     * Get the CSS icon class for a right-side action parent tab in D&D 5e.
     * @param {string} parentId
     * @returns {string}
     */
    getActionTypeIcon(parentId) {
        return ICONS.action_type[parentId] ?? super.getActionTypeIcon(parentId);
    }

    /**
     * Get the localized display label for a right-side action sub-tab in D&D 5e.
     * @param {string} subId
     * @returns {string}
     */
    getActionSubTabLabel(subId) {
        const config = LABEL_KEYS.action_subtab[subId];
        const fallback = config?.[1] ?? subId;

        const cfg = CONFIG?.DND5E;
        const configLabel = cfg?.activityActivationCategories?.[subId]
            ?? cfg?.activityActivationTypes?.[subId]
            ?? cfg?.abilityActivationTypes?.[subId];
        if (configLabel) {
            return typeof configLabel === 'string' ? localize(configLabel, fallback) : (configLabel.label ?? configLabel.name ?? fallback);
        }

        if (config) {
            const primaryKey = config[0];
            const localized = localize(primaryKey, null);
            if (localized) return localized;
            if (config[2]) {
                const altLocalized = localize(config[2], null);
                if (altLocalized) return altLocalized;
            }
            return localize(primaryKey, fallback);
        }

        return super.getActionSubTabLabel(subId);
    }
}


