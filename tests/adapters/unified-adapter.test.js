import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { adapter, Adapter, BaseFoundryAdapter, FoundryVTTV12Adapter, FoundryVTTV14Adapter, FoundryCurrentAdapter, BaseSystemAdapter } from '../../src/adapters/index.js';
import { initializeFoundryAdapter } from '../../src/adapters/foundry/index.js';
import { initializeSystemAdapter } from '../../src/adapters/system/index.js';
import { initializeModuleAdapters } from '../../src/adapters/module/index.js';
import { MODULE_ID } from '../../src/constants.js';
import { log } from '../../src/lib/logger.js';

test('initializeFoundryAdapter returns FoundryVTTV12Adapter or FoundryVTTV14Adapter based on release generation', () => {
    // V12
    game.release = { generation: 12 };
    game.version = '12.331';
    const v12 = initializeFoundryAdapter();
    assert.ok(v12 instanceof FoundryVTTV12Adapter);
    assert.ok(v12 instanceof BaseFoundryAdapter);
    assert.equal(v12.generation, 12);

    // V13
    game.release = { generation: 13 };
    game.version = '13.300';
    const v13 = initializeFoundryAdapter();
    assert.ok(v13 instanceof FoundryVTTV12Adapter);
    assert.ok(v13 instanceof BaseFoundryAdapter);
    assert.equal(v13.generation, 13);

    // V14
    game.release = { generation: 14 };
    game.version = '14.000';
    const v14 = initializeFoundryAdapter();
    assert.ok(v14 instanceof FoundryVTTV14Adapter);
    assert.ok(v14 instanceof BaseFoundryAdapter);
    assert.equal(v14.generation, 14);
});

test('FoundryVTTV12Adapter and FoundryVTTV14Adapter getCombatantByToken and getCombatantsByToken contracts', () => {
    const mockCombatant = { id: 'c1', tokenId: 't1' };

    // V12 Adapter uses Combat#getCombatantByToken
    const v12 = new FoundryVTTV12Adapter();
    const mockCombatV12 = {
        getCombatantByToken: (id) => id === 't1' ? mockCombatant : null
    };
    assert.equal(v12.getCombatantByToken(mockCombatV12, 't1'), mockCombatant);
    assert.deepEqual(v12.getCombatantsByToken(mockCombatV12, 't1'), [mockCombatant]);
    assert.equal(v12.getCombatantByToken(mockCombatV12, { id: 't1' }), mockCombatant);

    // V14 Adapter uses Combat#getCombatantsByToken
    const v14 = new FoundryVTTV14Adapter();
    const mockCombatV14 = {
        getCombatantsByToken: (id) => id === 't1' ? [mockCombatant] : []
    };
    assert.equal(v14.getCombatantByToken(mockCombatV14, 't1'), mockCombatant);
    assert.deepEqual(v14.getCombatantsByToken(mockCombatV14, 't1'), [mockCombatant]);
    assert.equal(v14.getCombatantByToken(mockCombatV14, { id: 't1' }), mockCombatant);
});

test('initializeSystemAdapter loads matching system adapter or falls back to BaseSystemAdapter with isSupported flag', async () => {
    // Known system: dnd5e
    const dnd5e = await initializeSystemAdapter('dnd5e');
    assert.equal(dnd5e.systemId, 'dnd5e');
    assert.equal(dnd5e.isSupported, true);

    // Known system: pf1
    const pf1 = await initializeSystemAdapter('pf1');
    assert.equal(pf1.systemId, 'pf1');
    assert.equal(pf1.isSupported, true);

    // Known system: pf2e
    const pf2e = await initializeSystemAdapter('pf2e');
    assert.equal(pf2e.systemId, 'pf2e');
    assert.equal(pf2e.isSupported, true);

    // Unknown/unsupported system fallback (e.g. tormenta20)
    const logs = [];
    const origLog = console.log;
    const origWarn = console.warn;
    log.setVerbosity('debug');
    console.log = (...args) => logs.push(args.join(' '));
    console.warn = (...args) => logs.push(args.join(' '));
    try {
        const tormenta = await initializeSystemAdapter('tormenta20');
        assert.ok(tormenta instanceof BaseSystemAdapter);
        assert.equal(tormenta.systemId, 'tormenta20');
        assert.equal(tormenta.isSupported, false);
        assert.ok(logs.some(l => l.includes('tormenta20') && l.includes('not currently supported') && l.includes('github.com')));
    } finally {
        console.log = origLog;
        console.warn = origWarn;
        log.setVerbosity('warn');
    }

    // Empty system fallback
    const fallback = await initializeSystemAdapter(null);
    assert.ok(fallback instanceof BaseSystemAdapter);
    assert.equal(fallback.systemId, 'unknown');
    assert.equal(fallback.isSupported, false);
});

