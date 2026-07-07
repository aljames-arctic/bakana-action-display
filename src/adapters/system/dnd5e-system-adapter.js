import { FantasySystemAdapter } from './genre/fantasy-system-adapter.js';
import { localize, toSet } from '../../lib/utils.js';
import { log } from '../../lib/logger.js';
import { MODULE_ID } from '../../constants.js';
import { TabRef } from '../../ui/tab-ref.js';
import { Action } from '../../ui/action.js';

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
        'components': { 'vocal': 0, 'somatic': 1, 'material': 2 }
    },
    item_type: {
        'weapon': 1,
        'equipment': 2,
        'spell': 3,
        'consumable': 4,
        'tool': 5,
        'backpack': 6,
        'loot': 7,
        'feat': 8
    }
};

const ALLOWED_TYPES = new Set(['weapon', 'equipment', 'consumable', 'tool', 'backpack', 'loot', 'feat', 'spell']);

/**
 * System adapter for D&D 5th Edition.
 * Handles D&D 5e's specific item types, action categories, spell slot calculations,
 * and spell preparation toggles.
 */
export class Dnd5eSystemAdapter extends FantasySystemAdapter {
    constructor() {
        super('dnd5e');
    }

    // #region Core Action Modification

    /**
     * Determine if a specific item should be extracted as a base action for DnD5e.
     * Prevents allocating objects for unallowed types, cached helper items, and unequipped gear.
     */
    shouldExtractItem(item) {
        const type = item.type;
        if (!ALLOWED_TYPES.has(type)) return false;
        if (item.getFlag('dnd5e', 'cachedFor')) return false;

        const isEquipped = this.getItemEquipped(item);
        if (['consumable', 'tool'].includes(type) && !isEquipped) {
            return false;
        }
        return true;
    }

