import { BaseSystemContextModifier } from './base-system-context-modifier.js';
import { localize } from '../../../lib/utils.js';
import { MODULE_ID } from '../../../constants.js';

const SORT_ORDERS = Object.freeze({
    tabs: Object.freeze({
        'spell': Object.freeze({
            'all': 0, 'level_0': 1, 'level_1': 2, 'level_2': 3, 'level_3': 4,
            'level_4': 5, 'level_5': 6, 'level_6': 7, 'level_7': 8, 'level_8': 9,
            'level_9': 10, 'itemCharges': 99
        }),
        'weapon': Object.freeze({
            'all': 0, 'simpleM': 1, 'martialM': 2, 'simpleR': 3, 'martialR': 4,
            'natural': 5, 'improv': 6, 'siege': 7
        }),
        'equipment': Object.freeze({
            'all': 0, 'light': 1, 'medium': 2, 'heavy': 3, 'shield': 4,
            'clothing': 5, 'trinket': 6, 'ring': 7, 'rod': 8, 'wand': 9,
            'wondrous': 10, 'vehicle': 11, 'natural': 12
        }),
        'economy': Object.freeze({
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
        }),
        'standard': Object.freeze({ 'all': 0, 'action': 1, 'bonus': 2, 'reaction': 3 }),
        'time': Object.freeze({ 'all': 0, 'minute': 1, 'hour': 2, 'day': 3 }),
        'rest': Object.freeze({ 'all': 0, 'longRest': 1, 'shortRest': 2, 'long': 1, 'short': 2 }),
        'combat': Object.freeze({ 'all': 0, 'encounter': 1, 'turnStart': 2, 'turnEnd': 3 }),
        'monster': Object.freeze({ 'all': 0, 'legendary': 1, 'mythic': 2, 'lair': 3 }),
        'vehicle': Object.freeze({ 'all': 0, 'crew': 1 }),
        'components': Object.freeze({ 'vocal': 0, 'somatic': 1, 'material': 2 }),
        'ability': Object.freeze({ 'all': 0, 'str': 1, 'dex': 2, 'con': 3, 'int': 4, 'wis': 5, 'cha': 6 })
    }),
    item_type: Object.freeze({
        'savingThrow': 1,
        'abilityCheck': 2,
        'weapon': 3,
        'equipment': 4,
        'spell': 5,
        'consumable': 6,
        'tool': 7,
        'tools': 7,
        'backpack': 8,
        'loot': 9,
        'feat': 10
    })
});

const ICONS = Object.freeze({
    item_type: Object.freeze({
        'equipment': 'fas fa-shield',
        'tool': 'fas fa-hammer',
        'tools': 'fas fa-hammer',
        'backpack': 'fas fa-sack',
        'loot': 'fas fa-gem'
    }),
    action_type: Object.freeze({
        'economy': 'fas fa-stopwatch',
        'components': 'fas fa-magic'
    })
});

