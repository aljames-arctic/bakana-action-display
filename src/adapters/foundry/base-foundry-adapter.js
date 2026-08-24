/**
 * Baseline Foundry VTT platform adapter.
 * Abstract interface for versioned Foundry Application, ContextMenu, interaction, and utility operations.
 */
export class BaseFoundryAdapter {
    /**
     * The major generation version of Foundry VTT (e.g. 12, 13, 14).
     * @returns {number}
     */
    get generation() {
        return game.release.generation;
    }

    /**
     * The active ContextMenu constructor.
     */
    get ContextMenu() {
        return foundry.applications.ux.ContextMenu;
    }

    /**
     * The active KeyboardManager constructor.
     */
    get KeyboardManager() {
        return foundry.helpers.interaction.KeyboardManager;
    }

    /**
     * The active Token placeable constructor.
     */
    get Token() {
        return foundry.canvas.placeables.Token;
    }

    /**
     * The active ApplicationV2 constructor.
     */
    get ApplicationV2() {
        return foundry.applications.api.ApplicationV2;
    }

    /**
     * The active HandlebarsApplicationMixin wrapper.
     */
    get HandlebarsApplicationMixin() {
        return foundry.applications.api.HandlebarsApplicationMixin;
    }

    /**
     * The active FilePicker constructor / implementation.
     */
    get FilePicker() {
        return foundry.applications.apps.FilePicker.implementation;
    }

    /**
     * Browse a directory using the active FilePicker implementation.
     * @param {string} source Storage source (e.g. 'data', 'public', 'client')
     * @param {string} target Directory target path
     * @param {Object} [options={}] Browse options
     * @returns {Promise<{ target: string, files: string[], dirs: string[] }>}
     */
    async browseDirectory(source, target, options = {}) {
        return this.FilePicker.browse(source, target, options);
    }

    /**
     * Safely resolve a document from UUID synchronously.
     * @param {string} uuid Document UUID
     * @param {Object} [options={}] Resolution options
     * @returns {Document|null}
     */
    fromUuidSync(uuid, options = {}) {
        if (!uuid) return null;
        try {
            if (typeof foundry?.utils?.fromUuidSync === 'function') {
                return foundry.utils.fromUuidSync(uuid, options) ?? null;
            }
            if (typeof globalThis.fromUuidSync === 'function') {
                return globalThis.fromUuidSync(uuid, options) ?? null;
            }
        } catch (_) {}
        return null;
    }

    /**
     * Safely resolve a document from UUID asynchronously.
     * @param {string} uuid Document UUID
     * @param {Object} [options={}] Resolution options
     * @returns {Promise<Document|null>}
     */
    async fromUuid(uuid, options = {}) {
        if (!uuid) return null;
        try {
            if (typeof foundry?.utils?.fromUuid === 'function') {
                return (await foundry.utils.fromUuid(uuid, options)) ?? null;
            }
            if (typeof globalThis.fromUuid === 'function') {
                return (await globalThis.fromUuid(uuid, options)) ?? null;
            }
        } catch (_) {}
        return null;
    }

    /**
     * Merge two objects recursively.
     * @param {Object} original Target object
     * @param {Object} [other={}] Source object
     * @param {Object} [options={}] Merge options
     * @returns {Object}
     */
    mergeObject(original, other = {}, options = {}) {
        return foundry.utils.mergeObject(original, other, options);
    }

    /**
     * Deep duplicate an object.
     * @param {Object} obj Target object
     * @returns {Object}
     */
    duplicate(obj) {
        return foundry.utils.duplicate(obj);
    }

    /**
     * Retrieve a property from an object by dot-separated path.
     * @param {Object} obj Target object
     * @param {string} path Dot path
     * @returns {*}
     */
    getProperty(obj, path) {
        return foundry.utils.getProperty(obj, path);
    }

    /**
     * The active TextEditor constructor / implementation.
     */
    get TextEditor() {
        return foundry.applications.ux.TextEditor.implementation;
    }

    /**
     * Enrich an HTML string with Foundry enrichers, roll data, and document links.
     * @param {string} content HTML string to enrich
     * @param {Object} [options={}] Enrichment options (rollData, secrets, relativeTo, etc.)
     * @returns {Promise<string>}
     */
    async enrichHTML(content, options = {}) {
        if (!content) return '';
        if (typeof this.TextEditor?.enrichHTML === 'function') {
            return this.TextEditor.enrichHTML(content, { secrets: false, async: true, ...options });
        }
        return content;
    }

    /**
     * Retrieve all combatants associated with a token in combat for baseline v12/v13.
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
     * Retrieve the primary combatant associated with a token in combat for baseline v12/v13.
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
