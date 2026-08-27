import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { actionDisplay } from '../../src/action-display.js';
import { handleHUDBind } from '../../src/module.js';

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
    handleHUDBind(mockToken);

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

    // 5. Updating active actor with only module flags (including _id and _stats metadata) does NOT trigger secondary render
    Hooks.callAll('updateActor', { id: 'actor-hero' }, {
        _id: 'actor-hero',
        'flags.bakana-action-display.autoBanState': { conditions: {}, manualUnbans: { vocal: true } },
        _stats: { modifiedTime: Date.now() }
    }, {}, 'user-1');
    await new Promise(r => setTimeout(r, 70));
    assert.equal(renderCount, 4, 'Internal module flag changes must not trigger a redundant re-render');

    // 6. Updating different actor does NOT trigger render
    Hooks.callAll('updateActor', { id: 'actor-enemy' }, {}, {}, 'user-1');
    await new Promise(r => setTimeout(r, 70));
    assert.equal(renderCount, 4);

    // 7. Updating synthetic token triggers render
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
    handleHUDBind(mockToken);

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
    handleHUDBind(mockToken);

    const app = actionDisplay.activeApp;
    assert.ok(app);
    app.element = { style: {}, offsetWidth: 300, offsetHeight: 200 };

    // 1. Attached mode (default)
    app.isAttached = true;
    app.setPosition();
    assert.ok(app.element.style.left !== undefined || app.element.style.top !== undefined);

    // 2. Detached mode
    app.isAttached = false;
    app.setPosition();
    assert.ok(app.element.style.left !== undefined);

    // Cleanup: close HUD
    Hooks.callAll('closeTokenHUD', {}, {});
});

test('Combat turn advancement hook switches HUD to active combatant when autoTrackCombat is enabled', async () => {
    const MODULE_ID = 'bakana-action-display';
    await game.settings.set(MODULE_ID, 'enableCombatAutoTrackButton', true);
    await game.settings.set(MODULE_ID, 'autoTrackCombat', true);

    const tokenGoblin = {
        id: 'token-goblin',
        name: 'Goblin',
        document: { isOwner: true },
        actor: { id: 'actor-goblin', name: 'Goblin Actor', isOwner: true, items: new foundry.utils.Collection() }
    };
    const tokenHero = {
        id: 'token-hero-combat',
        name: 'Hero Combat',
        document: { isOwner: true },
        actor: { id: 'actor-hero-combat', name: 'Hero Combat Actor', isOwner: true, items: new foundry.utils.Collection() }
    };

    globalThis.canvas = {
        tokens: {
            get: (id) => id === 'token-goblin' ? tokenGoblin : tokenHero,
            placeables: [tokenGoblin, tokenHero]
        }
    };

    // 1. Initial state: HUD open for Hero
    handleHUDBind(tokenHero);
    assert.ok(actionDisplay.activeApp);
    assert.equal(actionDisplay.activeApp.token.id, 'token-hero-combat');
    actionDisplay.activeApp.rendered = true;

    // 2. Combat turn advances to Goblin
    const mockCombat = {
        started: true,
        combatant: { tokenId: 'token-goblin', token: tokenGoblin, actor: tokenGoblin.actor }
    };
    globalThis.game.combat = mockCombat;

    Hooks.callAll('combatTurn', mockCombat, {}, {});

    // HUD should now be switched to Goblin!
    assert.ok(actionDisplay.activeApp);
    assert.equal(actionDisplay.activeApp.token.id, 'token-goblin');

    // 3. User toggles combat auto-track OFF via left-click button handler, while autoToggleCombat is ON
    await game.settings.set(MODULE_ID, 'autoToggleCombat', true);
    await actionDisplay.activeApp._onToggleCombatAutoTrack();
    assert.equal(game.settings.get(MODULE_ID, 'autoTrackCombat'), false);
    assert.equal(game.settings.get(MODULE_ID, 'autoToggleCombat'), true, 'autoToggleCombat should remain untouched');

    // 4. Combat turn advances back to Hero -> HUD must NOT switch, and remain on Goblin because autoTrackCombat is OFF!
    const mockCombatHeroTurn = {
        started: true,
        combatant: { tokenId: 'token-hero-combat', token: tokenHero, actor: tokenHero.actor }
    };
    globalThis.game.combat = mockCombatHeroTurn;

    Hooks.callAll('combatTurn', mockCombatHeroTurn, {}, {});
    assert.ok(actionDisplay.activeApp);
    assert.equal(actionDisplay.activeApp.token.id, 'token-goblin', 'HUD must remain on Goblin after autoTrackCombat is toggled off even if autoToggleCombat is active');

    // Clean up
    Hooks.callAll('closeTokenHUD', {}, {});
    await game.settings.set(MODULE_ID, 'enableCombatAutoTrackButton', false);
    await game.settings.set(MODULE_ID, 'autoTrackCombat', false);
    await game.settings.set(MODULE_ID, 'autoToggleCombat', false);
    globalThis.game.combat = null;
});

