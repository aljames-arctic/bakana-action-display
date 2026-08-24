import test from 'node:test';
import assert from 'node:assert/strict';
import '../setup.js';
import { ActionDisplayApp } from '../../src/ui/action-display-app.js';
import { actionDisplay } from '../../src/action-display.js';
import { MODULE_ID } from '../../src/constants.js';
import '../../src/module.js';

test('ActionDisplayApp _onRecenterToken recenters canvas view on token center', async () => {
    let pannedCoords = null;
    globalThis.canvas = {
        animatePan: async (coords) => {
            pannedCoords = coords;
        }
    };

    const mockToken = {
        actor: { id: 'test-actor' },
        center: { x: 500, y: 750 }
    };
    const app = new ActionDisplayApp(mockToken);
    await app._onRecenterToken({}, {});

    assert.deepEqual(pannedCoords, { x: 500, y: 750 });
});

test('ActionDisplayApp _onToggleFilterResources toggles showDepleted setting via button', async () => {
    let renderCalled = false;
    const app = new ActionDisplayApp({ actor: { id: 'test-actor' } });
    app.render = () => { renderCalled = true; };

    // Initial state is false (default: hide depleted items, button disabled / not highlit)
    await game.settings.set(MODULE_ID, 'showDepleted', false);
    assert.equal(game.settings.get(MODULE_ID, 'showDepleted'), false);

    // Toggle on (from button with no target.checked -> show depleted items, button enabled / highlit)
    await app._onToggleFilterResources({}, {});
    assert.equal(game.settings.get(MODULE_ID, 'showDepleted'), true);
    assert.equal(renderCalled, true);

    // Toggle off (back to hiding depleted items)
    renderCalled = false;
    await app._onToggleFilterResources({}, {});
    assert.equal(game.settings.get(MODULE_ID, 'showDepleted'), false);
    assert.equal(renderCalled, true);
});

test('ActionDisplayApp search query filters actions in _prepareContext and clears via _onClearSearch', async () => {
    const mockActions = [
        { id: '1', name: 'Fireball', left: ['spell', 'level_3'], right: [{ path: 'economy/action' }], page: 1 },
        { id: '2', name: 'Longsword Attack', left: ['weapon', 'martialM'], right: [{ path: 'economy/action' }], page: 1 },
        { id: '3', name: 'Healing Word', left: ['spell', 'level_1'], right: [{ path: 'economy/bonus' }], page: 1 }
    ];

    actionDisplay.getActions = async () => mockActions;

    const app = new ActionDisplayApp({ actor: { id: 'test-actor' } });
    app.activePage = 1;
    app._saveTabState = () => {};

    // 1. Without search query, all matching actions are visible
    const contextNormal = await app._prepareContext({});
    assert.equal(contextNormal.items.length, 3);
    assert.equal(contextNormal.searchQuery, '');

    // 2. With search query 'fire'
    app.searchQuery = 'fire';
    const contextFire = await app._prepareContext({});
    assert.equal(contextFire.items.length, 1);
    assert.equal(contextFire.items[0].name, 'Fireball');
    assert.equal(contextFire.searchQuery, 'fire');

    // 3. With search query 'healing' (case-insensitive)
    app.searchQuery = 'HEALING';
    const contextHealing = await app._prepareContext({});
    assert.equal(contextHealing.items.length, 1);
    assert.equal(contextHealing.items[0].name, 'Healing Word');

    // 4. With search query matching multiple items ('word' matches Longsword Attack and Healing Word)
    app.searchQuery = 'word';
    const contextWord = await app._prepareContext({});
    assert.equal(contextWord.items.length, 2);

    // 5. With search query matching nothing
    app.searchQuery = 'nonexistent item';
    const contextEmpty = await app._prepareContext({});
    assert.equal(contextEmpty.items.length, 0);

    // 6. Clear search query via _onClearSearch
    let renderCalled = false;
    app.render = () => { renderCalled = true; };
    app._onClearSearch({}, {});
    assert.equal(app.searchQuery, '');
    assert.equal(renderCalled, true);
});

