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
        const rawGen = globalThis.game?.release?.generation;
        if (typeof rawGen === 'number') return rawGen;
        const versionStr = globalThis.game?.version ?? '12';
        const parsed = parseInt(String(versionStr).split('.')[0], 10);
        return isNaN(parsed) ? 12 : parsed;
    }

    /**
     * The active ContextMenu constructor.
     */
    get ContextMenu() {
        return globalThis.foundry?.applications?.ux?.ContextMenu ?? globalThis.ContextMenu ?? class {};
    }

    /**
     * The active KeyboardManager constructor.
     */
    get KeyboardManager() {
        return globalThis.foundry?.helpers?.interaction?.KeyboardManager ?? globalThis.KeyboardManager ?? class {};
    }

    /**
     * The active Token placeable constructor.
     */
    get Token() {
        return globalThis.foundry?.canvas?.placeables?.Token ?? globalThis.Token ?? class {};
    }

    /**
     * The active ApplicationV2 constructor.
     */
    get ApplicationV2() {
        return globalThis.foundry?.applications?.api?.ApplicationV2 ?? class {};
    }

    /**
     * The active HandlebarsApplicationMixin wrapper.
     */
    get HandlebarsApplicationMixin() {
        return globalThis.foundry?.applications?.api?.HandlebarsApplicationMixin ?? ((cls) => cls);
    }

    /**
     * Safely resolve a document from UUID synchronously.
     * @param {string} uuid Document UUID
     * @param {Object} [options={}] Resolution options
     * @returns {Document|null}
     */
    fromUuidSync(uuid, options = {}) {
        if (typeof globalThis.foundry?.utils?.fromUuidSync === 'function') {
            return globalThis.foundry.utils.fromUuidSync(uuid, options);
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
        if (typeof globalThis.foundry?.utils?.mergeObject === 'function') {
            return globalThis.foundry.utils.mergeObject(original, other, options);
        }
        return Object.assign(original, other);
    }

    /**
     * Deep duplicate an object.
     * @param {Object} obj Target object
     * @returns {Object}
     */
    duplicate(obj) {
        if (typeof globalThis.foundry?.utils?.duplicate === 'function') {
            return globalThis.foundry.utils.duplicate(obj);
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
        if (typeof globalThis.foundry?.utils?.getProperty === 'function') {
            return globalThis.foundry.utils.getProperty(obj, path);
        }
        return undefined;
    }
}
