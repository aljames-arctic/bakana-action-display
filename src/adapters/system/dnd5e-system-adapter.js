import { FantasySystemAdapter } from './genre/fantasy-system-adapter.js';
import { localize, toSet } from '../../lib/utils.js';
import { log } from '../../lib/logger.js';
import { MODULE_ID } from '../../constants.js';
import { TabRef } from '../../ui/tab-ref.js';
import { Action } from '../../ui/action.js';

import { SORT_ORDERS, ALLOWED_TYPES, ICONS, LABEL_KEYS } from './dnd5e/constants.js';
import { getSpellSlotUses, hasAvailableUpcastSlots, calculateSpellSlots, getHighestAvailableSpellSlot, calculateWeaponAmmunition, getAmmoQuantities } from './dnd5e/spells.js';
import { normalizeActivationType, extractItemSpell, resolveRootSpellDocument, getActivityActivationType, requiresComponent, getComponentTabs } from './dnd5e/activities.js';
import { Dnd5eSystemContextMenuManager } from './context-menu/dnd5e-system-context-menu-manager.js';
import { Dnd5eSystemTabFilterManager } from './filter/dnd5e-system-tab-filter-manager.js';

/**
 * System adapter for D&D 5th Edition.
 * Handles D&D 5e's specific item types, action categories, spell slot calculations,
 * and spell preparation toggles.
 */
export class Dnd5eSystemAdapter extends FantasySystemAdapter {
    #actor = null;
    #highestAvailableSlot = 0;
    #ammoQuantities = new Map();

    constructor() {
        super('dnd5e');
        this.contextMenuManager = new Dnd5eSystemContextMenuManager(this);
        this.filterManager = new Dnd5eSystemTabFilterManager(this);
    }

    get actor() {
        return this.#actor;
    }

    /**
     * Initialize adapter context for an actor.
     * Pre-calculates ammo quantities and highest available spell slot for O(1) lookups during action modification.
     * @param {Actor} actor
     */
    init(actor) {
        this.#actor = actor;
        this.#highestAvailableSlot = actor ? this.#getHighestAvailableSpellSlot(actor) : 0;
        this.#ammoQuantities = actor ? this.#getAmmoQuantities(actor) : new Map();
    }

    get highestAvailableSlot() {
        return this.#highestAvailableSlot;
    }

    // #region Core Action Modification

    /**
     * Determine if a specific item should be extracted as a base action for DnD5e.
     * Prevents allocating objects for unallowed types, cached helper items, and unequipped gear.
     */
    shouldExtractItem(item) {
        const type = item.type;
        if (!ALLOWED_TYPES.has(type) || item.getFlag?.('dnd5e', 'cachedFor')) return false;
        return !(['consumable', 'tool'].includes(type) && !this.getItemEquipped(item));
    }

