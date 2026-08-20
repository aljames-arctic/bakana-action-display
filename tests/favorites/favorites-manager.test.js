import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_ID } from '../../src/constants.js';
import {
    getActorFavorites,
    isActorItemFavorite,
    setActorItemFavorite,
    syncActorFavorites
} from '../../src/favorites/favorites-manager.js';

test('getActorFavorites returns empty object if actor or flag missing, or returns flags', () => {
    assert.deepEqual(getActorFavorites(null), {});
    assert.deepEqual(getActorFavorites({}), {});

    const mockActor = {
        getFlag: (moduleId, key) => {
            if (moduleId === MODULE_ID && key === 'favorites') {
                return { 'item-1': true, 'item-2': true };
            }
            return undefined;
        }
    };
    assert.deepEqual(getActorFavorites(mockActor), { 'item-1': true, 'item-2': true });
});

test('isActorItemFavorite checks actor flag map and adapter', () => {
    const flags = { 'item-1': true };
    const itemsMap = new Map([
        ['item-2', { id: 'item-2', name: 'Dagger' }],
        ['item-3', { id: 'item-3', name: 'Shield' }]
    ]);
    const mockActor = {
        getFlag: (moduleId, key) => (moduleId === MODULE_ID && key === 'favorites' ? flags : undefined),
        items: {
            get: (id) => itemsMap.get(id)
        }
    };

    const mockAdapter = {
        hasFavorites: () => true,
        isFavorite: (actor, item) => item.id === 'item-2'
    };

    // Item 1: favorite via actor flag
    assert.equal(isActorItemFavorite(mockActor, { id: 'item-1' }, mockAdapter), true);

    // Item 2: favorite via adapter
    assert.equal(isActorItemFavorite(mockActor, { id: 'item-2' }, mockAdapter), true);

    // Item 3: not favorite
    assert.equal(isActorItemFavorite(mockActor, { id: 'item-3' }, mockAdapter), false);

    // Without adapter supporting favorites
    const noFavAdapter = { hasFavorites: () => false, isFavorite: () => true };
    assert.equal(isActorItemFavorite(mockActor, { id: 'item-2' }, noFavAdapter), false);
});

test('setActorItemFavorite updates adapter and actor flag correctly', async () => {
    let flagState = {};
    let systemFavState = {};

    const mockActor = {
        getFlag: (moduleId, key) => (moduleId === MODULE_ID && key === 'favorites' ? flagState : undefined),
        setFlag: async (moduleId, key, val) => {
            if (moduleId === MODULE_ID && key === 'favorites') flagState = val;
        },
        update: async (data) => {
            for (const [k, v] of Object.entries(data)) {
                if (k.startsWith(`flags.${MODULE_ID}.favorites.-=`)) {
                    const id = k.replace(`flags.${MODULE_ID}.favorites.-=`, '');
                    delete flagState[id];
                }
            }
        }
    };

    const mockAdapter = {
        hasFavorites: () => true,
        setFavorite: async (actor, item, isFav) => {
            systemFavState[item.id] = isFav;
        }
    };

    const item = { id: 'item-1', name: 'Sword' };

    // 1. Add to favorites
    await setActorItemFavorite(mockActor, item, true, mockAdapter);
    assert.equal(flagState['item-1'], true);
    assert.equal(systemFavState['item-1'], true);

    // 2. Remove from favorites
    await setActorItemFavorite(mockActor, item, false, mockAdapter);
    assert.equal(flagState['item-1'], undefined);
    assert.equal(systemFavState['item-1'], false);
});

test('syncActorFavorites synchronizes system favorites into actor flag map', async () => {
    let flagState = { 'item-old': true };
    const items = [
        { id: 'item-1', name: 'Sword' },
        { id: 'item-2', name: 'Bow' }
    ];

    const mockActor = {
        name: 'Hero',
        isOwner: true,
        items: new foundry.utils.Collection(items),
        getFlag: (moduleId, key) => (moduleId === MODULE_ID && key === 'favorites' ? flagState : undefined),
        setFlag: async (moduleId, key, val) => {
            if (moduleId === MODULE_ID && key === 'favorites') flagState = val;
        }
    };

    const mockAdapter = {
        hasFavorites: () => true,
        isFavorite: (actor, item) => item.id === 'item-1' // Only item-1 is system favorite
    };

    await syncActorFavorites(mockActor, mockAdapter);
    // Should have synchronized item-1 to true and removed item-old
    assert.deepEqual(flagState, { 'item-1': true });
});
