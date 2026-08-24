import { BaseFoundryAdapter } from './base-foundry-adapter.js';

/**
 * Platform adapter for Foundry VTT v14+.
 * Implements platform capabilities using modern v14+ Foundry APIs (e.g. Combat#getCombatantsByToken).
 */
export class FoundryVTTV14Adapter extends BaseFoundryAdapter {
    /**
     * Retrieve all combatants associated with a token in combat using v14+ Combat#getCombatantsByToken.
     * @param {Combat} combat Target combat encounter
     * @param {string|TokenDocument|Token} token Token ID or Document or Placeable
     * @returns {Combatant[]}
     */
    getCombatantsByToken(combat, token) {
        if (!combat) return [];
        const tokenId = typeof token === 'string' ? token : (token?.id ?? token?.document?.id);
        if (!tokenId) return [];

        if (typeof combat.getCombatantsByToken === 'function') {
            return combat.getCombatantsByToken(tokenId);
        }
        const match = combat.combatants?.filter?.(c => c.tokenId === tokenId || c.token?.id === tokenId) ?? [];
        return Array.isArray(match) ? match : Array.from(match);
    }

    /**
     * Retrieve the primary combatant associated with a token in combat using v14+ Combat#getCombatantsByToken.
     * @param {Combat} combat Target combat encounter
     * @param {string|TokenDocument|Token} token Token ID or Document or Placeable
     * @returns {Combatant|null}
     */
    getCombatantByToken(combat, token) {
        return this.getCombatantsByToken(combat, token)[0] ?? null;
    }
}
