import { FantasySystemAdapter } from './genre/fantasy-system-adapter.js';
import { localize } from '../../lib/utils.js';
import { log } from '../../lib/logger.js';
import { TabRef } from '../../ui/tab-ref.js';
import { Action } from '../../ui/action.js';
import { MODULE_ID } from '../../constants.js';
import { Pf2eSystemContextMenuManager } from './context-menu/pf2e-system-context-menu-manager.js';

const SORT_ORDERS = {
    tabs: {
        'economy': {
            'all': 0, 'action': 1, 'reaction': 2, 'free': 3, 'other': 4
        },
        'ability': {
            'all': 0, 'str': 1, 'dex': 2, 'con': 3, 'int': 4, 'wis': 5, 'cha': 6
        }
    },
    item_type: {
        'all': 0,
        'savingThrow': 1,
        'abilityCheck': 2,
        'weapon': 3,
        'equipment': 4,
        'consumable': 5,
        'feat': 6,
        'spell': 7,
        'other': 8
    }
};

const EXTRACTABLE_TYPES = new Set(['action', 'feat', 'spell', 'consumable', 'equipment']);

const PF2E_SPELL_SUB_TAB_ORDER = new Map(
    ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'focus', 'innate', 'ritual'].map((id, i) => [id, i])
);

const ICONS = {
    action_type: {
        'all': 'fas fa-border-all',
        'economy': 'fas fa-stopwatch',
        'ability': 'fas fa-fist-raised'
    },
    default_strike: 'systems/pf2e/icons/default-icons/melee.svg'
};

const PF2E_ACTION_TYPE_MAP = {
    'reaction': 'reaction',
    'free': 'other',
    'action': 'action'
};

/**
 * System adapter for Pathfinder 2nd Edition (PF2e).
 * Modifies the base actions list by mapping feats and spells, and injecting Strikes (attacks).
 */
export class Pf2eSystemAdapter extends FantasySystemAdapter {
    constructor(foundry = null) {
        super('pf2e', true, foundry);
        this.contextMenuManager = new Pf2eSystemContextMenuManager(this);
    }

    /**
     * Check if a PF2e item is equipped.
     * Natural attacks, unarmed strikes, and non-physical items are always considered equipped.
     * Items marked as 'stowed' or 'dropped' are unequipped.
     * Items marked as 'held' or 'worn' are equipped.
     * @param {Item} item
     * @returns {boolean}
     */
    getItemEquipped(item) {
        if (!item?.system) return true;
        if (item.isPhysical === false) return true;
        if (item.category === 'unarmed' || item.system.category?.value === 'unarmed') return true;

        const traits = item.system.traits?.value;
        if (traits?.includes?.('unarmed') || traits?.includes?.('natural') || traits?.has?.('unarmed') || traits?.has?.('natural')) {
            return true;
        }

        const carryType = item.system.equipped?.carryType;
        if (carryType) {
            return carryType !== 'stowed' && carryType !== 'dropped' && (carryType === 'held' || carryType === 'worn');
        }
        if (item.isEquipped !== undefined) {
            return Boolean(item.isEquipped);
        }
        return true;
    }

    // #region Core Action Modification

    /**
     * Determine if a specific item should be extracted as a base action for PF2e.
     * Prevents allocating objects for unhandled item types (like equipment/consumables).
     */
    shouldExtractItem(item) {
        return EXTRACTABLE_TYPES.has(item.type);
    }