test('ActionDisplayApp _prepareContext reflects enableCenterOnToken and enableItemSummaryButton world config settings', async () => {
    actionDisplay.getActions = async () => [];

    const app = new ActionDisplayApp({ actor: { id: 'test-actor' } });
    app.activePage = 1;
    app._saveTabState = () => {};

    // Default disabled
    await game.settings.set(MODULE_ID, 'enableCenterOnToken', false);
    await game.settings.set(MODULE_ID, 'enableItemSummaryButton', false);
    await game.settings.set(MODULE_ID, 'showItemSummaries', false);
    let context = await app._prepareContext({});
    assert.equal(context.enableCenterOnToken, false);
    assert.equal(context.enableItemSummaryButton, false);
    assert.equal(context.showItemSummaries, false);

    // Enabled via world config
    await game.settings.set(MODULE_ID, 'enableCenterOnToken', true);
    await game.settings.set(MODULE_ID, 'enableItemSummaryButton', true);
    await game.settings.set(MODULE_ID, 'showItemSummaries', true);
    context = await app._prepareContext({});
    assert.equal(context.enableCenterOnToken, true);
    assert.equal(context.enableItemSummaryButton, true);
    assert.equal(context.showItemSummaries, true);

    // Reset back to false
    await game.settings.set(MODULE_ID, 'enableCenterOnToken', false);
    await game.settings.set(MODULE_ID, 'enableItemSummaryButton', false);
    await game.settings.set(MODULE_ID, 'showItemSummaries', false);
});

test('ActionDisplayApp _onToggleItemSummaries toggles showItemSummaries setting via button', async () => {
    let renderCalled = false;
    const app = new ActionDisplayApp({ actor: { id: 'test-actor' } });
    app.render = () => { renderCalled = true; };

    // Initial state is false
    await game.settings.set(MODULE_ID, 'showItemSummaries', false);
    assert.equal(game.settings.get(MODULE_ID, 'showItemSummaries'), false);

    // Toggle on
    await app._onToggleItemSummaries({}, {});
    assert.equal(game.settings.get(MODULE_ID, 'showItemSummaries'), true);
    assert.equal(renderCalled, true);

    // Toggle off
    renderCalled = false;
    await app._onToggleItemSummaries({}, {});
    assert.equal(game.settings.get(MODULE_ID, 'showItemSummaries'), false);
    assert.equal(renderCalled, true);
});

test('ActionDisplayApp _syncTabWidths synchronizes tab widths to maximal width per depth', () => {
    const app = new ActionDisplayApp({ actor: { id: 'test-actor' } });

    const createMockColumn = () => {
        const properties = new Map();
        const style = {
            setProperty: (k, v) => properties.set(k, v),
            removeProperty: (k) => properties.delete(k),
            get: (k) => properties.get(k)
        };
        const depth2Elements = [
            { offsetWidth: 60, scrollWidth: 60, classList: { contains: () => false } },
            { offsetWidth: 110, scrollWidth: 110, classList: { contains: () => false } },
            { offsetWidth: 75, scrollWidth: 75, classList: { contains: () => false } }
        ];
        const depth3Elements = [
            { offsetWidth: 140, scrollWidth: 140, classList: { contains: () => true } },
            { offsetWidth: 80, scrollWidth: 80, classList: { contains: () => true } }
        ];

        return {
            style,
            properties,
            querySelectorAll: (sel) => {
                if (sel.includes(':not(.bad-nested-sub-tab)')) return depth2Elements;
                if (sel.includes('.bad-nested-sub-tab')) return depth3Elements;
                return [];
            }
        };
    };

    const mockLeft = createMockColumn();
    const mockRight = createMockColumn();

    app.element = {
        querySelector: (sel) => {
            if (sel === '.bad-left-tabs') return mockLeft;
            if (sel === '.bad-right-tabs') return mockRight;
            return null;
        }
    };

    app._syncTabWidths();

    // Verify depth 2 width is set to max depth 2 width (110px)
    assert.equal(mockRight.properties.get('--bad-depth-2-width'), '110px');
    assert.equal(mockLeft.properties.get('--bad-depth-2-width'), '110px');

    // Verify depth 3 width is set to max depth 3 width (140px)
    assert.equal(mockRight.properties.get('--bad-depth-3-width'), '140px');
    assert.equal(mockLeft.properties.get('--bad-depth-3-width'), '140px');
});

test('ActionDisplayApp _onToggleAnchor toggles between attached and detached modes', async () => {
    let renderCalled = false;
    const app = new ActionDisplayApp({ actor: { id: 'test-actor' } });
    app.render = () => { renderCalled = true; };
    app.element = {
        getBoundingClientRect: () => ({ left: 250, top: 180 })
    };

    // 1. Initial mode is attached
    app.isAttached = true;
    assert.equal(app.isAttached, true);
    assert.equal(app.isDetached, false);

    // 2. Toggle to detached
    await app._onToggleAnchor({ preventDefault: () => {} }, {});
    assert.equal(app.isAttached, false);
    assert.equal(app.isDetached, true);
    assert.equal(game.settings.get(MODULE_ID, 'isAttached'), false);
    assert.deepEqual(game.settings.get(MODULE_ID, 'hudDetachedPosition'), { left: 250, top: 180 });
    assert.equal(renderCalled, true);

    // 3. Toggle back to attached
    renderCalled = false;
    await app._onToggleAnchor({ preventDefault: () => {} }, {});
    assert.equal(app.isAttached, true);
    assert.equal(app.isDetached, false);
    assert.equal(game.settings.get(MODULE_ID, 'isAttached'), true);
    assert.equal(renderCalled, true);
});

