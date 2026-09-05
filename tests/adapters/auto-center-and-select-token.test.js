import test from 'node:test';
import assert from 'node:assert/strict';
import '../setup.js';
import { adapter } from '../../src/adapters/index.js';
import { ActionDisplayApp } from '../../src/ui/action-display-app.js';
import { actionDisplay } from '../../src/action-display.js';
import { MODULE_ID } from '../../src/constants.js';
import { handleCombatTurnChange } from '../../src/module.js';

test('BaseFoundryAdapter selectToken and centerCanvasOnToken work correctly', async () => {
    let controlledCalled = false;
    let controlledOptions = null;
    let pannedCoords = null;

    const mockToken = {
        id: 'token-select-1',
        name: 'Selected Token',
        center: { x: 300, y: 400 },
        control: (opts) => {
            controlledCalled = true;
            controlledOptions = opts;
            globalThis.canvas.tokens.controlled = [mockToken];
        }
    };

    globalThis.canvas = {
        tokens: {
            get: (id) => id === 'token-select-1' ? mockToken : null,
            controlled: []
        },
        animatePan: async (coords) => {
            pannedCoords = coords;
        }
    };

    // 1. Test selectToken
    adapter.foundry.selectToken(mockToken);
    assert.equal(controlledCalled, true);
    assert.deepEqual(controlledOptions, { releaseOthers: true });
    assert.deepEqual(canvas.tokens.controlled, [mockToken]);

    // 2. Test centerCanvasOnToken with center property
    await adapter.foundry.centerCanvasOnToken(mockToken);
    assert.deepEqual(pannedCoords, { x: 300, y: 400 });

    // 3. Test centerCanvasOnToken with x, y, w, h fallback
    pannedCoords = null;
    const tokenNoCenter = {
        x: 100,
        y: 200,
        w: 100,
        h: 100
    };
    await adapter.foundry.centerCanvasOnToken(tokenNoCenter);
    assert.deepEqual(pannedCoords, { x: 150, y: 250 });
});

test('Recenter button: left-click centers on current combatant without changing autoCenterOnToken state', async () => {
    let pannedCoords = null;
    globalThis.canvas = {
        animatePan: async (coords) => {
            pannedCoords = coords;
        }
    };

    const hudToken = {
        id: 'token-hud',
        name: 'HUD Token',
        actor: { id: 'actor-hud' },
        center: { x: 100, y: 100 }
    };
    const combatToken = {
        id: 'token-combatant',
        name: 'Combatant Token',
        actor: { id: 'actor-combatant' },
        center: { x: 777, y: 888 }
    };

    await game.settings.set(MODULE_ID, 'autoCenterOnToken', false);

    const app = new ActionDisplayApp(hudToken);

    // Scenario A: Active combat exists with current combatant -> centers on current combatant
    globalThis.game.combat = {
        started: true,
        combatant: {
            tokenId: 'token-combatant',
            token: combatToken
        }
    };

    await app._onRecenterToken({}, {});
    assert.deepEqual(pannedCoords, { x: 777, y: 888 }, 'Left-click must center on active combatant');
    assert.equal(game.settings.get(MODULE_ID, 'autoCenterOnToken'), false, 'Left-click must not alter autoCenterOnToken state');

    // Scenario B: No active combat -> falls back to centering on HUD token
    globalThis.game.combat = null;
    pannedCoords = null;

    await app._onRecenterToken({}, {});
    assert.deepEqual(pannedCoords, { x: 100, y: 100 }, 'Left-click falls back to HUD token when no combatant exists');
    assert.equal(game.settings.get(MODULE_ID, 'autoCenterOnToken'), false, 'autoCenterOnToken remains unchanged');
});

