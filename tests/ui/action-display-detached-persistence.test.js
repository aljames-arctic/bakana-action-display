import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { actionDisplay } from '../../src/action-display.js';
import { MODULE_ID } from '../../src/constants.js';
import '../../src/module.js';

test('Detached HUD persistence across token clicks and 4-click periodicity fix', async () => {
    // Enable persistDetached setting and set mode to detached
    game.settings.set(MODULE_ID, 'persistDetached', true);
    game.settings.set(MODULE_ID, 'isAttached', false);

    // Trigger init and ready hooks
    await Hooks.callAll('init');
    await Hooks.callAll('ready');

    const mockToken = new foundry.canvas.placeables.Token();
    mockToken.id = 'token-detached-1';
    mockToken.name = 'Detached Hero';
    mockToken.document = { isOwner: true };
    mockToken.actor = {
        id: 'actor-detached-1',
        name: 'Detached Actor',
        isOwner: true,
        items: new foundry.utils.Collection()
    };

    // Ensure initial state: TokenHUD is closed, no activeApp
    canvas.hud.token.clear();
    assert.equal(canvas.hud.token.rendered, false);

    // CLICK 1: Right-click token to open TokenHUD and detached ActionDisplayApp
    mockToken._onClickRight({});
    assert.equal(canvas.hud.token.rendered, true);
    assert.ok(actionDisplay.activeApp);
    assert.equal(actionDisplay.activeApp.isDetached, true);
    assert.equal(actionDisplay.activeApp.token.id, 'token-detached-1');

    const firstAppInstance = actionDisplay.activeApp;

    // CLICK 2: Left-click off token -> TokenHUD clears, detached ActionDisplayApp stays open
    canvas.hud.token.clear();
    assert.equal(canvas.hud.token.rendered, false);
    assert.ok(actionDisplay.activeApp);
    assert.equal(actionDisplay.activeApp, firstAppInstance);

    // CLICK 3: Right-click token again -> TokenHUD opens, detached ActionDisplayApp stays open
    mockToken._onClickRight({});
    assert.equal(canvas.hud.token.rendered, true);
    assert.ok(actionDisplay.activeApp);
    assert.equal(actionDisplay.activeApp, firstAppInstance);

    // CLICK 4: Left-click off token -> TokenHUD clears, detached ActionDisplayApp MUST stay open (Fixes 4-click bug!)
    canvas.hud.token.clear();
    assert.equal(canvas.hud.token.rendered, false);
    assert.ok(actionDisplay.activeApp);
    assert.equal(actionDisplay.activeApp, firstAppInstance);

    // CLICK 5: Right-click token again (opens TokenHUD)
    mockToken._onClickRight({});
    assert.equal(canvas.hud.token.rendered, true);
    assert.ok(actionDisplay.activeApp);
    assert.equal(actionDisplay.activeApp, firstAppInstance);

    // CLICK 6: Right-click token AGAIN WHILE TokenHUD IS OPEN -> Both TokenHUD and ActionDisplayApp close!
    mockToken._onClickRight({});
    assert.equal(canvas.hud.token.rendered, false);
    assert.equal(actionDisplay.activeApp, null);

    // Reopen HUD with right-click
    mockToken._onClickRight({});
    assert.equal(canvas.hud.token.rendered, true);
    assert.ok(actionDisplay.activeApp);
    const secondAppInstance = actionDisplay.activeApp;

    // Close HUD explicitly via close button
    await secondAppInstance._onCloseHUD({ preventDefault: () => {}, stopPropagation: () => {} }, {});
    secondAppInstance.rendered = false;
    secondAppInstance.element = null;

    // Clear TokenHUD
    canvas.hud.token.clear();

    // Right-click token opens TokenHUD and creates a fresh ActionDisplayApp instance
    mockToken._onClickRight({});
    assert.equal(canvas.hud.token.rendered, true);
    assert.ok(actionDisplay.activeApp);
    assert.notEqual(actionDisplay.activeApp, secondAppInstance);

    // Reset settings & state
    canvas.hud.token.clear();
    game.settings.set(MODULE_ID, 'persistDetached', false);
    game.settings.set(MODULE_ID, 'isAttached', true);
});

test('Attached HUD or persistDetached=false closes immediately on click-off', async () => {
    game.settings.set(MODULE_ID, 'persistDetached', false);
    game.settings.set(MODULE_ID, 'isAttached', true);

    const mockToken = new foundry.canvas.placeables.Token();
    mockToken.id = 'token-attached-1';
    mockToken.name = 'Attached Hero';
    mockToken.document = { isOwner: true };
    mockToken.actor = {
        id: 'actor-attached-1',
        name: 'Attached Actor',
        isOwner: true,
        items: new foundry.utils.Collection()
    };

    // Right-click token opens HUD
    mockToken._onClickRight({});
    assert.equal(canvas.hud.token.rendered, true);
    assert.ok(actionDisplay.activeApp);

    // Left-click off token closes HUD immediately
    canvas.hud.token.clear();
    assert.equal(canvas.hud.token.rendered, false);
    assert.equal(actionDisplay.activeApp, null);
});
