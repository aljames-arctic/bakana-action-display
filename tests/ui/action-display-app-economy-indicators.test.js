import test from 'node:test';
import assert from 'node:assert/strict';
import '../setup.js';
import { MODULE_ID } from '../../src/constants.js';
import { BaseSystemAdapter } from '../../src/adapters/system/base-system-adapter.js';
import { Dnd5eSystemAdapter } from '../../src/adapters/system/dnd5e-system-adapter.js';
import { Pf1SystemAdapter } from '../../src/adapters/system/pf1-system-adapter.js';
import { Pf2eSystemAdapter } from '../../src/adapters/system/pf2e-system-adapter.js';
import { adapter } from '../../src/adapters/index.js';
import { TabRef } from '../../src/ui/tab-ref.js';
import { ActionDisplayApp } from '../../src/ui/action-display-app.js';
import { EconomyColorsConfigApp } from '../../src/ui/economy-colors-config-app.js';

test('BaseSystemAdapter provides default economy types, colors, and grey fallback for undefined', () => {
    const baseAdapter = new BaseSystemAdapter();
    const types = baseAdapter.getEconomyTypes();
    assert.ok(Array.isArray(types));
    assert.ok(types.some(t => t.id === 'action' && t.defaultColor === '#3b82f6'));
    assert.ok(types.some(t => t.id === 'bonus' && t.defaultColor === '#14b8a6'));
    assert.ok(types.some(t => t.id === 'reaction' && t.defaultColor === '#ef4444'));

    // Default colors
    assert.equal(baseAdapter.getEconomyColor('action'), '#3b82f6');
    assert.equal(baseAdapter.getEconomyColor('bonus'), '#14b8a6');
    assert.equal(baseAdapter.getEconomyColor('reaction'), '#ef4444');
    
    // User color overrides
    assert.equal(baseAdapter.getEconomyColor('action', { action: '#ff00ff' }), '#ff00ff');

    // Unmapped/undefined types fallback to other / grey
    assert.equal(baseAdapter.getEconomyColor('unknown_type'), '#64748b');
    assert.equal(baseAdapter.getEconomyColor('unknown_type', { other: '#333333' }), '#333333');

    // 'none' or 'all' return null (no indicator)
    assert.equal(baseAdapter.getEconomyColor('none'), null);
    assert.equal(baseAdapter.getEconomyColor('all'), null);
    assert.equal(baseAdapter.getEconomyColor(null), null);
});

test('Dnd5eSystemAdapter provides system-specific action economy types including lair and legendary', () => {
    const dndAdapter = new Dnd5eSystemAdapter();
    const types = dndAdapter.getEconomyTypes();

    const action = types.find(t => t.id === 'action');
    const bonus = types.find(t => t.id === 'bonus');
    const reaction = types.find(t => t.id === 'reaction');
    const legendary = types.find(t => t.id === 'legendary');
    const lair = types.find(t => t.id === 'lair');

    assert.ok(action, 'Should include action');
    assert.equal(action.defaultColor, '#3b82f6', 'Action should be blue');

    assert.ok(bonus, 'Should include bonus action');
    assert.equal(bonus.defaultColor, '#14b8a6', 'Bonus action should be teal');

    assert.ok(reaction, 'Should include reaction');
    assert.equal(reaction.defaultColor, '#ef4444', 'Reaction should be red');

    assert.ok(legendary, 'Should include legendary action');
    assert.equal(legendary.defaultColor, '#18181b', 'Legendary action should be black');

    assert.ok(lair, 'Should include lair action');
    assert.equal(lair.defaultColor, '#eab308', 'Lair action should be gold');
});

