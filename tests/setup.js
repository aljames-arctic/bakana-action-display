/**
 * Global Foundry VTT environment mock/shim for zero-dependency Node.js unit tests.
 * Sets up globalThis.game and globalThis.foundry before importing adapters or utilities.
 */

function getProperty(obj, path) {
    if (!obj || !path) return undefined;
    const parts = String(path).split('.');
    let current = obj;
    for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        current = current[part];
    }
    return current;
}

globalThis.foundry = {
    utils: {
        getProperty,
        fromUuidSync(uuid, options = {}) {
            // Mock resolver: if options.relative has items matching UUID, return it
            if (options.relative?.items) {
                return options.relative.items.find(i => i.uuid === uuid || i.id === uuid) ?? null;
            }
            return null;
        }
    }
};

const settingsStore = new Map([
    ['bakana-action-display.filterNoResources', false]
]);

globalThis.game = {
    i18n: {
        has(key) { return false; },
        localize(key) { return key; }
    },
    settings: {
        get(moduleId, key) {
            const fullKey = `${moduleId}.${key}`;
            return settingsStore.has(fullKey) ? settingsStore.get(fullKey) : false;
        },
        set(moduleId, key, value) {
            settingsStore.set(`${moduleId}.${key}`, value);
        }
    },
    keyboard: {
        isModifierActive(mod) { return false; }
    }
};