    /**
     * Filter, map, and sort the base actions list for DnD5e.
     * @param {Object[]} actions Base action list from the core
     * @param {Actor} actor 
     * @returns {Object[]} The modified actions list
     */
    async modifyActions(actions, actor) {
        this.init(actor);
        const modified = [];
        const filterNoResources = game.settings.get(MODULE_ID, 'filterNoResources');

        for (const action of actions) {
            const item = action.originalItem;
            const type = item.type;
            // Extract spell components if it's a spell (for the Spell Components tab)
            const props = item.system?.properties;
            const spellComponents = [];
            if (item.type === 'spell') {
                spellComponents.push(...this.#getComponentTabs(action));
            }

            // Check if user has hidden this item
            const hiddenIds = actor?.getFlag?.(MODULE_ID, 'hiddenItems') ?? [];
            const isUserHidden = hiddenIds.includes(item.id);

            // 1. Filter out unprepared spells (unless innate/at-will/pact, showUnprepared is enabled, or item is user-hidden)
            let isSpellUnprepared = false;
            if (type === 'spell') {
                const prepMode = item.system.method;
                const isPrepared = Boolean(item.system.prepared);
                isSpellUnprepared = !['innate', 'atwill', 'pact'].includes(prepMode) && !isPrepared;
                const showUnprepared = actor?.getFlag?.(MODULE_ID, 'showUnprepared');

                if (!showUnprepared && isSpellUnprepared && !isUserHidden) {
                    continue;
                }
            }

            // 2. Filter out unequipped weapons and equipment (unless showUnequipped is enabled or item is user-hidden)
            let isUnequipped = false;
            if (['weapon', 'equipment'].includes(type)) {
                isUnequipped = !this.getItemEquipped(item);
                const showUnequipped = actor?.getFlag?.(MODULE_ID, `showUnequipped_${type}`);

                if (!showUnequipped && isUnequipped && !isUserHidden) {
                    continue;
                }
            }

            // 4. Process activities if they exist (D&D 5e v4+)
            const activities = this.getItemActivities(item);

            if (activities.length > 0) {
                // Map D&D 5e Activities to sub-actions for the generic HUD item model
                const rawActivities = await Promise.all(activities.map(async (activity) => {
                    const linkedAction = await this.#resolveActivityLinkedAction(activity, actor);
                    const activationType = this.#getActivityActivationType(activity, item, linkedAction);
                    if (!activationType || activationType === 'none') return null;

                    const parentId = this.#getParentTab(activationType);
                    const subId = this.#getSubTab(activationType);
                    const tabRef = TabRef.from(parentId, subId);

                    return new Action({
                        id: activity.id,
                        name: activity.name || linkedAction?.name || activity.type.toUpperCase(),
                        img: activity.img || linkedAction?.img || item.img,
                        uses: this.#calculateActivityUses(activity, item),
                        tabs: [tabRef],
                        roll: async (event) => {
                            const proxiedEvent = this._createRollEvent(event);
                            return activity.use({ event: proxiedEvent }, { event: proxiedEvent });
                        },
                        originalItem: item,
                        originalActivity: activity,
                        linkedAction
                    });
                }));

                const mappedActivities = rawActivities.filter(Boolean);
                if (mappedActivities.length === 0) continue;

                // Extract spell components from linked spells on cast activities or item properties if present
                for (const act of mappedActivities) {
                    const compTabs = this.#getComponentTabs(act);
                    if (compTabs.length > 0) {
                        spellComponents.push(...compTabs);
                        act.tabs = [...act.tabs, ...compTabs];
                    }
                }

                // Single-pass Resource Filtering: Filter out depleted D&D 5e Activities if enabled
                let filteredActivities = mappedActivities;
                if (filterNoResources) {
                    filteredActivities = mappedActivities.filter(act => !act.isDepleted);

                    // If all activities are depleted, skip this item entirely!
                    if (filteredActivities.length === 0) {
                        continue;
                    }
                }

                log.debug(`Item "${item.name}" (${item.id}) activities (${filteredActivities.length}/${mappedActivities.length}):`, mappedActivities.map(a => ({
                    name: a.name,
                    uses: a.uses,
                    isDepleted: a.isDepleted,
                    tabs: a.tabs?.map(t => t.path)
                })));

                // Assign to hierarchical item types: [parentType, subType] (for left-side tabs)
                const itemTypes = this.#getItemTabTypes(item, type, filteredActivities);

                // Calculate main action uses
                const actionUses = filteredActivities.length === 1
                    ? filteredActivities[0].uses
                    : this.#calculateUses(item);

                // Create a SINGLE Action instance for the item
                const activityAction = new Action({
                    ...action,
                    name: item.name, // Keep the clean item name
                    img: item.img, // Use the parent item's icon
                    available: !(isSpellUnprepared || isUnequipped),
                    subactions: filteredActivities,
                    tabs: this.#collectUniqueTabs(filteredActivities),
                    itemTypes,
                    uses: actionUses,
                    roll: async (event) => {
                        // Roll the first active activity directly
                        return filteredActivities[0].roll(event);
                    }
                });

                modified.push(activityAction);
            } else if (['equipment', 'weapon', 'backpack', 'loot'].includes(type)) {
                // Passive items (armor, passive shields, containers, loot) are assigned right-side tab 'none' under 'economy'
                const subType = item.system.type?.value;
                const passiveAction = new Action({
                    ...action,
                    available: !(isSpellUnprepared || isUnequipped),
                    tabs: [TabRef.from('economy', 'none')],
                    itemTypes: subType ? [type, subType] : [type],
                    uses: { available: null, max: null }
                });
                modified.push(passiveAction);
            }
        }

        return modified;
    }

    // #endregion

    // #region Internal Filtering Logic

    // #endregion

    // #region Localizations & UI Formatting

    /**
     * Determine the parent action tab based on DnD5e activation type.
     */
    #getParentTab(type) {
        // Everything (including times, actions, legendary, special, none)
        // now goes under 'economy' (Action Economy)
        return 'economy';
    }

