import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { actionDisplay } from '../../src/action-display.js';
import { ActionDisplayApp } from '../../src/ui/action-display-app.js';
import { MODULE_ID } from '../../src/constants.js';
import '../../src/module.js';

test('HUD persistence when persistHUD=true across both attached and detached states', async () => {
    // Enable persistHUD setting and test detached mode first
    await game.settings.set(MODULE_ID, 'persistHUD', true);
    await game.settings.set(MODULE_ID, 'isAttached', false);

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

    // CLICK 4: Left-click off token -> TokenHUD clears, detached ActionDisplayApp MUST stay open
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

    // --- Now test Attached HUD with persistHUD=true (stays open on click-off!) ---
    await game.settings.set(MODULE_ID, 'isAttached', true);

    const mockAttachedToken = new foundry.canvas.placeables.Token();
    mockAttachedToken.id = 'token-attached-persist';
    mockAttachedToken.name = 'Attached Persist Hero';
    mockAttachedToken.document = { isOwner: true };
    mockAttachedToken.actor = {
        id: 'actor-attached-persist',
        name: 'Attached Persist Actor',
        isOwner: true,
        items: new foundry.utils.Collection()
    };

    // 1. Right-click token opens attached HUD
    mockAttachedToken._onClickRight({});
    assert.equal(canvas.hud.token.rendered, true);
    assert.ok(actionDisplay.activeApp);
    assert.equal(actionDisplay.activeApp.isAttached, true);

    const attachedApp = actionDisplay.activeApp;

    // 2. Left-click off token -> TokenHUD clears, but attached HUD STAYS OPEN because persistHUD is true!
    canvas.hud.token.clear();
    assert.equal(canvas.hud.token.rendered, false);
    assert.ok(actionDisplay.activeApp, 'Attached HUD must stay open on click-off when persistHUD is true');
    assert.equal(actionDisplay.activeApp, attachedApp);

    // 3. Right-click token opens TokenHUD
    mockAttachedToken._onClickRight({});
    assert.equal(canvas.hud.token.rendered, true);
    assert.ok(actionDisplay.activeApp);

    // 4. Right-click token AGAIN WHILE TokenHUD IS OPEN -> Both close!
    mockAttachedToken._onClickRight({});
    assert.equal(canvas.hud.token.rendered, false);
    assert.equal(actionDisplay.activeApp, null, 'Attached HUD closes when right-clicking the token again');

    // Reset settings & state
    canvas.hud.token.clear();
    await game.settings.set(MODULE_ID, 'persistHUD', false);
    await game.settings.set(MODULE_ID, 'isAttached', true);
});

test('When persistHUD=false, HUD closes immediately on click-off in both attached and detached modes', async () => {
    await game.settings.set(MODULE_ID, 'persistHUD', false);

    // Scenario A: Attached mode with persistHUD=false
    await game.settings.set(MODULE_ID, 'isAttached', true);

    const mockTokenAttached = new foundry.canvas.placeables.Token();
    mockTokenAttached.id = 'token-attached-1';
    mockTokenAttached.name = 'Attached Hero';
    mockTokenAttached.document = { isOwner: true };
    mockTokenAttached.actor = {
        id: 'actor-attached-1',
        name: 'Attached Actor',
        isOwner: true,
        items: new foundry.utils.Collection()
    };

    // Right-click token opens HUD
    mockTokenAttached._onClickRight({});
    assert.equal(canvas.hud.token.rendered, true);
    assert.ok(actionDisplay.activeApp);

    // Left-click off token closes HUD immediately
    canvas.hud.token.clear();
    assert.equal(canvas.hud.token.rendered, false);
    assert.equal(actionDisplay.activeApp, null, 'Attached HUD must close on click-off when persistHUD is false');

    // Scenario B: Detached mode with persistHUD=false
    await game.settings.set(MODULE_ID, 'isAttached', false);

    const mockTokenDetached = new foundry.canvas.placeables.Token();
    mockTokenDetached.id = 'token-detached-2';
    mockTokenDetached.name = 'Detached Hero 2';
    mockTokenDetached.document = { isOwner: true };
    mockTokenDetached.actor = {
        id: 'actor-detached-2',
        name: 'Detached Actor 2',
        isOwner: true,
        items: new foundry.utils.Collection()
    };

    mockTokenDetached._onClickRight({});
    assert.equal(canvas.hud.token.rendered, true);
    assert.ok(actionDisplay.activeApp);

    // Left-click off token closes HUD immediately
    canvas.hud.token.clear();
    assert.equal(canvas.hud.token.rendered, false);
    assert.equal(actionDisplay.activeApp, null, 'Detached HUD must close on click-off when persistHUD is false');

    await game.settings.set(MODULE_ID, 'isAttached', true);
});

test('Right-clicking the attachment icon toggles persistHUD setting and updates context', async () => {
    const mockActor = { isOwner: true, uuid: 'Actor.pin-toggle' };
    const app = new ActionDisplayApp({ actor: mockActor });

    let renderCalled = false;
    app.render = () => { renderCalled = true; };

    // Initial state: false
    await game.settings.set(MODULE_ID, 'persistHUD', false);
    let context = await app._prepareContext({});
    assert.equal(context.persistHUD, false);

    // 1. Right click toggles from false to true
    await app._onRightClickToggleAnchor();
    assert.equal(game.settings.get(MODULE_ID, 'persistHUD'), true);
    assert.equal(renderCalled, true);
    context = await app._prepareContext({});
    assert.equal(context.persistHUD, true);

    // 2. Right click toggles from true to false
    renderCalled = false;
    await app._onRightClickToggleAnchor();
    assert.equal(game.settings.get(MODULE_ID, 'persistHUD'), false);
    assert.equal(renderCalled, true);
    context = await app._prepareContext({});
    assert.equal(context.persistHUD, false);

    // 3. Test _onContextMenuCapture intercepts right-click on .bad-pin-btn
    let interceptedRightClick = false;
    app._onRightClickToggleAnchor = async () => { interceptedRightClick = true; };

    const mockPinBtn = document.createElement('button');
    mockPinBtn.className = 'bad-control-btn bad-pin-btn';
    mockPinBtn.closest = (sel) => sel.includes('bad-pin-btn') ? mockPinBtn : null;

    const mockEvent = {
        target: mockPinBtn,
        preventDefault: () => {},
        stopPropagation: () => {},
        stopImmediatePropagation: () => {}
    };

    await app._onContextMenuCapture(mockEvent);
    assert.equal(interceptedRightClick, true, '_onContextMenuCapture must intercept right-click on .bad-pin-btn');

    // Cleanup
    await game.settings.set(MODULE_ID, 'persistHUD', false);
});
