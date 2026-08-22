import { FantasySystemAdapter } from './genre/fantasy-system-adapter.js';
import { localize } from '../../lib/utils.js';
import { log } from '../../lib/logger.js';
import { MODULE_ID } from '../../constants.js';
import { TabRef } from '../../ui/tab-ref.js';
import { Action } from '../../ui/action.js';

import { Dnd5eSystemContextMenuManager } from './context-menu/dnd5e-system-context-menu-manager.js';
import { Dnd5eSystemTabFilterManager } from './filter/dnd5e-system-tab-filter-manager.js';
import { Dnd5eSystemContextModifier } from './context-modifier/dnd5e-system-context-modifier.js';

const ALLOWED_TYPES = new Set(['weapon', 'equipment', 'consumable', 'tool', 'backpack', 'loot', 'feat', 'spell']);

/**
 * System adapter for D&D 5th Edition.
 * Handles D&D 5e's specific item types, action categories, spell slot calculations,
 * and spell preparation toggles.
 */
export class Dnd5eSystemAdapter extends FantasySystemAdapter {
    #actor = null;
    #highestAvailableSlot = 0;
    #ammoQuantities = new Map();
    #resolvedSpellCache = new Map();
    #cachedForMap = new Map();

    constructor() {
        super('dnd5e', true);
        this.contextMenuManager = new Dnd5eSystemContextMenuManager(this);
        this.filterManager = new Dnd5eSystemTabFilterManager(this);
        this.contextModifier = new Dnd5eSystemContextModifier(this);
    }

    get actor() {
        return this.#actor;
    }

