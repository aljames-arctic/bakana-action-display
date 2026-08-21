import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Dnd5eSystemAdapter } from '../../src/adapters/system/dnd5e-system-adapter.js';
import { Action } from '../../src/ui/action.js';
import { TabRef } from '../../src/ui/tab-ref.js';
import { ActionDisplayApp } from '../../src/ui/action-display-app.js';
import { actionDisplay } from '../../src/action-display.js';

test('Dnd5eSystemAdapter maps activities to nested Action Economy categories', async () => {
    const adapter = new Dnd5eSystemAdapter();

    const createItemWithActivities = (id, name, activations) => ({
        id,
        name,
        type: 'feat',
        system: {
            equipped: true,
            activities: activations.map((actType, index) => ({
                id: `act-${id}-${index}`,
                name: `${name} ${actType}`,
                type: 'utility',
                activation: { type: actType }
            }))
        }
    });

    const items = [
        createItemWithActivities('item-std', 'Standard Item', ['action', 'bonus', 'reaction']),
        createItemWithActivities('item-time', 'Time Item', ['minute', 'hour', 'day']),
        createItemWithActivities('item-rest', 'Rest Item', ['shortRest', 'longRest', 'short', 'long']),
        createItemWithActivities('item-combat', 'Combat Item', ['encounter', 'turnStart', 'turnEnd']),
        createItemWithActivities('item-monster', 'Monster Item', ['legendary', 'mythic', 'lair']),
        createItemWithActivities('item-vehicle', 'Vehicle Item', ['crew']),
        createItemWithActivities('item-special', 'Special Item', ['special'])
    ];

    const actor = {
        items: new foundry.utils.Collection(items),
        system: { spells: {}, skills: {} }
    };

    const rawActions = items.map(item => ({ id: `act-${item.id}-0`, originalItem: item }));
    const modified = await adapter.modifyActions(rawActions, actor);

    // 1. Standard: action, bonus, reaction
    const stdAction = modified.find(a => a.name === 'Standard Item');
    assert.ok(stdAction);
    assert.deepEqual(stdAction.right.map(t => t.path), [
        'economy/standard/action',
        'economy/standard/bonus',
        'economy/standard/reaction'
    ]);

    // 2. Time: minute, hour, day
    const timeAction = modified.find(a => a.name === 'Time Item');
    assert.ok(timeAction);
    assert.deepEqual(timeAction.right.map(t => t.path), [
        'economy/time/minute',
        'economy/time/hour',
        'economy/time/day'
    ]);

    // 3. Rest: shortRest (and alias short), longRest (and alias long)
    const restAction = modified.find(a => a.name === 'Rest Item');
    assert.ok(restAction);
    assert.deepEqual(restAction.right.map(t => t.path), [
        'economy/rest/shortRest',
        'economy/rest/longRest'
    ]);

    // 4. Combat: encounter, turnStart, turnEnd
    const combatAction = modified.find(a => a.name === 'Combat Item');
    assert.ok(combatAction);
    assert.deepEqual(combatAction.right.map(t => t.path), [
        'economy/combat/encounter',
        'economy/combat/turnStart',
        'economy/combat/turnEnd'
    ]);

    // 5. Monster: legendary, mythic, lair
    const monsterAction = modified.find(a => a.name === 'Monster Item');
    assert.ok(monsterAction);
    assert.deepEqual(monsterAction.right.map(t => t.path), [
        'economy/monster/legendary',
        'economy/monster/mythic',
        'economy/monster/lair'
    ]);

    // 6. Vehicle: crew
    const vehicleAction = modified.find(a => a.name === 'Vehicle Item');
    assert.ok(vehicleAction);
    assert.deepEqual(vehicleAction.right.map(t => t.path), [
        'economy/vehicle/crew'
    ]);

    // 7. Special: nested directly under Action Economy
    const specialAction = modified.find(a => a.name === 'Special Item');
    assert.ok(specialAction);
    assert.deepEqual(specialAction.right.map(t => t.path), [
        'economy/special'
    ]);
});

