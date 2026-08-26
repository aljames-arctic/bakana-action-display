import { BaseFoundryAdapter } from './base-foundry-adapter.js';

/**
 * Modern Foundry VTT platform adapter (v14+).
 * Extends BaseFoundryAdapter and overwrites functions with newer platform methods.
 */
export class FoundryCurrentAdapter extends BaseFoundryAdapter {
    /**
     * The active ContextMenu constructor in v14+.
     */
    get ContextMenu() {
        return foundry.applications.ux.ContextMenu;
    }

    /**
     * The active KeyboardManager constructor in v14+.
     */
    get KeyboardManager() {
        return foundry.helpers.interaction.KeyboardManager;
    }

    /**
     * The active Token placeable constructor in v14+.
     */
    get Token() {
        return foundry.canvas.placeables.Token;
    }

    /**
     * The active FilePicker constructor / implementation in v14+.
     */
    get FilePicker() {
        return foundry.applications.apps.FilePicker.implementation;
    }

    /**
     * The active TextEditor constructor / implementation in v14+.
     */
    get TextEditor() {
        return foundry.applications.ux.TextEditor.implementation;
    }

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

        return combat.getCombatantsByToken?.(tokenId) ?? [];
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
