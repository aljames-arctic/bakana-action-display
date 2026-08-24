import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { actionDisplay } from '../../src/action-display.js';
import '../../src/module.js';

test('Reactive document hooks re-render activeApp when item or actor mutates', async () => {
    let renderCount = 0;
    const mockToken = {
        id: 'token-hero',
        name: 'Hero',
        document: { isOwner: true },
        actor: {
            id: 'actor-hero',
            name: 'Hero Actor',
            isOwner: true,
            items: new foundry.utils.Collection()
        }
    };

    // Open HUD for token
    Hooks.callAll('renderTokenHUD', { object: mockToken }, {}, {});

    assert.ok(actionDisplay.activeApp);
    const app = actionDisplay.activeApp;
    app.rendered = true;
    app.render = () => { renderCount++; };

    // 1. Updating item belonging to active actor triggers debounced render
    Hooks.callAll('updateItem', { id: 'ammo-1', parent: { id: 'actor-hero' } }, {}, {}, 'user-1');
    await new Promise(r => setTimeout(r, 70));
    assert.equal(renderCount, 1);

    // 2. Updating item belonging to a different actor does NOT trigger render
    Hooks.callAll('updateItem', { id: 'ammo-2', parent: { id: 'actor-other' } }, {}, {}, 'user-1');
    await new Promise(r => setTimeout(r, 70));
    assert.equal(renderCount, 1);

    // 3. Creating and deleting items on active actor triggers render
    Hooks.callAll('createItem', { id: 'item-new', actor: { id: 'actor-hero' } }, {}, 'user-1');
    await new Promise(r => setTimeout(r, 70));
    assert.equal(renderCount, 2);

    Hooks.callAll('deleteItem', { id: 'item-new', parent: { id: 'actor-hero' } }, {}, 'user-1');
    await new Promise(r => setTimeout(r, 70));
    assert.equal(renderCount, 3);

    // 4. Updating active actor triggers render
    Hooks.callAll('updateActor', { id: 'actor-hero' }, {}, {}, 'user-1');
    await new Promise(r => setTimeout(r, 70));
    assert.equal(renderCount, 4);

    // 5. Updating different actor does NOT trigger render
    Hooks.callAll('updateActor', { id: 'actor-enemy' }, {}, {}, 'user-1');
    await new Promise(r => setTimeout(r, 70));
    assert.equal(renderCount, 4);

    // 6. Updating synthetic token triggers render
    Hooks.callAll('updateToken', { id: 'token-hero', actor: { id: 'actor-hero' } }, {}, {}, 'user-1');
    await new Promise(r => setTimeout(r, 70));
    assert.equal(renderCount, 5);

    // Cleanup: close HUD
    Hooks.callAll('closeTokenHUD', {}, {});
});

test('canvasPan hook updates position on tracked activeApp without error', () => {
    let positionUpdated = 0;
    const mockToken = {
        id: 'token-hero-pan',
        name: 'Hero Pan',
        document: { isOwner: true },
        actor: {
            id: 'actor-hero-pan',
            name: 'Hero Actor',
            isOwner: true,
            items: new foundry.utils.Collection()
        }
    };

    // Open HUD for token
    Hooks.callAll('renderTokenHUD', { object: mockToken }, {}, {});

    const app = actionDisplay.activeApp;
    assert.ok(app);
    assert.equal(app.isTracked, true);

    app.setPosition = () => {
        positionUpdated++;
    };

    // canvasPan triggers setPosition when isTracked is true
    Hooks.callAll('canvasPan', {}, {});
    assert.equal(positionUpdated, 1);

    // Cleanup: close HUD
    Hooks.callAll('closeTokenHUD', {}, {});
});

test('ActionDisplayApp setPosition calculates coordinates across attached and detached modes', () => {
    const mockToken = {
        id: 'token-hero-pos',
        name: 'Hero Pos',
        document: { isOwner: true },
        actor: {
            id: 'actor-hero-pos',
            name: 'Hero Actor',
            isOwner: true,
            items: new foundry.utils.Collection()
        },
        w: 100,
        h: 100,
        worldTransform: { tx: 500, ty: 400 }
    };

    // Open HUD for token
    Hooks.callAll('renderTokenHUD', { object: mockToken }, {}, {});

    const app = actionDisplay.activeApp;
    assert.ok(app);
    app.element = { style: {}, offsetWidth: 300, offsetHeight: 200 };

    // 1. Attached mode (default)
    app.positionMode = 'attached';
    app.setPosition();
    assert.ok(app.element.style.left !== undefined || app.element.style.top !== undefined);

    // 2. Detached mode
    app.positionMode = 'detached';
    app.setPosition();
    assert.ok(app.element.style.left !== undefined);

    // Cleanup: close HUD
    Hooks.callAll('closeTokenHUD', {}, {});
});