    /**
     * Determine the sub-action tab based on DnD5e activation type.
     */
    #getSubTab(type) {
        if (!type) return 'none';
        return String(type).toLowerCase();
    }

    modifyContext(context, app) {
        super.modifyContext(context, app);
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

    // #endregion

    // #region User Interaction Events & Helpers

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

    /**
     * Get the localized label for a left-side item sub-tab for DnD5e.
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

    /**
     * Get the localized label for a right-side action type (parent tab) for DnD5e.
     */
    getActionTypeLabel(parentId) {
        const config = LABEL_KEYS.action_type[parentId];
        return config ? localize(config[0], config[1]) : super.getActionTypeLabel(parentId);
    }

    /**
     * Get the CSS icon class for a right-side action type (parent tab) for DnD5e.
     */
    getActionTypeIcon(parentId) {
        return ICONS.action_type[parentId] ?? super.getActionTypeIcon(parentId);
    }

    getActionSubTabLabel(subId) {
        const config = LABEL_KEYS.action_subtab[subId];
        return config ? localize(config[0], config[1]) : super.getActionSubTabLabel(subId);
    }

    // #endregion

    // #region System Specific Data Extractors & Schema Helpers

    #extractItemSpell(obj) {
        return extractItemSpell(obj);
    }

    #resolveRootSpellDocument(sub, parentItem) {
        return resolveRootSpellDocument(sub, parentItem);
    }

    async #resolveActivityLinkedAction(activity, actor) {
        if (activity.type === 'cast' && activity.spell?.uuid) {
            try {
                const doc = await fromUuid(activity.spell.uuid);
                if (doc) return doc;
            } catch (e) {
                log.debug(`Failed to resolve compendium spell UUID ${activity.spell.uuid}:`, e);
            }
        }
        if (actor) {
            const cached = actor.items?.find(i => i.flags?.dnd5e?.cachedFor?.endsWith(activity.id));
            if (cached) return cached;
        }
        return activity.cachedSpell ?? activity.spell ?? activity;
    }

    #requiresComponent(sub, component) {
        return requiresComponent(sub, component);
    }

    #getComponentTabs(doc) {
        return getComponentTabs(doc);
    }

    #collectUniqueTabs(activities) {
        const uniqueTabsMap = new Map();
        for (const activity of activities) {
            for (const tab of activity.tabs ?? []) {
                if (tab?.path && !uniqueTabsMap.has(tab.path)) {
                    uniqueTabsMap.set(tab.path, tab);
                }
            }
        }
        return Array.from(uniqueTabsMap.values());
    }

    #getItemTabTypes(item, type, filteredActivities) {
        if (type === 'spell') {
            return ['spell', `level_${item.system.level ?? 0}`];
        }

        const hasLimited = this.#hasLimitedUses(item);
        const hasCastActivity = filteredActivities.some(act => act.originalActivity?.type === 'cast');
        const isItemCharges = (type === 'equipment' && hasLimited)
            || (['feat', 'weapon', 'consumable', 'tool'].includes(type) && hasLimited && hasCastActivity);

        if (isItemCharges) {
            return ['spell', 'itemCharges'];
        }
        if (type === 'weapon' || type === 'equipment') {
            const subType = item.system.type?.value;
            return subType ? [type, subType] : [type];
        }
        return [type];
    }

    /**
     * Check if a D&D 5e item is equipped.
     * @param {Item} item
     * @returns {boolean}
     */
    getItemEquipped(item) {
        return item.system.equipped !== false;
    }

    /**
     * Get activities collection from a D&D 5e item.
     * @param {Item} item
     * @returns {Activities[]}
     */
    getItemActivities(item) {
        const activities = item.system?.activities;
        if (!activities) return [];
        if (typeof activities.values === 'function') {
            return Array.from(activities.values());
        }
        if (Array.isArray(activities)) {
            return activities;
        }
        if (typeof activities === 'object') {
            return Object.values(activities);
        }
        return [];
    }

    /**
     * Calculate available and maximum uses for an item.
     */
    calculateUses(item) {
        return this.#calculateUses(item);
    }

    #calculateUses(item) {
        if (item.type === 'spell') {
            return this.#calculateSpellSlots(item);
        }

        const system = item.system;

        // 1. Limited Uses (standard item charges/uses)
        if (system.uses && system.uses.max && system.uses.max !== "0") {
            let max = system.uses.max;
            if (typeof max === 'string') {
                max = parseInt(max, 10) || 0;
            }

            if (max > 0) {
                const spent = system.uses.spent;
                let available = (spent !== undefined && spent !== null)
                    ? Math.max(0, max - spent)
                    : (system.uses.value ?? 0);
                // Scale by quantity for consumables
                const quantity = system.quantity ?? 1;
                if (quantity > 1 && item.type === 'consumable') {
                    available = available + (quantity - 1) * max;
                    max = max * quantity;
                }
                return { available, max };
            }
        }

        // 2. Consumable Quantity (if no explicit charges, quantity is the uses)
        if (item.type === 'consumable') {
            return {
                available: system.quantity ?? 0,
                max: null
            };
        }

        // 3. Thrown Weapons (quantity is the uses)
        if (item.type === 'weapon' && foundry.utils.getProperty(system.properties, 'thr') && !foundry.utils.getProperty(system.properties, 'ret')) {
            return {
                available: system.quantity ?? 0,
                max: null
            };
        }

        return { available: null, max: null };
    }

    /**
     * Check if an item has limited uses (either at the item level or activity level).
     * @param {Item} item The item to check
     * @returns {boolean} True if the item has limited uses
     * @private
     */
    #hasLimitedUses(item) {
        if (this.#calculateLimitedUses(item.system?.uses)) return true;
        return Array.from(item.system?.activities?.values() ?? [])
            .some(activity => this.#calculateLimitedUses(activity.uses));
    }

    /**
     * Parse and calculate limited uses configuration.
     * @private
     */
    #calculateLimitedUses(uses) {
        if (uses && uses.max && uses.max !== "0") {
            let max = uses.max;
            if (typeof max === 'string') {
                max = parseInt(max, 10) || 0;
            }
            if (max > 0) {
                const spent = uses.spent;
                const available = (spent !== undefined && spent !== null)
                    ? Math.max(0, max - spent)
                    : (uses.value ?? max);
                return { available, max };
            }
        }
        return null;
    }

    /**
     * Resolve target item reference using direct ID or relative UUID.
     * @private
     */
    #resolveTargetItem(targetId, item, actor) {
        if (!targetId) return null;
        return targetId.includes('.')
            ? (foundry.utils.fromUuidSync(targetId, { relative: item })
               || foundry.utils.fromUuidSync(targetId, { relative: actor })
               || actor.items.get(targetId))
            : actor.items.get(targetId);
    }

    /**
     * Calculate available and maximum uses for a D&D 5e Activity.
     * @param {Activity} activity The activity instance
     * @param {Item} item The parent item
     * @param {Actor} actor The actor
     * @param {Map<string, number>} ammoQuantities Pre-calculated ammunition quantities
     * @param {number} highestAvailableSlot The highest available spell slot level on the actor
     * @returns {{available: number|null, max: number|null}} The uses count
     * @private
     */
    #calculateActivityUses(activity, item, actor = this.#actor, ammoQuantities = this.#ammoQuantities, highestAvailableSlot = this.#highestAvailableSlot) {
        const targets = activity.consumption?.targets ?? [];
        
        // 1. If the activity has its own explicit limited uses
        const selfUses = this.#calculateLimitedUses(activity.uses);
        if (selfUses) return selfUses;
        
        // 2. Resolve based on consumption targets
        for (const target of targets) {
            if (target.type === 'activityUses') {
                // Consumes another activity's uses (or self if target is empty)
                const targetActivity = target.target ? item.system.activities.get(target.target) : activity;
                if (targetActivity) {
                    const actUses = this.#calculateLimitedUses(targetActivity.uses);
                    if (actUses) return actUses;
                }
            } else if (target.type === 'itemUses') {
                // Consumes the parent item's uses
                return this.#calculateUses(item);
            } else if (target.type === 'spellSlots') {
                // Consumes actor spell slots
                const level = target.target ?? item.system.level; // Fallback to spell's base level if target is empty (dynamic slots)
                return this.#getSpellSlotUses(actor, level, highestAvailableSlot);
            } else if (target.type === 'item') {
                // Consumes quantity of another item (e.g. ammunition) or charges of another item
                const targetItem = this.#resolveTargetItem(target.target, item, actor);

                if (targetItem) {
                    const consumed = target.value || 1;
                    // If the target item has its own limited uses (like a wand), use those
                    const uses = this.#calculateUses(targetItem);
                    if (uses.available !== null) {
                        return {
                            available: Math.floor(uses.available / consumed),
                            max: uses.max !== null ? Math.floor(uses.max / consumed) : null
                        };
                    }
                    // Otherwise, use its quantity (standard ammo/consumable)
                    const qty = targetItem.system.quantity ?? 0;
                    return {
                        available: Math.floor(qty / consumed),
                        max: null
                    };
                }
            } else if (target.type === 'material') {
                // Consumes quantity of another item (specifically spell components)
                const targetItem = this.#resolveTargetItem(target.target, item, actor);

                if (targetItem) {
                    const qty = targetItem.system.quantity ?? 0;
                    const consumed = target.value || 1;
                    return {
                        available: Math.floor(qty / consumed),
                        max: null
                    };
                }
            }
        }
        
        // Fallback for standard spells if no explicit spellSlots consumption target was resolved
        if (item.type === 'spell') {
            return this.#calculateUses(item);
        }

        // Fallback for weapons requiring ammunition if no explicit consumption target was resolved
        if (item.type === 'weapon' && item.system.ammunition?.type) {
            return this.#calculateWeaponAmmunition(item, ammoQuantities);
        }

        return { available: null, max: null };
    }

    /**
     * Calculate spell slot uses (pact or standard) for a given slot level, including upcast logic.
     * @private
     */
    #getSpellSlotUses(actor, level, highestAvailableSlot) {
        return getSpellSlotUses(actor, level, highestAvailableSlot);
    }

    #hasAvailableUpcastSlots(level, highestAvailableSlot) {
        return hasAvailableUpcastSlots(level, highestAvailableSlot);
    }

    #calculateSpellSlots(item, actor = this.#actor, highestAvailableSlot = this.#highestAvailableSlot) {
        return calculateSpellSlots(item, actor, highestAvailableSlot);
    }

    #calculateWeaponAmmunition(item, ammoQuantities) {
        return calculateWeaponAmmunition(item, ammoQuantities);
    }

    #getAmmoQuantities(actor) {
        return getAmmoQuantities(actor);
    }

    #getHighestAvailableSpellSlot(actor) {
        return getHighestAvailableSpellSlot(actor);
    }

    #normalizeActivationType(type) {
        return normalizeActivationType(type);
    }

    #getActivityActivationType(activity, item, linkedAction = null) {
        return getActivityActivationType(activity, item, linkedAction);
    }

    // #endregion
}