const LABEL_KEYS = Object.freeze({
    item_type: Object.freeze({
        'all': Object.freeze(['BAD.core.allItems', 'All Items']),
        'weapon': Object.freeze(['DND5E.ItemTypeWeapon', 'Weapon']),
        'equipment': Object.freeze(['DND5E.ItemTypeEquipment', 'Equipment']),
        'consumable': Object.freeze(['DND5E.ItemTypeConsumable', 'Consumable']),
        'tool': Object.freeze(['DND5E.ItemTypeToolPlural', 'Tools']),
        'tools': Object.freeze(['DND5E.ItemTypeToolPlural', 'Tools']),
        'backpack': Object.freeze(['DND5E.ItemTypeContainer', 'Container']),
        'loot': Object.freeze(['DND5E.ItemTypeLoot', 'Loot']),
        'feat': Object.freeze(['DND5E.ItemTypeFeat', 'Feature']),
        'spell': Object.freeze(['DND5E.ItemTypeSpell', 'Spell']),
        'other': Object.freeze(['DND5E.ActionOther', 'Other']),
        'hidden': Object.freeze(['BAD.core.hidden', 'Hidden'])
    }),
    action_type: Object.freeze({
        'economy': Object.freeze(['BAD.common.actionEconomy', 'Action Economy']),
        'components': Object.freeze(['BAD.common.spellComponents', 'Spell Components'])
    }),
    action_subtab: Object.freeze({
        'all': Object.freeze(['BAD.core.allActions', 'All Actions']),
        'standard': Object.freeze(['DND5E.ActivityActivationStandard', 'Standard', 'DND5E.Standard']),
        'time': Object.freeze(['DND5E.ActivityActivationTime', 'Time', 'DND5E.Time']),
        'rest': Object.freeze(['DND5E.ActivityActivationRest', 'Rest', 'DND5E.Rest']),
        'combat': Object.freeze(['DND5E.ActivityActivationCombat', 'Combat', 'DND5E.Combat']),
        'monster': Object.freeze(['DND5E.ActivityActivationMonster', 'Monster', 'DND5E.Monster']),
        'vehicle': Object.freeze(['DND5E.ActivityActivationVehicle', 'Vehicle', 'DND5E.Vehicle']),
        'action': Object.freeze(['DND5E.Action', 'Action', 'DND5E.ActionAction']),
        'bonus': Object.freeze(['DND5E.BonusAction', 'Bonus Action', 'DND5E.ActionBonus']),
        'reaction': Object.freeze(['DND5E.Reaction', 'Reaction', 'DND5E.ActionReaction']),
        'minute': Object.freeze(['DND5E.TimeMinute', 'Minute']),
        'hour': Object.freeze(['DND5E.TimeHour', 'Hour']),
        'day': Object.freeze(['DND5E.TimeDay', 'Day']),
        'shortRest': Object.freeze(['DND5E.ActivityActivationShortRest', 'End of a Short Rest']),
        'longRest': Object.freeze(['DND5E.ActivityActivationLongRest', 'End of a Long Rest']),
        'short': Object.freeze(['DND5E.ActivityActivationShortRest', 'End of a Short Rest']),
        'long': Object.freeze(['DND5E.ActivityActivationLongRest', 'End of a Long Rest']),
        'encounter': Object.freeze(['DND5E.ActivityActivationStartEncounter', 'Start of Encounter']),
        'turnStart': Object.freeze(['DND5E.ActivityActivationTurnStart', 'Start of Turn']),
        'turnEnd': Object.freeze(['DND5E.ActivityActivationTurnEnd', 'End of Turn']),
        'legendary': Object.freeze(['DND5E.LegendaryAction', 'Legendary Action']),
        'mythic': Object.freeze(['DND5E.MythicAction', 'Mythic Action']),
        'lair': Object.freeze(['DND5E.LairAction', 'Lair Action']),
        'crew': Object.freeze(['DND5E.CrewAction', 'Crew Action']),
        'special': Object.freeze(['DND5E.Special', 'Special']),
        'other': Object.freeze(['DND5E.ActionOther', 'Other']),
        'none': Object.freeze(['DND5E.None', 'None']),
        'vocal': Object.freeze(['DND5E.ComponentVerbal', 'Verbal']),
        'somatic': Object.freeze(['DND5E.ComponentSomatic', 'Somatic']),
        'material': Object.freeze(['DND5E.ComponentMaterial', 'Material'])
    })
});

const LEVEL_ORDINALS = Object.freeze({ '1': '1st', '2': '2nd', '3': '3rd' });

const GEAR_TYPES = Object.freeze(['weapon', 'equipment', 'consumable', 'tool', 'backpack', 'loot']);
const GENERIC_GEAR_TYPES = Object.freeze(['consumable', 'tool', 'backpack', 'loot']);

export class Dnd5eSystemContextModifier extends BaseSystemContextModifier {
    constructor(adapter) {
        super(adapter);
    }

