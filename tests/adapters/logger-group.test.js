import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Adapter, BaseSystemAdapter } from '../../src/adapters/index.js';
import { Dnd5eSystemAdapter } from '../../src/adapters/system/dnd5e-system-adapter.js';
import { MODULE_ID } from '../../src/constants.js';
import { log } from '../../src/lib/logger.js';

test('log.group and log.groupEnd respect verbosity levels and encapsulate debug groups', () => {
    const groups = [];
    const origGroup = console.group;
    const origGroupEnd = console.groupEnd;

    console.group = (...args) => groups.push({ type: 'start', args });
    console.groupEnd = () => groups.push({ type: 'end' });

    try {
        // 1. When verbosity is 'warn' (default), 'debug' group is suppressed
        log.setVerbosity('warn');
        log.group('Suppressed debug group', 'debug');
        log.groupEnd();
        assert.equal(groups.length, 0, 'Debug groups should not trigger console.group when verbosity is warn');

        // 2. When verbosity is 'debug', 'debug' group is logged
        log.setVerbosity('debug');
        log.group('Active debug group', 'debug');
        log.groupEnd();
        assert.equal(groups.length, 2, 'Debug group should trigger console.group and console.groupEnd');
        assert.equal(groups[0].type, 'start');
        assert.ok(groups[0].args[0].includes('Active debug group'));
        assert.equal(groups[1].type, 'end');
    } finally {
        console.group = origGroup;
        console.groupEnd = origGroupEnd;
        log.setVerbosity('warn');
    }
});

test('Adapter._extractBaseActions and Adapter.getActions encapsulate extraction and filtering in log.group sections', async () => {
    const groups = [];
    const origGroup = console.group;
    const origGroupEnd = console.groupEnd;

    console.group = (...args) => groups.push({ type: 'start', label: args[0] });
    console.groupEnd = () => groups.push({ type: 'end' });

    log.setVerbosity('debug');

    try {
        const testAdapter = new Adapter();
        testAdapter.system = new BaseSystemAdapter('test');

        const mockActor = {
            name: 'Valeros',
            items: new foundry.utils.Collection([
                { id: 'item-1', name: 'Longsword', type: 'weapon', img: 'icons/sword.png' },
                { id: 'item-2', name: 'Potion', type: 'consumable', img: 'icons/potion.png' }
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

        // Verify that groups were started and ended for base extraction and hidden items processing
        const startLabels = groups.filter(g => g.type === 'start').map(g => g.label);
        assert.ok(startLabels.some(l => l.includes('Adapter._extractBaseActions') && l.includes('Valeros')),
            'Base action extraction should be wrapped in log.group');
        assert.ok(startLabels.some(l => l.includes('Adapter.getActions') && l.includes('hidden items')),
            'Hidden items filtering should be wrapped in log.group');

        const starts = groups.filter(g => g.type === 'start').length;
        const ends = groups.filter(g => g.type === 'end').length;
        assert.equal(starts, ends, 'Every log.group must have a corresponding log.groupEnd');
    } finally {
        console.group = origGroup;
        console.groupEnd = origGroupEnd;
        log.setVerbosity('warn');
    }
});

test('BaseSystemAdapter.modifyActions encapsulates depleted action filtering in log.group section', async () => {
    const groups = [];
    const origGroup = console.group;
    const origGroupEnd = console.groupEnd;

    console.group = (...args) => groups.push({ type: 'start', label: args[0] });
    console.groupEnd = () => groups.push({ type: 'end' });

    log.setVerbosity('debug');

    try {
        const adapter = new BaseSystemAdapter('test-system');
        const actions = [
            { id: '1', name: 'Cantrip', uses: null, originalItem: { type: 'spell' } },
            { id: '2', name: 'Depleted', uses: { available: 0, max: 1 }, originalItem: { type: 'spell' } }
        ];

        await game.settings.set(MODULE_ID, 'showDepleted', false);
        const filtered = await adapter.modifyActions(actions, { name: 'Mage' });
        assert.equal(filtered.length, 1);

        const startLabels = groups.filter(g => g.type === 'start').map(g => g.label);
        assert.ok(startLabels.some(l => l.includes('BaseSystemAdapter.modifyActions') && l.includes('Filtering depleted actions')),
            'Depleted action filtering should be wrapped in log.group');

        const starts = groups.filter(g => g.type === 'start').length;
        const ends = groups.filter(g => g.type === 'end').length;
        assert.equal(starts, ends, 'Every log.group must have a matching log.groupEnd');
    } finally {
        console.group = origGroup;
        console.groupEnd = origGroupEnd;
        log.setVerbosity('warn');
    }
});

test('Dnd5eSystemAdapter.modifyActions encapsulates action processing in log.group section', async () => {
    const groups = [];
    const origGroup = console.group;
    const origGroupEnd = console.groupEnd;

    console.group = (...args) => groups.push({ type: 'start', label: args[0] });
    console.groupEnd = () => groups.push({ type: 'end' });

    log.setVerbosity('debug');

    try {
        const adapter = new Dnd5eSystemAdapter();
        const mockItem = {
            id: 'item-spell-1',
            name: 'Shield',
            type: 'spell',
            img: 'icons/magic/defensive/shield.webp',
            system: {
                level: 1,
                method: 'prepared',
                prepared: true,
                activities: new foundry.utils.Collection([
                    {
                        id: 'act-cast',
                        name: 'Cast',
                        type: 'utility',
                        activation: { type: 'reaction' }
                    }
                ])
            }
        };
        const mockActor = {
            name: 'Wizard',
            isOwner: true,
            items: new foundry.utils.Collection([mockItem]),
            getFlag: () => false
        };

        const actions = [{
            id: 'item-spell-1',
            name: 'Shield',
            originalItem: mockItem
        }];

        await adapter.modifyActions(actions, mockActor);

        const startLabels = groups.filter(g => g.type === 'start').map(g => g.label);
        assert.ok(startLabels.some(l => l.includes('Dnd5eSystemAdapter.modifyActions') && l.includes('Wizard')),
            'D&D 5e action processing should be wrapped in log.group');

        const starts = groups.filter(g => g.type === 'start').length;
        const ends = groups.filter(g => g.type === 'end').length;
        assert.equal(starts, ends, 'Every log.group must have a matching log.groupEnd');
    } finally {
        console.group = origGroup;
        console.groupEnd = origGroupEnd;
        log.setVerbosity('warn');
    }
});
