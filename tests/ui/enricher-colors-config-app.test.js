import test from 'node:test';
import assert from 'node:assert/strict';
import '../setup.js';
import { MODULE_ID } from '../../src/constants.js';
import { EnricherColorsConfigApp } from '../../src/ui/enricher-colors-config-app.js';
import {
    ENRICHER_TYPES,
    DEFAULT_ENRICHER_COLORS,
    ENRICHER_COLOR_PRESETS,
    applyEnricherCssVariables
} from '../../src/ui/enricher-presets.js';
import { injectSettingsHeaders } from '../../src/settings.js';

class MockElement extends HTMLElement {
    constructor(tagName, attrs = {}) {
        super();
        this.tagName = tagName;
        this.className = attrs.className ?? '';
        this.dataset = attrs.dataset ?? {};
        this.name = attrs.name ?? '';
        this.children = [];
        this.parentNode = null;
        this.previousElementSibling = null;
        this.innerHTML = '';
        this.classList = {
            contains: (cls) => this.className.split(' ').includes(cls),
            add: (cls) => { if (!this.classList.contains(cls)) this.className = `${this.className} ${cls}`.trim(); }
        };
    }

    appendChild(child) {
        if (child.parentNode) {
            const oldIdx = child.parentNode.children.indexOf(child);
            if (oldIdx !== -1) child.parentNode.children.splice(oldIdx, 1);
        }
        if (this.children.length > 0) {
            child.previousElementSibling = this.children[this.children.length - 1];
        } else {
            child.previousElementSibling = null;
        }
        child.parentNode = this;
        this.children.push(child);
        return child;
    }

    insertBefore(newChild, refChild) {
        if (newChild.parentNode) {
            const oldIdx = newChild.parentNode.children.indexOf(newChild);
            if (oldIdx !== -1) newChild.parentNode.children.splice(oldIdx, 1);
        }
        const index = refChild ? this.children.indexOf(refChild) : -1;
        if (index === -1) {
            return this.appendChild(newChild);
        }
        newChild.parentNode = this;
        const prev = refChild.previousElementSibling;
        newChild.previousElementSibling = prev;
        refChild.previousElementSibling = newChild;
        this.children.splice(index, 0, newChild);
        return newChild;
    }

    closest(selector) {
        if (selector === '.form-group') {
            let curr = this;
            while (curr) {
                if (curr.classList?.contains('form-group')) return curr;
                curr = curr.parentNode;
            }
        }
        return null;
    }

    querySelector(selector) {
        const parts = selector.split(',').map(s => s.trim());
        const findMatch = (el) => {
            for (const part of parts) {
                if (part.startsWith('.bad-settings-section-header[data-scope="') && part.endsWith('"]')) {
                    const scope = part.slice(41, -2);
                    if (el.classList?.contains('bad-settings-section-header') && el.dataset?.scope === scope) return el;
                }
                if (part.startsWith('[name="') && part.endsWith('"]')) {
                    const expectedName = part.slice(7, -2);
                    if (el.name === expectedName) return el;
                }
                if (part.startsWith('[data-setting-id="') && part.endsWith('"]')) {
                    const expectedId = part.slice(18, -2);
                    if (el.dataset?.settingId === expectedId) return el;
                }
                if (part.startsWith('[data-key="') && part.endsWith('"]')) {
                    const expectedKey = part.slice(11, -2);
                    if (el.dataset?.key === expectedKey) return el;
                }
            }
            for (const child of el.children) {
                const found = findMatch(child);
                if (found) return found;
            }
            return null;
        };
        return findMatch(this);
    }
}

test('EnricherColorsConfigApp prepares context with categories, colors, icons, and presets', async () => {
    game.settings.set(MODULE_ID, 'enricherColors', {
        damage: '#ff0000',
        check: '#00ff00'
    });

    const app = new EnricherColorsConfigApp();
    const context = await app._prepareContext({});

    assert.ok(Array.isArray(context.enricherTypes));
    assert.equal(context.enricherTypes.length, ENRICHER_TYPES.length);

    const damageType = context.enricherTypes.find(t => t.id === 'damage');
    assert.ok(damageType);
    assert.equal(damageType.color, '#ff0000');
    assert.equal(damageType.defaultColor, '#f87171');
    assert.equal(damageType.icon, 'fas fa-dice-d20');

    const checkType = context.enricherTypes.find(t => t.id === 'check');
    assert.ok(checkType);
    assert.equal(checkType.color, '#00ff00');

    const areaType = context.enricherTypes.find(t => t.id === 'area');
    assert.ok(areaType);
    assert.equal(areaType.color, '#34d399');

    const referenceType = context.enricherTypes.find(t => t.id === 'reference');
    assert.ok(referenceType);
    assert.equal(referenceType.defaultColor, '#c5a059');
    assert.equal(referenceType.color, '#c5a059');

    assert.ok(Array.isArray(context.presets));
    assert.ok(context.presets.some(p => p.id === 'vibrant'));
    assert.ok(context.presets.some(p => p.id === 'highContrast'));
    assert.ok(context.presets.some(p => p.id === 'monochrome'));
});

