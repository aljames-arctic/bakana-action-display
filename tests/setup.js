/**
 * Global Foundry VTT environment mock/shim for zero-dependency Node.js unit tests.
 * Sets up globalThis.game and globalThis.foundry before importing adapters or utilities.
 */

globalThis.Item = class Item {};
globalThis.Actor = class Actor {};
globalThis.HTMLElement = class HTMLElement {};
globalThis.CONFIG = globalThis.CONFIG ?? {};
globalThis.CONFIG.DND5E = globalThis.CONFIG.DND5E ?? {
    activityActivationTypes: {
        action: 'DND5E.Action',
        bonus: 'DND5E.BonusAction',
        reaction: 'DND5E.Reaction',
        minute: 'DND5E.TimeMinute',
        hour: 'DND5E.TimeHour',
        day: 'DND5E.TimeDay',
        shortRest: 'DND5E.ActivityActivationShortRest',
        longRest: 'DND5E.ActivityActivationLongRest',
        encounter: 'DND5E.ActivityActivationStartEncounter',
        turnStart: 'DND5E.ActivityActivationTurnStart',
        turnEnd: 'DND5E.ActivityActivationTurnEnd',
        legendary: 'DND5E.LegendaryAction',
        mythic: 'DND5E.MythicAction',
        lair: 'DND5E.LairAction',
        crew: 'DND5E.CrewAction',
        special: 'DND5E.Special'
    },
    activityActivationCategories: {
        standard: 'DND5E.ActivityActivationStandard',
        time: 'DND5E.ActivityActivationTime',
        rest: 'DND5E.ActivityActivationRest',
        combat: 'DND5E.ActivityActivationCombat',
        monster: 'DND5E.ActivityActivationMonster',
        vehicle: 'DND5E.ActivityActivationVehicle'
    }
};

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

class Collection extends Map {
    constructor(entries) {
        super();
        if (entries) {
            if (Array.isArray(entries)) {
                for (const item of entries) {
                    if (item?.id) this.set(item.id, item);
                }
            } else if (entries instanceof Map) {
                for (const [k, v] of entries) this.set(k, v);
            }
        }
    }
    get contents() { return Array.from(this.values()); }
    find(fn) {
        for (const item of this.values()) {
            if (fn(item)) return item;
        }
        return undefined;
    }
    filter(fn) {
        const results = [];
        for (const item of this.values()) {
            if (fn(item)) results.push(item);
        }
        return results;
    }
    some(fn) {
        for (const item of this.values()) {
            if (fn(item)) return true;
        }
        return false;
    }
    every(fn) {
        for (const item of this.values()) {
            if (!fn(item)) return false;
        }
        return true;
    }
    map(fn) {
        return this.contents.map(fn);
    }
    [Symbol.iterator]() {
        return this.values();
    }
}

class TokenHUD {
    constructor() {
        this.rendered = false;
        this.object = null;
    }
    bind(token) {
        this.object = token;
        this.rendered = true;
        Hooks.callAll('renderTokenHUD', this, {}, {});
    }
    clear() {
        this.object = null;
        this.rendered = false;
        Hooks.callAll('closeTokenHUD', this, {});
    }
    close() {
        return this.clear();
    }
}

globalThis.canvas = {
    hud: {
        token: new TokenHUD()
    }
};