test('extractEconomyIndicators returns fixed-column slots with active indicators for single and multi-activity actions', () => {
    const dndAdapter = new Dnd5eSystemAdapter();

    // 1. Single action item (e.g. standard action)
    const singleAction = {
        name: 'Longsword',
        right: [TabRef.from('economy', 'action')]
    };
    const indicators1 = dndAdapter.extractEconomyIndicators(singleAction);
    assert.ok(indicators1.length >= 5, 'Should return full fixed-slot array for all economy types');
    const actSlot1 = indicators1.find(i => i.type === 'action');
    const bonusSlot1 = indicators1.find(i => i.type === 'bonus');
    assert.equal(actSlot1?.active, true);
    assert.equal(actSlot1?.color, '#3b82f6');
    assert.equal(bonusSlot1?.active, false);
    assert.equal(bonusSlot1?.color, null);

    // 2. Multi-activity item with differing economy types (Action + Bonus Action + Reaction)
    const multiAction = {
        name: 'Flexible Spell',
        subactions: [
            { name: 'Standard Cast', right: [TabRef.from('economy', 'action')] },
            { name: 'Quick Cast', right: [TabRef.from('economy', 'bonus')] },
            { name: 'Counter Strike', right: [TabRef.from('economy', 'reaction')] },
            { name: 'Standard Cast 2', right: [TabRef.from('economy', 'action')] } // duplicate type
        ]
    };
    const indicators2 = dndAdapter.extractEconomyIndicators(multiAction);
    const actSlot2 = indicators2.find(i => i.type === 'action');
    const bonusSlot2 = indicators2.find(i => i.type === 'bonus');
    const reactSlot2 = indicators2.find(i => i.type === 'reaction');
    const legendSlot2 = indicators2.find(i => i.type === 'legendary');

    assert.equal(actSlot2?.active, true);
    assert.equal(bonusSlot2?.active, true);
    assert.equal(reactSlot2?.active, true);
    assert.equal(legendSlot2?.active, false);
    assert.equal(actSlot2?.color, '#3b82f6');
    assert.equal(bonusSlot2?.color, '#14b8a6');
    assert.equal(reactSlot2?.color, '#ef4444');

    // 3. Passive item with economy: 'none'
    const passiveItem = {
        name: 'Shield of Faith (Passive)',
        right: [TabRef.from('economy', 'none')]
    };
    const indicators3 = dndAdapter.extractEconomyIndicators(passiveItem);
    assert.ok(indicators3.every(i => i.active === false), 'Passive items should have all inactive slots');
});

test('extractEconomyIndicators maintains exact horizontal column order of economy types', () => {
    const dndAdapter = new Dnd5eSystemAdapter();

    // Item with Bonus Action and Action defined in reverse order
    const reverseOrderAction = {
        name: 'Quick Weapon',
        subactions: [
            { name: 'Quick Slash', right: [TabRef.from('economy', 'bonus')] },
            { name: 'Standard Slash', right: [TabRef.from('economy', 'action')] }
        ]
    };
    const indicators = dndAdapter.extractEconomyIndicators(reverseOrderAction);
    const actIndex = indicators.findIndex(i => i.type === 'action');
    const bonusIndex = indicators.findIndex(i => i.type === 'bonus');
    const reactIndex = indicators.findIndex(i => i.type === 'reaction');

    // Action (slot 0/column 1) must be before Bonus Action (slot 1/column 2) which is before Reaction
    assert.ok(actIndex < bonusIndex, 'Action column must precede Bonus Action column');
    assert.ok(bonusIndex < reactIndex, 'Bonus Action column must precede Reaction column');
});