test('Recenter button: right-click toggles autoCenterOnToken between 2 states (off <-> on)', async () => {
    let renderCalled = false;
    const app = new ActionDisplayApp({ actor: { id: 'test-actor' } });
    app.render = () => { renderCalled = true; };

    // Initial state: false (Off)
    await game.settings.set(MODULE_ID, 'autoCenterOnToken', false);
    assert.equal(game.settings.get(MODULE_ID, 'autoCenterOnToken'), false);

    // 1. Right-click toggles from off -> on (auto-center on tokens in charge)
    await app._onRightClickRecenterToken();
    assert.equal(game.settings.get(MODULE_ID, 'autoCenterOnToken'), true);
    assert.equal(renderCalled, true);

    // 2. Right-click toggles from on -> off
    renderCalled = false;
    await app._onRightClickRecenterToken();
    assert.equal(game.settings.get(MODULE_ID, 'autoCenterOnToken'), false);
    assert.equal(renderCalled, true);

    // 3. Test _onContextMenuCapture intercepts right-click on .bad-recenter-btn
    let interceptedRightClick = false;
    app._onRightClickRecenterToken = async () => { interceptedRightClick = true; };

    const mockBtn = document.createElement('button');
    mockBtn.className = 'bad-control-btn bad-recenter-btn';
    mockBtn.closest = (sel) => sel.includes('bad-recenter-btn') ? mockBtn : null;

    const mockEvent = {
        target: mockBtn,
        preventDefault: () => {},
        stopPropagation: () => {},
        stopImmediatePropagation: () => {}
    };

    await app._onContextMenuCapture(mockEvent);
    assert.equal(interceptedRightClick, true, '_onContextMenuCapture must intercept right-click on .bad-recenter-btn');
    app._onRightClickRecenterToken = ActionDisplayApp.prototype._onRightClickRecenterToken;

    // 4. Right-click toggling ON during active combat centers on combatant only when in charge
    let pannedCoords = null;
    globalThis.canvas = {
        animatePan: async (coords) => { pannedCoords = coords; }
    };
    const userGM = { id: 'user-gm-rc-center', name: 'GM', role: 4, isGM: true, active: true };
    const userPlayer = { id: 'user-p1-rc-center', name: 'Player 1', role: 1, isGM: false, active: true };
    globalThis.game.users = new foundry.utils.Collection([userGM, userPlayer]);
    globalThis.game.user = userPlayer;

    const tokenHero = {
        id: 'token-hero-rc-c',
        center: { x: 333, y: 444 },
        document: { id: 'doc-hero', ownership: { default: 0, 'user-p1-rc-center': 3 } },
        actor: { id: 'act-hero', ownership: { default: 0, 'user-p1-rc-center': 3 } }
    };
    const tokenGoblin = {
        id: 'token-goblin-rc-c',
        center: { x: 888, y: 999 },
        document: { id: 'doc-goblin', ownership: { default: 0 } },
        actor: { id: 'act-goblin', ownership: { default: 0 } }
    };

    await game.settings.set(MODULE_ID, 'enableCenterOnToken', true);
    await game.settings.set(MODULE_ID, 'autoCenterOnToken', false);

    // Scenario A: Player turn (Player is in charge) -> Centers on Hero
    globalThis.game.combat = {
        started: true,
        combatant: { tokenId: 'token-hero-rc-c', token: tokenHero }
    };
    pannedCoords = null;
    await app._onRightClickRecenterToken();
    assert.deepEqual(pannedCoords, { x: 333, y: 444 }, 'Must center on token when turning on and in charge');

    // Scenario B: Goblin turn (Player is NOT in charge) -> Does not center on Goblin
    await game.settings.set(MODULE_ID, 'autoCenterOnToken', false);
    globalThis.game.combat = {
        started: true,
        combatant: { tokenId: 'token-goblin-rc-c', token: tokenGoblin }
    };
    pannedCoords = null;
    await app._onRightClickRecenterToken();
    assert.equal(pannedCoords, null, 'Must not center on token when turning on if not in charge');

    // Cleanup
    await game.settings.set(MODULE_ID, 'enableCenterOnToken', false);
    await game.settings.set(MODULE_ID, 'autoCenterOnToken', false);
    globalThis.game.combat = null;
    globalThis.game.user = userGM;
});