    /**
     * Filter, map, and sort the base actions list for DnD5e.
     * @param {Object[]} actions Base action list from the core
     * @param {Actor} actor 
     * @returns {Object[]} The modified actions list
     */
    async modifyActions(actions, actor) {
        const modified = [];
        const filterNoResources = game.settings.get(MODULE_ID, 'filterNoResources');

        // Pre-calculate ammunition quantities by subtype in a single pass to avoid nested loops (O(I) complexity)
        const ammoQuantities = this.#getAmmoQuantities(actor);

        // Pre-calculate the highest available spell slot level in a single pass (O(1) upcast checks later)
        let highestAvailableSlot = this.#getHighestAvailableSpellSlot(actor);

        for (const action of actions) {
            const item = action.originalItem;
            const type = item.type;
            // Extract spell components if it's a spell (for the Spell Components tab)
            const props = item.system?.properties;
            const spellComponents = [];
            if (item.type === 'spell') {
                if (this.#subRequiresComponent(action, 'vocal')) spellComponents.push(TabRef.from('components', 'vocal'));
                if (this.#subRequiresComponent(action, 'somatic')) spellComponents.push(TabRef.from('components', 'somatic'));
                if (this.#subRequiresComponent(action, 'material')) spellComponents.push(TabRef.from('components', 'material'));
            }

            // Check if user has hidden this item
            const hiddenIds = actor.getFlag(MODULE_ID, 'hiddenItems') ?? [];
            const isUserHidden = hiddenIds.includes(item.id);

            // 1. Filter out unprepared spells (unless innate/at-will/pact, showUnprepared is enabled, or item is user-hidden)
            let isSpellUnprepared = false;
            if (type === 'spell') {
                const prepMode = item.system.method;
                const isPrepared = !!item.system.prepared;
                const showUnprepared = actor.getFlag(MODULE_ID, 'showUnprepared');
                
                if (!['innate', 'atwill', 'pact'].includes(prepMode) && !isPrepared) {
                    isSpellUnprepared = true;
                }
                
                if (!showUnprepared && isSpellUnprepared && !isUserHidden) {
                    continue;
                }
            }

            // 2. Filter out unequipped weapons and equipment (unless showUnequipped is enabled or item is user-hidden)
            let isUnequipped = false;
            if (['weapon', 'equipment'].includes(type)) {
                const isEquipped = this.getItemEquipped(item);
                const showUnequipped = actor.getFlag(MODULE_ID, `showUnequipped_${type}`);
                
                if (!isEquipped) {
                    isUnequipped = true;
                }
                
                if (!showUnequipped && isUnequipped && !isUserHidden) {
                    continue;
                }
            }

            // 4. Process activities if they exist (D&D 5e v4+)
            const activities = this.getItemActivities(item);

            if (activities.length > 0) {
                // Map D&D 5e Activities to sub-actions for the generic HUD item model
                const rawActivities = await Promise.all(activities.map(async (activity) => {
                    let linkedAction = null;
                    if (activity.type === 'cast' && activity.spell?.uuid) {
                        try {
                            linkedAction = await fromUuid(activity.spell.uuid);
                        } catch (e) {
                            log.debug(`Failed to resolve compendium spell UUID ${activity.spell.uuid}:`, e);
                        }
                    }
                    if (!linkedAction && actor) {
                        linkedAction = actor.items?.find(i => i.flags?.dnd5e?.cachedFor?.endsWith(activity.id));
                    }
                    if (!linkedAction) {
                        linkedAction = activity.cachedSpell ?? activity.spell ?? activity;
                    }

                    const activationType = this.#getActivityActivationType(activity, item, linkedAction);
                    if (!activationType || activationType === 'none') return null;

                    const parentId = this.#getParentTab(activationType);
                    const subId = this.#getSubTab(activationType);
                    const tabRef = TabRef.from(parentId, subId);

                    const activityName = activity.name || linkedAction?.name || activity.type.toUpperCase();
                    const activityImg = activity.img || linkedAction?.img || item.img;

                    return new Action({
                        id: activity.id,
                        name: activityName,
                        img: activityImg,
                        uses: this.#calculateActivityUses(activity, item, actor, ammoQuantities, highestAvailableSlot),
                        tabs: [tabRef],
                        roll: async (event) => {
                            const proxiedEvent = this._createRollEvent(event);
                            return activity.use({ event: proxiedEvent }, { event: proxiedEvent });
                        },
                        originalItem: item,
                        originalActivity: activity,
                        linkedAction: linkedAction
                    });
                }));

                const mappedActivities = rawActivities.filter(Boolean);
                if (mappedActivities.length === 0) continue;

                // Extract spell components from linked spells on cast activities or item properties if present
                for (const act of mappedActivities) {
                    const isVocal = this.#subRequiresComponent(act, 'vocal');
                    const isSomatic = this.#subRequiresComponent(act, 'somatic');
                    const isMaterial = this.#subRequiresComponent(act, 'material');

                    if (isVocal || isSomatic || isMaterial) {
                        const compTabs = [];
                        if (isVocal) compTabs.push(TabRef.from('components', 'vocal'));
                        if (isSomatic) compTabs.push(TabRef.from('components', 'somatic'));
                        if (isMaterial) compTabs.push(TabRef.from('components', 'material'));

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

                log.debug(`[BAD Debug] Item "${item.name}" (${item.id}) activities: totalMapped=${mappedActivities.length}, afterResourceFilter=${filteredActivities.length} (filterNoResources=${filterNoResources})`);
                if (item.id === 'mmSpellcasting00' || item.name === 'Spellcasting') {
                    log.debug(`[BAD Debug] Spellcasting activities (${filteredActivities.length}/${mappedActivities.length}):`, mappedActivities.map(a => ({ name: a.name, uses: a.uses, isDepleted: a.isDepleted, tabs: a.tabs?.map(t => t.path) })));
                }

                // Assign to hierarchical item types: [parentType, subType] (for left-side tabs)
                const hasCastActivity = filteredActivities.some(act => act.originalActivity?.type === 'cast');
                const isItemCharges = (type === 'equipment' && this.#hasLimitedUses(item))
                    || (['feat', 'weapon', 'consumable', 'tool'].includes(type) && this.#hasLimitedUses(item) && hasCastActivity);

                let itemTypes = [type];
                if (type === 'spell') {
                    const level = item.system.level ?? 0;
                    itemTypes = ['spell', `level_${level}`];
                } else if (isItemCharges) {
                    itemTypes = ['spell', 'itemCharges'];
                } else if (type === 'weapon' || type === 'equipment') {
                    const subType = item.system.type?.value;
                    itemTypes = subType ? [type, subType] : [type];
                }

                // Calculate main action uses
                let actionUses;
                if (filteredActivities.length === 1) {
                    actionUses = filteredActivities[0].uses;
                } else {
                    if (type === 'spell') {
                        actionUses = this.#calculateSpellSlots(item, actor, highestAvailableSlot);
                    } else {
                        actionUses = this.#calculateUses(item);
                    }
                }

                // Collect all unique tabs from the remaining non-depleted activities
                const uniqueTabsMap = new Map();
                for (const activity of filteredActivities) {
                    for (const tab of activity.tabs) {
                        if (tab && tab.path && !uniqueTabsMap.has(tab.path)) {
                            uniqueTabsMap.set(tab.path, tab);
                        }
                    }
                }

                // Create a SINGLE Action instance for the item
                const activityAction = new Action({
                    ...action,
                    name: item.name, // Keep the clean item name
                    img: item.img, // Use the parent item's icon
                    available: !(isSpellUnprepared || isUnequipped),
                    subactions: filteredActivities,
                    tabs: Array.from(uniqueTabsMap.values()),
                    itemTypes: itemTypes,
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

    /**
     * Check if a spell's properties contain a specific property label (e.g. 'vocal', 'somatic', 'material').
     * Enforces strict type validation (must be Set or Array if present).
     * @param {Set<string>|Array<string>|null} spellProps
     * @param {string} prop
     * @returns {boolean}
     * @private
     */
    // #endregion

    // #region Internal Filtering Logic

    /**
     * System-specific sub-action filtering for D&D 5e activities.
     * Checks D&D 5e spell components (vocal, somatic, material) on linkedActions/originalActivities.
     */
    filterSubactions(subactions, filterContext) {
        const baseFiltered = super.filterSubactions(subactions, filterContext);
        const activeCompSubs = this.getActiveExclusionSubs(filterContext);

        if (activeCompSubs.length === 0) {
            return baseFiltered;
        }

        // Filter out subactions requiring banned spell components
        return baseFiltered.filter(sub => {
            const hasPropertyMatch = activeCompSubs.some(comp => this.#subRequiresComponent(sub, comp));
            const hasTabMatch = sub.tabs?.some(tab => tab.root === 'components' && activeCompSubs.includes(tab.label));
            return !hasPropertyMatch && !hasTabMatch;
        });
    }

    getTabCombinator(parentId) {
        return parentId === 'components' ? 'difference' : 'union';
    }

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
        
        const spellParent = context.itemTypes.find(t => t.id === 'spell');
        if (spellParent && spellParent.subTabs.length > 0) {
            const showUnprepared = app.actor.getFlag(MODULE_ID, 'showUnprepared') ?? false;
            spellParent.addSubTab({
                id: 'all',
                label: localize('BAD.common.allSpells', 'All Spells'),
                active: app.leftTabs.activeParents.has('spell') && app.leftTabs.activeSubTypes.size === 0,
                showUnprepared: showUnprepared
            });
            spellParent.updateOrder(Object.keys(SORT_ORDERS.tabs['spell']));
        }

        const weaponParent = context.itemTypes.find(t => t.id === 'weapon');
        if (weaponParent) {
            const showUnequipped = app.actor.getFlag(MODULE_ID, 'showUnequipped_weapon') ?? false;
            weaponParent.addSubTab({
                id: 'all',
                label: localize('BAD.common.allWeapons', 'All Weapons'),
                active: app.leftTabs.activeParents.has('weapon') && app.leftTabs.activeSubTypes.size === 0,
                showUnprepared: showUnequipped
            });
            weaponParent.updateOrder(Object.keys(SORT_ORDERS.tabs['weapon']));
        }

        const equipmentParent = context.itemTypes.find(t => t.id === 'equipment');
        if (equipmentParent) {
            const showUnequipped = app.actor.getFlag(MODULE_ID, 'showUnequipped_equipment') ?? false;
            equipmentParent.addSubTab({
                id: 'all',
                label: localize('BAD.common.allEquipment', 'All Equipment'),
                active: app.leftTabs.activeParents.has('equipment') && app.leftTabs.activeSubTypes.size === 0,
                showUnprepared: showUnequipped
            });
            equipmentParent.updateOrder(Object.keys(SORT_ORDERS.tabs['equipment']));
        }
    }

    // #endregion

    // #region User Interaction Events & Helpers

    /**
     * Get D&D 5e-specific context menu items for spells (Prepare/Unprepare).
     * @param {ApplicationV2} app The ActionDisplayApp instance
     * @returns {Object[]} An array of context menu item configurations
     */
    getContextMenuItems(app) {
        return [
            {
                name: "BAD.common.prepareSpell",
                icon: '<i class="fas fa-book"></i>',
                condition: el => {
                    if (!app.actor?.isOwner) return false;
                    const action = app.actions.find(a => a.id === el.dataset.actionId);
                    if (!action) return false;
                    const item = action.originalItem;
                    if (item?.type !== 'spell') return false;
                    
                    const prepMode = item.system.method;
                    const isPrepared = !!item.system.prepared;
                    return !['innate', 'atwill', 'pact'].includes(prepMode) && !isPrepared;
                },
                callback: async el => {
                    const action = app.actions.find(a => a.id === el.dataset.actionId);
                    const item = action?.originalItem;
                    if (item) {
                        log.debug(`Preparing spell: ${item.name}`);
                        await item.update({ "system.prepared": 1 });
                    }
                }
            },
            {
                name: "BAD.common.unprepareSpell",
                icon: '<i class="fas fa-book-dead"></i>',
                condition: el => {
                    if (!app.actor?.isOwner) return false;
                    const action = app.actions.find(a => a.id === el.dataset.actionId);
                    if (!action) return false;
                    const item = action.originalItem;
                    if (item?.type !== 'spell') return false;
                    
                    const prepMode = item.system.method;
                    return !['innate', 'atwill', 'pact'].includes(prepMode) && item.system.prepared === 1;
                },
                callback: async el => {
                    const action = app.actions.find(a => a.id === el.dataset.actionId);
                    const item = action?.originalItem;
                    if (item) {
                        log.debug(`Unpreparing spell: ${item.name}`);
                        await item.update({ "system.prepared": 0 });
                    }
                }
            },
            {
                name: "BAD.common.equipItem",
                icon: '<i class="fas fa-shield-halved"></i>',
                condition: el => {
                    if (!app.actor?.isOwner) return false;
                    const action = app.actions.find(a => a.id === el.dataset.actionId);
                    if (!action) return false;
                    const item = action.originalItem;
                    if (!item || !['weapon', 'equipment'].includes(item.type)) return false;
                    return !this.getItemEquipped(item);
                },
                callback: async el => {
                    const action = app.actions.find(a => a.id === el.dataset.actionId);
                    const item = action?.originalItem;
                    if (item) {
                        log.debug(`Equipping item: ${item.name}`);
                        await item.update({ "system.equipped": true });
                    }
                }
            },
            {
                name: "BAD.common.unequipItem",
                icon: '<i class="fas fa-shield-slash"></i>',
                condition: el => {
                    if (!app.actor?.isOwner) return false;
                    const action = app.actions.find(a => a.id === el.dataset.actionId);
                    if (!action) return false;
                    const item = action.originalItem;
                    if (!item || !['weapon', 'equipment'].includes(item.type)) return false;
                    return this.getItemEquipped(item);
                },
                callback: async el => {
                    const action = app.actions.find(a => a.id === el.dataset.actionId);
                    const item = action?.originalItem;
                    if (item) {
                        log.debug(`Unequipping item: ${item.name}`);
                        await item.update({ "system.equipped": false });
                    }
                }
            }
        ];
    }

    /**
     * Handle right-click on "All" sub-tabs (Spells, Weapons, Equipment) to toggle unprepared/unequipped items.
     * @param {ApplicationV2} app The ActionDisplayApp instance
     * @param {HTMLElement} el The tab element that was right-clicked
     * @param {Event} event The event
     * @returns {boolean} True if handled
     */
    onTabRightClick(app, el, event) {
        if (el.dataset.type === 'all') {
            const parentGroup = el.closest('.bad-left-tab-group');
            const parentTab = parentGroup?.querySelector('.bad-left-tab');
            const parentType = parentTab?.dataset.type;

            if (parentType === 'spell' && app.actor?.isOwner) {
                const showUnprepared = app.actor.getFlag(MODULE_ID, 'showUnprepared') ?? false;
                app.actor.setFlag(MODULE_ID, 'showUnprepared', !showUnprepared);
                return true;
            }

            if (['weapon', 'equipment'].includes(parentType) && app.actor?.isOwner) {
                const flagKey = `showUnequipped_${parentType}`;
                const showUnequipped = app.actor.getFlag(MODULE_ID, flagKey) ?? false;
                app.actor.setFlag(MODULE_ID, flagKey, !showUnequipped);
                return true;
            }
        }
        return false;
    }

    getItemTypeSortOrder(parentId) {
        return SORT_ORDERS.item_type[parentId] ?? super.getItemTypeSortOrder(parentId);
    }

    getActionSubTabSortOrder(parentId, subId) {
        return SORT_ORDERS.tabs[parentId]?.[subId] ?? super.getActionSubTabSortOrder(parentId, subId);
    }



    getItemTypeLabel(parentId) {
        const labels = {
            'all': localize('BAD.core.allItems', 'All Items'),
            'weapon': localize('DND5E.ItemTypeWeapon', 'Weapon'),
            'equipment': localize('DND5E.ItemTypeEquipment', 'Equipment'),
            'consumable': localize('DND5E.ItemTypeConsumable', 'Consumable'),
            'tool': localize('DND5E.ItemTypeTool', 'Tool'),
            'backpack': localize('DND5E.ItemTypeContainer', 'Container'),
            'loot': localize('DND5E.ItemTypeLoot', 'Loot'),
            'feat': localize('DND5E.ItemTypeFeat', 'Feature'),
            'spell': localize('DND5E.ItemTypeSpell', 'Spell'),
            'other': localize('DND5E.ActionOther', 'Other'),
            'hidden': localize('BAD.core.hidden', 'Hidden')
        };
        return labels[parentId] ?? super.getItemTypeLabel(parentId);
    }

    getItemTypeIcon(parentId) {
        const icons = {
            'equipment': 'fas fa-shield',
            'tool': 'fas fa-hammer',
            'backpack': 'fas fa-sack',
            'loot': 'fas fa-gem'
        };
        return icons[parentId] ?? super.getItemTypeIcon(parentId);
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
        if (parentId === 'weapon') {
            if (subId === 'all') return localize('BAD.common.allWeapons', 'All Weapons');
            const key = `DND5E.Weapon${subId.charAt(0).toUpperCase() + subId.slice(1)}`;
            return localize(key, CONFIG?.DND5E?.weaponTypes?.[subId] ?? subId);
        }
        if (parentId === 'equipment') {
            if (subId === 'all') return localize('BAD.common.allEquipment', 'All Equipment');
            const key = `DND5E.Equipment${subId.charAt(0).toUpperCase() + subId.slice(1)}`;
            return localize(key, CONFIG?.DND5E?.equipmentTypes?.[subId] ?? subId);
        }
        return super.getItemSubTabLabel(parentId, subId);
    }

    /**
     * Get the localized label for a right-side action type (parent tab) for DnD5e.
     */
    getActionTypeLabel(parentId) {
        const labels = {
            'economy': localize('BAD.common.actionEconomy', 'Action Economy'),
            'components': localize('BAD.common.spellComponents', 'Spell Components')
        };
        return labels[parentId] ?? super.getActionTypeLabel(parentId);
    }

    /**
     * Get the CSS icon class for a right-side action type (parent tab) for DnD5e.
     */
    getActionTypeIcon(parentId) {
        const icons = {
            'economy': 'fas fa-stopwatch',
            'components': 'fas fa-magic'
        };
        return icons[parentId] ?? super.getActionTypeIcon(parentId);
    }

    getActionSubTabLabel(subId) {
        const labels = {
            'all': localize('BAD.core.allActions', 'All Actions'),
            'action': localize('DND5E.Action', 'Action'),
            'bonus': localize('DND5E.BonusAction', 'Bonus Action'),
            'reaction': localize('DND5E.Reaction', 'Reaction'),
            'minute': localize('DND5E.TimeMinute', 'Minute'),
            'hour': localize('DND5E.TimeHour', 'Hour'),
            'day': localize('DND5E.TimeDay', 'Day'),
            'legendary': localize('DND5E.LegendaryAction', 'Legendary'),
            'mythic': localize('DND5E.MythicAction', 'Mythic'),
            'lair': localize('DND5E.LairAction', 'Lair'),
            'crew': localize('DND5E.CrewAction', 'Crew'),
            'special': localize('DND5E.Special', 'Special'),
            'none': localize('DND5E.None', 'None'),
            'vocal': localize('DND5E.ComponentVerbal', 'Verbal'),
            'somatic': localize('DND5E.ComponentSomatic', 'Somatic'),
            'material': localize('DND5E.ComponentMaterial', 'Material')
        };
        return labels[subId] ?? super.getActionSubTabLabel(subId);
    }

    // #endregion

    // #region System Specific Data Extractors & Schema Helpers

    /**
     * Recursively resolve the true root spell / item document for an activity or item.
     * Follows linkedActions, activity.spell.uuid, activity.item, activity.cachedSpell recursively.
     * @param {Action} sub Sub-action or Activity Action instance
     * @param {Object} [parentItem] Parent Item5e document
     * @returns {Object|null} The resolved root Item5e document, spell data, or item properties
     * @private
     */
    #resolveRootSpellDocument(sub, parentItem) {
        if (!sub) return null;

        // 1. Check direct linkedAction (if resolved from UUID)
        let doc = sub.linkedAction;

        // 2. Check activity linked sources if doc is not set
        const activity = sub.originalActivity;
        if (!doc && activity) {
            doc = activity.cachedSpell ?? (activity.spell instanceof Item ? activity.spell : null);
            if (!doc && activity.spell?.uuid && typeof fromUuidSync === 'function') {
                try {
                    doc = fromUuidSync(activity.spell.uuid);
                } catch (e) {
                    // ignore sync resolution errors
                }
            }
        }

        // 3. Follow doc links recursively if doc itself has a linked spell / UUID
        const maxDepth = 5;
        let depth = 0;
        while (doc && depth < maxDepth) {
            const nextDoc = doc.linkedAction ?? doc.cachedSpell ?? (doc.spell instanceof Item ? doc.spell : null);
            if (nextDoc && nextDoc !== doc) {
                doc = nextDoc;
                depth++;
            } else {
                break;
            }
        }

        if (doc) return doc;

        // 4. Fallback if no linked spell document was found: check activity.spell object or parent item (if spell)
        if (activity?.spell && typeof activity.spell === 'object' && !(activity.spell instanceof Item)) {
            return activity.spell;
        }

        if (activity?.type === 'cast') {
            return activity.spell || activity;
        }

        const origItem = sub.originalItem ?? parentItem;
        if (origItem?.type === 'spell') {
            return origItem;
        }

        return null;
    }

    /**
     * Helper to test if a property container (Set, Array, or Object) contains the specified component.
     * @param {Set|Array|Object|null} container The property container
     * @param {string} component The component to check for (e.g. 'vocal', 'somatic', 'material')
     * @returns {boolean}
     * @private
     */
    #containerHasComponent(container, component) {
        if (!container) return false;
        const target = container.value ?? container;
        if (target instanceof Set) return target.has(component);
        if (Array.isArray(target)) return target.includes(component);
        if (typeof target === 'object') return !!target[component];
        return false;
    }

    /**
     * Helper to check if a subaction, activity, linked spell, or item requires a given spell component ('vocal', 'somatic', 'material').
     * Resolves the true root spell document first, avoiding stale parent activity property overrides.
     * @param {Action} sub Sub-action
     * @param {string} component 'vocal' | 'somatic' | 'material'
     * @returns {boolean}
     * @private
     */
    #subRequiresComponent(sub, component) {
        if (!sub) return false;

        const rootDoc = this.#resolveRootSpellDocument(sub);
        if (!rootDoc) return false;

        if (this.#containerHasComponent(rootDoc, component)) return true;

        const props = rootDoc.system?.properties ?? rootDoc.properties;
        if (this.#containerHasComponent(props, component)) return true;

        const comps = rootDoc.system?.components ?? rootDoc.components;
        if (this.#containerHasComponent(comps, component)) return true;

        return false;
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
    #calculateUses(item) {
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
        const system = item.system;
        
        // 1. Check item-level uses
        if (system.uses && system.uses.max && system.uses.max !== "0") {
            const max = parseInt(system.uses.max, 10) || 0;
            if (max > 0) return true;
        }
        
        // 2. Check activity-level uses
        const activities = system.activities;
        if (activities) {
            for (const activity of activities.values()) {
                if (activity.uses && activity.uses.max && activity.uses.max !== "0") {
                    const max = parseInt(activity.uses.max, 10) || 0;
                    if (max > 0) return true;
                }
            }
        }
        
        return false;
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
    #calculateActivityUses(activity, item, actor, ammoQuantities, highestAvailableSlot) {
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
            return this.#calculateSpellSlots(item, actor, highestAvailableSlot);
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
        const actorSpells = actor.system.spells;
        
        if (level === 'pact') {
            const pact = actorSpells?.pact;
            const available = pact?.value ?? 0;
            const max = pact?.max ?? 0;
            
            if (available > 0) {
                return { available, max };
            }
            
            if (this.#hasAvailableUpcastSlots(pact?.level ?? 0, highestAvailableSlot)) {
                return {
                    available: localize('BAD.dnd5e.upcast', 'Upcast'),
                    max: null,
                    isUpcast: true
                };
            }
            return { available: 0, max };
        } else {
            const lvl = Number(level) || 0;
            if (lvl <= 0) return { available: null, max: null };
            
            const spellSlot = actorSpells?.[`spell${lvl}`];
            const available = spellSlot?.value ?? 0;
            const max = spellSlot?.max ?? 0;
            
            if (available > 0) {
                return { available, max };
            }
            
            if (this.#hasAvailableUpcastSlots(lvl, highestAvailableSlot)) {
                return {
                    available: localize('BAD.dnd5e.upcast', 'Upcast'),
                    max: null,
                    isUpcast: true
                };
            }
            return { available: 0, max };
        }
    }

    /**
     * Check if the actor has any available spell slots (standard or pact) of a given level or higher.
     * Optimized to O(1) by comparing against the pre-calculated highest available slot.
     * @private
     */
    #hasAvailableUpcastSlots(level, highestAvailableSlot) {
        return highestAvailableSlot >= level;
    }

    /**
     * Fallback method to calculate spell slots for standard slot-based spells.
     * Used when the Cast activity doesn't have an explicit spellSlots consumption target.
     * @param {Item} item The spell item
     * @param {Actor} actor The actor
     * @param {number} highestAvailableSlot The highest available spell slot level on the actor
     * @private
     */
    #calculateSpellSlots(item, actor, highestAvailableSlot) {
        const system = item.system;
        const prepMode = system.method;
        const level = system.level ?? 0;
        
        if (prepMode === 'pact') {
            return this.#getSpellSlotUses(actor, 'pact', highestAvailableSlot);
        } else if (!['innate', 'atwill'].includes(prepMode)) {
            return this.#getSpellSlotUses(actor, level, highestAvailableSlot);
        }
        return { available: null, max: null };
    }

    /**
     * Fallback method to calculate ammunition quantity for ranged weapons.
     * Used when the Attack activity doesn't have a working item consumption target.
     * @private
     */
    #calculateWeaponAmmunition(item, ammoQuantities) {
        const ammoType = item.system.ammunition?.type;
        const quantity = ammoQuantities.get(ammoType) ?? 0;
        return {
            available: quantity,
            max: null
        };
    }

    #getAmmoQuantities(actor) {
        const ammoQuantities = new Map();
        for (const i of actor.items) {
            if (i.type === 'consumable' && i.system.type?.value === 'ammo') {
                const subtype = i.system.type.subtype;
                if (subtype) {
                    const qty = i.system.quantity ?? 0;
                    ammoQuantities.set(subtype, (ammoQuantities.get(subtype) ?? 0) + qty);
                }
            }
        }
        return ammoQuantities;
    }

    #getHighestAvailableSpellSlot(actor) {
        let highestAvailableSlot = 0;
        const actorSpells = actor.system.spells;
        if (actorSpells) {
            for (let i = 1; i <= 9; i++) {
                if (actorSpells[`spell${i}`]?.value > 0) {
                    highestAvailableSlot = i; // Since we loop 1 to 9, this naturally finds the highest
                }
            }
            const pact = actorSpells.pact;
            if (pact?.value > 0) {
                highestAvailableSlot = Math.max(highestAvailableSlot, pact.level ?? 0);
            }
        }
        return highestAvailableSlot;
    }

    /**
     * Resolve the effective lowercased activation type for a D&D 5e activity.
     * Checks activity-level activation override before falling back to the parent item activation.
     * @param {Object} activity The D&D 5e activity object instance
     * @param {Object} item The parent D&D 5e item document
     * @returns {string} The lowercased activation type string
     * @private
     */
    #getActivityActivationType(activity, item, linkedAction = null) {
        const actType = activity.activation?.type ?? activity.system?.activation?.type;
        const actOverride = activity.activation?.override ?? activity.system?.activation?.override;

        if (actOverride && actType && actType !== 'none' && actType !== '') {
            return String(actType).toLowerCase();
        }

        const spellDoc = linkedAction ?? this.#resolveRootSpellDocument({ originalActivity: activity, linkedAction: activity.spell });
        const spellType = spellDoc?.system?.activation?.type ?? spellDoc?.activation?.type;
        if (spellType && spellType !== 'none' && spellType !== '') {
            return String(spellType).toLowerCase();
        }

        const itemType = item.system?.activation?.type;
        if (itemType && itemType !== 'none' && itemType !== '') {
            return String(itemType).toLowerCase();
        }

        if (actType && actType !== 'none' && actType !== '') {
            return String(actType).toLowerCase();
        }

        return 'none';
    }

    // #endregion
}