    modifyContext(context, app) {
        const findParent = id => context.itemTypes?.find(t => t.id === id);

        const showAll = app?.actor?.getFlag?.(MODULE_ID, 'showAll') ?? false;

        const allParent = findParent('all');
        if (allParent) {
            allParent.showUnprepared = showAll;
        }

        const spellParent = findParent('spell');
        if (spellParent) {
            spellParent.showUnprepared = Boolean(app?.actor?.getFlag?.(MODULE_ID, 'showUnprepared') || showAll);
        }

        for (const type of GEAR_TYPES) {
            const parent = findParent(type);
            if (parent) {
                parent.showUnprepared = Boolean(app?.actor?.getFlag?.(MODULE_ID, `showUnequipped_${type}`) || showAll);
            }
        }

        const weaponParent = findParent('weapon');
        const equipmentParent = findParent('equipment');

        const showTooltips = Boolean(context.showTooltips);
        if (showTooltips) {
            if (allParent) {
                allParent.tooltip = localize('BAD.tabs.allTooltip', '<b>Right Click:</b> Toggle Show All (Equipped & Unequipped Items, Prepared & Unprepared Spells)');
            }
            if (spellParent) {
                spellParent.tooltip = localize('BAD.tabs.unpreparedSpellsTooltip', '<b>Right Click:</b> Toggle Show Unprepared Spells');
            }
            if (weaponParent) {
                weaponParent.tooltip = localize('BAD.tabs.unequippedWeaponsTooltip', '<b>Right Click:</b> Toggle Show Unequipped Weapons');
            }
            if (equipmentParent) {
                equipmentParent.tooltip = localize('BAD.tabs.unequippedEquipmentTooltip', '<b>Right Click:</b> Toggle Show Unequipped Equipment');
            }
            for (const gearType of GENERIC_GEAR_TYPES) {
                const p = findParent(gearType);
                if (p) {
                    p.tooltip = localize('BAD.tabs.unequippedItemsTooltip', '<b>Right Click:</b> Toggle Show Unequipped Items');
                }
            }
        }

        this.#ensureAllSubTab(
            spellParent,
            app,
            localize('BAD.common.allSpells', 'All Spells'),
            'showUnprepared',
            true,
            showAll,
            showTooltips ? localize('BAD.tabs.unpreparedSpellsTooltip', '<b>Right Click:</b> Toggle Show Unprepared Spells') : ''
        );
        this.#ensureAllSubTab(
            weaponParent,
            app,
            localize('BAD.common.allWeapons', 'All Weapons'),
            'showUnequipped_weapon',
            false,
            showAll,
            showTooltips ? localize('BAD.tabs.unequippedWeaponsTooltip', '<b>Right Click:</b> Toggle Show Unequipped Weapons') : ''
        );
        this.#ensureAllSubTab(
            equipmentParent,
            app,
            localize('BAD.common.allEquipment', 'All Equipment'),
            'showUnequipped_equipment',
            false,
            showAll,
            showTooltips ? localize('BAD.tabs.unequippedEquipmentTooltip', '<b>Right Click:</b> Toggle Show Unequipped Equipment') : ''
        );
    }

    /**
     * Helper to inject an "All" sub-tab into a parent tab group.
     * @param {HUDTab} parent Parent tab group
     * @param {ApplicationV2} app Active HUD application
     * @param {string} label Localized tab label
     * @param {string} flagKey Actor flag key for unprepared/unequipped display toggle
     * @param {boolean} [requireSubTabs=false] Only inject if parent has existing subtabs
     * @param {boolean} [forceShow=false] Force orange indicator if showAll is true
     * @param {string} [tooltip=''] Contextual tooltip when showTooltips is enabled
     */
    #ensureAllSubTab(parent, app, label, flagKey, requireSubTabs = false, forceShow = false, tooltip = '') {
        if (!parent || !parent.addSubTab || (requireSubTabs && parent.subTabs?.length === 0)) return;
        const flagValue = app?.actor?.getFlag?.(MODULE_ID, flagKey) ?? false;
        const showUnprepared = Boolean(forceShow || flagValue);
        parent.addSubTab({
            id: 'all',
            label,
            active: Boolean(app?.leftTabs?.activeParents?.has(parent.id) && app?.leftTabs?.activeSubTypes?.size === 0),
            showUnprepared,
            tooltip
        });
        parent.updateOrder?.(Object.keys(SORT_ORDERS.tabs[parent.id]));
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
                const ord = LEVEL_ORDINALS[num] ?? `${num}th`;
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
        if (configLabel) {
            const label = configLabel.label ?? configLabel.name ?? configLabel;
            return localize(label, fallback);
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