test('ActionDisplayApp _prepareContext extracts economy indicators when enabled and suppresses when disabled', async () => {
    const mockToken = {
        id: 'token-1',
        name: 'Hero',
        actor: {
            id: 'actor-1',
            name: 'Hero',
            uuid: 'Actor.actor-1',
            isOwner: true,
            getFlag: () => ({})
        }
    };
    const app = new ActionDisplayApp(mockToken);
    app.activeTab = 'all';

    const mockActions = [
        {
            id: 'act-1',
            name: 'Sword Slash',
            available: true,
            left: [TabRef.from('item_type', 'weapon')],
            right: [TabRef.from('economy', 'action')]
        },
        {
            id: 'act-2',
            name: 'Misty Step',
            available: true,
            left: [TabRef.from('item_type', 'spell')],
            right: [TabRef.from('economy', 'bonus')]
        }
    ];

    // Mock getActions
    const origGetActions = adapter.getActions;
    adapter.getActions = async () => mockActions;

    try {
        // 1. When enableEconomyIndicators is true
        game.settings.set(MODULE_ID, 'enableEconomyIndicators', true);
        game.settings.set(MODULE_ID, 'economyColors', { action: '#0000ff' });

        const contextEnabled = await app._prepareContext({});
        assert.equal(contextEnabled.showEconomyIndicators, true);
        assert.ok(contextEnabled.items[0].economyIndicators.length > 0);
        const item1Action = contextEnabled.items[0].economyIndicators.find(i => i.type === 'action');
        const item1Bonus = contextEnabled.items[0].economyIndicators.find(i => i.type === 'bonus');
        assert.equal(item1Action?.active, true);
        assert.equal(item1Action?.color, '#0000ff');
        assert.equal(item1Bonus?.active, false);

        const item2Action = contextEnabled.items[1].economyIndicators.find(i => i.type === 'action');
        const item2Bonus = contextEnabled.items[1].economyIndicators.find(i => i.type === 'bonus');
        assert.equal(item2Action?.active, false);
        assert.equal(item2Bonus?.active, true);
        assert.equal(item2Bonus?.color, '#14b8a6');

        // 2. When enableEconomyIndicators is false
        game.settings.set(MODULE_ID, 'enableEconomyIndicators', false);
        const contextDisabled = await app._prepareContext({});
        assert.equal(contextDisabled.showEconomyIndicators, false);
        assert.equal(contextDisabled.items[0].economyIndicators.length, 0);
        assert.equal(contextDisabled.items[1].economyIndicators.length, 0);
    } finally {
        adapter.getActions = origGetActions;
        game.settings.set(MODULE_ID, 'enableEconomyIndicators', false);
    }
});

test('EconomyColorsConfigApp prepares economy context, saves colors, selects presets, and resets defaults', async () => {
    game.settings.set(MODULE_ID, 'economyColors', { action: '#123456' });

    const configApp = new EconomyColorsConfigApp();
    const context = await configApp._prepareContext({});

    assert.ok(Array.isArray(context.economyTypes));
    const actionType = context.economyTypes.find(t => t.id === 'action');
    assert.ok(actionType);
    assert.equal(actionType.color, '#123456');

    assert.ok(Array.isArray(context.presets));
    assert.ok(context.presets.some(p => p.id === 'protanopia'));
    assert.ok(context.presets.some(p => p.id === 'tritanopia'));

    // Test select preset (e.g. protanopia)
    let rendered = false;
    configApp.render = () => { rendered = true; };
    configApp.applyPreset('protanopia');
    assert.equal(configApp.selectedPreset, 'protanopia');
    assert.equal(configApp.colors.action, '#0072b2');
    assert.equal(configApp.colors.reaction, '#d55e00');
    assert.equal(rendered, true);

    // Test save
    configApp.colors = { action: '#abcdef', bonus: '#654321' };
    let closed = false;
    configApp.close = async () => { closed = true; };
    await configApp._onSaveConfig({ preventDefault() {} });

    assert.equal(game.settings.get(MODULE_ID, 'economyColors').action, '#abcdef');
    assert.equal(game.settings.get(MODULE_ID, 'economyColors').bonus, '#654321');
    assert.equal(closed, true);

    // Test reset defaults
    rendered = false;
    await configApp._onResetDefaults({ preventDefault() {} });
    assert.deepEqual(configApp.colors, {});
    assert.equal(configApp.selectedPreset, '');
    assert.equal(rendered, true);
});
