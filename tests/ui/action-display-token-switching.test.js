import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_ID } from '../../src/constants.js';
import { actionDisplay } from '../../src/action-display.js';
import { handleHUDBind } from '../../src/module.js';

function createMockToken(id, name, tx, ty, w = 100, h = 100) {
    return {
        id,
        name,
        w,
        h,
        worldTransform: { tx, ty },
        document: { isOwner: true },
        actor: {
            id: `actor-${id}`,
            name: `${name} Actor`,
            isOwner: true,
            items: new foundry.utils.Collection()
        }
    };
}

test('Token switching in attached vertical mode updates vertical position to new token without retaining previous vertical alignment', async () => {
    await game.settings.set(MODULE_ID, 'hudAnchorSide', 'vertical');
    await game.settings.set(MODULE_ID, 'hudGridOffset', 0.5);

    const token1 = createMockToken('token-1', 'Token 1', 100, 100);
    const token2 = createMockToken('token-2', 'Token 2', 500, 400);

    // 1. Right click Token 1
    handleHUDBind(token1);
    assert.ok(actionDisplay.activeApp);
    assert.equal(actionDisplay.activeApp.token.id, 'token-1');

    // Simulate mock DOM element for app
    const style1 = {};
    actionDisplay.activeApp.element = { style: style1, offsetWidth: 320, offsetHeight: 200 };
    actionDisplay.activeApp.rendered = true;
    actionDisplay.activeApp.setPosition();

    const initialTop1 = style1.top;
    const initialBottom1 = style1.bottom;
    const initialLeft1 = style1.left;
    assert.ok(initialTop1 || initialBottom1, 'Token 1 must have vertical coordinate set');

    // 2. Right click Token 2 while HUD is open
    handleHUDBind(token2);
    assert.ok(actionDisplay.activeApp);
    assert.equal(actionDisplay.activeApp.token.id, 'token-2');

    const style2 = {};
    actionDisplay.activeApp.element = { style: style2, offsetWidth: 320, offsetHeight: 200 };
    actionDisplay.activeApp.rendered = true;
    actionDisplay.activeApp.setPosition();

    // Vertical position of Token 2 must not retain Token 1's vertical position
    if (style2.top) {
        assert.notEqual(style2.top, initialTop1, 'Token 2 vertical top position must not retain Token 1 top position');
    }
    if (style2.bottom) {
        assert.notEqual(style2.bottom, initialBottom1, 'Token 2 vertical bottom position must not retain Token 1 bottom position');
    }
    assert.notEqual(style2.left, initialLeft1, 'Token 2 horizontal left position must align with Token 2');

    await actionDisplay.activeApp.close();
});

test('Token switching in attached horizontal mode updates horizontal position to new token without retaining previous horizontal alignment', async () => {
    await game.settings.set(MODULE_ID, 'hudAnchorSide', 'horizontal');
    await game.settings.set(MODULE_ID, 'hudGridOffsetHorizontal', 0.5);

    const token1 = createMockToken('token-h1', 'Token H1', 100, 100);
    const token2 = createMockToken('token-h2', 'Token H2', 600, 500);

    // 1. Right click Token 1
    handleHUDBind(token1);
    assert.ok(actionDisplay.activeApp);
    assert.equal(actionDisplay.activeApp.token.id, 'token-h1');

    const style1 = {};
    actionDisplay.activeApp.element = { style: style1, offsetWidth: 320, offsetHeight: 200 };
    actionDisplay.activeApp.rendered = true;
    actionDisplay.activeApp.setPosition();

    const initialLeft1 = style1.left;
    const initialRight1 = style1.right;
    const initialTop1 = style1.top;
    assert.ok(initialLeft1 || initialRight1, 'Token 1 must have horizontal coordinate set');

    // 2. Right click Token 2 while HUD is open
    handleHUDBind(token2);
    assert.ok(actionDisplay.activeApp);
    assert.equal(actionDisplay.activeApp.token.id, 'token-h2');

    const style2 = {};
    actionDisplay.activeApp.element = { style: style2, offsetWidth: 320, offsetHeight: 200 };
    actionDisplay.activeApp.rendered = true;
    actionDisplay.activeApp.setPosition();

    // Horizontal position of Token 2 must not retain Token 1's horizontal position
    if (style2.left) {
        assert.notEqual(style2.left, initialLeft1, 'Token 2 horizontal left position must not retain Token 1 left position');
    }
    if (style2.right) {
        assert.notEqual(style2.right, initialRight1, 'Token 2 horizontal right position must not retain Token 1 right position');
    }
    assert.notEqual(style2.top, initialTop1, 'Token 2 vertical top position must align with Token 2');

    await actionDisplay.activeApp.close();

    // Reset settings back to defaults
    await game.settings.set(MODULE_ID, 'hudAnchorSide', 'vertical');
});

test('Token switching via TokenHUD lifecycle is resilient to async closeTokenHUD from previous token', async () => {
    const token1 = createMockToken('token-lifecycle-1', 'Token L1', 100, 100);
    const token2 = createMockToken('token-lifecycle-2', 'Token L2', 500, 500);

    // 1. Initial bind to Token 1
    canvas.hud.token.object = token1;
    canvas.hud.token.rendered = true;
    handleHUDBind(token1);
    assert.ok(actionDisplay.activeApp);
    assert.equal(actionDisplay.activeApp.token.id, 'token-lifecycle-1');

    // 2. Bind to Token 2 (TokenHUD binds Token 2 and is now rendered for Token 2)
    canvas.hud.token.object = token2;
    canvas.hud.token.rendered = true;
    handleHUDBind(token2);
    assert.ok(actionDisplay.activeApp);
    assert.equal(actionDisplay.activeApp.token.id, 'token-lifecycle-2');

    // 3. Asynchronous closeTokenHUD event finishes from Token 1's clear/fade
    Hooks.callAll('closeTokenHUD', canvas.hud.token, {});

    // Action Display must remain open for Token 2 because TokenHUD is currently rendered for Token 2
    assert.ok(actionDisplay.activeApp, 'Active app must not be closed by previous token closeTokenHUD');
    assert.equal(actionDisplay.activeApp.token.id, 'token-lifecycle-2');

    // 4. TokenHUD closes completely (user clicks off)
    canvas.hud.token.object = null;
    canvas.hud.token.rendered = false;
    Hooks.callAll('closeTokenHUD', canvas.hud.token, {});

    // Now activeApp should close
    assert.equal(actionDisplay.activeApp, null, 'Active app must close when TokenHUD closes completely');
});
