import { BaseFoundryAdapter } from './base-foundry-adapter.js';

/**
 * Foundry VTT V12 platform baseline adapter.
 * Extends BaseFoundryAdapter and provides global constructors and legacy UUID/combat handlers for Foundry V12.
 */
export class FoundryV12Adapter extends BaseFoundryAdapter {
    /**
     * The active ContextMenu constructor in v12.
     */
    get ContextMenu() {
        return ContextMenu;
    }

    /**
     * The active KeyboardManager constructor in v12.
     */
    get KeyboardManager() {
        return KeyboardManager;
    }

    /**
     * The active Token placeable constructor in v12.
     */
    get Token() {
        return Token;
    }

    /**
     * The active FilePicker constructor / implementation in v12.
     */
    get FilePicker() {
        return FilePicker;
    }

    /**
     * The active TextEditor constructor / implementation in v12.
     */
    get TextEditor() {
        return TextEditor;
    }
    /**
     * Safely resolve a document from UUID synchronously in Foundry V12.
     * @param {string} uuid Document UUID
     * @param {Object} [options={}] Resolution options
     * @returns {Document|null}
     */
    fromUuidSync(uuid, options = {}) {
        if (!uuid) return null;
        try {
            return fromUuidSync(uuid, options) ?? null;
        } catch (_) {
            return null;
        }
    }

    /**
     * Safely resolve a document from UUID asynchronously in Foundry V12.
     * @param {string} uuid Document UUID
     * @param {Object} [options={}] Resolution options
     * @returns {Promise<Document|null>}
     */
    async fromUuid(uuid, options = {}) {
        if (!uuid) return null;
        try {
            return (await fromUuid(uuid, options)) ?? null;
        } catch (_) {
            return null;
        }
    }

    /**
     * Retrieve all combatants associated with a token in combat using legacy V12 Combat#getCombatantByToken.
     * @param {Combat} combat Target combat encounter
     * @param {string|TokenDocument|Token} token Token ID or Document or Placeable
     * @returns {Combatant[]}
     */
    getCombatantsByToken(combat, token) {
        if (!combat) return [];
        const tokenId = token?.id ?? token?.document?.id ?? token;
        if (!tokenId) return [];

        const single = combat.getCombatantByToken(tokenId);
        return single ? [single] : [];
    }
}