test('ActionDisplayApp _prepareContext computes isCurrentCombatant when enableEndTurnButton is enabled and combat turn matches', async () => {
    actionDisplay.getActions = async () => [];

    const mockToken = { id: 'combatToken1' };
    const mockActor = { id: 'combatActor1' };
    const app = new ActionDisplayApp({ token: mockToken, actor: mockActor, id: 'combatToken1' });
    app.activePage = 1;
    app._saveTabState = () => {};

    // 1. Setting disabled -> isCurrentCombatant is false even if it is actor's turn
    await game.settings.set(MODULE_ID, 'enableEndTurnButton', false);
    globalThis.game.combat = {
        started: true,
        combatant: { token: mockToken, actor: mockActor }
    };
    let context = await app._prepareContext({});
    assert.equal(context.isCurrentCombatant, false);

    // 2. Setting enabled, but combat is not started -> isCurrentCombatant is false
    await game.settings.set(MODULE_ID, 'enableEndTurnButton', true);
    globalThis.game.combat = {
        started: false,
        combatant: { token: mockToken, actor: mockActor }
    };
    context = await app._prepareContext({});
    assert.equal(context.isCurrentCombatant, false);

    // 3. Setting enabled, combat started, but different combatant's turn -> isCurrentCombatant is false
    globalThis.game.combat = {
        started: true,
        combatant: { token: { id: 'otherToken' }, actor: { id: 'otherActor' } }
    };
    context = await app._prepareContext({});
    assert.equal(context.isCurrentCombatant, false);

    // 4. Setting enabled, combat started, matching token/actor turn -> isCurrentCombatant is true
    globalThis.game.combat = {
        started: true,
        combatant: { token: mockToken, actor: mockActor }
    };
    context = await app._prepareContext({});
    assert.equal(context.isCurrentCombatant, true);

    // Clean up
    await game.settings.set(MODULE_ID, 'enableEndTurnButton', false);
    globalThis.game.combat = null;
});

test('ActionDisplayApp _onEndCombatTurn calls combat.nextTurn() during active combat turn', async () => {
    let nextTurnCalled = false;
    globalThis.game.combat = {
        started: true,
        nextTurn: async () => {
            nextTurnCalled = true;
        }
    };

    const app = new ActionDisplayApp({ token: { id: 'combatToken1' }, actor: { id: 'combatActor1' } });
    await app._onEndCombatTurn({ preventDefault: () => {}, stopPropagation: () => {} }, {});
    assert.equal(nextTurnCalled, true, 'combat.nextTurn should be called');

    // Clean up
    globalThis.game.combat = null;
});

test('ActionDisplayApp _prepareContext reflects enableCombatAutoTrackButton and autoTrackCombat settings', async () => {
    actionDisplay.getActions = async () => [];

    const app = new ActionDisplayApp({ actor: { id: 'test-actor' } });
    app.activePage = 1;
    app._saveTabState = () => {};

    // 1. Default disabled
    await game.settings.set(MODULE_ID, 'enableCombatAutoTrackButton', false);
    await game.settings.set(MODULE_ID, 'autoTrackCombat', false);
    let context = await app._prepareContext({});
    assert.equal(context.enableCombatAutoTrackButton, false);
    assert.equal(context.autoTrackCombat, false);

    // 2. Enabled via settings
    await game.settings.set(MODULE_ID, 'enableCombatAutoTrackButton', true);
    await game.settings.set(MODULE_ID, 'autoTrackCombat', true);
    context = await app._prepareContext({});
    assert.equal(context.enableCombatAutoTrackButton, true);
    assert.equal(context.autoTrackCombat, true);

    // Reset
    await game.settings.set(MODULE_ID, 'enableCombatAutoTrackButton', false);
    await game.settings.set(MODULE_ID, 'autoTrackCombat', false);
});

test('ActionDisplayApp _onToggleCombatAutoTrack toggles setting and switches token during active combat', async () => {
    const combatToken = {
        id: 'monster1',
        document: { isOwner: true },
        actor: { id: 'actorMonster1', isOwner: true, items: [], flags: {} }
    };
    const playerToken = {
        id: 'player1',
        document: { isOwner: true },
        actor: { id: 'actorPlayer1', isOwner: true, items: [], flags: {} }
    };

    globalThis.canvas = {
        tokens: {
            get: (id) => id === 'monster1' ? combatToken : playerToken,
            placeables: [combatToken, playerToken]
        }
    };

    globalThis.game.combat = {
        started: true,
        combatant: { tokenId: 'monster1', token: combatToken, actor: combatToken.actor }
    };

    const initialApp = new ActionDisplayApp(playerToken);
    actionDisplay.activeApp = initialApp;
    initialApp.rendered = true;

    // Toggle on: should switch HUD to monster1
    await game.settings.set(MODULE_ID, 'autoTrackCombat', false);
    await initialApp._onToggleCombatAutoTrack({ preventDefault: () => {} }, {});

    assert.equal(game.settings.get(MODULE_ID, 'autoTrackCombat'), true);
    assert.ok(actionDisplay.activeApp);
    assert.equal(actionDisplay.activeApp.token.id, 'monster1');

    // Clean up
    if (actionDisplay.activeApp) {
        actionDisplay.activeApp.close();
        actionDisplay.activeApp = null;
    }
    await game.settings.set(MODULE_ID, 'autoTrackCombat', false);
    globalThis.game.combat = null;
});