    /**
     * Initialize adapter context for an actor.
     * Pre-calculates ammo quantities, highest available spell slot, and cached item lookups for O(1) lookups during action modification.
     * @param {Actor} actor
     */
    init(actor) {
        this.#actor = actor;
        this.#highestAvailableSlot = actor ? this.#getHighestAvailableSpellSlot(actor) : 0;
        this.#ammoQuantities = actor ? this.#getAmmoQuantities(actor) : new Map();
        this.#cachedForMap = new Map();
        if (actor?.items) {
            for (const item of actor.items.values()) {
                const cachedFor = item.flags?.dnd5e?.cachedFor ?? item.getFlag?.('dnd5e', 'cachedFor');
                if (cachedFor) {
                    const lastDot = cachedFor.lastIndexOf('.');
                    const actId = lastDot !== -1 ? cachedFor.slice(lastDot + 1) : cachedFor;
                    this.#cachedForMap.set(actId, item);
                    this.#cachedForMap.set(cachedFor, item);
                }
            }
        }
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
        if (!ALLOWED_TYPES.has(type)) {
            log.debug(`Dnd5eSystemAdapter.shouldExtractItem | Skipping "${item.name}" (${type}, ID: ${item.id}) — type not in ALLOWED_TYPES`);
            return false;
        }
        const cachedFor = item.getFlag?.('dnd5e', 'cachedFor') ?? item.flags?.dnd5e?.cachedFor;
        if (cachedFor) {
            log.debug(`Dnd5eSystemAdapter.shouldExtractItem | Skipping "${item.name}" (${type}, ID: ${item.id}) — item.flags.dnd5e.cachedFor is set (helper item)`);
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
        this.init(actor);
        const modified = [];
        const showDepleted = Boolean(game.settings.get(MODULE_ID, 'showDepleted'));

        const showAll = actor?.getFlag?.(MODULE_ID, 'showAll') ?? false;
        const showUnprepared = Boolean((actor?.getFlag?.(MODULE_ID, 'showUnprepared') ?? false) || showAll);

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
            // NOTE(migration): hiddenItems transitioned from legacy string[] to Record<string, boolean> object map.
            // Array check fallback can be removed in a future cleanup once legacy world actor flags have migrated.
            const rawHidden = actor?.getFlag?.(MODULE_ID, 'hiddenItems');
            const isUserHidden = Array.isArray(rawHidden)
                ? rawHidden.includes(item.id)
                : Boolean(rawHidden?.[item.id]);

            // 1. Filter out unprepared spells (unless cantrip/innate/at-will/pact/always, showUnprepared/showAll is enabled, or item is user-hidden)
            let isSpellUnprepared = false;
            if (type === 'spell') {
                const prep = item.system.preparation ?? {};
                const prepMode = prep.mode ?? item.system.method ?? 'prepared';
                const isPrepared = Boolean(prep.prepared ?? item.system.prepared);
                const isCantrip = (item.system.level ?? 0) === 0;
                isSpellUnprepared = !isCantrip && !['innate', 'atwill', 'pact', 'always'].includes(prepMode) && !isPrepared;

                if (!showUnprepared && isSpellUnprepared && !isUserHidden) {
                    log.debug(`Dnd5eSystemAdapter.modifyActions | Filtering out spell "${item.name}" (ID: ${item.id}) — prep.prepared === false and prepMode (${prepMode}) requires preparation; showUnprepared flag is not set`);
                    continue;
                }
            }

            // 2. Filter out unequipped gear (unless showUnequipped/showAll is enabled or item is user-hidden)
            let isUnequipped = false;
            if (this.getItemEquipped(item) === false) {
                isUnequipped = true;
                const showUnequipped = Boolean((actor?.getFlag?.(MODULE_ID, `showUnequipped_${type}`) ?? false) || showAll);

                if (!showUnequipped && !isUserHidden) {
                    log.debug(`Dnd5eSystemAdapter.modifyActions | Filtering out ${type} "${item.name}" (ID: ${item.id}) — item.system.equipped === false and showUnequipped_${type} / showAll flag is not set`);
                    continue;
                }
            }

            // 4. Process activities if they exist (D&D 5e v4+)
            const activities = this.getItemActivities(item);
            let mappedActivities = [];

            if (activities.length > 0) {
                // Map D&D 5e Activities to sub-actions for the generic HUD item model
                const rawActivities = await Promise.all(activities.map(async (activity) => {
                    const linkedAction = await this.#resolveActivityLinkedAction(activity, actor);
                    const activationType = this.#getActivityActivationType(activity, item, linkedAction);
                    if (!activationType || activationType === 'none') return null;

                    const category = this.#getEconomyCategory(activationType);
                    const subId = this.#getCanonicalSubTab(activationType);
                    const tabRef = TabRef.from('economy', category, subId);

                    return new Action({
                        id: activity.id,
                        name: (activity.name && activity.name.trim().length > 0) ? activity.name : (linkedAction?.name ?? activity.type.toUpperCase()),
                        img: (activity.img && activity.img.trim().length > 0) ? activity.img : (linkedAction?.img ?? item.img),
                        uses: this.#calculateActivityUses(activity, item),
                        right: [tabRef],
                        roll: async (event) => {
                            const proxiedEvent = this._createRollEvent(event);
                            return activity.use({ event: proxiedEvent }, { event: proxiedEvent });
                        },
                        originalItem: item,
                        originalActivity: activity,
                        linkedAction
                    });
                }));

                mappedActivities = rawActivities.filter(Boolean);
            }

            if (mappedActivities.length > 0) {
                // Extract spell components from linked spells on cast activities or item properties if present
                for (const act of mappedActivities) {
                    const compTabs = this.#getComponentTabs(act);
                    if (compTabs.length > 0) {
                        spellComponents.push(...compTabs);
                        act.right = [...act.right, ...compTabs];
                    }
                }

                // Single-pass Resource Filtering: Filter out depleted D&D 5e Activities unless showDepleted is enabled
                let filteredActivities = mappedActivities;
                if (!showDepleted) {
                    filteredActivities = mappedActivities.filter(act => {
                        if (act.isDepleted) {
                            log.debug(`Dnd5eSystemAdapter.modifyActions | Filtering out activity "${act.name}" on "${item.name}" (ID: ${item.id}) — act.isDepleted === true (uses.available <= 0) and showDepleted is disabled`);
                            return false;
                        }
                        return true;
                    });

                    // If all activities are depleted, skip this item entirely!
                    if (filteredActivities.length === 0) {
                        log.debug(`Dnd5eSystemAdapter.modifyActions | Filtering out item "${item.name}" (ID: ${item.id}) — all ${mappedActivities.length} activities are depleted and showDepleted is disabled`);
                        continue;
                    }
                }

                // Assign to hierarchical item types: [parentType, subType] (for left-side tabs)
                const left = this.#getItemTabTypes(item, type, filteredActivities);

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
                    right: this.#collectUniqueTabs(filteredActivities),
                    left,
                    uses: actionUses,
                    roll: async (event) => {
                        // Roll the first active activity directly
                        return filteredActivities[0].roll(event);
                    }
                });

                modified.push(activityAction);
            } else if (['equipment', 'weapon', 'consumable', 'tool', 'backpack', 'loot'].includes(type)) {
                // Passive items (armor, passive shields, containers, loot, passive consumables/tools) are assigned right-side tab 'none' under 'economy'
                const subType = item.system.type?.value;
                const passiveAction = new Action({
                    ...action,
                    name: item.name,
                    img: item.img,
                    available: !(isSpellUnprepared || isUnequipped),
                    right: [TabRef.from('economy', 'none')],
                    left: subType ? [type, subType] : [type],
                    uses: { available: null, max: null },
                    roll: async (event) => {
                        if (activities[0]?.use) {
                            const proxiedEvent = this._createRollEvent(event);
                            return activities[0].use({ event: proxiedEvent }, { event: proxiedEvent });
                        }
                        return action.roll?.(event);
                    }
                });
                modified.push(passiveAction);
            }
        }

        for (const act of modified) {
            act.page = 1;
        }

        modified.push(...this.extractCheckActions(actor));

        return modified;
    }

    extractCheckActions(actor) {
        if (!actor) return [];
        const checkActions = [];
        const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
        const abilityNames = {
            str: ['DND5E.AbilityStr', 'Strength'],
            dex: ['DND5E.AbilityDex', 'Dexterity'],
            con: ['DND5E.AbilityCon', 'Constitution'],
            int: ['DND5E.AbilityInt', 'Intelligence'],
            wis: ['DND5E.AbilityWis', 'Wisdom'],
            cha: ['DND5E.AbilityCha', 'Charisma']
        };
        const abilityIcons = {
            str: 'icons/svg/sword.svg',
            dex: 'icons/svg/wing.svg',
            con: 'icons/svg/shield.svg',
            int: 'icons/svg/book.svg',
            wis: 'icons/svg/eye.svg',
            cha: 'icons/svg/paralysis.svg'
        };

        for (const abl of abilities) {
            const labelKey = abilityNames[abl];
            const name = localize(labelKey[0], labelKey[1]);
            const img = abilityIcons[abl];

            const saveSub = new Action({
                id: `save-${abl}`,
                name: localize('BAD.page2.savingThrow', 'Saving Throw'),
                type: 'save',
                img,
                right: [TabRef.from('ability', abl)],
                left: ['savingThrow'],
                available: true,
                roll: async (event) => {
                    const rollEvent = this._createRollEvent(event);
                    return actor.rollSavingThrow?.({ ability: abl, event: rollEvent })
                        ?? actor.rollAbilitySave?.(abl, { event: rollEvent });
                }
            });

            const checkSub = new Action({
                id: `check-${abl}`,
                name: localize('BAD.page2.abilityCheck', 'Ability Check'),
                type: 'abilityCheck',
                img,
                right: [TabRef.from('ability', abl)],
                left: ['abilityCheck'],
                available: true,
                roll: async (event) => {
                    const rollEvent = this._createRollEvent(event);
                    return actor.rollAbilityTest?.({ ability: abl, event: rollEvent })
                        ?? actor.rollAbilityCheck?.({ ability: abl, event: rollEvent })
                        ?? actor.rollAbilityTest?.(abl, { event: rollEvent })
                        ?? actor.rollAbilityCheck?.(abl, { event: rollEvent });
                }
            });

            const coreAction = new Action({
                id: `ability-${abl}`,
                name,
                type: 'ability',
                img,
                right: [TabRef.from('ability', abl)],
                left: ['savingThrow'],
                itemCategories: [['savingThrow'], ['abilityCheck']],
                available: true,
                uses: { available: null, max: null },
                subactions: [saveSub, checkSub],
                collapseDropdownIfSingle: true,
                extra: { section: 'core', page: 2, ability: abl }
            });
            coreAction.section = 'core';
            coreAction.page = 2;
            checkActions.push(coreAction);
        }

        // 3. Skill Checks
        const cfg = CONFIG?.DND5E;
        const skills = actor.system?.skills ?? {};
        for (const [skillId, skill] of Object.entries(skills)) {
            const abl = skill.ability ?? 'dex';
            const label = skill.label ?? cfg?.skills?.[skillId]?.label ?? skillId;
            const skillImg = abilityIcons[abl] ?? 'icons/svg/d20.svg';
            const skillAction = new Action({
                id: `skill-${skillId}`,
                name: label,
                type: 'skill',
                img: skillImg,
                right: [TabRef.from('ability', abl)],
                left: ['abilityCheck'],
                available: true,
                uses: { available: null, max: null },
                roll: async (event) => {
                    const rollEvent = this._createRollEvent(event);
                    return actor.rollSkill?.({ skill: skillId, event: rollEvent })
                        ?? actor.rollSkill?.(skillId, { event: rollEvent });
                },
                extra: { section: 'other', page: 2, ability: abl }
            });
            skillAction.section = 'other';
            skillAction.page = 2;
            checkActions.push(skillAction);
        }

        return checkActions;
    }

    // #endregion

    // #region Internal Filtering Logic

    // #endregion

    // #region Localizations & UI Formatting

    /**
     * Map a D&D 5e activation type to its parent category under Action Economy.
     * @param {string} type
     * @returns {string|null} Category identifier ('standard', 'time', 'rest', 'combat', 'monster', 'vehicle') or null if direct
     */
    #getEconomyCategory(type) {
        if (!type) return null;
        const norm = String(type).toLowerCase();
        switch (norm) {
            case 'action':
            case 'bonus':
            case 'reaction':
                return 'standard';
            case 'minute':
            case 'hour':
            case 'day':
                return 'time';
            case 'shortrest':
            case 'short':
            case 'endshortrest':
            case 'longrest':
            case 'long':
            case 'endlongrest':
                return 'rest';
            case 'encounter':
            case 'startencounter':
            case 'turnstart':
            case 'startturn':
            case 'turnend':
            case 'endturn':
                return 'combat';
            case 'legendary':
            case 'mythic':
            case 'lair':
                return 'monster';
            case 'crew':
                return 'vehicle';
            case 'special':
            case 'other':
            default:
                return null;
        }
    }

    /**
     * Map a D&D 5e activation type to its canonical sub-tab identifier.
     * @param {string} type
     * @returns {string} Canonical sub-tab identifier
     */
    #getCanonicalSubTab(type) {
        if (!type) return 'none';
        const norm = String(type).toLowerCase();
        switch (norm) {
            case 'short':
            case 'shortrest':
            case 'endshortrest':
                return 'shortRest';
            case 'long':
            case 'longrest':
            case 'endlongrest':
                return 'longRest';
            case 'encounter':
            case 'startencounter':
                return 'encounter';
            case 'turnstart':
            case 'startturn':
                return 'turnStart';
            case 'turnend':
            case 'endturn':
                return 'turnEnd';
            default:
                return norm;
        }
    }

    /**
     * Get the list of configurable action economy types and default colors for D&D 5e.
     * @returns {{ id: string, label: string, defaultColor: string }[]}
     */
    getEconomyTypes() {
        return [
            { id: 'action', label: this.getActionSubTabLabel('action') ?? 'Action', defaultColor: '#3b82f6', defaultEnabled: true },
            { id: 'bonus', label: this.getActionSubTabLabel('bonus') ?? 'Bonus Action', defaultColor: '#14b8a6', defaultEnabled: true },
            { id: 'reaction', label: this.getActionSubTabLabel('reaction') ?? 'Reaction', defaultColor: '#ef4444', defaultEnabled: true },
            { id: 'minute', label: this.getActionSubTabLabel('minute') ?? 'Minute', defaultColor: '#0284c7', defaultEnabled: false },
            { id: 'hour', label: this.getActionSubTabLabel('hour') ?? 'Hour', defaultColor: '#0369a1', defaultEnabled: false },
            { id: 'day', label: this.getActionSubTabLabel('day') ?? 'Day', defaultColor: '#075985', defaultEnabled: false },
            { id: 'longRest', label: this.getActionSubTabLabel('longRest') ?? 'End of a Long Rest', defaultColor: '#059669', defaultEnabled: false },
            { id: 'shortRest', label: this.getActionSubTabLabel('shortRest') ?? 'End of a Short Rest', defaultColor: '#10b981', defaultEnabled: false },
            { id: 'encounter', label: this.getActionSubTabLabel('encounter') ?? 'Start of Encounter', defaultColor: '#f59e0b', defaultEnabled: false },
            { id: 'turnStart', label: this.getActionSubTabLabel('turnStart') ?? 'Start of Turn', defaultColor: '#84cc16', defaultEnabled: false },
            { id: 'turnEnd', label: this.getActionSubTabLabel('turnEnd') ?? 'End of Turn', defaultColor: '#e11d48', defaultEnabled: false },
            { id: 'legendary', label: this.getActionSubTabLabel('legendary') ?? 'Legendary Action', defaultColor: '#18181b', defaultEnabled: false },
            { id: 'mythic', label: this.getActionSubTabLabel('mythic') ?? 'Mythic Action', defaultColor: '#ec4899', defaultEnabled: false },
            { id: 'lair', label: this.getActionSubTabLabel('lair') ?? 'Lair Action', defaultColor: '#eab308', defaultEnabled: false },
            { id: 'crew', label: this.getActionSubTabLabel('crew') ?? 'Crew Action', defaultColor: '#6366f1', defaultEnabled: false },
            { id: 'special', label: this.getActionSubTabLabel('special') ?? 'Special', defaultColor: '#a855f7', defaultEnabled: true },
            { id: 'other', label: this.getActionSubTabLabel('other') ?? 'Other', defaultColor: '#64748b', defaultEnabled: false }
        ];
    }

    /**
     * Modify the Handlebars rendering context for D&D 5e (splits into ability/skill check layout on Page 2).
     * @param {Object} context Handlebars template context
     * @param {ApplicationV2} app Active HUD application
     * @returns {Object}
     */
    modifyContext(context, app) {
        super.modifyContext(context, app);
        if (Number(app?.activePage) === 2) {
            this.formatSplitLayout(context);
        }
        return context;
    }

    // #endregion

    // #region System Specific Data Extractors & Schema Helpers

    /**
     * Validate if an object is an Item Document.
     * @param {Object} doc
     * @returns {boolean}
     */
    #isItemDocument(doc) {
        return doc?.documentName === 'Item';
    }

    /**
     * Extract the spell document from an activity or item reference.
     * @param {Object} obj
     * @returns {Item|null}
     */
    #extractItemSpell(obj) {
        if (!obj) return null;
        if (obj.linkedAction !== undefined) return obj.linkedAction;
        const spell = obj.spell;
        return (this.#isItemDocument(spell) || spell?.type === 'spell') ? spell : null;
    }

    /**
     * Resolve the underlying root spell document for a given activity or linked action.
     * @param {Object} sub Subaction or activity
     * @param {Item} [parentItem] Parent item document
     * @returns {Item|Object|null}
     */
    resolveRootSpellDocument(sub, parentItem) {
        if (!sub) return null;

        let doc = sub.linkedAction;
        const activity = sub.originalActivity;
        if (!doc && activity) {
            doc = this.#cachedForMap.get(activity.id)
                ?? this.#actor?.items?.find?.(i => (i.flags?.dnd5e?.cachedFor ?? i.getFlag?.('dnd5e', 'cachedFor'))?.endsWith(activity.id));
            if (!doc) {
                doc = this.#extractItemSpell(activity);
            }
            if (!doc) {
                const uuid = activity.spell?.uuid ?? (activity.spell?.startsWith?.('Compendium.') ? activity.spell : null);
                if (uuid) {
                    const syncResolver = globalThis.fromUuidSync ?? foundry?.utils?.fromUuidSync;
                    try {
                        doc = syncResolver?.(uuid);
                    } catch (_) {}
                }
            }
        }

        const maxDepth = 5;
        let depth = 0;
        while (doc && depth < maxDepth) {
            const nextDoc = this.#extractItemSpell(doc);
            if (nextDoc && nextDoc !== doc) {
                doc = nextDoc;
                depth++;
            } else {
                break;
            }
        }

        if (doc) return doc;

        if (activity?.spell && !this.#isItemDocument(activity.spell)) {
            return activity.spell;
        }

        if (activity?.type === 'cast') {
            return activity.spell ?? activity;
        }

        const origItem = sub.originalItem ?? parentItem;
        if (origItem?.type === 'spell') {
            return origItem;
        }

        return null;
    }

    /**
     * Resolve linked action document for a D&D 5e Activity.
     * @param {Activity} activity
     * @param {Actor} [actor]
     * @returns {Promise<Document|Object>}
     */
    async #resolveActivityLinkedAction(activity, actor) {
        if (actor) {
            const cached = this.#cachedForMap.get(activity.id)
                ?? actor.items?.find?.(i => (i.flags?.dnd5e?.cachedFor ?? i.getFlag?.('dnd5e', 'cachedFor'))?.endsWith(activity.id));
            if (cached) return cached;
        }
        if (activity.type === 'cast') {
            const uuid = activity.spell?.uuid ?? (activity.spell?.startsWith?.('Compendium.') ? activity.spell : null);
            if (uuid) {
                if (this.#resolvedSpellCache.has(uuid)) {
                    return this.#resolvedSpellCache.get(uuid);
                }
                const syncResolver = globalThis.fromUuidSync ?? foundry?.utils?.fromUuidSync;
                try {
                    const doc = syncResolver?.(uuid);
                    if (doc) {
                        this.#resolvedSpellCache.set(uuid, doc);
                        return doc;
                    }
                } catch (_) {}

                const asyncResolver = globalThis.fromUuid ?? foundry?.utils?.fromUuid;
                try {
                    const doc = await asyncResolver?.(uuid);
                    if (doc) {
                        this.#resolvedSpellCache.set(uuid, doc);
                        return doc;
                    }
                } catch (e) {
                    log.warn(`Failed to resolve compendium spell UUID ${uuid}:`, e);
                }
            }
            if (this.#isItemDocument(activity.spell) || activity.spell?.system) {
                return activity.spell;
            }
            return activity.spell ?? activity;
        }
        return activity;
    }

    /**
     * Get spell component TabRef objects required by a document.
     * @param {Document} doc
     * @returns {TabRef[]}
     */
    #getComponentTabs(doc) {
        return this.filterManager.getComponentTabs(doc);
    }

    /**
     * Collect unique right-side tabs across a collection of activities.
     * @param {Object[]} activities
     * @returns {TabRef[]}
     */
    #collectUniqueTabs(activities) {
        const uniqueTabsMap = new Map();
        for (const activity of activities) {
            for (const tab of activity.right ?? []) {
                if (tab?.path && !uniqueTabsMap.has(tab.path)) {
                    uniqueTabsMap.set(tab.path, tab);
                }
            }
        }
        return Array.from(uniqueTabsMap.values());
    }

    /**
     * Determine left-side item tab paths for an item.
     * @param {Item} item
     * @param {string} type
     * @param {Object[]} filteredActivities
     * @returns {string[]}
     */
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
        if (activities.values) {
            return Array.from(activities.values()).map(act => {
                if (act && !act.id && act._id) act.id = act._id;
                return act;
            });
        }
        if (Array.isArray(activities)) {
            return activities.map(act => {
                if (act && !act.id && act._id) act.id = act._id;
                return act;
            });
        }
        return Object.entries(activities).map(([id, act]) => {
            if (act) act.id = act.id ?? act._id ?? id;
            return act;
        });
    }

    /**
     * Calculate available and maximum uses for an item.
     */
    calculateUses(item) {
        return this.#calculateUses(item);
    }

    /**
     * Internal implementation to calculate uses and charges for an item.
     * @param {Item} item
     * @returns {{available: number|null, max: number|null}}
     */
    #calculateUses(item) {
        if (item.type === 'spell') {
            return this.#calculateSpellSlots(item);
        }

        const system = item.system;

        // 1. Limited Uses (standard item charges/uses)
        if (system.uses && system.uses.max && system.uses.max !== "0") {
            const max = parseInt(system.uses.max, 10) || 0;

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
     */
    #hasLimitedUses(item) {
        if (this.#calculateLimitedUses(item.system?.uses)) return true;
        return this.getItemActivities(item)
            .some(activity => this.#calculateLimitedUses(activity.uses));
    }

    /**
     * Parse and calculate limited uses configuration.
     * @param {Object} uses
     * @returns {{available: number|null, max: number|null}|null}
     */
    #calculateLimitedUses(uses) {
        if (uses && uses.max && uses.max !== "0") {
            const max = parseInt(uses.max, 10) || 0;
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
     * @param {string} targetId
     * @param {Item} item
     * @param {Actor} actor
     * @returns {Item|null}
     */
    #resolveTargetItem(targetId, item, actor) {
        if (!targetId) return null;
        return targetId.includes('.')
            ? (foundry.utils.fromUuidSync(targetId, { relative: item })
               ?? foundry.utils.fromUuidSync(targetId, { relative: actor })
               ?? actor.items.get(targetId))
            : actor.items.get(targetId);
    }

    /**
     * Calculate available and maximum uses for a D&D 5e Activity.
     * @param {Activity} activity The activity instance
     * @param {Item} item The parent item
     * @param {Actor} [actor=this.#actor] The actor
     * @param {Map<string, number>} [ammoQuantities=this.#ammoQuantities] Pre-calculated ammunition quantities
     * @param {number} [highestAvailableSlot=this.#highestAvailableSlot] The highest available spell slot level on the actor
     * @returns {{available: number|null, max: number|null}} The uses count
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
                    const consumed = target.value ?? 1;
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
                    const consumed = target.value ?? 1;
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
     * @param {Actor} actor
     * @param {string|number} level
     * @param {number} highestAvailableSlot
     * @returns {{available: number|string|null, max: number|null, isUpcast?: boolean}}
     */
    #getSpellSlotUses(actor, level, highestAvailableSlot) {
        const actorSpells = actor?.system?.spells;
        const isPact = level === 'pact';
        const numLevel = Number(level);
        const lvl = isPact ? (actorSpells?.pact?.level ?? 0) : (Number.isNaN(numLevel) ? 0 : numLevel);

        if (!isPact && lvl <= 0) return { available: null, max: null };

        const slot = isPact ? actorSpells?.pact : actorSpells?.[`spell${lvl}`];
        const available = slot?.value ?? 0;
        const max = slot?.max ?? 0;

        if (available > 0) {
            return { available, max };
        }
        if (highestAvailableSlot >= lvl) {
            return {
                available: localize('BAD.dnd5e.upcast', 'Upcast'),
                max: null,
                isUpcast: true
            };
        }
        return { available: 0, max };
    }

    /**
     * Calculate remaining spell slots for a spell item.
     * @param {Item} item
     * @param {Actor} [actor=this.#actor]
     * @param {number} [highestAvailableSlot=this.#highestAvailableSlot]
     * @returns {{available: number|string|null, max: number|null, isUpcast?: boolean}}
     */
    #calculateSpellSlots(item, actor = this.#actor, highestAvailableSlot = this.#highestAvailableSlot) {
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
     * Calculate available ammunition quantity for a weapon.
     * @param {Item} item
     * @param {Map<string, number>} ammoQuantities
     * @returns {{available: number, max: null}}
     */
    #calculateWeaponAmmunition(item, ammoQuantities) {
        const ammoType = item.system.ammunition?.type;
        const quantity = ammoQuantities.get(ammoType) ?? 0;
        return {
            available: quantity,
            max: null
        };
    }

    /**
     * Build map of ammunition quantities available on an actor.
     * @param {Actor} actor
     * @returns {Map<string, number>}
     */
    #getAmmoQuantities(actor) {
        const ammoQuantities = new Map();
        for (const i of actor?.items ?? []) {
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

    /**
     * Find highest available spell slot level on an actor.
     * @param {Actor} actor
     * @returns {number}
     */
    #getHighestAvailableSpellSlot(actor) {
        const actorSpells = actor?.system?.spells;
        if (!actorSpells) return 0;

        let highest = 0;
        for (let i = 9; i >= 1; i--) {
            if (actorSpells[`spell${i}`]?.value > 0) {
                highest = i;
                break;
            }
        }
        if (actorSpells.pact?.value > 0) {
            highest = Math.max(highest, actorSpells.pact.level ?? 0);
        }
        return highest;
    }

    /**
     * Normalize activation type string.
     * @param {*} type
     * @returns {string|null}
     */
    #normalizeActivationType(type) {
        if (!type || type === true || type === 'none') return null;
        const str = String(type).trim().toLowerCase();
        return str.length > 0 && str !== 'none' ? str : null;
    }

    /**
     * Extract activation type for a D&D 5e activity.
     * @param {Activity} activity
     * @param {Item} item
     * @param {Item|null} [linkedAction=null]
     * @returns {string}
     */
    #getActivityActivationType(activity, item, linkedAction = null) {
        const actOverride = Boolean(activity.activation?.override ?? activity.system?.activation?.override);
        if (actOverride) {
            const overrideType = this.#normalizeActivationType(activity.activation?.type ?? activity.system?.activation?.type);
            if (overrideType) return overrideType;
        }

        const spellDoc = linkedAction ?? this.resolveRootSpellDocument({ originalActivity: activity, linkedAction: activity.spell });
        if (spellDoc) {
            const rawType = spellDoc.system?.activation?.type ?? spellDoc.activation?.type;
            const spellType = this.#normalizeActivationType(rawType);
            if (spellType) return spellType;
        }

        return this.#normalizeActivationType(item.system?.activation?.type)
            ?? this.#normalizeActivationType(activity.activation?.type ?? activity.system?.activation?.type)
            ?? 'none';
    }

    /**
     * Open the sheet or edit dialog for a DnD5e action, activity, or item.
     * Handles opening the DnD5e Activity configuration sheet directly for activities.
     * @param {Object} action
     */
    openEditSheet(action) {
        const activity = action?.originalActivity;
        if (activity) {
            if (activity.sheet?.render) {
                activity.sheet.render(true);
                return;
            }
            if (activity.item?.sheet?.render) {
                activity.item.sheet.render(true, { subtab: "activities", activityId: activity.id });
                return;
            }
        }
        const item = action?.originalItem;
        if (item?.sheet?.render) {
            item.sheet.render(true);
        }
    }

    // #endregion

    // #region Favorites Integration

    /**
     * Whether this system adapter supports native favoriting.
     * @returns {boolean}
     */
    hasFavorites() {
        return true;
    }

    /**
     * Check if an item is favorited on the actor using DnD5e logic.
     *
     * @param {Object} actor Actor document
     * @param {Item} item Item document
     * @returns {boolean} True if favorited in dnd5e
     */
    isFavorite(actor, item) {
        if (!item) return false;

        // 1. Direct system.favorite property (dnd5e 3.x+)
        if (item.system && 'favorite' in item.system) {
            return Boolean(item.system.favorite);
        }

        // 2. Legacy / flag-based favorite (dnd5e 2.x)
        if (item.flags?.dnd5e?.favorite !== undefined) {
            return Boolean(item.flags.dnd5e.favorite);
        }

        // 3. Actor system.favorites set/array (dnd5e 3.x+ actor favorites collection)
        if (actor?.system?.favorites?.some) {
            const relUuid = item.getRelativeUUID?.(actor) ?? null;
            return actor.system.favorites.some(f => f?.id === item.id || (relUuid && f?.id === relUuid) || f?.id === item.uuid);
        }

        return false;
    }

    /**
     * Set or unset favorite status on an item in DnD5e.
     *
     * @param {Object} actor Actor document
     * @param {Item} item Item document
     * @param {boolean} favorite True to favorite, false to unfavorite
     * @returns {Promise<any>|null} Result of update
     */
    async setFavorite(actor, item, favorite) {
        if (!item) return null;
        const isFav = Boolean(favorite);

        // 1. If item has system.favorite field (modern dnd5e 3.x+)
        if (item.system && 'favorite' in item.system && item.update) {
            return await item.update({ 'system.favorite': isFav });
        }

        // 2. If actor has addFavorite / removeFavorite methods (dnd5e 3.x actor methods)
        if (actor?.system?.addFavorite && actor?.system?.removeFavorite) {
            const uuid = item.getRelativeUUID?.(actor) ?? item.id;
            if (isFav) {
                return await actor.system.addFavorite({ id: uuid, type: 'item' });
            } else {
                return await actor.system.removeFavorite(uuid);
            }
        }

        // 3. Fallback to updating item flags
        if (item.update) {
            return await item.update({ 'flags.dnd5e.favorite': isFav });
        }

        return null;
    }

    /**
     * Get the default HUD categorization structure for D&D 5e.
     * Includes standard fantasy categories plus Base Ability Checks and Skill Checks / Saves with ability subcategories.
     * @param {Object} [overrides={}] Generic category overrides
     * @returns {Object[]} Array of category definition objects
     */
    getDefaultCategories(overrides = {}) {
        const categories = super.getDefaultCategories(overrides);
        const dnd5eCategories = [
            {
                id: 'cat_ability_checks',
                name: 'Abilities',
                expression: `action.type === "ability"`,
                subcategories: []
            },
            {
                id: 'cat_skill_checks',
                name: 'Skills',
                expression: `action.type === "skill"`,
                subcategories: [
                    {
                        id: 'sub_strength',
                        name: 'Strength',
                        expression: `action.right.some(t => t.label === "str")`
                    },
                    {
                        id: 'sub_dexterity',
                        name: 'Dexterity',
                        expression: `action.right.some(t => t.label === "dex")`
                    },
                    {
                        id: 'sub_constitution',
                        name: 'Constitution',
                        expression: `action.right.some(t => t.label === "con")`
                    },
                    {
                        id: 'sub_intelligence',
                        name: 'Intelligence',
                        expression: `action.right.some(t => t.label === "int")`
                    },
                    {
                        id: 'sub_wisdom',
                        name: 'Wisdom',
                        expression: `action.right.some(t => t.label === "wis")`
                    },
                    {
                        id: 'sub_charisma',
                        name: 'Charisma',
                        expression: `action.right.some(t => t.label === "cha")`
                    }
                ]
            }
        ];

        for (const cat of dnd5eCategories) {
            const key = cat.id.replace('cat_', '');
            const catOverride = overrides[cat.id] ?? overrides[key] ?? {};
            categories.push(foundry.utils.mergeObject(cat, catOverride, { inplace: false, overwrite: true }));
        }

        return categories;
    }

    // #endregion
}