test('Auto-combat tracking updates currently selected token on canvas to current combatant', async () => {
    const userGM = { id: 'user-gm-select', name: 'GM', role: 4, isGM: true, active: true };
    const userPlayer = { id: 'user-p1-select', name: 'Player 1', role: 1, isGM: false, active: true };
    globalThis.game.users = new foundry.utils.Collection([userGM, userPlayer]);
    globalThis.game.user = userPlayer;

    let heroControlled = false;
    const tokenHero = {
        id: 'token-hero-sel',
        name: 'Hero Sel',
        document: { id: 'token-hero-sel-doc', ownership: { default: 0, 'user-p1-select': 3 } },
        actor: { id: 'actor-hero-sel', ownership: { default: 0, 'user-p1-select': 3 }, items: new foundry.utils.Collection() },
        control: (opts) => { heroControlled = true; }
    };

    let goblinControlled = false;
    const tokenGoblin = {
        id: 'token-goblin-sel',
        name: 'Goblin Sel',
        document: { id: 'token-goblin-sel-doc', ownership: { default: 0 } },
        actor: { id: 'actor-goblin-sel', ownership: { default: 0 }, items: new foundry.utils.Collection() },
        control: (opts) => { goblinControlled = true; }
    };

    globalThis.canvas = {
        tokens: {
            get: (id) => id === 'token-hero-sel' ? tokenHero : tokenGoblin,
            placeables: [tokenHero, tokenGoblin],
            controlled: []
        },
        animatePan: async () => {}
    };

    const mockCombat = {
        started: true,
        combatant: { tokenId: 'token-hero-sel', token: tokenHero, actor: tokenHero.actor }
    };
    globalThis.game.combat = mockCombat;

    await game.settings.set(MODULE_ID, 'enableCombatAutoTrackButton', true);
    await game.settings.set(MODULE_ID, 'autoTrackCombat', false);

    // Scenario A: Left-clicking auto combat track button to turn ON while combat is active on token in charge
    const app = new ActionDisplayApp(tokenGoblin);
    actionDisplay.activeApp = app;

    heroControlled = false;
    await app._onToggleCombatAutoTrack({}, {});
    assert.equal(game.settings.get(MODULE_ID, 'autoTrackCombat'), true);
    assert.equal(heroControlled, true, 'Left-clicking auto combat toggle ON must select current combatant on canvas');

    // Scenario B: Combat turn advancement updates selected token to new combatant when in charge
    await game.settings.set(MODULE_ID, 'autoTrackCombat', true);
    heroControlled = false;
    goblinControlled = false;

    // Advance to Hero turn (Player 1 in charge) -> Player 1 client selects Hero
    handleCombatTurnChange(mockCombat);
    assert.equal(heroControlled, true, 'Turn advancement with autoTrackCombat must select Hero token');

    // Advance to Goblin turn (Player 1 NOT in charge) -> Player 1 client does NOT select Goblin
    heroControlled = false;
    goblinControlled = false;
    const mockCombatGoblin = {
        started: true,
        combatant: { tokenId: 'token-goblin-sel', token: tokenGoblin, actor: tokenGoblin.actor }
    };
    handleCombatTurnChange(mockCombatGoblin);
    assert.equal(goblinControlled, false, 'Turn advancement must not select token user is not in charge of');

    // Cleanup
    if (actionDisplay.activeApp) {
        actionDisplay.activeApp.close();
        actionDisplay.activeApp = null;
    }
    await game.settings.set(MODULE_ID, 'enableCombatAutoTrackButton', false);
    await game.settings.set(MODULE_ID, 'autoTrackCombat', false);
});