test('Dnd5eSystemAdapter localizations for right-side action economy tabs', () => {
    const origLocalize = game.i18n.localize;
    const dictionary = {
        'BAD.common.actionEconomy': 'Action Economy',
        'DND5E.Standard': 'Standard',
        'DND5E.Time': 'Time',
        'DND5E.Rest': 'Rest',
        'DND5E.Combat': 'Combat',
        'DND5E.Monster': 'Monster',
        'DND5E.Vehicle': 'Vehicle',
        'DND5E.Action': 'Action',
        'DND5E.BonusAction': 'Bonus Action',
        'DND5E.Reaction': 'Reaction',
        'DND5E.TimeMinute': 'Minute',
        'DND5E.TimeHour': 'Hour',
        'DND5E.TimeDay': 'Day',
        'DND5E.ActivityActivationShortRest': 'End of a Short Rest',
        'DND5E.ActivityActivationLongRest': 'End of a Long Rest',
        'DND5E.ActivityActivationStartEncounter': 'Start of Encounter',
        'DND5E.ActivityActivationTurnStart': 'Start of Turn',
        'DND5E.ActivityActivationTurnEnd': 'End of Turn',
        'DND5E.LegendaryAction': 'Legendary Action',
        'DND5E.MythicAction': 'Mythic Action',
        'DND5E.LairAction': 'Lair Action',
        'DND5E.CrewAction': 'Crew Action'
    };
    game.i18n.localize = key => dictionary[key] ?? key;

    try {
        const adapter = new Dnd5eSystemAdapter();

        // Top-level / Category tabs
        assert.equal(adapter.getActionTypeLabel('economy'), 'Action Economy');
        assert.equal(adapter.getActionSubTabLabel('standard'), 'Standard');
        assert.equal(adapter.getActionSubTabLabel('time'), 'Time');
        assert.equal(adapter.getActionSubTabLabel('rest'), 'Rest');
        assert.equal(adapter.getActionSubTabLabel('combat'), 'Combat');
        assert.equal(adapter.getActionSubTabLabel('monster'), 'Monster');
        assert.equal(adapter.getActionSubTabLabel('vehicle'), 'Vehicle');

        // Standard subtabs
        assert.equal(adapter.getActionSubTabLabel('action'), 'Action');
        assert.equal(adapter.getActionSubTabLabel('bonus'), 'Bonus Action');
        assert.equal(adapter.getActionSubTabLabel('reaction'), 'Reaction');

        // Time subtabs
        assert.equal(adapter.getActionSubTabLabel('minute'), 'Minute');
        assert.equal(adapter.getActionSubTabLabel('hour'), 'Hour');
        assert.equal(adapter.getActionSubTabLabel('day'), 'Day');

        // Rest subtabs
        assert.equal(adapter.getActionSubTabLabel('shortRest'), 'End of a Short Rest');
        assert.equal(adapter.getActionSubTabLabel('longRest'), 'End of a Long Rest');
        assert.equal(adapter.getActionSubTabLabel('short'), 'End of a Short Rest');
        assert.equal(adapter.getActionSubTabLabel('long'), 'End of a Long Rest');

        // Combat subtabs
        assert.equal(adapter.getActionSubTabLabel('encounter'), 'Start of Encounter');
        assert.equal(adapter.getActionSubTabLabel('turnStart'), 'Start of Turn');
        assert.equal(adapter.getActionSubTabLabel('turnEnd'), 'End of Turn');

        // Monster subtabs
        assert.equal(adapter.getActionSubTabLabel('legendary'), 'Legendary Action');
        assert.equal(adapter.getActionSubTabLabel('mythic'), 'Mythic Action');
        assert.equal(adapter.getActionSubTabLabel('lair'), 'Lair Action');

        // Vehicle subtabs
        assert.equal(adapter.getActionSubTabLabel('crew'), 'Crew Action');
    } finally {
        game.i18n.localize = origLocalize;
    }
});

