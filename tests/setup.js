/**
 * Global Foundry VTT environment mock/shim for zero-dependency Node.js unit tests.
 * Sets up globalThis.game and globalThis.foundry before importing adapters or utilities.
 */

globalThis.Item = class Item {};
globalThis.Actor = class Actor {};
globalThis.HTMLElement = class HTMLElement {};
globalThis.ContextMenu = class ContextMenu {
    constructor(element, selector, menuItems, options = {}) {
        this.element = element;
        this.selector = selector;
        this.menuItems = menuItems;
        this.options = options;
    }
    async render(target) {
        this.options?.onOpen?.(target);
        this._setPosition?.(null, target);
    }
    async close() {}
};
globalThis.TextEditor = {
    enrichHTML: async (content, options = {}) => {
        if (!content) return '';
        let enriched = String(content);
        const name = options.rollData?.name ?? options.relativeTo?.name ?? '';
        if (name) {
            enriched = enriched.replace(/\[\[lookup\s+@name\s+lowercase\]\]\{([^}]*)\}/gi, name.toLowerCase());
            enriched = enriched.replace(/\[\[lookup\s+@name\]\]\{([^}]*)\}/gi, name);
        } else {
            enriched = enriched.replace(/\[\[lookup\s+@[^\]]+\]\]\{([^}]*)\}/gi, '$1');
        }
        return enriched;
    }
};
globalThis.KeyboardManager = class KeyboardManager {
    static MODIFIER_KEYS = {
        SHIFT: 'Shift',
        CONTROL: 'Control',
        ALT: 'Alt'
    };
};
globalThis.Token = class Token {
    _onClickRight(event) {
        if (globalThis.canvas?.hud?.token?.rendered && (globalThis.canvas.hud.token.object === this || globalThis.canvas.hud.token.object?.id === this.id)) {
            globalThis.canvas.hud.token.clear();
        } else {
            globalThis.canvas.hud.token.bind(this);
        }
    }
};
globalThis.FilePicker = class FilePicker {
    static async browse(source, target, options = {}) {
        return { target, files: [], dirs: [] };
    }
};
Math.clamp = Math.clamp ?? ((num, min, max) => Math.min(Math.max(num, min), max));
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
    },
    actorSizes: {
        tiny: { label: 'Tiny' },
        sm: { label: 'Small' },
        med: { label: 'Medium' },
        lg: { label: 'Large' },
        huge: { label: 'Huge' },
        grg: { label: 'Gargantuan' }
    },
    creatureTypes: {
        aberration: { label: 'Aberration' },
        beast: { label: 'Beast' },
        celestial: { label: 'Celestial' },
        construct: { label: 'Construct' },
        dragon: { label: 'Dragon' },
        elemental: { label: 'Elemental' },
        fey: { label: 'Fey' },
        fiend: { label: 'Fiend' },
        giant: { label: 'Giant' },
        humanoid: { label: 'Humanoid' },
        monstrosity: { label: 'Monstrosity' },
        ooze: { label: 'Ooze' },
        plant: { label: 'Plant' },
        undead: { label: 'Undead' }
    },
    damageTypes: {
        acid: { label: 'Acid' },
        bludgeoning: { label: 'Bludgeoning' },
        cold: { label: 'Cold' },
        fire: { label: 'Fire' },
        force: { label: 'Force' },
        lightning: { label: 'Lightning' },
        necrotic: { label: 'Necrotic' },
        piercing: { label: 'Piercing' },
        poison: { label: 'Poison' },
        psychic: { label: 'Psychic' },
        radiant: { label: 'Radiant' },
        slashing: { label: 'Slashing' },
        thunder: { label: 'Thunder' }
    },
    conditionTypes: {
        blinded: { label: 'Blinded' },
        charmed: { label: 'Charmed' },
        deafened: { label: 'Deafened' },
        exhaustion: { label: 'Exhaustion' },
        frightened: { label: 'Frightened' },
        grappled: { label: 'Grappled' },
        incapacitated: { label: 'Incapacitated' },
        invisible: { label: 'Invisible' },
        paralyzed: { label: 'Paralyzed' },
        petrified: { label: 'Petrified' },
        poisoned: { label: 'Poisoned' },
        prone: { label: 'Prone' },
        restrained: { label: 'Restrained' },
        stunned: { label: 'Stunned' },
        unconscious: { label: 'Unconscious' }
    },
    languages: {
        common: { label: 'Common' },
        dwarvish: { label: 'Dwarvish' },
        elvish: { label: 'Elvish' },
        giant: { label: 'Giant' },
        gnomish: { label: 'Gnomish' },
        goblin: { label: 'Goblin' },
        halfling: { label: 'Halfling' },
        orc: { label: 'Orc' },
        abyssal: { label: 'Abyssal' },
        celestial: { label: 'Celestial' },
        draconic: { label: 'Draconic' },
        deep: { label: 'Deep Speech' },
        infernal: { label: 'Infernal' },
        primordial: { label: 'Primordial' },
        sylvan: { label: 'Sylvan' },
        undercommon: { label: 'Undercommon' }
    },
    armorClasses: {
        armored: { label: 'Armored' },
        natural: { label: 'Natural Armor' },
        unarmored: { label: 'Unarmored' },
        draconic: { label: 'Draconic Resilience' },
        mage: { label: 'Mage Armor' },
        custom: { label: 'Custom' },
        flat: { label: 'Flat' }
    },
    physicalWeaponBypasses: {
        ada: { label: 'Adamantine' },
        mgc: { label: 'Magical' },
        sil: { label: 'Silvered' }
    }
};