    /**
     * Filter, map, inject, and sort actions for PF2e.
     * @param {Object[]} actions Base action list from the core
     * @param {Actor} actor 
     * @returns {Object[]} The modified actions list
     */
    async modifyActions(actions, actor) {
        const modified = [];

        const ammoQuantities = this.#buildAmmoQuantitiesMap(actor);
        const spellToEntryMap = this.#buildSpellToEntryMap(actor);

        // 1. Process existing items (Feats, Actions, Spells)
        for (const action of actions) {
            if (this.#formatActionRow(action, spellToEntryMap)) {
                modified.push(action);
            }
        }

        // 2. Inject Strikes (attacks)
        for (const strike of this.#getActorStrikes(actor)) {
            modified.push(this.#createStrikeAction(strike, ammoQuantities));
        }

        // 3. Filter unequipped items (stowed/dropped) unless showAll / showUnequipped flag is enabled
        const showAll = Boolean(actor?.getFlag?.(MODULE_ID, 'showAll'));
        const showUnequippedMap = {
            weapon: Boolean(actor?.getFlag?.(MODULE_ID, 'showUnequipped_weapon')),
            equipment: Boolean(actor?.getFlag?.(MODULE_ID, 'showUnequipped_equipment')),
            consumable: Boolean(actor?.getFlag?.(MODULE_ID, 'showUnequipped_consumable'))
        };

        const finalActions = [];
        for (const action of modified) {
            action.available = true;
            const item = action.originalItem;
            if (item) {
                const isEquipped = this.getItemEquipped(item);
                if (!isEquipped) {
                    const type = item.type ?? action.type;
                    const canShowUnequipped = Boolean(showAll || showUnequippedMap[type] || showUnequippedMap.weapon);
                    if (!canShowUnequipped) {
                        continue;
                    }
                    action.available = false;
                }
            }
            finalActions.push(action);
        }

        for (const action of finalActions) {
            action.page = 1;
        }

        finalActions.push(...this.extractCheckActions(actor));

        // 4. Apply default resource filtering (e.g. hiding depleted actions)
        return super.modifyActions(finalActions, actor);
    }

    /**
     * Extract Page 2 ability checks, saving throws, and skill checks for PF2e.
     * In PF2e, saving throws are Fortitude, Reflex, and Will, and perception is a core check.
     * Raw ability checks do not exist in PF2e (skills are rolled instead).
     * @param {Actor} actor
     * @returns {Action[]}
     */
    extractCheckActions(actor) {
        if (!actor) return [];
        const checkActions = [];

        // 1. Core Saves (Fortitude, Reflex, Will) and Perception
        const fortitude = new Action({
            id: 'save-fortitude',
            name: localize('PF2E.SavesFortitude', 'Fortitude'),
            type: 'save',
            img: 'icons/svg/shield.svg',
            right: [TabRef.from('ability', 'con')],
            left: ['savingThrow'],
            available: true,
            uses: { available: null, max: null },
            roll: async (event) => {
                const rollEvent = this._createRollEvent(event);
                if (actor.saves?.fortitude?.roll) {
                    return actor.saves.fortitude.roll({ event: rollEvent });
                } else if (actor.system?.saves?.fortitude?.roll) {
                    return actor.system.saves.fortitude.roll({ event: rollEvent });
                }
            },
            extra: { section: 'core', page: 2, ability: 'con' }
        });
        fortitude.section = 'core';
        fortitude.page = 2;
        checkActions.push(fortitude);

        const reflex = new Action({
            id: 'save-reflex',
            name: localize('PF2E.SavesReflex', 'Reflex'),
            type: 'save',
            img: 'icons/svg/wing.svg',
            right: [TabRef.from('ability', 'dex')],
            left: ['savingThrow'],
            available: true,
            uses: { available: null, max: null },
            roll: async (event) => {
                const rollEvent = this._createRollEvent(event);
                if (actor.saves?.reflex?.roll) {
                    return actor.saves.reflex.roll({ event: rollEvent });
                } else if (actor.system?.saves?.reflex?.roll) {
                    return actor.system.saves.reflex.roll({ event: rollEvent });
                }
            },
            extra: { section: 'core', page: 2, ability: 'dex' }
        });
        reflex.section = 'core';
        reflex.page = 2;
        checkActions.push(reflex);

        const will = new Action({
            id: 'save-will',
            name: localize('PF2E.SavesWill', 'Will'),
            type: 'save',
            img: 'icons/svg/eye.svg',
            right: [TabRef.from('ability', 'wis')],
            left: ['savingThrow'],
            available: true,
            uses: { available: null, max: null },
            roll: async (event) => {
                const rollEvent = this._createRollEvent(event);
                if (actor.saves?.will?.roll) {
                    return actor.saves.will.roll({ event: rollEvent });
                } else if (actor.system?.saves?.will?.roll) {
                    return actor.system.saves.will.roll({ event: rollEvent });
                }
            },
            extra: { section: 'core', page: 2, ability: 'wis' }
        });
        will.section = 'core';
        will.page = 2;
        checkActions.push(will);

        const perception = new Action({
            id: 'check-perception',
            name: localize('PF2E.PerceptionLabel', 'Perception'),
            type: 'skill',
            img: 'icons/svg/eye.svg',
            right: [TabRef.from('ability', 'wis')],
            left: ['abilityCheck'],
            available: true,
            uses: { available: null, max: null },
            roll: async (event) => {
                const rollEvent = this._createRollEvent(event);
                return actor.perception?.roll?.({ event: rollEvent }) ??
                    actor.system?.attributes?.perception?.roll?.({ event: rollEvent });
            },
            extra: { section: 'core', page: 2, ability: 'wis' }
        });
        perception.section = 'core';
        perception.page = 2;
        checkActions.push(perception);

        // 2. Skills
        const PF2E_SKILL_ABILITY_MAP = {
            acrobatics: 'dex',
            arcana: 'int',
            athletics: 'str',
            crafting: 'int',
            deception: 'cha',
            diplomacy: 'cha',
            intimidation: 'cha',
            medicine: 'wis',
            nature: 'wis',
            occultism: 'int',
            performance: 'cha',
            religion: 'wis',
            society: 'int',
            stealth: 'dex',
            survival: 'wis',
            thievery: 'dex'
        };

        const abilityIcons = {
            str: 'icons/svg/sword.svg',
            dex: 'icons/svg/wing.svg',
            con: 'icons/svg/shield.svg',
            int: 'icons/svg/book.svg',
            wis: 'icons/svg/eye.svg',
            cha: 'icons/svg/paralysis.svg'
        };

        const skills = actor.skills ?? actor.system?.skills ?? {};
        for (const [skillKey, skill] of Object.entries(skills)) {
            const slug = skill.slug ?? skillKey;
            const abl = skill.attribute ?? skill.ability ?? PF2E_SKILL_ABILITY_MAP[slug] ?? 'int';
            const label = skill.label ?? skill.name ?? slug;
            const skillImg = abilityIcons[abl] ?? 'icons/svg/d20.svg';

            const skillAction = new Action({
                id: `skill-${slug}`,
                name: label,
                type: 'skill',
                img: skillImg,
                right: [TabRef.from('ability', abl)],
                left: ['abilityCheck'],
                available: true,
                uses: { available: null, max: null },
                roll: async (event) => {
                    const rollEvent = this._createRollEvent(event);
                    if (skill.roll) {
                        return skill.roll({ event: rollEvent });
                    }
                    if (actor.rollSkill) {
                        try {
                            return await actor.rollSkill({ skill: slug, event: rollEvent });
                        } catch {
                            return actor.rollSkill(slug, { event: rollEvent });
                        }
                    }
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

    // #region Localizations & UI Formatting

    /**
     * Get the localized label for a left-side item type (parent tab) in PF2e.
     */
    getItemTypeLabel(parentId) {
        switch (parentId) {
            case 'feat': return localize('PF2E.Item.Feat.Plural', 'Feats');
            case 'spell': return localize('PF2E.Item.Spell.Plural', 'Spells');
            case 'weapon': return localize('PF2E.TraitWeapons', 'Weapons');
            case 'consumable': return localize('PF2E.Item.Consumable.Plural', localize('PF2E.Item.Physical.Consumable', 'Consumables'));
            case 'equipment': return localize('PF2E.CompendiumBrowser.TabEquipment', localize('PF2E.NPC.AddEquipment', 'Equipment'));
            default: return super.getItemTypeLabel(parentId);
        }
    }

    /**
     * Get the localized label for a left-side item sub-tab (spell rank) in PF2e.
     */
    getItemSubTabLabel(parentId, subId) {
        if (parentId === 'spell') {
            switch (subId) {
                case 'focus': return localize('PF2E.Focus.Spells', 'Focus Spells');
                case 'innate': return localize('PF2E.PreparationTypeInnate', 'Innate Spells');
                case 'ritual': return localize('PF2E.Actor.Character.Spellcasting.Tab.Rituals', 'Rituals');
                case '0': return localize('PF2E.TraitCantrip', 'Cantrip');
                default: return localize(`PF2E.Item.Spell.Rank.${subId}`, `${subId} Rank`);
            }
        }
        return super.getItemSubTabLabel(parentId, subId);
    }

    /**
     * Get the localized label for a right-side action type (parent tab) in PF2e.
     */
    getActionTypeLabel(parentId) {
        return parentId === 'economy'
            ? localize('BAD.common.actionEconomy', 'Action Economy')
            : super.getActionTypeLabel(parentId);
    }

    getItemTypeSortOrder(parentId) {
        return SORT_ORDERS.item_type[parentId] ?? super.getItemTypeSortOrder(parentId);
    }

    getActionSubTabSortOrder(parentId, subId) {
        return SORT_ORDERS.tabs[parentId]?.[subId] ?? super.getActionSubTabSortOrder(parentId, subId);
    }

    /**
     * Get the CSS icon class for a right-side action type (parent tab) in PF2e.
     */
    getActionTypeIcon(parentId) {
        return ICONS.action_type[parentId] ?? super.getActionTypeIcon(parentId);
    }

    /**
     * Get the localized label for a right-side action sub-tab in PF2e.
     */
    getActionSubTabLabel(subId) {
        const abilityLabels = {
            str: localize('PF2E.AbilityStr', 'Strength'),
            dex: localize('PF2E.AbilityDex', 'Dexterity'),
            con: localize('PF2E.AbilityCon', 'Constitution'),
            int: localize('PF2E.AbilityInt', 'Intelligence'),
            wis: localize('PF2E.AbilityWis', 'Wisdom'),
            cha: localize('PF2E.AbilityCha', 'Charisma')
        };
        if (abilityLabels[subId]) return abilityLabels[subId];

        switch (subId) {
            case 'all': return localize('BAD.core.allActions', 'All Actions');
            case 'action': return localize('PF2E.TabActionsLabel', 'Actions');
            case 'reaction': return localize('PF2E.ActionsReactionsHeader', 'Reactions');
            case 'other': return localize('PF2E.ActionsFreeActionsHeader', 'Free Actions');
            default: return super.getActionSubTabLabel(subId);
        }
    }

    /**
     * Get the list of configurable action economy types and default colors for PF2e.
     * @returns {{ id: string, label: string, defaultColor: string }[]}
     */
    getEconomyTypes() {
        return [
            { id: 'action', label: this.getActionSubTabLabel('action') ?? 'Actions', defaultColor: '#3b82f6', defaultEnabled: true },
            { id: 'reaction', label: this.getActionSubTabLabel('reaction') ?? 'Reactions', defaultColor: '#ef4444', defaultEnabled: true },
            { id: 'other', label: this.getActionSubTabLabel('other') ?? 'Free Actions', defaultColor: '#22c55e', defaultEnabled: true }
        ];
    }

    /**
     * Modify the rendering context before it is sent to the template.
     * Used here to sort the spell sub-tabs (Cantrips, Ranks 1-10, Focus, Innate, Rituals) and display showUnprepared tab indicators.
     */
    modifyContext(context, app) {
        super.modifyContext?.(context, app);
        if (Number(app?.activePage) === 2) {
            this.formatSplitLayout(context);
        }

        const showAll = Boolean(app?.actor?.getFlag?.(MODULE_ID, 'showAll'));

        const allParent = context.itemTypes?.find(g => g.id === 'all');
        if (allParent) {
            allParent.showUnprepared = showAll;
        }

        const weaponParent = context.itemTypes?.find(g => g.id === 'weapon');
        if (weaponParent) {
            const showUnequippedWeapon = Boolean(app.actor?.getFlag?.(MODULE_ID, 'showUnequipped_weapon'));
            weaponParent.showUnprepared = Boolean(showUnequippedWeapon || showAll);
        }

        const consumableParent = context.itemTypes?.find(g => g.id === 'consumable');
        if (consumableParent) {
            const showUnequippedConsumable = Boolean(app.actor?.getFlag?.(MODULE_ID, 'showUnequipped_consumable'));
            consumableParent.showUnprepared = Boolean(showUnequippedConsumable || showAll);
        }

        const equipmentParent = context.itemTypes?.find(g => g.id === 'equipment');
        if (equipmentParent) {
            const showUnequippedEquipment = Boolean(app.actor?.getFlag?.(MODULE_ID, 'showUnequipped_equipment'));
            equipmentParent.showUnprepared = Boolean(showUnequippedEquipment || showAll);
        }

        const spellGroup = context.itemTypes?.find(g => g.id === 'spell');
        if (spellGroup?.subTabs?.length) {
            spellGroup.subTabs.sort((a, b) =>
                (PF2E_SPELL_SUB_TAB_ORDER.get(a.id) ?? 999) - (PF2E_SPELL_SUB_TAB_ORDER.get(b.id) ?? 999)
            );
        }
    }

    // #endregion

    // #region System Specific Data Extractors & Schema Helpers

    #buildAmmoQuantitiesMap(actor) {
        const ammoQuantities = new Map();
        for (const i of actor.items ?? []) {
            const { baseItem, quantity } = this.#getAmmoInfo(i);
            if (baseItem) {
                ammoQuantities.set(baseItem, (ammoQuantities.get(baseItem) ?? 0) + quantity);
            }
        }
        return ammoQuantities;
    }

    #buildSpellToEntryMap(actor) {
        const spellToEntryMap = new Map();
        for (const entry of this.#getSpellcastingEntries(actor)) {
            for (const spell of entry.spells ?? []) {
                spellToEntryMap.set(spell.id, entry);
            }
        }
        return spellToEntryMap;
    }

    /**
     * Extract ammunition quantity and base item ID from a PF2e item.
     * @param {Item} item
     * @returns {{ baseItem: string|undefined, quantity: number }}
     */
    #getAmmoInfo(item) {
        return item.type === 'ammo'
            ? { baseItem: item.system.baseItem, quantity: item.system.quantity ?? 0 }
            : { baseItem: undefined, quantity: 0 };
    }

    /**
     * Translate PF2e action cost structures into core activation types.
     * @param {Item} item
     * @returns {string|null}
     */
    #getActionType(item) {
        return PF2E_ACTION_TYPE_MAP[item.system.actionType?.value] ?? null;
    }

    /**
     * Get spellcasting entries from a PF2e Actor.
     * @param {Actor} actor
     * @returns {Object[]}
     */
    #getSpellcastingEntries(actor) {
        return actor.spellcasting ?? [];
    }

    /**
     * Get Strikes (attacks) registered on a PF2e Actor.
     * @param {Actor} actor
     * @returns {Object[]}
     */
    #getActorStrikes(actor) {
        return actor.system.actions ?? [];
    }

