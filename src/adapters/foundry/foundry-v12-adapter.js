import { BaseFoundryAdapter } from './base-foundry-adapter.js';

/**
 * Platform adapter for Foundry VTT v12 / v13.
 * Implements platform capabilities using legacy v12/v13 Foundry APIs.
 */
export class FoundryVTTV12Adapter extends BaseFoundryAdapter {
    /**
     * Retrieve all combatants associated with a token in combat for v12/v13.
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
        if (typeof combat.getCombatantByToken === 'function') {
            const single = combat.getCombatantByToken(tokenId);
            return single ? [single] : [];
        }
        const match = combat.combatants?.filter?.(c => c.tokenId === tokenId || c.token?.id === tokenId) ?? [];
        return Array.isArray(match) ? match : Array.from(match);
    }

    /**
     * Retrieve the primary combatant associated with a token in combat for v12/v13.
     * @param {Combat} combat Target combat encounter
     * @param {string|TokenDocument|Token} token Token ID or Document or Placeable
     * @returns {Combatant|null}
     */
    getCombatantByToken(combat, token) {
        if (!combat) return null;
        const tokenId = typeof token === 'string' ? token : (token?.id ?? token?.document?.id);
        if (!tokenId) return null;

        if (typeof combat.getCombatantByToken === 'function') {
            return combat.getCombatantByToken(tokenId) ?? null;
        }
        return combat.combatants?.find?.(c => c.tokenId === tokenId || c.token?.id === tokenId) ?? null;
    }
}