test('initializeModuleAdapters registers active modules from registry', () => {
    game.modules = new Map([
        ['midi-qol', { id: 'midi-qol', active: true }]
    ]);

    const activeMods = initializeModuleAdapters();
    assert.equal(activeMods.has('midi-qol'), true);
});

test('Unified Adapter init initializes and formats system label correctly for supported and unsupported systems', async () => {
    game.release = { generation: 12 };
    game.version = '12.331';
    game.modules = new Map();

    const logs = [];
    const origLog = console.log;
    log.setVerbosity('info');
    console.log = (...args) => logs.push(args.join(' '));

    try {
        // Supported system
        game.system = { id: 'dnd5e' };
        const supportedAdapter = new Adapter();
        await supportedAdapter.init();
        assert.ok(supportedAdapter.foundry instanceof FoundryCurrentAdapter);
        assert.ok(supportedAdapter.foundry instanceof BaseFoundryAdapter);
        assert.equal(supportedAdapter.foundry.generation, 12);
        assert.equal(supportedAdapter.system.systemId, 'dnd5e');
        assert.equal(supportedAdapter.system.isSupported, true);
        assert.equal(supportedAdapter.modules.size, 0);
        assert.ok(logs.some(l => l.includes('Unified Adapter initialized [Foundry: v12, System: dnd5e, Modules: 0]')));

        logs.length = 0;

        // Unsupported system: tormenta20
        game.release = { generation: 13 };
        game.system = { id: 'tormenta20' };
        const unsupportedAdapter = new Adapter();
        await unsupportedAdapter.init();
        assert.equal(unsupportedAdapter.system.systemId, 'tormenta20');
        assert.equal(unsupportedAdapter.system.isSupported, false);
        assert.ok(logs.some(l => l.includes('Unified Adapter initialized [Foundry: v13, System: tormenta20 (unsupported), Modules: 0]')));
    } finally {
        console.log = origLog;
        log.setVerbosity('warn');
    }
});

test('Unified Adapter getActions executes base extraction -> system -> module -> hidden pipeline', async () => {
    const testAdapter = new Adapter();
    testAdapter.system = new BaseSystemAdapter('test');

    const mockActor = {
        name: 'Hero',
        items: new foundry.utils.Collection([
            { id: 'item-1', name: 'Longsword', type: 'weapon', img: 'icons/sword.png' },
            { id: 'item-2', name: 'Shield', type: 'equipment', img: 'icons/shield.png' }
        ]),
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
    assert.deepEqual(swordAction.left, ['weapon']);

    assert.ok(shieldAction);
    assert.equal(shieldAction.isHidden, true);
    assert.deepEqual(shieldAction.left, ['hidden']);
});

test('Unified Adapter delegates facade methods to layers', () => {
    const testAdapter = new Adapter();
    assert.ok(Array.isArray(testAdapter.getDefaultActiveLeftSubTypes()));
    assert.ok(Array.isArray(testAdapter.getDefaultActiveSubTypes()));
    assert.equal(testAdapter.isExclusionTab('unknown'), false);
    assert.equal(testAdapter.getItemTypeLabel('weapon'), 'Weapon');
});