test('ActionDisplayApp builds nested sub-tabs under Action Economy and filters accordingly', async () => {
    const token = {
        id: 'tok-1',
        name: 'Hero',
        actor: {
            id: 'act-1',
            name: 'Hero',
            uuid: 'Actor.act-1',
            isOwner: true,
            getFlag: () => null
        }
    };

    const app = new ActionDisplayApp(token);
    app.activePage = 1;

    const testActions = [
        new Action({ id: '1', name: 'Strike', left: ['weapon'], right: [TabRef.from('economy', 'standard', 'action')], page: 1 }),
        new Action({ id: '2', name: 'Healing Word', left: ['spell'], right: [TabRef.from('economy', 'standard', 'bonus')], page: 1 }),
        new Action({ id: '3', name: 'Shield Reaction', left: ['spell'], right: [TabRef.from('economy', 'standard', 'reaction')], page: 1 }),
        new Action({ id: '4', name: 'Prayer of Healing', left: ['spell'], right: [TabRef.from('economy', 'time', 'minute')], page: 1 }),
        new Action({ id: '5', name: 'Long Rest Buff', left: ['feat'], right: [TabRef.from('economy', 'rest', 'longRest')], page: 1 }),
        new Action({ id: '6', name: 'Turn Start Regen', left: ['feat'], right: [TabRef.from('economy', 'combat', 'turnStart')], page: 1 }),
        new Action({ id: '7', name: 'Dragon Breath (Legendary)', left: ['feat'], right: [TabRef.from('economy', 'monster', 'legendary')], page: 1 }),
        new Action({ id: '8', name: 'Fire Ballista', left: ['equipment'], right: [TabRef.from('economy', 'vehicle', 'crew')], page: 1 }),
        new Action({ id: '9', name: 'Special Feature', left: ['feat'], right: [TabRef.from('economy', 'special')], page: 1 })
    ];

    actionDisplay.getActions = async () => testActions;

    // 1. Initial render context: all actions visible under 'all'
    const ctx = await app._prepareContext();
    assert.equal(ctx.items.length, 9);

    // Verify parentGroups['economy'] hierarchy
    const econGroup = app.parentGroups['economy'];
    assert.ok(econGroup);
    const subCategories = econGroup.subTabs.map(t => t.id);
    assert.ok(subCategories.includes('standard'), 'Should have standard category');
    assert.ok(subCategories.includes('time'), 'Should have time category');
    assert.ok(subCategories.includes('rest'), 'Should have rest category');
    assert.ok(subCategories.includes('combat'), 'Should have combat category');
    assert.ok(subCategories.includes('monster'), 'Should have monster category');
    assert.ok(subCategories.includes('vehicle'), 'Should have vehicle category');
    assert.ok(subCategories.includes('special'), 'Should have direct special sub-tab');

    // Verify nested sub-tabs under standard
    const stdCat = econGroup.subTabs.find(t => t.id === 'standard');
    assert.ok(stdCat);
    const stdSubIds = stdCat.subTabs.map(t => t.id);
    assert.deepEqual(stdSubIds, ['action', 'bonus', 'reaction']);

    // 2. Select 'economy' parent tab: all 9 economy actions visible
    app.rightTabs.selectParent('economy', app.parentGroups);
    const ctxEcon = await app._prepareContext();
    assert.equal(ctxEcon.items.length, 9);

    // 3. Select 'standard' category tab: only Action, Bonus Action, Reaction actions visible
    app.rightTabs.selectSub('economy', 'standard', app.parentGroups);
    const ctxStandard = await app._prepareContext();
    assert.equal(ctxStandard.items.length, 3);
    assert.deepEqual(ctxStandard.items.map(i => i.name).sort(), ['Healing Word', 'Shield Reaction', 'Strike']);

    // 4. Select 'time' category tab: only Minute action visible
    app.rightTabs.selectSub('economy', 'time', app.parentGroups);
    const ctxTime = await app._prepareContext();
    assert.equal(ctxTime.items.length, 1);
    assert.equal(ctxTime.items[0].name, 'Prayer of Healing');

    // 5. Select 'rest' category tab: only Long Rest action visible
    app.rightTabs.selectSub('economy', 'rest', app.parentGroups);
    const ctxRest = await app._prepareContext();
    assert.equal(ctxRest.items.length, 1);
    assert.equal(ctxRest.items[0].name, 'Long Rest Buff');

    // 6. Select 'combat' category tab: only Turn Start Regen action visible
    app.rightTabs.selectSub('economy', 'combat', app.parentGroups);
    const ctxCombat = await app._prepareContext();
    assert.equal(ctxCombat.items.length, 1);
    assert.equal(ctxCombat.items[0].name, 'Turn Start Regen');

    // 7. Select 'monster' category tab: only Dragon Breath action visible
    app.rightTabs.selectSub('economy', 'monster', app.parentGroups);
    const ctxMonster = await app._prepareContext();
    assert.equal(ctxMonster.items.length, 1);
    assert.equal(ctxMonster.items[0].name, 'Dragon Breath (Legendary)');

    // 8. Select 'vehicle' category tab: only Fire Ballista action visible
    app.rightTabs.selectSub('economy', 'vehicle', app.parentGroups);
    const ctxVehicle = await app._prepareContext();
    assert.equal(ctxVehicle.items.length, 1);
    assert.equal(ctxVehicle.items[0].name, 'Fire Ballista');

    // 9. Select leaf sub-tab 'bonus' directly: only Healing Word visible
    app.rightTabs.selectSub('economy', 'bonus', app.parentGroups);
    const ctxBonus = await app._prepareContext();
    assert.equal(ctxBonus.items.length, 1);
    assert.equal(ctxBonus.items[0].name, 'Healing Word');

    // 10. Select direct sub-tab 'special': only Special Feature visible
    app.rightTabs.selectSub('economy', 'special', app.parentGroups);
    const ctxSpecial = await app._prepareContext();
    assert.equal(ctxSpecial.items.length, 1);
    assert.equal(ctxSpecial.items[0].name, 'Special Feature');
});

