import { FoundryV12Adapter } from './foundry-v12-adapter.js';

/**
 * Foundry VTT V13 platform adapter.
 * Extends FoundryV12Adapter and encapsulates capabilities and API changes introduced in Foundry V13.
 */
export class FoundryV13Adapter extends FoundryV12Adapter {
    /**
     * The active ContextMenu constructor in v13+.
     */
    get ContextMenu() {
        return foundry.applications.ux.ContextMenu.implementation;
    }

    /**
     * The active KeyboardManager constructor in v13+.
     */
    get KeyboardManager() {
        return foundry.helpers.interaction.KeyboardManager;
    }

    /**
     * The active Token placeable constructor in v13+.
     */
    get Token() {
        return foundry.canvas.placeables.Token;
    }

    /**
     * The active FilePicker constructor / implementation in v13+.
     */
    get FilePicker() {
        return foundry.applications.apps.FilePicker.implementation;
    }

    /**
     * The active TextEditor constructor / implementation in v13+.
     */
    get TextEditor() {
        return foundry.applications.ux.TextEditor.implementation;
    }

    /**
     * Safely resolve a document from UUID synchronously using standard V13+ foundry.utils.fromUuidSync.
     * @param {string} uuid Document UUID
     * @param {Object} [options={}] Resolution options
     * @returns {Document|null}
     */
    fromUuidSync(uuid, options = {}) {
        if (!uuid) return null;
        try {
            return foundry.utils.fromUuidSync(uuid, options) ?? null;
        } catch (_) {
            return null;
        }
    }

    /**
     * Safely resolve a document from UUID asynchronously using standard V13+ foundry.utils.fromUuid.
     * @param {string} uuid Document UUID
     * @param {Object} [options={}] Resolution options
     * @returns {Promise<Document|null>}
     */
    async fromUuid(uuid, options = {}) {
        if (!uuid) return null;
        try {
            return (await foundry.utils.fromUuid(uuid, options)) ?? null;
        } catch (_) {
            return null;
        }
    }

    /**
     * Retrieve all combatants associated with a token in combat using native V13+ Combat#getCombatantsByToken.
     * @param {Combat} combat Target combat encounter
     * @param {string|TokenDocument|Token} token Token ID or Document or Placeable
     * @returns {Combatant[]}
     */
    getCombatantsByToken(combat, token) {
        if (!combat || !token) return [];
        return combat.getCombatantsByToken(token.id ?? token) ?? [];
    }

    /**
     * Preload Handlebars templates in Foundry V13+ using namespaced foundry.applications.handlebars.loadTemplates.
     * @override
     * @param {string[]} paths Array of template paths
     * @returns {Promise<Function[]>}
     */
    async loadTemplates(paths) {
        return foundry.applications.handlebars.loadTemplates(paths);
    }
}