test('EnricherColorsConfigApp applyPreset updates colors and re-renders', () => {
    const app = new EnricherColorsConfigApp();
    let rendered = false;
    app.render = () => { rendered = true; };

    app.applyPreset('vibrant');
    assert.equal(app.selectedPreset, 'vibrant');
    assert.equal(app.colors.damage, '#ef4444');
    assert.equal(app.colors.check, '#06b6d4');
    assert.equal(app.colors.area, '#10b981');
    assert.equal(rendered, true);

    app.applyPreset('monochrome');
    assert.equal(app.selectedPreset, 'monochrome');
    assert.equal(app.colors.damage, '#e2e8f0');
    assert.equal(app.colors.check, '#cbd5e1');
});

test('EnricherColorsConfigApp _onResetDefaults restores default colors', async () => {
    const app = new EnricherColorsConfigApp();
    app.colors = { damage: '#000000', check: '#111111' };
    app.selectedPreset = 'custom';

    let rendered = false;
    app.render = () => { rendered = true; };

    await app._onResetDefaults({ preventDefault() {} });
    assert.equal(app.colors.damage, DEFAULT_ENRICHER_COLORS.damage);
    assert.equal(app.colors.check, DEFAULT_ENRICHER_COLORS.check);
    assert.equal(app.selectedPreset, '');
    assert.equal(rendered, true);
});

test('EnricherColorsConfigApp _onSaveConfig persists settings and applies CSS variables', async () => {
    const app = new EnricherColorsConfigApp();
    app.colors = {
        damage: '#e11d48',
        check: '#0284c7',
        area: '#059669',
        roll: '#7c3aed',
        reference: '#9333ea'
    };

    let closed = false;
    app.close = async () => { closed = true; };

    const styleProps = {};
    const origDoc = globalThis.document;
    globalThis.document = {
        documentElement: {
            style: {
                setProperty(prop, val) { styleProps[prop] = val; }
            }
        }
    };

    try {
        await app._onSaveConfig({ preventDefault() {} });

        const saved = game.settings.get(MODULE_ID, 'enricherColors');
        assert.equal(saved.damage, '#e11d48');
        assert.equal(saved.check, '#0284c7');
        assert.equal(saved.area, '#059669');
        assert.equal(closed, true);

        assert.equal(styleProps['--bad-enricher-damage-color'], '#e11d48');
        assert.equal(styleProps['--bad-enricher-check-color'], '#0284c7');
        assert.equal(styleProps['--bad-enricher-area-color'], '#059669');
    } finally {
        globalThis.document = origDoc;
    }
});

test('applyEnricherCssVariables sets CSS custom properties on documentElement', () => {
    const origDoc = globalThis.document;
    const styleProps = {};
    globalThis.document = {
        documentElement: {
            style: {
                setProperty(prop, val) {
                    styleProps[prop] = val;
                },
                getPropertyValue(prop) {
                    return styleProps[prop];
                }
            }
        }
    };

    try {
        applyEnricherCssVariables({ damage: '#ff4444', roll: '#9933ff' });
        assert.equal(styleProps['--bad-enricher-damage-color'], '#ff4444');
        assert.equal(styleProps['--bad-enricher-roll-color'], '#9933ff');
        assert.equal(styleProps['--bad-enricher-check-color'], '#38bdf8'); // default fallback
    } finally {
        globalThis.document = origDoc;
    }
});

test('injectSettingsHeaders moves enricherColorsMenu into User Settings section', () => {
    const origCreateElement = document.createElement;
    document.createElement = (tagName) => new MockElement(tagName);

    try {
        const root = new MockElement('div', { className: 'settings-list' });

        const fgCat = new MockElement('div', { className: 'form-group' });
        const btnCat = new MockElement('button', { dataset: { key: 'bakana-action-display.categorizationMenu' } });
        fgCat.appendChild(btnCat);
        root.appendChild(fgCat);

        const fgEnricher = new MockElement('div', { className: 'form-group' });
        const btnEnricher = new MockElement('button', { dataset: { key: 'bakana-action-display.enricherColorsMenu' } });
        fgEnricher.appendChild(btnEnricher);
        root.appendChild(fgEnricher);

        const fgOpacity = new MockElement('div', { className: 'form-group' });
        const inputOpacity = new MockElement('input', { name: 'bakana-action-display.hudOpacity' });
        fgOpacity.appendChild(inputOpacity);
        root.appendChild(fgOpacity);

        injectSettingsHeaders(root);

        const userHeader = root.querySelector('.bad-settings-section-header[data-scope="user"]');
        assert.ok(userHeader, 'User Settings header should be injected');

        const enricherMenu = root.querySelector('[data-key="bakana-action-display.enricherColorsMenu"]');
        const hudOpacity = root.querySelector('[name="bakana-action-display.hudOpacity"]');
        assert.ok(enricherMenu);
        assert.ok(hudOpacity);

        // Verify enricherMenu is positioned before hudOpacity
        const allFormGroups = root.children.filter(c => c.classList.contains('form-group'));
        const enricherFg = enricherMenu.closest('.form-group');
        const opacityFg = hudOpacity.closest('.form-group');
        const enricherIdx = allFormGroups.indexOf(enricherFg);
        const hudOpacityIdx = allFormGroups.indexOf(opacityFg);
        assert.ok(enricherIdx < hudOpacityIdx, 'enricherColorsMenu should precede hudOpacity');
    } finally {
        document.createElement = origCreateElement;
    }
});