test('HUDTabColumn right-click multi-select toggling of nested sub-tabs and category tabs', async () => {
    const token = {
        id: 'tok-2',
        name: 'Hero',
        actor: {
            id: 'act-2',
            name: 'Hero',
            uuid: 'Actor.act-2',
            isOwner: true,
            getFlag: () => null
        }
    };

    const app = new ActionDisplayApp(token);
    app.activePage = 1;

    const testActions = [
        new Action({ id: '1', name: 'Strike', left: ['weapon'], right: [TabRef.from('economy', 'standard', 'action')], page: 1 }),
        new Action({ id: '2', name: 'Healing Word', left: ['spell'], right: [TabRef.from('economy', 'standard', 'bonus')], page: 1 }),
        new Action({ id: '3', name: 'Shield Reaction', left: ['spell'], right: [TabRef.from('economy', 'standard', 'reaction')], page: 1 }),
        new Action({ id: '4', name: 'Prayer of Healing', left: ['spell'], right: [TabRef.from('economy', 'time', 'minute')], page: 1 })
    ];

    actionDisplay.getActions = async () => testActions;
    app.rightTabs.resetToDefault();
    await app._prepareContext();

    // 1. Right-click Action
    app.rightTabs.toggleSub('economy', 'action', app.parentGroups);
    assert.deepEqual(Array.from(app.rightTabs.activeSubTypes), ['action']);

    // 2. Right-click Reaction
    app.rightTabs.toggleSub('economy', 'reaction', app.parentGroups);
    assert.deepEqual(Array.from(app.rightTabs.activeSubTypes).sort(), ['action', 'reaction']);

    // 3. Right-click Standard (selects category Standard, collapsing individual active children)
    app.rightTabs.toggleSub('economy', 'standard', app.parentGroups);
    assert.deepEqual(Array.from(app.rightTabs.activeSubTypes), ['standard']);

    const ctxAllStd = await app._prepareContext();
    const econGroup = app.parentGroups['economy'];
    const stdCat = econGroup.subTabs.find(t => t.id === 'standard');
    assert.equal(stdCat.active, true, 'Standard category should be active');
    for (const sub of stdCat.subTabs) {
        assert.equal(sub.active, true, `Child sub-tab ${sub.id} should be active when parent category is active`);
    }
    assert.equal(ctxAllStd.items.length, 3, 'All 3 standard actions should be visible');

    // 4. Right-click Standard again -> unselects Standard AND clears all descendant sub-tabs
    app.rightTabs.toggleSub('economy', 'standard', app.parentGroups);
    assert.deepEqual(Array.from(app.rightTabs.activeSubTypes), [], 'activeSubTypes should be completely empty');

    const ctxNone = await app._prepareContext();
    const stdCatUnselected = app.parentGroups['economy'].subTabs.find(t => t.id === 'standard');
    assert.equal(stdCatUnselected.active, false, 'Standard category should be inactive');
    for (const sub of stdCatUnselected.subTabs) {
        assert.equal(sub.active, false, `Child sub-tab ${sub.id} should be inactive`);
    }

    // 5. Right-click Standard (active), then Right-click Action (toggles Action off, leaving Bonus & Reaction active)
    app.rightTabs.toggleSub('economy', 'standard', app.parentGroups);
    assert.deepEqual(Array.from(app.rightTabs.activeSubTypes), ['standard']);

    app.rightTabs.toggleSub('economy', 'action', app.parentGroups);
    assert.deepEqual(Array.from(app.rightTabs.activeSubTypes).sort(), ['bonus', 'reaction']);

    // 6. Right-click Action again -> all siblings under Standard are now active -> collapses back to Standard
    app.rightTabs.toggleSub('economy', 'action', app.parentGroups);
    assert.deepEqual(Array.from(app.rightTabs.activeSubTypes), ['standard']);
});

