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
        mergeObject(original, other = {}, { inplace = true, overwrite = true, recursive = true } = {}) {
            const target = inplace ? original : structuredClone(original);
            if (!other || typeof other !== 'object') return target;
            for (const [key, value] of Object.entries(other)) {
                if (value === undefined) continue;
                if (recursive && value && typeof value === 'object' && !Array.isArray(value) && typeof target[key] === 'object' && !Array.isArray(target[key])) {
                    target[key] = foundry.utils.mergeObject(target[key], value, { inplace: true, overwrite, recursive });
                } else if (overwrite || target[key] === undefined) {
                    target[key] = (value && typeof value === 'object') ? structuredClone(value) : value;
                }
            }
            return target;
        },
        fromUuidSync(uuid, options = {}) {
            if (options.relative?.items) {
                return options.relative.items.find(i => i.uuid === uuid || i.id === uuid) ?? null;
            }
            return null;
        }
    }
};

const settingsStore = new Map([
    ['bakana-action-display.filterNoResources', false],
    ['bakana-action-display.categorizationConfig', { enabled: false, categories: [] }]
]);

globalThis.ui = {
    notifications: {
        info(msg) {},
        warn(msg) {},
        error(msg) {}
    }
};

globalThis.game = {
    i18n: {
        has(key) { return true; },
        localize(key) { return key; },
        format(key, data = {}) {
            let str = key;
            for (const [k, v] of Object.entries(data)) {
                str = str.replace(`{${k}}`, v);
            }
            return str;
        }
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