test('Closed HUD does not re-open when actor status conditions or properties mutate', async () => {
    let renderCalled = false;
    const mockToken = {
        id: 'token-closed-test',
        name: 'Hero Closed',
        document: { isOwner: true },
        actor: { id: 'actor-closed-test', name: 'Hero Closed Actor', isOwner: true, items: new foundry.utils.Collection() }
    };

    // 1. Open HUD
    handleHUDBind(mockToken);
    const app = actionDisplay.activeApp;
    assert.ok(app);

    // 2. Explicitly close the HUD
    await app.close();
    assert.equal(actionDisplay.activeApp, null, 'activeApp should be null after closing');

    // Spy on render if any instance still existed
    app.render = () => { renderCalled = true; };

    // 3. Mutate actor with status condition (e.g. petrified)
    Hooks.callAll('updateActor', { id: 'actor-closed-test' }, { system: { attributes: { hp: { value: 10 } } } }, {}, 'user-1');
    Hooks.callAll('createActiveEffect', { parent: { id: 'actor-closed-test' }, statuses: new Set(['petrified']) }, {}, 'user-1');

    // 4. Background TokenHUD hook fired during status toggle with TokenHUD closed
    Hooks.callAll('renderTokenHUD', { object: mockToken, rendered: false }, {}, {});

    await new Promise(r => setTimeout(r, 70));

    // Verify HUD was NOT opened or rendered
    assert.equal(renderCalled, false, 'render must not be called on closed app');
    assert.equal(actionDisplay.activeApp, null, 'HUD must remain closed');
});

test('Toggling status conditions on open TokenHUD does not re-open closed Action Display', async () => {
    const mockToken = {
        id: 'token-hud-test',
        name: 'Hero HUD',
        document: { isOwner: true },
        actor: { id: 'actor-hud-test', name: 'Hero HUD Actor', isOwner: true, items: new foundry.utils.Collection() }
    };

    // 1. Initial right-click: TokenHUD binds and opens Action Display
    handleHUDBind(mockToken);
    assert.ok(actionDisplay.activeApp);
    assert.equal(actionDisplay.activeApp.token.id, 'token-hud-test');

    // 2. User explicitly closes Action Display (TokenHUD remains open on screen)
    await actionDisplay.activeApp.close();
    assert.equal(actionDisplay.activeApp, null);

    // 3. User toggles a status condition in TokenHUD (TokenHUD re-renders)
    Hooks.callAll('createActiveEffect', { parent: { id: 'actor-hud-test' }, statuses: new Set(['grappled']) }, {}, 'user-1');
    Hooks.callAll('renderTokenHUD', { object: mockToken, rendered: true }, {}, {});

    await new Promise(r => setTimeout(r, 70));

    // Action Display must remain closed
    assert.equal(actionDisplay.activeApp, null, 'Action Display must stay closed when TokenHUD re-renders after status toggle');

    // 4. When TokenHUD is newly bound to another token (or re-bound), Action Display opens
    const otherToken = {
        id: 'token-other-test',
        name: 'Other Token',
        document: { isOwner: true },
        actor: { id: 'actor-other-test', name: 'Other Actor', isOwner: true, items: new foundry.utils.Collection() }
    };
    handleHUDBind(otherToken);
    assert.ok(actionDisplay.activeApp);
    assert.equal(actionDisplay.activeApp.token.id, 'token-other-test');

    // Cleanup
    await actionDisplay.activeApp.close();
});



