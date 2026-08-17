import { FantasySystemAdapter } from './genre/fantasy-system-adapter.js';
import { localize } from '../../lib/utils.js';
import { TabRef } from '../../ui/tab-ref.js';

const SORT_ORDERS = {
    tabs: {
        'economy': {
            'all': 0, 'action': 1, 'reaction': 2, 'free': 3, 'other': 4
        }
    },
    item_type: {
        'weapon': 1,
        'equipment': 2,
        'consumable': 3,
        'feat': 4,
        'spell': 5,
        'other': 6
    }
};

const EXTRACTABLE_TYPES = new Set(['action', 'feat', 'spell']);

const PF2E_SPELL_SUB_TAB_ORDER = new Map(
    ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'focus', 'innate', 'ritual'].map((id, i) => [id, i])
);

const ICONS = {
    action_type: {
        'all': 'fas fa-border-all',
        'economy': 'fas fa-stopwatch'
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
    constructor() {
        super('pf2e');
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

        // 3. Apply default resource filtering (e.g. hiding depleted actions)
        return super.modifyActions(modified, actor);
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
        switch (subId) {
            case 'all': return localize('BAD.core.allActions', 'All Actions');
            case 'action': return localize('PF2E.TabActionsLabel', 'Actions');
            case 'reaction': return localize('PF2E.ActionsReactionsHeader', 'Reactions');
            case 'other': return localize('PF2E.ActionsFreeActionsHeader', 'Free Actions');
            default: return super.getActionSubTabLabel(subId);
        }
    }

    /**
     * Modify the rendering context before it is sent to the template.
     * Used here to sort the spell sub-tabs (Cantrips, Ranks 1-10, Focus, Innate, Rituals) in the correct order.
     */
    modifyContext(context, app) {
        super.modifyContext?.(context, app);

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
        for (const i of actor.items) {
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
        if (typeof item.toMessage === 'function') {
            item.toMessage();
        } else if (typeof item.use === 'function') {
            item.use({ event: proxiedEvent });
        }
    }

    #executeSpellRoll(entry, item, event) {
        const proxiedEvent = this._createRollEvent(event);
        if (typeof entry.cast === 'function') {
            entry.cast(item, { event: proxiedEvent });
        } else if (typeof item.toMessage === 'function') {
            item.toMessage();
        }
    }

    #executeStrikeRoll(strike, event) {
        const proxiedEvent = this._createRollEvent(event);
        if (strike.variants?.[0]?.roll) {
            strike.variants[0].roll({ event: proxiedEvent });
        } else if (typeof strike.roll === 'function') {
            strike.roll({ event: proxiedEvent });
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
            uses: this.#getStrikeAmmoUses(strike, ammoQuantities),
            roll: (event) => this.#executeStrikeRoll(strike, event),
            originalItem: strike.item,
            extra: { pf2eStrike: strike }
        };
    }

    #formatActionRow(action, spellToEntryMap) {
        const item = action.originalItem;
        if (item.type === 'action' || item.type === 'feat') {
            return this.#formatFeatAction(action, item);
        }
        if (item.type === 'spell') {
            return this.#formatSpellAction(action, item, spellToEntryMap.get(item.id));
        }
        return false;
    }

    #formatFeatAction(action, item) {
        const activationType = this.#getActionType(item);
        if (!activationType) return false;

        action.activationType = activationType;
        action.right = [TabRef.from('economy', activationType)];
        action.left = [item.type === 'action' ? 'feat' : item.type];
        action.uses = this.#getUses(item);
        action.roll = (event) => this.#executeFeatRoll(item, event);
        return true;
    }

    #formatSpellAction(action, item, entry) {
        if (!entry) return false;

        const spellLevel = item.rank ?? 0;
        action.right = [TabRef.from('economy', 'action')];
        action.activationType = 'action';
        action.left = ['spell', this.#getSpellSubTab(entry, spellLevel)];
        action.roll = (event) => this.#executeSpellRoll(entry, item, event);
        action.uses = this.#getSpellUses(entry, item);
        action.name = `${item.name} (${entry.name})`;
        return true;
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
     * @returns {Object[]} Array of category definition objects
     */
    getDefaultCategories() {
        return super.getDefaultCategories({
            weapon: {
                name: 'Weapons & Strikes',
                expression: `item.type === 'weapon' || left.includes('weapon')`
            },
            spell: {
                subcategories: [
                    {
                        id: 'sub_cantrips',
                        name: 'Cantrips',
                        expression: `item.rank === 0 || item.isCantrip || item.system.traits.value.includes('cantrip')`
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
        });
    }

    // #endregion
}