    #getSpellSubTab(entry, spellLevel) {
        if (entry.isFocusPool) return 'focus';
        if (entry.isInnate) return 'innate';
        if (entry.isRitual) return 'ritual';
        return spellLevel.toString();
    }

    #executeFeatRoll(item, event) {
        const proxiedEvent = this._createRollEvent(event);
        if (item.toMessage) {
            item.toMessage();
        } else if (item.use) {
            item.use({ event: proxiedEvent });
        }
    }

    #executeSpellRoll(entry, item, event) {
        const proxiedEvent = this._createRollEvent(event);
        if (entry?.cast) {
            entry.cast(item, { event: proxiedEvent });
        } else if (item.toMessage) {
            item.toMessage();
        }
    }

    #executeStrikeRoll(strike, event) {
        const proxiedEvent = this._createRollEvent(event);
        if (strike.variants?.[0]?.roll) {
            strike.variants[0].roll({ event: proxiedEvent });
        } else if (strike.roll) {
            strike.roll({ event: proxiedEvent });
        }
    }

    #executeConsumableRoll(item, event) {
        const proxiedEvent = this._createRollEvent(event);
        if (item.consume) {
            item.consume();
        } else if (item.toMessage) {
            item.toMessage();
        } else if (item.use) {
            item.use({ event: proxiedEvent });
        }
    }

    #executeEquipmentRoll(item, event) {
        const proxiedEvent = this._createRollEvent(event);
        if (item.toMessage) {
            item.toMessage();
        } else if (item.use) {
            item.use({ event: proxiedEvent });
        }
    }

    #createStrikeAction(strike, ammoQuantities) {
        return {
            id: `strike-${strike.slug ?? strike.label}`,
            name: strike.label,
            type: 'weapon',
            img: strike.item?.img ?? ICONS.default_strike,
            activationType: 'action',
            right: [TabRef.from('economy', 'action')],
            left: ['weapon'],
            hidden: false,
            available: true,
            uses: this.#getStrikeAmmoUses(strike, ammoQuantities),
            roll: (event) => this.#executeStrikeRoll(strike, event),
            originalItem: strike.item,
            extra: { pf2eStrike: strike }
        };
    }

    #formatActionRow(action, spellToEntryMap) {
        const item = action.originalItem;
        if (!item) return false;
        if (item.type === 'action' || item.type === 'feat') {
            return this.#formatFeatAction(action, item);
        }
        if (item.type === 'spell') {
            return this.#formatSpellAction(action, item, spellToEntryMap.get(item.id));
        }
        if (item.type === 'consumable') {
            return this.#formatConsumableAction(action, item);
        }
        if (item.type === 'equipment') {
            return this.#formatEquipmentAction(action, item);
        }
        return false;
    }

    #formatFeatAction(action, item) {
        const activationType = this.#getActionType(item);
        if (!activationType) {
            const rawType = item.system.actionType?.value;
            log.debug(`Pf2eSystemAdapter.#formatFeatAction | Filtering out "${item.name}" (${item.type}, ID: ${item.id}) — item.system.actionType.value ("${rawType}") is not in PF2E_ACTION_TYPE_MAP`);
            return false;
        }

        action.activationType = activationType;
        action.right = [TabRef.from('economy', activationType)];
        action.left = [item.type === 'action' ? 'feat' : item.type];
        action.uses = this.#getUses(item);
        action.roll = (event) => this.#executeFeatRoll(item, event);
        return true;
    }

    #formatSpellAction(action, item, entry) {
        if (!entry) {
            log.debug(`Pf2eSystemAdapter.#formatSpellAction | Filtering out spell "${item.name}" (ID: ${item.id}) — no spellcasting entry found in spellToEntryMap (spell is not registered in any spellcasting entry on this actor)`);
            return false;
        }

        const spellLevel = item.rank ?? 0;
        action.right = [TabRef.from('economy', 'action')];
        action.activationType = 'action';
        action.left = ['spell', this.#getSpellSubTab(entry, spellLevel)];
        action.roll = (event) => this.#executeSpellRoll(entry, item, event);
        action.uses = this.#getSpellUses(entry, item);
        action.name = `${item.name} (${entry.name})`;
        return true;
    }

    #formatConsumableAction(action, item) {
        action.name = action.name ?? item.name;
        const activationType = this.#getActionType(item) ?? 'action';
        action.activationType = activationType;
        action.right = [TabRef.from('economy', activationType)];
        action.left = ['consumable'];
        action.uses = this.#getConsumableUses(item);
        action.roll = (event) => this.#executeConsumableRoll(item, event);
        return true;
    }

    #formatEquipmentAction(action, item) {
        action.name = action.name ?? item.name;
        const activationType = this.#getActionType(item) ?? 'action';
        action.activationType = activationType;
        action.right = [TabRef.from('economy', activationType)];
        action.left = ['equipment'];
        action.uses = this.#getUses(item);
        action.roll = (event) => this.#executeEquipmentRoll(item, event);
        return true;
    }

    #getConsumableUses(item) {
        const uses = item.system.uses;
        if (uses && uses.max > 0) {
            return { available: uses.value ?? 0, max: uses.max };
        }
        const quantity = item.system.quantity;
        if (quantity !== undefined && quantity !== null) {
            return { available: quantity, max: null };
        }
        return { available: null, max: null };
    }

    /**
     * Calculate frequency limits (uses) for PF2e actions/feats.
     * @param {Item} item
     * @returns {{ available: number|null, max: number|null }}
     */
    #getUses(item) {
        const freq = item.system.frequency;
        return freq
            ? { available: freq.value ?? 0, max: freq.max ?? 0 }
            : { available: null, max: null };
    }

    /**
     * Calculate spell slot / focus pool uses for PF2e spells.
     * @param {Object} entry Spellcasting entry
     * @param {Item} spell Spell item
     * @returns {{ available: number|null, max: number|null }}
     */
    #getSpellUses(entry, spell) {
        if (entry.isFocusPool) {
            const focus = entry.actor?.system?.resources?.focus;
            return { available: focus?.value ?? 0, max: focus?.max ?? 0 };
        }

        const level = spell.rank ?? 0;
        if (entry.isSpontaneous && level > 0) {
            const slot = entry.system.slots?.[`slot${level}`];
            return { available: slot?.value ?? 0, max: slot?.max ?? 0 };
        }

        return { available: null, max: null };
    }

    /**
     * Calculate ammo uses for a PF2e strike if applicable.
     * @param {Object} strike
     * @param {Map<string, number>} ammoQuantities
     * @returns {{ available: number|null, max: number|null }}
     */
    #getStrikeAmmoUses(strike, ammoQuantities) {
        const baseType = strike.item?.type === 'weapon' && strike.item.system.ammo?.baseType;
        return baseType
            ? { available: ammoQuantities.get(baseType) ?? 0, max: null }
            : { available: null, max: null };
    }

    /**
     * Get the default HUD categorization structure for PF2e.
     * @param {Object} [overrides={}] Generic category overrides
     * @returns {Object[]} Array of category definition objects
     */
    getDefaultCategories(overrides = {}) {
        const categories = super.getDefaultCategories(foundry.utils.mergeObject({
            weapon: {
                name: 'Weapons & Strikes',
                expression: `item.type === 'weapon' || action.left.includes('weapon')`
            },
            spell: {
                subcategories: [
                    {
                        id: 'sub_cantrips',
                        name: 'Cantrips',
                        expression: `item.rank === 0 || item.isCantrip || item.system?.traits?.value?.includes('cantrip')`
                    },
                    {
                        id: 'sub_ranked_spells',
                        name: 'Ranked Spells',
                        expression: `item.rank > 0`
                    }
                ]
            },
            feature: {
                name: 'Feats & Actions',
                expression: `item.type === 'feat' || item.type === 'action'`
            }
        }, overrides, { inplace: false, overwrite: true }));

        const pf2eCategories = [
            {
                id: 'cat_saves',
                name: 'Saving Throws',
                expression: `action.type === "save"`,
                subcategories: []
            },
            {
                id: 'cat_skill_checks',
                name: 'Skills & Perception',
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

        for (const cat of pf2eCategories) {
            const key = cat.id.replace('cat_', '');
            const catOverride = overrides[cat.id] ?? overrides[key] ?? {};
            categories.push(foundry.utils.mergeObject(cat, catOverride, { inplace: false, overwrite: true }));
        }

        return categories;
    }

    // #endregion

    // #region Tooltip Item Summary

    /**
     * Build an item summary object for PF2e tooltips.
     * @param {Object} action The HUD action instance
     * @param {Object} [item] The original item document
     * @param {Object} [actor] The owning actor document
     * @returns {{title: string, subtitle?: string, img?: string, properties?: Array<string|{label?: string, value: string}>, description?: string}|null}
     */
    async getItemSummary(action, item = action?.originalItem, actor = null) {
        if (!action && !item) return null;
        const targetItem = item ?? action?.originalItem ?? action;
        const title = action?.name ?? targetItem?.name ?? '';
        const img = (action?.img && action.img.length > 0) ? action.img : (targetItem?.img ?? '');
        const system = targetItem?.system ?? {};
        const type = targetItem?.type ? (targetItem.type.charAt(0).toUpperCase() + targetItem.type.slice(1)) : '';
        const properties = [];

        if (system.damage?.dice && system.damage?.die) {
            properties.push({ label: 'Damage', value: `${system.damage.dice}${system.damage.die} ${system.damage.damageType ?? ''}`.trim() });
        }
        if (system.range) {
            const rangeStr = typeof system.range === 'object' ? `${system.range.value ?? ''} ${system.range.unit ?? ''}`.trim() : String(system.range);
            if (rangeStr) properties.push({ label: 'Range', value: rangeStr });
        }
        if (system.traits?.value && Array.isArray(system.traits.value)) {
            for (const trait of system.traits.value) {
                properties.push({ value: trait });
            }
        }
        if (action?.uses?.available !== null && action?.uses?.available !== undefined) {
            const usesStr = `${action.uses.available}${action.uses.max ? ' / ' + action.uses.max : ''}`;
            properties.push({ label: 'Uses', value: usesStr });
        }

        let description = system.description?.value ?? '';
        if (description) {
            const rollData = targetItem?.getRollData?.() ?? actor?.getRollData?.() ?? {};
            description = await this.enrichHTML(description, {
                rollData,
                relativeTo: targetItem ?? actor,
                secrets: false,
                async: true
            });
        }

        return {
            title,
            subtitle: type,
            img,
            properties,
            description
        };
    }

    // #endregion
}
