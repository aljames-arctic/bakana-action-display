import { BaseFoundryAdapter } from './base-foundry-adapter.js';

/**
 * Foundry VTT V12 platform baseline adapter.
 * Extends BaseFoundryAdapter and provides global constructors and legacy UUID/combat handlers for Foundry V12.
 */
export class FoundryV12Adapter extends BaseFoundryAdapter {
    /**
     * The active ContextMenu constructor (global in v12/v13 baseline).
     */
    get ContextMenu() {
        return ContextMenu;
    }

    /**
     * The active KeyboardManager constructor (global in v12/v13 baseline).
     */
    get KeyboardManager() {
        return KeyboardManager;
    }

    /**
     * The active Token placeable constructor (global in v12/v13 baseline).
     */
    get Token() {
        return Token;
    }

    /**
     * The active ApplicationV2 constructor (introduced in v12 under foundry.applications.api).
     */
    get ApplicationV2() {
        return foundry.applications.api.ApplicationV2;
    }

    /**
     * The active HandlebarsApplicationMixin wrapper (introduced in v12 under foundry.applications.api).
     */
    get HandlebarsApplicationMixin() {
        return foundry.applications.api.HandlebarsApplicationMixin;
    }

    /**
     * The active FilePicker constructor / implementation (global in v12/v13 baseline).
     */
    get FilePicker() {
        return FilePicker.implementation ?? FilePicker;
    }

    /**
     * The active TextEditor constructor / implementation (global in v12/v13 baseline).
     */
    get TextEditor() {
        return TextEditor.implementation ?? TextEditor;
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
     * Retrieve all combatants associated with a token in combat for baseline v12/v13.
     * @param {Combat} combat Target combat encounter
     * @param {string|TokenDocument|Token} token Token ID or Document or Placeable
     * @returns {Combatant[]}
     */
    getCombatantsByToken(combat, token) {
        if (!combat) return [];
        const tokenId = token?.id ?? token?.document?.id ?? token;
        if (!tokenId) return [];

        const single = combat.getCombatantByToken?.(tokenId);
        return single ? [single] : [];
    }

    /**
     * Retrieve the primary combatant associated with a token in combat for baseline v12/v13.
     * @param {Combat} combat Target combat encounter
     * @param {string|TokenDocument|Token} token Token ID or Document or Placeable
     * @returns {Combatant|null}
     */
    getCombatantByToken(combat, token) {
        return this.getCombatantsByToken(combat, token)[0] ?? null;
    }
}
