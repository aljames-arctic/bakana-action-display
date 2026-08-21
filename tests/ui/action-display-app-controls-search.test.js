import test from 'node:test';
import assert from 'node:assert/strict';
import '../setup.js';
import { ActionDisplayApp } from '../../src/ui/action-display-app.js';
import { actionDisplay } from '../../src/action-display.js';
import { MODULE_ID } from '../../src/constants.js';

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

test('ActionDisplayApp _onToggleFilterResources toggles filterNoResources setting via button', async () => {
    let renderCalled = false;
    const app = new ActionDisplayApp({ actor: { id: 'test-actor' } });
    app.render = () => { renderCalled = true; };

    // Initial state is false
    await game.settings.set(MODULE_ID, 'filterNoResources', false);

    // Toggle on (from button with no target.checked)
    await app._onToggleFilterResources({}, {});
    assert.equal(game.settings.get(MODULE_ID, 'filterNoResources'), true);
    assert.equal(renderCalled, true);

    // Toggle off
    renderCalled = false;
    await app._onToggleFilterResources({}, {});
    assert.equal(game.settings.get(MODULE_ID, 'filterNoResources'), false);
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

test('ActionDisplayApp _prepareContext reflects enableCenterOnToken world config setting', async () => {
    actionDisplay.getActions = async () => [];

    const app = new ActionDisplayApp({ actor: { id: 'test-actor' } });
    app.activePage = 1;
    app._saveTabState = () => {};

    // Default disabled
    await game.settings.set(MODULE_ID, 'enableCenterOnToken', false);
    let context = await app._prepareContext({});
    assert.equal(context.enableCenterOnToken, false);

    // Enabled via world config
    await game.settings.set(MODULE_ID, 'enableCenterOnToken', true);
    context = await app._prepareContext({});
    assert.equal(context.enableCenterOnToken, true);

    // Reset back to false
    await game.settings.set(MODULE_ID, 'enableCenterOnToken', false);
});
