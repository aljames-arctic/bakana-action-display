import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { adapter, Adapter, BaseFoundryAdapter, FoundryCurrentAdapter, BaseSystemAdapter } from '../../src/adapters/index.js';
import { initializeFoundryAdapter } from '../../src/adapters/foundry/index.js';
import { initializeSystemAdapter } from '../../src/adapters/system/index.js';
import { initializeModuleAdapters } from '../../src/adapters/module/index.js';
import { MODULE_ID } from '../../src/constants.js';
import { log } from '../../src/lib/logger.js';

test('initializeFoundryAdapter returns BaseFoundryAdapter on v12 baseline and FoundryCurrentAdapter on v13+', () => {
    // V12 baseline
    game.release = { generation: 12 };
    game.version = '12.331';
    const v12 = initializeFoundryAdapter();
    assert.ok(v12 instanceof BaseFoundryAdapter);
    assert.equal(v12.generation, 12);

    // V13 modern
    game.release = { generation: 13 };
    game.version = '13.300';
    const v13 = initializeFoundryAdapter();
    assert.ok(v13 instanceof FoundryCurrentAdapter);
    assert.ok(v13 instanceof BaseFoundryAdapter);
    assert.equal(v13.generation, 13);

    // V14 modern
    game.release = { generation: 14 };
    game.version = '14.000';
    const v14 = initializeFoundryAdapter();
    assert.ok(v14 instanceof FoundryCurrentAdapter);
    assert.ok(v14 instanceof BaseFoundryAdapter);
    assert.equal(v14.generation, 14);
});

test('BaseFoundryAdapter and FoundryCurrentAdapter getCombatantByToken and getCombatantsByToken contracts', () => {
    const mockCombatant = { id: 'c1', tokenId: 't1' };

    // BaseFoundryAdapter (v12 baseline) uses Combat#getCombatantByToken
    const v12 = new BaseFoundryAdapter();
    const mockCombatV12 = {
        getCombatantByToken: (id) => id === 't1' ? mockCombatant : null
    };
    assert.equal(v12.getCombatantByToken(mockCombatV12, 't1'), mockCombatant);
    assert.deepEqual(v12.getCombatantsByToken(mockCombatV12, 't1'), [mockCombatant]);
    assert.equal(v12.getCombatantByToken(mockCombatV12, { id: 't1' }), mockCombatant);

    // FoundryCurrentAdapter (v14 modern) uses Combat#getCombatantsByToken
    const v14 = new FoundryCurrentAdapter();
    const mockCombatV14 = {
        getCombatantsByToken: (id) => id === 't1' ? [mockCombatant] : []
    };
    assert.equal(v14.getCombatantByToken(mockCombatV14, 't1'), mockCombatant);
    assert.deepEqual(v14.getCombatantsByToken(mockCombatV14, 't1'), [mockCombatant]);
    assert.equal(v14.getCombatantByToken(mockCombatV14, { id: 't1' }), mockCombatant);
});

test('BaseFoundryAdapter (v12) and FoundryCurrentAdapter (v14+) constructor getters contract', () => {
    // 1. BaseFoundryAdapter (v12 baseline) resolves globals even when foundry.applications.ux is undefined
    const v12 = new BaseFoundryAdapter();
    assert.equal(v12.ContextMenu, globalThis.ContextMenu);
    assert.equal(v12.KeyboardManager, globalThis.KeyboardManager);
    assert.equal(v12.Token, globalThis.Token);
    assert.equal(v12.ApplicationV2, globalThis.foundry.applications.api.ApplicationV2);
    assert.equal(v12.HandlebarsApplicationMixin, globalThis.foundry.applications.api.HandlebarsApplicationMixin);
    assert.equal(v12.FilePicker, globalThis.FilePicker);
    assert.equal(v12.TextEditor, globalThis.TextEditor);

    // 2. FoundryCurrentAdapter (v14 modern) resolves modern namespaced constructors
    const v14 = new FoundryCurrentAdapter();
    assert.equal(v14.ContextMenu, globalThis.foundry.applications.ux.ContextMenu);
    assert.equal(v14.KeyboardManager, globalThis.foundry.helpers.interaction.KeyboardManager);
    assert.equal(v14.Token, globalThis.foundry.canvas.placeables.Token);
    assert.equal(v14.ApplicationV2, globalThis.foundry.applications.api.ApplicationV2);
    assert.equal(v14.HandlebarsApplicationMixin, globalThis.foundry.applications.api.HandlebarsApplicationMixin);
    assert.equal(v14.FilePicker, globalThis.foundry.applications.apps.FilePicker.implementation);
    assert.equal(v14.TextEditor, globalThis.foundry.applications.ux.TextEditor.implementation);
});

test('isNewerVersion contract across BaseFoundryAdapter and BaseSystemAdapter', () => {
    const foundry = new BaseFoundryAdapter();
    const system = new BaseSystemAdapter('pf1', true, foundry);

    assert.equal(foundry.isNewerVersion('12.0.0', '11.0.0'), true);
    assert.equal(foundry.isNewerVersion('11.0.0', '12.0.0'), false);
    assert.equal(foundry.isNewerVersion('11.0.0', '11.0.0'), false);

    assert.equal(system.isNewerVersion('12.0.0', '11.0.0'), true);
    assert.equal(system.isNewerVersion('11.0.0', '12.0.0'), false);
});

test('fromUuid and fromUuidSync resolve cleanly across FoundryAdapter, SystemAdapter, and UnifiedAdapter', async () => {
    const mockDoc = { id: 'doc1', uuid: 'Item.123' };
    const origFromUuidSync = globalThis.foundry.utils.fromUuidSync;
    const origFromUuid = globalThis.foundry.utils.fromUuid;

    globalThis.foundry.utils.fromUuidSync = (uuid) => uuid === 'Item.123' ? mockDoc : null;
    globalThis.foundry.utils.fromUuid = async (uuid) => uuid === 'Item.123' ? mockDoc : null;

    try {
        const foundryAdapter = new BaseFoundryAdapter();
        assert.equal(foundryAdapter.fromUuidSync('Item.123'), mockDoc);
        assert.equal(foundryAdapter.fromUuidSync('Item.none'), null);
        assert.equal(await foundryAdapter.fromUuid('Item.123'), mockDoc);

        const systemAdapter = new BaseSystemAdapter('dnd5e', true, foundryAdapter);
        assert.equal(systemAdapter.fromUuidSync('Item.123'), mockDoc);
        assert.equal(await systemAdapter.fromUuid('Item.123'), mockDoc);

        const unified = new Adapter();
        unified.foundry = foundryAdapter;
        assert.equal(unified.fromUuidSync('Item.123'), mockDoc);
        assert.equal(await unified.fromUuid('Item.123'), mockDoc);
    } finally {
        globalThis.foundry.utils.fromUuidSync = origFromUuidSync;
        globalThis.foundry.utils.fromUuid = origFromUuid;
    }
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

test('Unified Adapter delegates facade methods to layers', async () => {
    const testAdapter = new Adapter();
    await testAdapter.init();
    assert.ok(Array.isArray(testAdapter.getDefaultActiveLeftSubTypes()));
    assert.ok(Array.isArray(testAdapter.getDefaultActiveSubTypes()));
    assert.equal(testAdapter.isExclusionTab('unknown'), false);
    assert.equal(testAdapter.getItemTypeLabel('weapon'), 'Weapon');
});