globalThis.foundry = {
    helpers: {
        interaction: {
            KeyboardManager: class KeyboardManager {
                static MODIFIER_KEYS = {
                    ALT: 'Alt',
                    CONTROL: 'Control',
                    SHIFT: 'Shift'
                };
            }
        }
    },
    applications: {
        apps: {
            FilePicker: {
                implementation: class FilePicker {
                    static async browse(source, target) {
                        if (target && target.includes('src/adapters/system')) {
                            return {
                                files: [
                                    'modules/bakana-action-display/src/adapters/system/dnd5e-system-adapter.js',
                                    'modules/bakana-action-display/src/adapters/system/pf1-system-adapter.js',
                                    'modules/bakana-action-display/src/adapters/system/pf2e-system-adapter.js'
                                ]
                            };
                        }
                        return { files: [] };
                    }
                }
            }
        },
        api: {
            HandlebarsApplicationMixin: (cls) => cls,
            ApplicationV2: class ApplicationV2 {
                constructor() {
                    this.rendered = false;
                    this.state = 0;
                    this.element = null;
                }
                async _prepareContext(options = {}) { return { ...options }; }
                async render(options = {}) {
                    this.rendered = true;
                    this.state = 2;
                    this.element = { style: {} };
                    return this;
                }
                async close(options = {}) {
                    this.rendered = false;
                    this.state = 0;
                    if (this.element) {
                        this.element.style.display = 'none';
                        this.element = null;
                    }
                    return this;
                }
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
            Token: class Token {
                _onClickRight(event) {
                    if (globalThis.canvas?.hud?.token?.rendered && (globalThis.canvas.hud.token.object === this || globalThis.canvas.hud.token.object?.id === this.id)) {
                        globalThis.canvas.hud.token.clear();
                    } else {
                        globalThis.canvas.hud.token.bind(this);
                    }
                }
            }
        }
    },
    utils: {
        Collection,
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
        },
        duplicate(obj) {
            return structuredClone(obj);
        }
    }
};

const settingsStore = new Map([
    ['bakana-action-display.showDepleted', false],
    ['bakana-action-display.enableCenterOnToken', false],
    ['bakana-action-display.enableEconomyIndicators', false],
    ['bakana-action-display.economyColors', {}],
    ['bakana-action-display.categorizationConfig', { enabled: false, categories: [] }]
]);

globalThis.ui = {
    notifications: {
        info(msg) {},
        warn(msg) {},
        error(msg) {}
    }
};

const hookListeners = new Map();
globalThis.Hooks = {
    events: hookListeners,
    once(event, fn) {
        if (!hookListeners.has(event)) hookListeners.set(event, []);
        const wrapped = (...args) => {
            const list = hookListeners.get(event) ?? [];
            const idx = list.indexOf(wrapped);
            if (idx !== -1) list.splice(idx, 1);
            return fn(...args);
        };
        hookListeners.get(event).push(wrapped);
    },
    on(event, fn) {
        if (!hookListeners.has(event)) hookListeners.set(event, []);
        hookListeners.get(event).push(fn);
    },
    callAll(event, ...args) {
        const listeners = hookListeners.get(event) ?? [];
        for (const fn of [...listeners]) {
            fn(...args);
        }
    },
    call(event, ...args) {
        const listeners = hookListeners.get(event) ?? [];
        for (const fn of [...listeners]) {
            fn(...args);
        }
    }
};

globalThis.document = globalThis.document ?? {
    documentElement: {
        style: {
            setProperty(prop, val) {}
        }
    },
    body: {
        appendChild(child) { return child; }
    },
    querySelector(selector) {
        return null;
    },
    querySelectorAll(selector) {
        return [];
    },
    createElement(tag) {
        return {
            tagName: tag,
            className: '',
            dataset: {},
            children: [],
            classList: { contains: () => false, add: () => {}, remove: () => {} },
            appendChild(child) { this.children.push(child); return child; },
            insertBefore(child) { this.children.push(child); return child; },
            addEventListener() {},
            getBoundingClientRect() { return { left: 0, top: 0, right: 100, bottom: 30, width: 100, height: 30 }; },
            remove() {}
        };
    }
};

globalThis.game = {
    release: {
        generation: 12
    },
    modules: new Map([
        ['bakana-action-display', { id: 'bakana-action-display', active: true }]
    ]),
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
        register(moduleId, key, config) {
            if (!settingsStore.has(`${moduleId}.${key}`)) {
                settingsStore.set(`${moduleId}.${key}`, config?.default);
            }
        },
        registerMenu(moduleId, key, config) {},
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
