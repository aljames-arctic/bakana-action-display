import test from 'node:test';
import assert from 'node:assert/strict';
import '../setup.js';
import { HUDConfigApp, DEFAULT_HUD_CONFIG } from '../../src/ui/hud-config-app.js';
import { MODULE_ID } from '../../src/constants.js';
import { actionDisplay } from '../../src/action-display.js';

test('HUDConfigApp initializes with stored settings and returns context', async () => {
    await game.settings.set(MODULE_ID, 'hudOpacity', 0.75);
    await game.settings.set(MODULE_ID, 'hudScale', 1.25);
    await game.settings.set(MODULE_ID, 'fontSize', 16);
    await game.settings.set(MODULE_ID, 'hudAnchorSide', 'horizontal');
    await game.settings.set(MODULE_ID, 'hudGridOffset', 0.8);
    await game.settings.set(MODULE_ID, 'hudGridOffsetHorizontal', 1.5);

    const app = new HUDConfigApp();
    assert.equal(app.config.hudOpacity, 0.75);
    assert.equal(app.config.hudScale, 1.25);
    assert.equal(app.config.fontSize, 16);
    assert.equal(app.config.hudAnchorSide, 'horizontal');
    assert.equal(app.config.hudGridOffset, 0.8);
    assert.equal(app.config.hudGridOffsetHorizontal, 1.5);

    const context = await app._prepareContext({});
    assert.equal(context.config.hudOpacity, 0.75);
    assert.equal(context.config.hudScale, 1.25);
    assert.equal(context.config.fontSize, 16);
    assert.equal(context.config.hudAnchorSide, 'horizontal');
    assert.equal(context.config.hudGridOffset, 0.8);
    assert.equal(context.config.hudGridOffsetHorizontal, 1.5);

    assert.equal(context.anchorSideChoices.length, 2);
    const verticalChoice = context.anchorSideChoices.find(c => c.id === 'vertical');
    const horizontalChoice = context.anchorSideChoices.find(c => c.id === 'horizontal');
    assert.equal(verticalChoice?.selected, false);
    assert.equal(horizontalChoice?.selected, true);
});

test('HUDConfigApp falls back to DEFAULT_HUD_CONFIG when settings are unconfigured', async () => {
    const app = new HUDConfigApp();
    assert.ok(app.config);
    assert.equal(typeof app.config.hudOpacity, 'number');
    assert.equal(typeof app.config.hudScale, 'number');
    assert.equal(typeof app.config.fontSize, 'number');
    assert.equal(typeof app.config.hudAnchorSide, 'string');
    assert.equal(typeof app.config.hudGridOffset, 'number');
    assert.equal(typeof app.config.hudGridOffsetHorizontal, 'number');
});

test('HUDConfigApp _onResetDefaults resets input fields to default values', () => {
    const app = new HUDConfigApp();

    const mockInputs = {
        hudOpacity: { name: 'hudOpacity', value: '0.5' },
        hudScale: { name: 'hudScale', value: '1.4' },
        fontSize: { name: 'fontSize', value: '20', dataset: { unit: 'px' } },
        hudAnchorSide: { name: 'hudAnchorSide', value: 'horizontal' },
        hudGridOffset: { name: 'hudGridOffset', value: '0.9' },
        hudGridOffsetHorizontal: { name: 'hudGridOffsetHorizontal', value: '2.5' }
    };

    const mockOutputs = {
        hudOpacity: { textContent: '0.5' },
        hudScale: { textContent: '1.4' },
        fontSize: { textContent: '20px' },
        hudGridOffset: { textContent: '0.9' },
        hudGridOffsetHorizontal: { textContent: '2.5' }
    };

    app.element = {
        querySelector(selector) {
            for (const [key, input] of Object.entries(mockInputs)) {
                if (selector === `[name="${key}"]`) return input;
                if (selector === `.bad-range-value[data-for="${key}"]`) return mockOutputs[key] ?? null;
            }
            return null;
        }
    };

    app._onResetDefaults({ preventDefault() {} }, {});

    assert.equal(mockInputs.hudOpacity.value, DEFAULT_HUD_CONFIG.hudOpacity);
    assert.equal(mockInputs.hudScale.value, DEFAULT_HUD_CONFIG.hudScale);
    assert.equal(mockInputs.fontSize.value, DEFAULT_HUD_CONFIG.fontSize);
    assert.equal(mockInputs.hudAnchorSide.value, DEFAULT_HUD_CONFIG.hudAnchorSide);
    assert.equal(mockInputs.hudGridOffset.value, DEFAULT_HUD_CONFIG.hudGridOffset);
    assert.equal(mockInputs.hudGridOffsetHorizontal.value, DEFAULT_HUD_CONFIG.hudGridOffsetHorizontal);

    assert.equal(mockOutputs.hudOpacity.textContent, `${DEFAULT_HUD_CONFIG.hudOpacity}`);
    assert.equal(mockOutputs.fontSize.textContent, `${DEFAULT_HUD_CONFIG.fontSize}px`);
});

test('HUDConfigApp _onSaveConfig saves settings to game.settings and updates CSS vars', async () => {
    const app = new HUDConfigApp();

    const mockValues = {
        hudOpacity: '0.65',
        hudScale: '0.9',
        fontSize: '12',
        hudAnchorSide: 'horizontal',
        hudGridOffset: '0.3',
        hudGridOffsetHorizontal: '1.2'
    };

    app.element = {
        querySelector(selector) {
            for (const [key, val] of Object.entries(mockValues)) {
                if (selector === `[name="${key}"]`) return { value: val };
            }
            return null;
        }
    };

    let closed = false;
    app.close = () => { closed = true; };

    let activeAppPositioned = false;
    let activeAppRendered = false;
    actionDisplay.activeApp = {
        rendered: true,
        setPosition() { activeAppPositioned = true; },
        render() { activeAppRendered = true; }
    };

    const cssProperties = {};
    document.documentElement.style.setProperty = (prop, val) => {
        cssProperties[prop] = val;
    };

    await app._onSaveConfig({ preventDefault() {} }, {});

    assert.equal(game.settings.get(MODULE_ID, 'hudOpacity'), 0.65);
    assert.equal(game.settings.get(MODULE_ID, 'hudScale'), 0.9);
    assert.equal(game.settings.get(MODULE_ID, 'fontSize'), 12);
    assert.equal(game.settings.get(MODULE_ID, 'hudAnchorSide'), 'horizontal');
    assert.equal(game.settings.get(MODULE_ID, 'hudGridOffset'), 0.3);
    assert.equal(game.settings.get(MODULE_ID, 'hudGridOffsetHorizontal'), 1.2);

    assert.equal(cssProperties['--bad-hud-opacity'], 0.65);
    assert.equal(cssProperties['--bad-hud-scale'], 0.9);
    assert.equal(cssProperties['--bad-hud-font-size'], '12px');

    assert.equal(activeAppPositioned, true);
    assert.equal(activeAppRendered, true);
    assert.equal(closed, true);

    actionDisplay.activeApp = null;
});

test('HUDConfigApp _onCloseConfig closes dialog without saving', () => {
    const app = new HUDConfigApp();
    let closed = false;
    app.close = () => { closed = true; };

    app._onCloseConfig({ preventDefault() {} }, {});
    assert.equal(closed, true);
});
