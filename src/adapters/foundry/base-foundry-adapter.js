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
        return foundry.utils.fromUuidSync(uuid, options);
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
     * Enrich an HTML string with Foundry enrichers, roll data, and document links.
     * @param {string} content HTML string to enrich
     * @param {Object} [options={}] Enrichment options (rollData, secrets, relativeTo, etc.)
     * @returns {Promise<string>}
     */
    async enrichHTML(content, options = {}) {
        if (!content) return '';
        if (typeof globalThis.TextEditor?.enrichHTML === 'function') {
            return globalThis.TextEditor.enrichHTML(content, { secrets: false, async: true, ...options });
        }
        return content;
    }
}