test('ActionDisplayApp bringToTop elevates HUD z-index above all other open application windows', () => {
    const app = new ActionDisplayApp({ actor: { id: 'test-actor' } });
    app.element = { style: { zIndex: '100' } };

    // Simulate other open sheets/windows in DOM
    const otherWinA = { style: { zIndex: '120' } };
    const otherWinB = { style: { zIndex: '135' } };
    const oldQuerySelectorAll = document.querySelectorAll;

    document.querySelectorAll = (sel) => {
        if (sel.includes('window-app')) {
            return [app.element, otherWinA, otherWinB];
        }
        return [];
    };

    const newZ = app.bringToTop();
    assert.equal(newZ, 136, 'HUD z-index should be higher than highest other window (135 + 1)');
    assert.equal(app.element.style.zIndex, '136');

    // Restore
    document.querySelectorAll = oldQuerySelectorAll;
});

test('ActionDisplayApp _onFirstRender calls bringToTop on initial open, while _onRender preserves z-index', () => {
    let bringToTopCount = 0;
    const app = new ActionDisplayApp({ actor: { id: 'test-actor' } });
    const mockElement = {
        style: { zIndex: '100' },
        querySelector: () => ({ offsetWidth: 320, offsetHeight: 400 }),
        querySelectorAll: () => [],
        addEventListener: () => {},
        offsetWidth: 320,
        offsetHeight: 400
    };
    app.element = mockElement;
    app.bringToTop = () => {
        bringToTopCount++;
        return 150;
    };
    app._attachSearchListeners = () => {};
    app._restoreSearchFocus = () => {};
    app._syncTabWidths = () => {};
    app._adjustMinHeight = () => {};
    app.setPosition = () => {};
    app._createContextMenu = () => null;

    // 1. Initial open calls bringToTop
    app._onFirstRender({}, {});
    assert.equal(bringToTopCount, 1, '_onFirstRender must call bringToTop() on initial open');

    // 2. Background re-render preserves z-index (does NOT call bringToTop)
    app._onRender({}, {});
    assert.equal(bringToTopCount, 1, '_onRender must not call bringToTop() so subsequent windows remain on top');
});

test('Clicking or rendering another application elevates that window above the HUD', () => {
    const hudApp = new ActionDisplayApp({ actor: { id: 'test-actor' } });
    const hudElement = {
        style: { zIndex: '100' },
        querySelector: () => ({ offsetWidth: 320, offsetHeight: 400 }),
        querySelectorAll: () => [],
        addEventListener: () => {},
        contains: (el) => el === hudElement,
        offsetWidth: 320,
        offsetHeight: 400
    };
    hudApp.element = hudElement;
    actionDisplay.activeApp = hudApp;

    // Simulate another application window
    const sheetElement = {
        style: { zIndex: '100' },
        closest: (sel) => sel.includes('window-app') ? sheetElement : null
    };

    // 1. Initial render of another application -> renderApplication hook elevates sheet
    Hooks.callAll('renderApplication', { element: [sheetElement] }, [sheetElement]);
    assert.equal(sheetElement.style.zIndex, '101', 'Newly opened sheet should have z-index higher than HUD (100 + 1)');

    // 2. Click on the HUD -> elevates HUD above sheet
    hudApp._onFirstRender({}, {});
    hudApp._boundWindowStackPointerDown({
        target: { closest: (sel) => sel.includes('window-app') ? hudElement : null }
    });
    assert.ok(parseInt(hudElement.style.zIndex, 10) > 101, 'HUD z-index should be elevated above sheet on HUD click');

    // 3. Click on the sheet -> elevates sheet above HUD
    const newHudZ = parseInt(hudElement.style.zIndex, 10);
    hudApp._boundWindowStackPointerDown({
        target: { closest: (sel) => sel.includes('window-app') ? sheetElement : null }
    });
    assert.equal(sheetElement.style.zIndex, `${newHudZ + 1}`, 'Sheet z-index should be elevated above HUD on sheet click');

    // Clean up
    actionDisplay.activeApp = null;
});