test('Combat turn auto-centering: auto-centers canvas on token when in charge and autoCenterOnToken is ON', async () => {
    await game.settings.set(MODULE_ID, 'enableCenterOnToken', true);
    await game.settings.set(MODULE_ID, 'autoCenterOnToken', true);

    const userGM = { id: 'user-gm-ac', name: 'GM', role: 4, isGM: true, active: true };
    const userPlayer = { id: 'user-p1-ac', name: 'Player 1', role: 1, isGM: false, active: true };
    globalThis.game.users = new foundry.utils.Collection([userGM, userPlayer]);
    globalThis.game.user = userPlayer;

    let pannedCoords = null;
    const tokenHero = {
        id: 'token-hero-ac',
        name: 'Hero AC',
        center: { x: 550, y: 650 },
        document: { id: 'token-hero-ac-doc', ownership: { default: 0, 'user-p1-ac': 3 } },
        actor: { id: 'actor-hero-ac', ownership: { default: 0, 'user-p1-ac': 3 }, items: new foundry.utils.Collection() }
    };

    const tokenGoblin = {
        id: 'token-goblin-ac',
        name: 'Goblin AC',
        center: { x: 1200, y: 1400 },
        document: { id: 'token-goblin-ac-doc', ownership: { default: 0 } },
        actor: { id: 'actor-goblin-ac', ownership: { default: 0 }, items: new foundry.utils.Collection() }
    };

    globalThis.canvas = {
        tokens: {
            get: (id) => id === 'token-hero-ac' ? tokenHero : tokenGoblin,
            placeables: [tokenHero, tokenGoblin],
            controlled: []
        },
        animatePan: async (coords) => {
            pannedCoords = coords;
        }
    };

    const mockCombatHero = {
        started: true,
        combatant: { tokenId: 'token-hero-ac', token: tokenHero, actor: tokenHero.actor }
    };
    const mockCombatGoblin = {
        started: true,
        combatant: { tokenId: 'token-goblin-ac', token: tokenGoblin, actor: tokenGoblin.actor }
    };

    // 1. Advance to Hero turn (Player 1 is in charge) -> Must auto-center on Hero
    pannedCoords = null;
    handleCombatTurnChange(mockCombatHero);
    assert.deepEqual(pannedCoords, { x: 550, y: 650 }, 'Auto-centers on token user is in charge of');

    // 2. Advance to Goblin turn (Player 1 is NOT in charge) -> Must NOT auto-center
    pannedCoords = null;
    handleCombatTurnChange(mockCombatGoblin);
    assert.equal(pannedCoords, null, 'Does not auto-center on token user is not in charge of');

    // 3. When autoCenterOnToken is OFF -> Must NOT auto-center even when in charge
    await game.settings.set(MODULE_ID, 'autoCenterOnToken', false);
    pannedCoords = null;
    handleCombatTurnChange(mockCombatHero);
    assert.equal(pannedCoords, null, 'Does not auto-center when autoCenterOnToken is OFF');

    // 4. When enableCenterOnToken world setting is FALSE -> Must NOT auto-center even if autoCenterOnToken is ON
    await game.settings.set(MODULE_ID, 'enableCenterOnToken', false);
    await game.settings.set(MODULE_ID, 'autoCenterOnToken', true);
    pannedCoords = null;
    handleCombatTurnChange(mockCombatHero);
    assert.equal(pannedCoords, null, 'Does not auto-center when enableCenterOnToken is disabled in world settings');

    // Cleanup
    await game.settings.set(MODULE_ID, 'enableCenterOnToken', false);
    await game.settings.set(MODULE_ID, 'autoCenterOnToken', false);
    if (actionDisplay.activeApp) {
        actionDisplay.activeApp.close();
        actionDisplay.activeApp = null;
    }
});

test('ActionDisplayApp _prepareContext reflects autoCenterOnToken setting', async () => {
    const app = new ActionDisplayApp({ actor: { id: 'test-actor' } });

    await game.settings.set(MODULE_ID, 'autoCenterOnToken', false);
    let context = await app._prepareContext({});
    assert.equal(context.autoCenterOnToken, false);

    await game.settings.set(MODULE_ID, 'autoCenterOnToken', true);
    context = await app._prepareContext({});
    assert.equal(context.autoCenterOnToken, true);

    await game.settings.set(MODULE_ID, 'autoCenterOnToken', false);
});
