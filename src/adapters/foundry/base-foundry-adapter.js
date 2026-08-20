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
        return foundry?.applications?.ux?.ContextMenu ?? (typeof ContextMenu !== 'undefined' ? ContextMenu : class {});
    }

    /**
     * The active KeyboardManager constructor.
     */
    get KeyboardManager() {
        return foundry?.helpers?.interaction?.KeyboardManager ?? (typeof KeyboardManager !== 'undefined' ? KeyboardManager : class {});
    }

    /**
     * The active Token placeable constructor.
     */
    get Token() {
        return foundry?.canvas?.placeables?.Token ?? (typeof Token !== 'undefined' ? Token : class {});
    }

    /**
     * The active ApplicationV2 constructor.
     */
    get ApplicationV2() {
        return foundry?.applications?.api?.ApplicationV2 ?? class {};
    }

    /**
     * The active HandlebarsApplicationMixin wrapper.
     */
    get HandlebarsApplicationMixin() {
        return foundry?.applications?.api?.HandlebarsApplicationMixin ?? ((cls) => cls);
    }

    /**
     * Safely resolve a document from UUID synchronously.
     * @param {string} uuid Document UUID
     * @param {Object} [options={}] Resolution options
     * @returns {Document|null}
     */
    fromUuidSync(uuid, options = {}) {
        if (typeof foundry?.utils?.fromUuidSync === 'function') {
            return foundry.utils.fromUuidSync(uuid, options);
        }
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
        if (typeof foundry?.utils?.mergeObject === 'function') {
            return foundry.utils.mergeObject(original, other, options);
        }
        return Object.assign(original, other);
    }

    /**
     * Deep duplicate an object.
     * @param {Object} obj Target object
     * @returns {Object}
     */
    duplicate(obj) {
        if (typeof foundry?.utils?.duplicate === 'function') {
            return foundry.utils.duplicate(obj);
        }
        return structuredClone(obj);
    }

    /**
     * Retrieve a property from an object by dot-separated path.
     * @param {Object} obj Target object
     * @param {string} path Dot path
     * @returns {*}
     */
    getProperty(obj, path) {
        if (typeof foundry?.utils?.getProperty === 'function') {
            return foundry.utils.getProperty(obj, path);
        }
        return undefined;
    }
}
