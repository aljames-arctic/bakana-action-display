import test from 'node:test';
import assert from 'node:assert/strict';
import '../setup.js';
import { MidiQolModuleAdapter } from '../../src/adapters/module/midi-qol-module-adapter.js';
import { initializeModuleAdapters, hasActiveModuleAdapters } from '../../src/adapters/module/index.js';
import { ModuleIntegrationsConfigApp } from '../../src/ui/module-integrations-config-app.js';
import { MODULE_ID } from '../../src/constants.js';
import { TabRef } from '../../src/ui/tab-ref.js';

test('hasActiveModuleAdapters returns true only when supported modules are active', () => {
    // No modules active
    game.modules = new Map([
        ['some-other-mod', { id: 'some-other-mod', active: true }],
        ['midi-qol', { id: 'midi-qol', active: false }]
    ]);
    assert.equal(hasActiveModuleAdapters(), false);

    // Midi-QOL active
    game.modules = new Map([
        ['midi-qol', { id: 'midi-qol', active: true }]
    ]);
    assert.equal(hasActiveModuleAdapters(), true);
});

test('MidiQolModuleAdapter filters automationOnly items when midiQolFilterAutomationOnly is true', async () => {
    game.settings.set(MODULE_ID, 'midiQolFilterAutomationOnly', true);

    const adapter = new MidiQolModuleAdapter();

    const normalActivity = {
        id: 'act-1',
        name: 'Cast Spell',
        right: [TabRef.from('economy', 'standard', 'action')],
        originalActivity: { midiProperties: { automationOnly: false } }
    };

    const autoActivity = {
        id: 'act-2',
        name: 'Auto Trigger',
        right: [TabRef.from('economy', 'special', 'other')],
        originalActivity: { midiProperties: { automationOnly: true } }
    };

    const actions = [
        {
            id: 'item-1',
            name: 'Mixed Item',
            subactions: [normalActivity, autoActivity],
            right: [TabRef.from('economy', 'standard', 'action'), TabRef.from('economy', 'special', 'other')]
        },
        {
            id: 'item-2',
            name: 'Pure Automation Item',
            subactions: [autoActivity],
            right: [TabRef.from('economy', 'special', 'other')]
        }
    ];

    const result = await adapter.modifyActions(actions);

    // item-2 should be completely filtered out
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'item-1');
    // item-1 should have autoActivity removed from subactions
    assert.equal(result[0].subactions.length, 1);
    assert.equal(result[0].subactions[0].id, 'act-1');
});

test('MidiQolModuleAdapter preserves automationOnly items when midiQolFilterAutomationOnly is false', async () => {
    game.settings.set(MODULE_ID, 'midiQolFilterAutomationOnly', false);

    const adapter = new MidiQolModuleAdapter();

    const autoActivity = {
        id: 'act-2',
        name: 'Auto Trigger',
        right: [TabRef.from('economy', 'special', 'other')],
        originalActivity: { midiProperties: { automationOnly: true } }
    };

    const actions = [
        {
            id: 'item-2',
            name: 'Pure Automation Item',
            subactions: [autoActivity],
            right: [TabRef.from('economy', 'special', 'other')]
        }
    ];

    const result = await adapter.modifyActions(actions);

    // When setting is disabled, items should NOT be filtered out
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'item-2');
    assert.equal(result[0].subactions.length, 1);
});

test('ModuleIntegrationsConfigApp initializes with stored setting and prepares context', async () => {
    game.settings.set(MODULE_ID, 'midiQolFilterAutomationOnly', true);
    game.modules = new Map([
        ['midi-qol', { id: 'midi-qol', active: true }]
    ]);

    const app = new ModuleIntegrationsConfigApp();
    assert.equal(app.midiQolFilterAutomationOnly, true);

    const context = await app._prepareContext({});
    assert.equal(context.hasActiveModules, true);
    assert.equal(context.modules.midiQol.active, true);
    assert.equal(context.modules.midiQol.filterAutomationOnly, true);
});

test('ModuleIntegrationsConfigApp _onSaveConfig persists settings and closes', async () => {
    game.settings.set(MODULE_ID, 'midiQolFilterAutomationOnly', true);
    game.modules = new Map([
        ['midi-qol', { id: 'midi-qol', active: true }]
    ]);

    const app = new ModuleIntegrationsConfigApp();
    let closed = false;
    app.close = () => { closed = true; };

    // Mock form element with unchecked checkbox
    const mockCheckbox = { name: 'midiQolFilterAutomationOnly', checked: false };
    app.element = {
        querySelector: (sel) => {
            if (sel.includes('midiQolFilterAutomationOnly')) return mockCheckbox;
            return null;
        }
    };

    await app._onSaveConfig({ preventDefault: () => {} }, {});

    assert.equal(closed, true);
    assert.equal(app.midiQolFilterAutomationOnly, false);
    assert.equal(game.settings.get(MODULE_ID, 'midiQolFilterAutomationOnly'), false);
});
