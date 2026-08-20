import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { adapter, Adapter, BaseFoundryAdapter, FoundryCurrentAdapter, BaseSystemAdapter } from '../../src/adapters/index.js';
import { initializeFoundryAdapter } from '../../src/adapters/foundry/index.js';
import { initializeSystemAdapter } from '../../src/adapters/system/index.js';
import { initializeModuleAdapters } from '../../src/adapters/module/index.js';
import { MODULE_ID } from '../../src/constants.js';

test('initializeFoundryAdapter returns FoundryCurrentAdapter inheriting BaseFoundryAdapter with dynamic generation', () => {
    // V12
    globalThis.game.release = { generation: 12 };
    globalThis.game.version = '12.331';
    const v12 = initializeFoundryAdapter();
    assert.ok(v12 instanceof FoundryCurrentAdapter);
    assert.ok(v12 instanceof BaseFoundryAdapter);
    assert.equal(v12.generation, 12);

    // V13
    globalThis.game.release = { generation: 13 };
    globalThis.game.version = '13.300';
    const v13 = initializeFoundryAdapter();
    assert.ok(v13 instanceof FoundryCurrentAdapter);
    assert.ok(v13 instanceof BaseFoundryAdapter);
    assert.equal(v13.generation, 13);

    // V14
    globalThis.game.release = { generation: 14 };
    globalThis.game.version = '14.000';
    const v14 = initializeFoundryAdapter();
    assert.ok(v14 instanceof FoundryCurrentAdapter);
    assert.ok(v14 instanceof BaseFoundryAdapter);
    assert.equal(v14.generation, 14);
});

test('initializeSystemAdapter loads matching system adapter or falls back to BaseSystemAdapter', async () => {
    // Known system: dnd5e
    const dnd5e = await initializeSystemAdapter('dnd5e');
    assert.equal(dnd5e.systemId, 'dnd5e');

    // Unknown system fallback
    const unknown = await initializeSystemAdapter('custom-homebrew-rpg');
    assert.ok(unknown instanceof BaseSystemAdapter);
    assert.equal(unknown.systemId, 'custom-homebrew-rpg');

    // Empty system fallback
    const fallback = await initializeSystemAdapter(null);
    assert.ok(fallback instanceof BaseSystemAdapter);
    assert.equal(fallback.systemId, 'unknown');
});

test('initializeModuleAdapters registers active modules from registry', () => {
    globalThis.game.modules = new Map([
        ['midi-qol', { id: 'midi-qol', active: true }]
    ]);

    const activeMods = initializeModuleAdapters();
    assert.equal(activeMods.has('midi-qol'), true);
});

test('Unified Adapter init initializes foundry, system, and module layers', async () => {
    globalThis.game.release = { generation: 12 };
    globalThis.game.version = '12.331';
    globalThis.game.system = { id: 'dnd5e' };
    globalThis.game.modules = new Map([
        ['midi-qol', { id: 'midi-qol', active: false }]
    ]);

    const testAdapter = new Adapter();
    await testAdapter.init();

    assert.ok(testAdapter.foundry instanceof FoundryCurrentAdapter);
    assert.ok(testAdapter.foundry instanceof BaseFoundryAdapter);
    assert.equal(testAdapter.foundry.generation, 12);
    assert.equal(testAdapter.system.systemId, 'dnd5e');
    assert.equal(testAdapter.modules.size, 0);
});

test('Unified Adapter getActions executes base extraction -> system -> module -> hidden pipeline', async () => {
    const testAdapter = new Adapter();
    testAdapter.system = new BaseSystemAdapter('test');

    const mockActor = {
        name: 'Hero',
        items: [
            { id: 'item-1', name: 'Longsword', type: 'weapon', img: 'icons/sword.png' },
            { id: 'item-2', name: 'Shield', type: 'equipment', img: 'icons/shield.png' }
        ],
        getFlag: (mod, key) => {
            if (mod === MODULE_ID && key === 'hiddenItems') {
                return { 'item-2': true };
            }
            return undefined;
        }
    };

    const actions = await testAdapter.getActions(mockActor);
    assert.equal(actions.length, 2);

    const swordAction = actions.find(a => a.id === 'item-1');
    const shieldAction = actions.find(a => a.id === 'item-2');

    assert.ok(swordAction);
    assert.equal(swordAction.isHidden, false);

    assert.ok(shieldAction);
    assert.equal(shieldAction.isHidden, true);
    assert.deepEqual(shieldAction.left, ['hidden']);
});

test('Unified Adapter delegates facade methods to layers', () => {
    const testAdapter = new Adapter();
    assert.ok(Array.isArray(testAdapter.getDefaultActiveLeftSubTypes()));
    assert.ok(Array.isArray(testAdapter.getDefaultActiveSubTypes()));
    assert.equal(testAdapter.isExclusionTab('unknown'), false);
    assert.equal(testAdapter.getItemTypeLabel('weapon'), 'WEAPON');
});
