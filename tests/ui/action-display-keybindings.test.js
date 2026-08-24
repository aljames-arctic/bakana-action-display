import test from 'node:test';
import assert from 'node:assert/strict';
import '../setup.js';
import { MODULE_ID } from '../../src/constants.js';
import { actionDisplay } from '../../src/action-display.js';
import { registerKeybindings, toggleHUD } from '../../src/keybindings.js';

test('registerKeybindings registers toggleHUD keybinding with Shift+Space default', () => {
    registerKeybindings();

    const binding = game.keybindings.get(MODULE_ID, 'toggleHUD');
    assert.ok(binding, 'toggleHUD keybinding should be registered');
    assert.equal(binding.name, 'BAD.keybindings.toggleHUD.name');
    assert.equal(binding.hint, 'BAD.keybindings.toggleHUD.hint');
    assert.deepEqual(binding.editable, [{ key: 'Space', modifiers: ['Shift'] }]);
    assert.equal(typeof binding.onDown, 'function');
});

test('toggleHUD is suppressed when enableToggleHotkey world setting is false', async () => {
    registerKeybindings();
    await game.settings.set(MODULE_ID, 'enableToggleHotkey', false);

    const binding = game.keybindings.get(MODULE_ID, 'toggleHUD');
    const result = binding.onDown();
    assert.equal(result, false, 'onDown should return false when setting is disabled');
    assert.equal(actionDisplay.activeApp, null);
});

test('toggleHUD opens and closes Action Display for controlled token when enabled', async () => {
    registerKeybindings();
    await game.settings.set(MODULE_ID, 'enableToggleHotkey', true);

    const mockToken = {
        id: 'token1',
        document: { isOwner: true },
        actor: {
            id: 'actor1',
            isOwner: true,
            items: [],
            flags: {}
        }
    };

    globalThis.canvas = {
        tokens: {
            controlled: [mockToken],
            placeables: [mockToken]
        }
    };

    const binding = game.keybindings.get(MODULE_ID, 'toggleHUD');

    // 1. Initial press: opens HUD
    const openResult = binding.onDown();
    assert.equal(openResult, true, 'onDown should return true on open');
    assert.ok(actionDisplay.activeApp, 'activeApp should be set');
    assert.equal(actionDisplay.activeApp.token.id, 'token1');

    // Mark as rendered
    actionDisplay.activeApp.rendered = true;

    // 2. Second press: closes HUD
    const closeResult = binding.onDown();
    assert.equal(closeResult, true, 'onDown should return true on close');
    assert.equal(actionDisplay.activeApp, null, 'activeApp should be cleared after toggle close');

    // Clean up
    await game.settings.set(MODULE_ID, 'enableToggleHotkey', false);
    globalThis.canvas = { tokens: { controlled: [], placeables: [] } };
});

test('toggleHUD switches to newly controlled token if another token is selected', async () => {
    registerKeybindings();
    await game.settings.set(MODULE_ID, 'enableToggleHotkey', true);

    const mockTokenA = {
        id: 'tokenA',
        document: { isOwner: true },
        actor: { id: 'actorA', isOwner: true, items: [], flags: {} }
    };
    const mockTokenB = {
        id: 'tokenB',
        document: { isOwner: true },
        actor: { id: 'actorB', isOwner: true, items: [], flags: {} }
    };

    globalThis.canvas = {
        tokens: {
            controlled: [mockTokenA],
            placeables: [mockTokenA, mockTokenB]
        }
    };

    const binding = game.keybindings.get(MODULE_ID, 'toggleHUD');

    // Open Token A
    binding.onDown();
    assert.equal(actionDisplay.activeApp.token.id, 'tokenA');
    actionDisplay.activeApp.rendered = true;

    // Switch controlled token to Token B
    globalThis.canvas.tokens.controlled = [mockTokenB];

    // Toggle: should switch from Token A to Token B
    binding.onDown();
    assert.ok(actionDisplay.activeApp);
    assert.equal(actionDisplay.activeApp.token.id, 'tokenB');

    // Clean up
    if (actionDisplay.activeApp) {
        actionDisplay.activeApp.close();
        actionDisplay.activeApp = null;
    }
    await game.settings.set(MODULE_ID, 'enableToggleHotkey', false);
    globalThis.canvas = { tokens: { controlled: [], placeables: [] } };
});

test('toggleHUD falls back to game.user.character when no token is controlled', async () => {
    registerKeybindings();
    await game.settings.set(MODULE_ID, 'enableToggleHotkey', true);

    const charToken = {
        id: 'charToken1',
        document: { isOwner: true },
        actor: { id: 'userChar1', isOwner: true, items: [], flags: {} }
    };

    globalThis.game.user = {
        character: {
            id: 'userChar1',
            getActiveTokens: () => [charToken]
        }
    };

    globalThis.canvas = {
        tokens: {
            controlled: [],
            placeables: [charToken]
        }
    };

    const binding = game.keybindings.get(MODULE_ID, 'toggleHUD');
    const result = binding.onDown();
    assert.equal(result, true);
    assert.ok(actionDisplay.activeApp);
    assert.equal(actionDisplay.activeApp.token.id, 'charToken1');

    // Clean up
    if (actionDisplay.activeApp) {
        actionDisplay.activeApp.close();
        actionDisplay.activeApp = null;
    }
    globalThis.game.user = { character: null };
    await game.settings.set(MODULE_ID, 'enableToggleHotkey', false);
    globalThis.canvas = { tokens: { controlled: [], placeables: [] } };
});