globalThis.CONFIG.statusEffects = [
    { id: 'silenced', name: 'DND5E.ConSilenced', img: 'icons/magic/symbols/silence.svg' },
    { id: 'restrained', name: 'DND5E.ConRestrained', img: 'icons/svg/net.svg' },
    { id: 'incapacitated', name: 'DND5E.ConIncapacitated', img: 'icons/svg/daze.svg' },
    { id: 'paralyzed', name: 'DND5E.ConParalyzed', img: 'icons/svg/paralysis.svg' },
    { id: 'petrified', name: 'DND5E.ConPetrified', img: 'icons/svg/statue.svg' },
    { id: 'stunned', name: 'DND5E.ConStunned', img: 'icons/svg/daze.svg' },
    { id: 'unconscious', name: 'DND5E.ConUnconscious', img: 'icons/svg/unconscious.svg' },
    { id: 'grappled', name: 'DND5E.ConGrappled', img: 'icons/svg/grab.svg' },
    { id: 'blinded', name: 'DND5E.ConBlinded', img: 'icons/svg/blind.svg' },
    { id: 'deafened', name: 'DND5E.ConDeafened', img: 'icons/svg/deaf.svg' }
];

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
    },
    stage: {
        scale: { x: 1, y: 1 }
    },
    grid: {
        size: 100
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
                _onFirstRender(context, options) {}
                _onRender(context, options) {}
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
                setPosition(position = {}) {
                    return this;
                }
            }
        },
        ux: {
            ContextMenu: globalThis.ContextMenu,
            TextEditor: {
                implementation: globalThis.TextEditor
            }
        },
        helpers: {
            interaction: {
                KeyboardManager: globalThis.KeyboardManager
            }
        },
        apps: {
            FilePicker: {
                implementation: globalThis.FilePicker
            }
        }
    },
    canvas: {
        placeables: {
            Token: globalThis.Token
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
            if (typeof globalThis.fromUuidSync === 'function') {
                return globalThis.fromUuidSync(uuid, options);
            }
            return null;
        },
        duplicate(obj) {
            return structuredClone(obj);
        },
        isNewerVersion(v1, v0) {
            const parts1 = String(v1).split('.').map(n => parseInt(n, 10) || 0);
            const parts0 = String(v0).split('.').map(n => parseInt(n, 10) || 0);
            const len = Math.max(parts1.length, parts0.length);
            for (let i = 0; i < len; i++) {
                const p1 = parts1[i] ?? 0;
                const p0 = parts0[i] ?? 0;
                if (p1 > p0) return true;
                if (p1 < p0) return false;
            }
            return false;
        }
    }
};

const settingsStore = new Map([
    ['bakana-action-display.showDepleted', false],
    ['bakana-action-display.enableCenterOnToken', false],
    ['bakana-action-display.enableItemSummaryButton', false],
    ['bakana-action-display.enableToggleHotkey', false],
    ['bakana-action-display.enableEconomyIndicators', false],
    ['bakana-action-display.economyColors', {}],
    ['bakana-action-display.categorizationConfig', { enabled: false, categories: [] }],
    ['bakana-action-display.isAttached', true],
    ['bakana-action-display.persistDetached', true],
    ['bakana-action-display.autoTrackCombat', false],
    ['bakana-action-display.autoToggleCombat', false],
    ['bakana-action-display.dnd5eAutoBanConditions', {
        enabled: true,
        vocal: ['silenced', 'incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious'],
        somatic: ['restrained', 'incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious', 'grappled']
    }]
]);

globalThis.CONST = globalThis.CONST ?? {};
globalThis.CONST.KEYBINDING_PRECEDENCE = {
    PRIORITY: 1,
    NORMAL: 0,
    DEFERRED: -1
};
globalThis.CONST.USER_ROLES = {
    NONE: 0,
    PLAYER: 1,
    TRUSTED: 2,
    ASSISTANT: 3,
    GAMEMASTER: 4
};
globalThis.CONST.DOCUMENT_OWNERSHIP_LEVELS = {
    INHERIT: -1,
    NONE: 0,
    LIMITED: 1,
    OBSERVER: 2,
    OWNER: 3
};

const keybindingsStore = new Map();

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

globalThis.window = globalThis.window ?? {
    innerWidth: 1920,
    innerHeight: 1080,
    getComputedStyle: () => ({ paddingBottom: '0px' }),
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame: (cb) => setTimeout(cb, 0)
};

globalThis.requestAnimationFrame = globalThis.requestAnimationFrame ?? ((cb) => setTimeout(cb, 0));

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
    keybindings: {
        bindings: keybindingsStore,
        register(moduleId, action, config) {
            keybindingsStore.set(`${moduleId}.${action}`, config);
        },
        get(moduleId, action) {
            return keybindingsStore.get(`${moduleId}.${action}`);
        }
    },
    keyboard: {
        isModifierActive(mod) { return false; }
    },
    tooltip: {
        element: null,
        options: null,
        active: false,
        locked: false,
        activate(element, options = {}) {
            this.element = element;
            this.options = options;
            this.active = true;
        },
        deactivate() {
            this.element = null;
            this.options = null;
            this.active = false;
        }
    },
    canvas: globalThis.canvas,
    users: new Collection(),
    user: {
        id: 'user-gm',
        name: 'Gamemaster',
        role: 4,
        isGM: true,
        isTrusted: true,
        active: true
    }
};
