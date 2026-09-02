import test from 'node:test';
import assert from 'node:assert/strict';
import '../setup.js';
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

test('injectSettingsHeaders inserts world, user, and client headers into SettingsConfig DOM', () => {
    const origCreateElement = document.createElement;
    document.createElement = (tagName) => new MockElement(tagName);

    try {
        const root = new MockElement('div', { className: 'settings-list' });

        // World group (menu button)
        const fgWorld = new MockElement('div', { className: 'form-group' });
        const btnWorld = new MockElement('button', { dataset: { key: 'bakana-action-display.categorizationMenu' } });
        fgWorld.appendChild(btnWorld);
        root.appendChild(fgWorld);

        // User group
        const fgUser = new MockElement('div', { className: 'form-group' });
        const inputUser = new MockElement('input', { name: 'bakana-action-display.hudOpacity' });
        fgUser.appendChild(inputUser);
        root.appendChild(fgUser);

        // Client group
        const fgClient = new MockElement('div', { className: 'form-group' });
        const inputClient = new MockElement('input', { name: 'bakana-action-display.logVerbosity' });
        fgClient.appendChild(inputClient);
        root.appendChild(fgClient);

        // First injection
        injectSettingsHeaders(root);

        assert.equal(root.children.length, 6, 'Should have 3 headers and 3 form groups (total 6)');
        assert.equal(root.children[0].className, 'bad-settings-section-header');
        assert.equal(root.children[0].dataset.scope, 'world');
        assert.equal(root.children[1], fgWorld);

        assert.equal(root.children[2].className, 'bad-settings-section-header');
        assert.equal(root.children[2].dataset.scope, 'user');
        assert.equal(root.children[3], fgUser);

        assert.equal(root.children[4].className, 'bad-settings-section-header');
        assert.equal(root.children[4].dataset.scope, 'client');
        assert.equal(root.children[5], fgClient);

        // Second injection (idempotency check)
        injectSettingsHeaders(root);
        assert.equal(root.children.length, 6, 'Should remain 6 items without duplicate headers');
    } finally {
        document.createElement = origCreateElement;
    }
});

test('injectSettingsHeaders moves economyColorsMenu into the User Settings section', () => {
    const origCreateElement = document.createElement;
    document.createElement = (tagName) => new MockElement(tagName);

    try {
        const root = new MockElement('div', { className: 'settings-list' });

        // Foundry renders all menus at the top of the module section
        const fgCatMenu = new MockElement('div', { className: 'form-group' });
        const btnCat = new MockElement('button', { dataset: { key: 'bakana-action-display.categorizationMenu' } });
        fgCatMenu.appendChild(btnCat);
        root.appendChild(fgCatMenu);

        const fgEconMenu = new MockElement('div', { className: 'form-group' });
        const btnEcon = new MockElement('button', { dataset: { key: 'bakana-action-display.economyColorsMenu' } });
        fgEconMenu.appendChild(btnEcon);
        root.appendChild(fgEconMenu);

        // Regular world settings follow
        const fgCenter = new MockElement('div', { className: 'form-group' });
        const inputCenter = new MockElement('input', { name: 'bakana-action-display.enableCenterOnToken' });
        fgCenter.appendChild(inputCenter);
        root.appendChild(fgCenter);

        // User settings
        const fgOpacity = new MockElement('div', { className: 'form-group' });
        const inputOpacity = new MockElement('input', { name: 'bakana-action-display.hudOpacity' });
        fgOpacity.appendChild(inputOpacity);
        root.appendChild(fgOpacity);

        // Client settings
        const fgLog = new MockElement('div', { className: 'form-group' });
        const inputLog = new MockElement('input', { name: 'bakana-action-display.logVerbosity' });
        fgLog.appendChild(inputLog);
        root.appendChild(fgLog);

        injectSettingsHeaders(root);

        // Expected DOM structure:
        // [0]: World Header
        // [1]: fgCatMenu (World Menu)
        // [2]: fgCenter (World Setting)
        // [3]: User Header
        // [4]: fgEconMenu (User Menu relocated here!)
        // [5]: fgOpacity (User Setting)
        // [6]: Client Header
        // [7]: fgLog (Client Setting)
        assert.equal(root.children.length, 8);
        assert.equal(root.children[0].className, 'bad-settings-section-header');
        assert.equal(root.children[0].dataset.scope, 'world');
        assert.equal(root.children[1], fgCatMenu);
        assert.equal(root.children[2], fgCenter);

        assert.equal(root.children[3].className, 'bad-settings-section-header');
        assert.equal(root.children[3].dataset.scope, 'user');
        assert.equal(root.children[4], fgEconMenu, 'economyColorsMenu should be located under User Settings header');
        assert.equal(root.children[5], fgOpacity);

        assert.equal(root.children[6].className, 'bad-settings-section-header');
        assert.equal(root.children[6].dataset.scope, 'client');
        assert.equal(root.children[7], fgLog);
    } finally {
        document.createElement = origCreateElement;
    }
});

test('injectSettingsHeaders places showTooltips in the User Settings section', () => {
    const origCreateElement = document.createElement;
    document.createElement = (tagName) => new MockElement(tagName);

    try {
        const root = new MockElement('div', { className: 'settings-list' });

        // User settings
        const fgTooltips = new MockElement('div', { className: 'form-group' });
        const inputTooltips = new MockElement('input', { name: 'bakana-action-display.showTooltips' });
        fgTooltips.appendChild(inputTooltips);
        root.appendChild(fgTooltips);

        // Client settings
        const fgLog = new MockElement('div', { className: 'form-group' });
        const inputLog = new MockElement('input', { name: 'bakana-action-display.logVerbosity' });
        fgLog.appendChild(inputLog);
        root.appendChild(fgLog);

        injectSettingsHeaders(root);

        // Expect User Header before fgTooltips, Client Header before fgLog
        assert.equal(root.children[0].className, 'bad-settings-section-header');
        assert.equal(root.children[0].dataset.scope, 'user');
        assert.equal(root.children[1], fgTooltips, 'showTooltips should be placed under User Settings');

        assert.equal(root.children[2].className, 'bad-settings-section-header');
        assert.equal(root.children[2].dataset.scope, 'client');
        assert.equal(root.children[3], fgLog, 'logVerbosity should be placed under Client Settings');
    } finally {
        document.createElement = origCreateElement;
    }
});

