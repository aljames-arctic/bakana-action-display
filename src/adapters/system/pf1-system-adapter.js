import { FantasySystemAdapter } from './genre/fantasy-system-adapter.js';
import { localize } from '../../lib/utils.js';
import { log } from '../../lib/logger.js';
import { TabRef } from '../../ui/tab-ref.js';
import { Action } from '../../ui/action.js';
import { MODULE_ID } from '../../constants.js';
import { Pf1SystemContextMenuManager } from './context-menu/pf1-system-context-menu-manager.js';

const SORT_ORDERS = {
    tabs: {
        'economy': {
            'all': 0, 'action': 1, 'bonus': 2, 'reaction': 3, 'other': 4
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
        'attack': 3,
        'equipment': 4,
        'spell': 5,
        'feat': 6,
        'buff': 7,
        'consumable': 8
    }
};

const EXTRACTABLE_TYPES = new Set(['spell', 'attack', 'weapon', 'consumable', 'feat', 'buff', 'equipment']);

const SPELL_SUB_TAB_ORDER = new Map(
    ['cantrip', 'orison', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'sla'].map((id, i) => [id, i])
);

const ICONS = {
    action_type: {
        'all': 'fas fa-border-all',
        'economy': 'fas fa-stopwatch',
        'ability': 'fas fa-fist-raised'
    }
};

/**
 * System adapter for Pathfinder 1st Edition (PF1e).
 * Handles PF1e's multi-action items, prepared/spontaneous spellcasting, and toggleable buffs.
 */
export class Pf1SystemAdapter extends FantasySystemAdapter {
    constructor() {
        super('pf1', true);
        this.contextMenuManager = new Pf1SystemContextMenuManager(this);
    }

    /**
     * Check if a PF1e item is equipped.
     * @param {Item} item
     * @returns {boolean}
     */
    getItemEquipped(item) {
        if (!item?.system) return true;
        if (item.system.equipped !== undefined) {
            return Boolean(item.system.equipped);
        }
        return true;
    }

    // #region Core Action Modification

    /**
     * Determine if a specific item should be extracted as a base action for PF1e.
     * Prevents allocating objects for unhandled item types (like containers).
     */
    shouldExtractItem(item) {
        return EXTRACTABLE_TYPES.has(item.type);
    }

    /**
     * Filter, map, and sort actions for PF1e.
     * @param {Object[]} actions Base action list from the core
     * @param {Actor} actor 
     * @returns {Object[]} The modified actions list
     */
    async modifyActions(actions, actor) {
        const modified = [];
        const showAll = Boolean(actor?.getFlag?.(MODULE_ID, 'showAll'));

        const { attackToWeaponMap, weaponLinkedAttacks } = this.#buildWeaponAttackLinks(actor);

        for (const action of actions) {
            const item = action.originalItem;
            const type = item.type;

            let isUnequipped = false;
            if (['weapon', 'equipment', 'consumable', 'loot', 'attack'].includes(type) && item.system?.equipped !== undefined) {
                if (this.getItemEquipped(item) === false) {
                    isUnequipped = true;
                    const showUnequipped = Boolean((actor?.getFlag?.(MODULE_ID, `showUnequipped_${type}`) ?? false) || showAll);
                    const isUserHidden = Boolean(actor?.getFlag?.(MODULE_ID, 'hiddenItems')?.[item.id]);
                    if (!showUnequipped && !isUserHidden) {
                        log.debug(`Pf1SystemAdapter.modifyActions | Filtering out unequipped ${type} "${item.name}" (ID: ${item.id}) — item.system.equipped === false and showUnequipped_${type} / showAll flag is not set`);
                        continue;
                    }
                }
            }

            if (item.type === 'spell') {
                // 1. Spells in PF1e
                const spellbookId = item.system.spellbook ?? 'primary';
                const spellbook = this.#getSpellbook(actor, spellbookId);
                if (!spellbook) {
                    log.debug(`Pf1SystemAdapter.modifyActions | Filtering out spell "${item.name}" (ID: ${item.id}) — no spellbook found for spellbook ID "${spellbookId}" (item.system.spellbook)`);
                    continue;
                }

                action.right = [TabRef.from('economy', 'action')];
                action.activationType = 'action';

                const level = item.system.level ?? 0;
                const subTab = this.#getSpellSubTab(spellbookId, spellbook, level);
                action.left = ['spell', subTab];

                // Calculate uses (slots or prepared casts)
                action.uses = this.#calculateSpellUses(spellbook, item);

                // Roll function
                action.roll = (event) => this.#executeItemRoll(item, null, event);

                modified.push(action);
            } else if (item.type === 'attack') {
                // 2. Attacks in PF1e (if not linked to a weapon)
                if (attackToWeaponMap.has(item.id)) {
                    log.debug(`Pf1SystemAdapter.modifyActions | Skipping attack "${item.name}" (${item.id}) because it is linked to a weapon.`);
                    continue;
                }

                const itemActions = this.#getItemActions(item);
                if (itemActions.length === 0) {
                    log.debug(`Pf1SystemAdapter.modifyActions | Filtering out attack "${item.name}" (ID: ${item.id}) — item.system.actions is empty`);
                    continue;
                }

                const uses = this.#calculateUses(item, actor);

                const subactions = this.#buildSubactions(item, itemActions, uses);
                if (subactions.length === 0) {
                    log.debug(`Pf1SystemAdapter.modifyActions | Filtering out attack "${item.name}" (ID: ${item.id}) — no subactions had a recognized activationType`);
                    continue;
                }

                this.#promoteFirstSubaction(action, subactions, ['weapon'], uses);
                if (isUnequipped) action.available = false;
                modified.push(action);

            } else if (item.type === 'weapon') {
                // 3. Weapons (with ammo resolution and linked attacks merging)
                const uses = this.#calculateUses(item, actor);
                const linkedAttacks = weaponLinkedAttacks.get(item.id) ?? [];

                const itemActionsList = linkedAttacks.length > 0
                    ? this.#buildLinkedAttackSubactions(linkedAttacks, item, uses)
                    : this.#buildSubactions(item, this.#getItemActions(item), uses);

                if (itemActionsList.length === 0) {
                    log.debug(`Pf1SystemAdapter.modifyActions | Filtering out weapon "${item.name}" (ID: ${item.id}) — no subactions had a recognized activationType`);
                    continue;
                }

                this.#promoteFirstSubaction(action, itemActionsList, ['weapon'], uses);
                if (isUnequipped) action.available = false;
                modified.push(action);

            } else if (['consumable', 'feat', 'equipment'].includes(type)) {
                // 4. Consumables, Feats, and Equipment
                const itemActions = item.system.actions ?? [];
                if (itemActions.length === 0) {
                    if (type === 'equipment') {
                        // Passive or standard equipment item
                        action.right = [TabRef.from('economy', 'other')];
                        action.activationType = 'other';
                        action.left = ['equipment'];
                        action.uses = { available: null, max: null };
                        action.available = !isUnequipped;
                        action.roll = (event) => this.#executeItemRoll(item, null, event);
                        modified.push(action);
                        continue;
                    }
                    log.debug(`Pf1SystemAdapter.modifyActions | Filtering out ${type} "${item.name}" (ID: ${item.id}) — item.system.actions is empty`);
                    continue;
                }

                const uses = this.#calculateUses(item, actor);

                const subactions = this.#buildSubactions(item, itemActions, uses);
                if (subactions.length === 0) {
                    log.debug(`Pf1SystemAdapter.modifyActions | Filtering out ${type} "${item.name}" (ID: ${item.id}) — no subactions had a recognized activationType`);
                    continue;
                }

                this.#promoteFirstSubaction(action, subactions, [item.type], uses);
                if (isUnequipped) action.available = false;
                modified.push(action);

            } else if (item.type === 'buff') {
                // 5. Buffs
                action.right = [TabRef.from('economy', 'other')];
                action.activationType = 'other';
                action.left = ['buff'];

                action.roll = async (event) => {
                    const active = this.#getBuffActiveState(item);
                    await item.update({ "system.active": !active });
                };

                action.isActive = this.#getBuffActiveState(item);
                action.uses = { available: null, max: null };
                action.excludeFromAll = true; // Exclude buffs from the 'All Items' tab in PF1e

                modified.push(action);
            }
        }

        for (const act of modified) {
            act.page = 1;
        }

        modified.push(...this.extractCheckActions(actor));

        // Apply default resource filtering (e.g. hiding depleted actions)
        return super.modifyActions(modified, actor);
    }

    /**
     * Extract Page 2 ability checks, saving throws, and skill checks for PF1e.
     * @param {Actor} actor
     * @returns {Action[]}
     */
    extractCheckActions(actor) {
        if (!actor) return [];
        const checkActions = [];
        const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
        const abilityNames = {
            str: ['PF1.AbilityStr', 'Strength'],
            dex: ['PF1.AbilityDex', 'Dexterity'],
            con: ['PF1.AbilityCon', 'Constitution'],
            int: ['PF1.AbilityInt', 'Intelligence'],
            wis: ['PF1.AbilityWis', 'Wisdom'],
            cha: ['PF1.AbilityCha', 'Charisma']
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

            const subactions = [];

            if (abl === 'con' || abl === 'dex' || abl === 'wis') {
                const saveMap = { con: 'fort', dex: 'ref', wis: 'will' };
                const saveKey = saveMap[abl];
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
                        if (typeof actor.rollSavingThrow === 'function') {
                            return actor.rollSavingThrow(saveKey, { event: rollEvent });
                        } else if (typeof actor.rollSave === 'function') {
                            return actor.rollSave(saveKey, { event: rollEvent });
                        }
                    }
                });
                subactions.push(saveSub);
            }

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
                    if (typeof actor.rollAbilityTest === 'function') {
                        return actor.rollAbilityTest(abl, { event: rollEvent });
                    } else if (typeof actor.rollAbilityCheck === 'function') {
                        return actor.rollAbilityCheck(abl, { event: rollEvent });
                    } else if (typeof actor.rollAbility === 'function') {
                        return actor.rollAbility(abl, { event: rollEvent });
                    }
                }
            });
            subactions.push(checkSub);

            const coreAction = new Action({
                id: `ability-${abl}`,
                name,
                type: 'ability',
                img,
                right: [TabRef.from('ability', abl)],
                left: subactions.some(s => s.type === 'save') ? ['savingThrow'] : ['abilityCheck'],
                itemCategories: subactions.some(s => s.type === 'save') ? [['savingThrow'], ['abilityCheck']] : [['abilityCheck']],
                available: true,
                uses: { available: null, max: null },
                subactions,
                collapseDropdownIfSingle: true,
                extra: { section: 'core', page: 2, ability: abl }
            });
            coreAction.section = 'core';
            coreAction.page = 2;
            checkActions.push(coreAction);
        }

        // Skills
        const skills = actor.system?.skills ?? {};
        for (const [skillId, skill] of Object.entries(skills)) {
            const abl = skill.ability ?? CONFIG?.PF1?.skills?.[skillId]?.ability ?? 'dex';
            const label = skill.name ?? CONFIG?.PF1?.skills?.[skillId] ?? skill.label ?? skillId;
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
                    if (typeof actor.rollSkill === 'function') {
                        return actor.rollSkill(skillId, { event: rollEvent });
                    }
                },
                extra: { section: 'other', page: 2, ability: abl }
            });
            skillAction.section = 'other';
            skillAction.page = 2;
            checkActions.push(skillAction);

            if (skill.subSkills && typeof skill.subSkills === 'object') {
                for (const [subId, subSkill] of Object.entries(skill.subSkills)) {
                    const subAbl = subSkill.ability ?? abl;
                    const subLabel = subSkill.name ?? `${label} (${subId})`;
                    const subAction = new Action({
                        id: `skill-${skillId}-${subId}`,
                        name: subLabel,
                        type: 'skill',
                        img: abilityIcons[subAbl] ?? skillImg,
                        right: [TabRef.from('ability', subAbl)],
                        left: ['abilityCheck'],
                        available: true,
                        uses: { available: null, max: null },
                        roll: async (event) => {
                            const rollEvent = this._createRollEvent(event);
                            if (typeof actor.rollSkill === 'function') {
                                return actor.rollSkill(`${skillId}.subSkills.${subId}`, { event: rollEvent });
                            }
                        },
                        extra: { section: 'other', page: 2, ability: subAbl }
                    });
                    subAction.section = 'other';
                    subAction.page = 2;
                    checkActions.push(subAction);
                }
            }
        }

        return checkActions;
    }

    // #endregion

    // #region Localizations & UI Formatting

    /**
     * Modify the rendering context before it is sent to the template.
     * Used here to sort the spell sub-tabs (Cantrips, Orisons, Levels, SLAs) and display showUnprepared indicators.
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

        const equipmentParent = context.itemTypes?.find(g => g.id === 'equipment');
        if (equipmentParent) {
            const showUnequippedEquipment = Boolean(app.actor?.getFlag?.(MODULE_ID, 'showUnequipped_equipment'));
            equipmentParent.showUnprepared = Boolean(showUnequippedEquipment || showAll);
        }

        const spellGroup = context.itemTypes?.find(g => g.id === 'spell');
        if (spellGroup?.subTabs?.length) {
            spellGroup.subTabs.sort((a, b) =>
                (SPELL_SUB_TAB_ORDER.get(a.id) ?? 999) - (SPELL_SUB_TAB_ORDER.get(b.id) ?? 999)
            );
        }
    }

    /**
     * Get the localized label for a right-side action type (parent tab) in PF1e.
     */
    getActionTypeLabel(parentId) {
        const labels = {
            'economy': localize('BAD.common.actionEconomy', 'Action Economy')
        };
        return labels[parentId] ?? super.getActionTypeLabel(parentId);
    }

    /**
     * Get the CSS icon class for a right-side action type (parent tab) in PF1e.
     */
    getActionTypeIcon(parentId) {
        return ICONS.action_type[parentId] ?? super.getActionTypeIcon(parentId);
    }

    /**
     * Get the localized label for a right-side action sub-tab in PF1e.
     */
    getActionSubTabLabel(subId) {
        const abilityLabels = {
            str: localize('PF1.AbilityStr', 'Strength'),
            dex: localize('PF1.AbilityDex', 'Dexterity'),
            con: localize('PF1.AbilityCon', 'Constitution'),
            int: localize('PF1.AbilityInt', 'Intelligence'),
            wis: localize('PF1.AbilityWis', 'Wisdom'),
            cha: localize('PF1.AbilityCha', 'Charisma')
        };
        if (abilityLabels[subId]) return abilityLabels[subId];

        switch (subId) {
            case 'all': return localize('BAD.core.allActions', 'All Actions');
            case 'action': return localize('PF1.Activation.action.Plural', 'Actions');
            case 'bonus': return localize('PF1.Activation.swift.Single', 'Swift');
            case 'reaction': return localize('PF1.Activation.immediate.Single', 'Immediate');
            case 'other': return localize('PF1.Activation.free.Single', 'Free');
            default: return super.getActionSubTabLabel(subId);
        }
    }

    /**
     * Get the list of configurable action economy types and default colors for PF1.
     * @returns {{ id: string, label: string, defaultColor: string }[]}
     */
    getEconomyTypes() {
        return [
            { id: 'action', label: this.getActionSubTabLabel('action') ?? 'Actions', defaultColor: '#3b82f6', defaultEnabled: true },
            { id: 'bonus', label: this.getActionSubTabLabel('bonus') ?? 'Swift', defaultColor: '#14b8a6', defaultEnabled: true },
            { id: 'reaction', label: this.getActionSubTabLabel('reaction') ?? 'Immediate', defaultColor: '#ef4444', defaultEnabled: true },
            { id: 'other', label: this.getActionSubTabLabel('other') ?? 'Free', defaultColor: '#64748b', defaultEnabled: true }
        ];
    }

    /**
     * Get the localized label for a left-side item type (parent tab) in PF1e.
     */
    getItemTypeLabel(parentId) {
        switch (parentId) {
            case 'weapon': return localize('PF1.InventoryWeapons', 'Weapons');
            case 'equipment': return localize('PF1.InventoryEquipment', localize('PF1.Equipment', 'Equipment'));
            case 'spell': return localize('PF1.Spells', 'Spells');
            case 'feat': return localize('PF1.Feats', 'Feats');
            case 'buff': return localize('PF1.Buffs', 'Buffs');
            case 'consumable': return localize('PF1.InventoryConsumables', 'Consumables');
            default: return super.getItemTypeLabel(parentId);
        }
    }

    /**
     * Get the localized label for a left-side item sub-tab (spell level/spellbook) in PF1e.
     */
    getItemSubTabLabel(parentId, subId) {
        if (parentId !== 'spell') return super.getItemSubTabLabel(parentId, subId);

        switch (subId) {
            case 'sla':
                return localize('PF1.SpellBookSpelllike', 'Spell-like');
            case 'cantrip':
                return localize('PF1.Cantrip', localize('PF1.Cantrips', 'Cantrips'));
            case 'orison':
                return localize('PF1.Orison', localize('PF1.Orisons', 'Orisons'));
            default:
                return localize(`PF1.SpellLevels.${subId}`, `${subId} Level`);
        }
    }

    /**
     * Get the CSS icon class for a left-side item type (parent tab) in PF1e.
     */
    getItemTypeIcon(parentId) {
        if (parentId === 'buff') return 'fas fa-sparkles';
        if (parentId === 'equipment') return 'fas fa-shield';
        return super.getItemTypeIcon(parentId);
    }

    getItemTypeSortOrder(parentId) {
        return SORT_ORDERS.item_type[parentId] ?? super.getItemTypeSortOrder(parentId);
    }

    getActionSubTabSortOrder(parentId, subId) {
        return SORT_ORDERS.tabs[parentId]?.[subId] ?? super.getActionSubTabSortOrder(parentId, subId);
    }



    /* ------------------------------------------------------------------------- */
    /*  System Data Structure Accessors / Schema Extraction Helpers              */
    /* ------------------------------------------------------------------------- */

    // #endregion

    // #region System Specific Data Extractors & Schema Helpers

    #executeItemRoll(item, actionId, event) {
        const proxiedEvent = this._createRollEvent(event);
        const options = actionId ? { actionId, event: proxiedEvent } : { event: proxiedEvent };
        if (typeof item.use === 'function') {
            item.use(options);
        } else if (typeof item.roll === 'function') {
            item.roll(options);
        }
    }

    #buildSubactions(item, itemActions, uses) {
        const subactions = [];
        for (const itemAction of itemActions) {
            const activationType = this.#parseActivationType(itemAction.activation?.type);
            if (!activationType) continue;

            subactions.push({
                id: itemAction._id,
                name: itemAction.name ?? item.name,
                img: item.img,
                activationType,
                right: [TabRef.from('economy', activationType)],
                uses,
                roll: (event) => this.#executeItemRoll(item, itemAction._id, event)
            });
        }
        return subactions;
    }

    #buildLinkedAttackSubactions(linkedAttacks, weapon, uses) {
        const subactions = [];
        for (const attackItem of linkedAttacks) {
            for (const itemAction of this.#getItemActions(attackItem)) {
                const activationType = this.#parseActivationType(itemAction.activation?.type);
                if (!activationType) continue;

                const name = linkedAttacks.length > 1
                    ? `${attackItem.name}: ${itemAction.name ?? localize('PF1.Attack', 'Attack')}`
                    : (itemAction.name ?? attackItem.name);

                subactions.push({
                    id: itemAction._id,
                    name,
                    img: attackItem.img ?? weapon.img,
                    activationType,
                    right: [TabRef.from('economy', activationType)],
                    uses,
                    roll: (event) => this.#executeItemRoll(attackItem, itemAction._id, event)
                });
            }
        }
        return subactions;
    }

    /**
     * Translate PF1e activation types into our core activation types.
     * Maps Swift -> bonus, Immediate -> reaction, Free/Nonaction -> other.
     * @param {string} actType Raw PF1e activation type
     * @returns {string|null} Normalized activation type
     * @private
     */
    #parseActivationType(actType) {
        if (!actType) return null;

        switch (actType.toLowerCase()) {
            case 'standard':
            case 'attack':
                return 'action';
            case 'swift':
                return 'bonus';
            case 'immediate':
                return 'reaction';
            case 'free':
            case 'nonaction':
                return 'other';
            default:
                return null;
        }
    }

    #buildWeaponAttackLinks(actor) {
        const attackToWeaponMap = new Map();
        const weaponLinkedAttacks = new Map();

        const weapons = actor.items.filter(i => i.type === 'weapon');

        for (const weapon of weapons) {
            const children = this.#getWeaponLinkChildren(weapon);
            const linked = [];
            for (const child of children) {
                if (!child.uuid) continue;

                let childItem = null;
                try {
                    childItem = foundry.utils.fromUuidSync(child.uuid, { relative: actor });
                } catch (e) {
                    log.error(`Pf1SystemAdapter.modifyActions | Failed to resolve child UUID ${child.uuid}:`, e);
                }

                if (childItem && childItem.type === 'attack') {
                    attackToWeaponMap.set(childItem.id, weapon);
                    linked.push(childItem);
                }
            }
            if (linked.length > 0) {
                weaponLinkedAttacks.set(weapon.id, linked);
            }
        }

        return { attackToWeaponMap, weaponLinkedAttacks };
    }

    /**
     * Extract weapon link children for a PF1e weapon item.
     * @param {Item} weapon
     * @returns {Object[]} Link children objects
     */
    #getWeaponLinkChildren(weapon) {
        return weapon.system.links?.children ?? [];
    }

    /**
     * Get a spellbook from a PF1e Actor by ID.
     * @param {Actor} actor
     * @param {string} spellbookId
     * @returns {Object|undefined}
     */
    #getSpellbook(actor, spellbookId) {
        return actor.system.attributes?.spells?.spellbooks?.[spellbookId];
    }

    #getSpellSubTab(spellbookId, spellbook, level) {
        if (spellbookId === 'spelllike' || spellbookId === 'sla') return 'sla';
        if (level === 0 && spellbook?.kind === 'arcane') return 'cantrip';
        if (level === 0 && spellbook?.kind === 'divine') return 'orison';
        return level.toString();
    }

    #promoteFirstSubaction(action, subactions, left, uses) {
        const firstSub = subactions[0];
        action.subactions = subactions;
        action.activationType = firstSub.activationType;
        action.right = firstSub.right;
        action.left = left;
        action.uses = uses;
    }

    /**
     * Extract sub-actions attached to a PF1e item or attack.
     * @param {Item} item
     * @returns {Object[]} Sub-action objects
     */
    #getItemActions(item) {
        return item.system.actions ?? [];
    }

    /**
     * Extract active state of a PF1e Buff item.
     * @param {Item} item
     * @returns {boolean}
     */
    #getBuffActiveState(item) {
        return item.system.active ?? false;
    }

    /**
     * Calculate remaining charges/uses for PF1e items.
     */
    #calculateUses(item, actor) {
        // 1. Ranged weapon ammunition tracking
        if (item.type === 'weapon' && item.system.weaponSubtype === 'ranged' && item.system.ammo?.type) {
            const ammoId = item.system.ammo?.default;
            const quantity = (ammoId && actor?.items.get(ammoId)?.system.quantity) ?? 0;
            return { available: quantity, max: null };
        }

        // 2. Standard charges/uses
        const max = item.system.uses?.max ?? 0;
        const value = item.system.uses?.value;

        if (max > 0 || (value ?? 0) > 0) {
            return { available: value ?? max, max };
        }

        // Fallback for consumables: use quantity if uses are not defined
        if (item.type === 'consumable' && item.system.quantity !== undefined) {
            return {
                available: item.system.quantity ?? 0,
                max: null
            };
        }

        return { available: null, max: null };
    }

    /**
     * Calculate spell slot / prepared uses for PF1e spells.
     */
    #calculateSpellUses(spellbook, spell) {
        const level = spell.system.level ?? 0;
        if (level === 0) return { available: null, max: null }; // Cantrips have infinite uses

        // 1. Prepared Spellcasting (Wizard, Cleric, Alchemist, etc.)
        if (spellbook.spellPreparationMode === 'prepared') {
            const prep = spell.system.preparation;
            if (prep?.max > 0) {
                return { available: prep.value ?? prep.max, max: prep.max };
            }
            return { available: 0, max: 0 }; // Not prepared
        }

        // 2. Spontaneous Spellcasting (Sorcerer, Bard, etc.)
        // Uses the spellbook's slots for that level on the actor
        const slot = spellbook.spells?.[`spell${level}`];
        if (slot) {
            return {
                available: slot.value ?? 0,
                max: slot.max ?? 0
            };
        }

        return { available: null, max: null };
    }

    /**
     * Get the default HUD categorization structure for PF1e.
     * @param {Object} [overrides={}] Generic category overrides
     * @returns {Object[]} Array of category definition objects
     */
    getDefaultCategories(overrides = {}) {
        const categories = super.getDefaultCategories(foundry.utils.mergeObject({
            weapon: {
                expression: `item.type === 'weapon' || item.type === 'attack' || item.type === 'equipment'`
            },
            feature: {
                expression: `item.type === 'feat' || item.type === 'buff'`
            }
        }, overrides, { inplace: false, overwrite: true }));

        const pf1Categories = [
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

        for (const cat of pf1Categories) {
            const key = cat.id.replace('cat_', '');
            const catOverride = overrides[cat.id] ?? overrides[key] ?? {};
            categories.push(foundry.utils.mergeObject(cat, catOverride, { inplace: false, overwrite: true }));
        }

        return categories;
    }

    // #endregion
}
