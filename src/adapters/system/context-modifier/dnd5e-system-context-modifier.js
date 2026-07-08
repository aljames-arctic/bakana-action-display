import { BaseSystemContextModifier } from './base-system-context-modifier.js';
import { localize } from '../../../lib/utils.js';
import { MODULE_ID } from '../../../constants.js';
import { SORT_ORDERS, ICONS, LABEL_KEYS } from '../dnd5e/constants.js';

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
