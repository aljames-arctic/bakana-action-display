/**
 * Global Foundry VTT environment mock/shim for zero-dependency Node.js unit tests.
 * Sets up globalThis.game and globalThis.foundry before importing adapters or utilities.
 */

globalThis.Item = class Item {};
globalThis.Actor = class Actor {};

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
    helpers: {
        interaction: {
            KeyboardManager: class KeyboardManager {}
        }
    },
    applications: {
        api: {
            HandlebarsApplicationMixin: (cls) => cls,
            ApplicationV2: class ApplicationV2 {
                async _prepareContext(options = {}) { return { ...options }; }
            }
        },
        ux: {
            ContextMenu: class ContextMenu {
                constructor(element, selector, menuItems, options = {}) {
                    this.element = element;
                    this.selector = selector;
                    this.menuItems = menuItems;
                    this.options = options;
                }
                async render() {}
                async close() {}
            }
        }
    },
    canvas: {
        placeables: {
            Token: class Token {}
        }
    },
    utils: {
        getProperty,
        fromUuidSync(uuid, options = {}) {
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
        has(key) { return true; },
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
