import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Dnd5eSystemAdapter } from '../../src/adapters/system/dnd5e-system-adapter.js';
import { Action } from '../../src/ui/action.js';
import { TabRef } from '../../src/ui/tab-ref.js';
import { ActionDisplayApp } from '../../src/ui/action-display-app.js';
import { actionDisplay } from '../../src/action-display.js';
import { adapter } from '../../src/adapters/index.js';

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
    const origHas = game.i18n.has;
    const dictionary = {
        'BAD.common.actionEconomy': 'Action Economy',
        'DND5E.ActivityActivationStandard': 'Standard Act',
        'DND5E.ActivityActivationTime': 'Time Act',
        'DND5E.ActivityActivationRest': 'Rest Act',
        'DND5E.ActivityActivationCombat': 'Combat Act',
        'DND5E.ActivityActivationMonster': 'Monster Act',
        'DND5E.ActivityActivationVehicle': 'Vehicle Act',
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
    game.i18n.has = key => key in dictionary;
    game.i18n.localize = key => dictionary[key] ?? key;

    try {
        const adapter = new Dnd5eSystemAdapter();

        // Top-level / Category tabs (resolves via DND5E.ActivityActivation*)
        assert.equal(adapter.getActionTypeLabel('economy'), 'Action Economy');
        assert.equal(adapter.getActionSubTabLabel('standard'), 'Standard Act');
        assert.equal(adapter.getActionSubTabLabel('time'), 'Time Act');
        assert.equal(adapter.getActionSubTabLabel('rest'), 'Rest Act');
        assert.equal(adapter.getActionSubTabLabel('combat'), 'Combat Act');
        assert.equal(adapter.getActionSubTabLabel('monster'), 'Monster Act');
        assert.equal(adapter.getActionSubTabLabel('vehicle'), 'Vehicle Act');

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
        game.i18n.has = origHas;
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
        new Action({ id: '4', name: 'Prayer of Healing (Minute)', left: ['spell'], right: [TabRef.from('economy', 'time', 'minute')], page: 1 }),
        new Action({ id: '5', name: 'Mage Armor (Hour)', left: ['spell'], right: [TabRef.from('economy', 'time', 'hour')], page: 1 }),
        new Action({ id: '6', name: 'Heroism (Day)', left: ['spell'], right: [TabRef.from('economy', 'time', 'day')], page: 1 }),
        new Action({ id: '7', name: 'Long Rest Buff', left: ['feat'], right: [TabRef.from('economy', 'rest', 'longRest')], page: 1 }),
        new Action({ id: '8', name: 'Short Rest Recovery', left: ['feat'], right: [TabRef.from('economy', 'rest', 'shortRest')], page: 1 }),
        new Action({ id: '9', name: 'Initiative Surge (Encounter)', left: ['feat'], right: [TabRef.from('economy', 'combat', 'encounter')], page: 1 }),
        new Action({ id: '10', name: 'Turn Start Regen', left: ['feat'], right: [TabRef.from('economy', 'combat', 'turnStart')], page: 1 }),
        new Action({ id: '11', name: 'Turn End Tick', left: ['feat'], right: [TabRef.from('economy', 'combat', 'turnEnd')], page: 1 }),
        new Action({ id: '12', name: 'Dragon Breath (Legendary)', left: ['feat'], right: [TabRef.from('economy', 'monster', 'legendary')], page: 1 }),
        new Action({ id: '13', name: 'Mythic Phase', left: ['feat'], right: [TabRef.from('economy', 'monster', 'mythic')], page: 1 }),
        new Action({ id: '14', name: 'Lair Quake', left: ['feat'], right: [TabRef.from('economy', 'monster', 'lair')], page: 1 }),
        new Action({ id: '15', name: 'Fire Ballista', left: ['equipment'], right: [TabRef.from('economy', 'vehicle', 'crew')], page: 1 }),
        new Action({ id: '16', name: 'Special Feature', left: ['feat'], right: [TabRef.from('economy', 'special')], page: 1 })
    ];

    actionDisplay.getActions = async () => testActions;

    // 1. Initial render context: all actions visible under 'all'
    const ctx = await app._prepareContext();
    assert.equal(ctx.items.length, 16);

    // Verify parentGroups['economy'] hierarchy and subcategory order
    const econGroup = app.parentGroups['economy'];
    assert.ok(econGroup);
    const subCategories = econGroup.subTabs.map(t => t.id);
    assert.deepEqual(subCategories, ['all', 'standard', 'time', 'rest', 'combat', 'monster', 'vehicle', 'special']);

    // Verify nested sub-tabs under categories
    const stdCat = econGroup.subTabs.find(t => t.id === 'standard');
    assert.ok(stdCat);
    assert.deepEqual(stdCat.subTabs.map(t => t.id), ['action', 'bonus', 'reaction']);

    const timeCat = econGroup.subTabs.find(t => t.id === 'time');
    assert.ok(timeCat);
    assert.deepEqual(timeCat.subTabs.map(t => t.id), ['minute', 'hour', 'day']);

    const restCat = econGroup.subTabs.find(t => t.id === 'rest');
    assert.ok(restCat);
    assert.deepEqual(restCat.subTabs.map(t => t.id), ['longRest', 'shortRest']);

    const combatCat = econGroup.subTabs.find(t => t.id === 'combat');
    assert.ok(combatCat);
    assert.deepEqual(combatCat.subTabs.map(t => t.id), ['encounter', 'turnStart', 'turnEnd']);

    const monsterCat = econGroup.subTabs.find(t => t.id === 'monster');
    assert.ok(monsterCat);
    assert.deepEqual(monsterCat.subTabs.map(t => t.id), ['legendary', 'mythic', 'lair']);

    // 2. Select 'economy' parent tab: all 16 economy actions visible
    app.rightTabs.selectParent('economy', app.parentGroups);
    const ctxEcon = await app._prepareContext();
    assert.equal(ctxEcon.items.length, 16);

    // 3. Select 'standard' category tab: only Action, Bonus Action, Reaction actions visible
    app.rightTabs.selectSub('economy', 'standard', app.parentGroups);
    const ctxStandard = await app._prepareContext();
    assert.equal(ctxStandard.items.length, 3);
    assert.deepEqual(ctxStandard.items.map(i => i.name).sort(), ['Healing Word', 'Shield Reaction', 'Strike']);

    // 4. Select 'time' category tab: Minute, Hour, Day actions visible
    app.rightTabs.selectSub('economy', 'time', app.parentGroups);
    const ctxTime = await app._prepareContext();
    assert.equal(ctxTime.items.length, 3);
    assert.deepEqual(ctxTime.items.map(i => i.name).sort(), ['Heroism (Day)', 'Mage Armor (Hour)', 'Prayer of Healing (Minute)']);

    // 5. Select 'rest' category tab: Long Rest and Short Rest actions visible
    app.rightTabs.selectSub('economy', 'rest', app.parentGroups);
    const ctxRest = await app._prepareContext();
    assert.equal(ctxRest.items.length, 2);
    assert.deepEqual(ctxRest.items.map(i => i.name).sort(), ['Long Rest Buff', 'Short Rest Recovery']);

    // 6. Select 'combat' category tab: Encounter, Turn Start, Turn End actions visible
    app.rightTabs.selectSub('economy', 'combat', app.parentGroups);
    const ctxCombat = await app._prepareContext();
    assert.equal(ctxCombat.items.length, 3);
    assert.deepEqual(ctxCombat.items.map(i => i.name).sort(), ['Initiative Surge (Encounter)', 'Turn End Tick', 'Turn Start Regen']);

    // 7. Select 'monster' category tab: Legendary, Mythic, Lair actions visible
    app.rightTabs.selectSub('economy', 'monster', app.parentGroups);
    const ctxMonster = await app._prepareContext();
    assert.equal(ctxMonster.items.length, 3);
    assert.deepEqual(ctxMonster.items.map(i => i.name).sort(), ['Dragon Breath (Legendary)', 'Lair Quake', 'Mythic Phase']);

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

test('ActionDisplayApp left parent tab right-click multi-selects when not in focus, and toggles show capabilities when in focus', async () => {
    adapter.system = new Dnd5eSystemAdapter();
    const flags = {};
    const mockActor = {
        isOwner: true,
        getFlag: (mod, key) => flags[key] ?? false,
        setFlag: async (mod, key, val) => { flags[key] = val; }
    };
    const app = new ActionDisplayApp({ actor: mockActor });
    const testActions = [
        new Action({ id: '1', name: 'Sword', left: ['weapon'], right: [TabRef.from('economy', 'standard', 'action')], page: 1 }),
        new Action({ id: '2', name: 'Fireball', left: ['spell'], right: [TabRef.from('economy', 'standard', 'action')], page: 1 })
    ];
    actionDisplay.getActions = async () => testActions;

    // Initial state: 'all' is focused/expanded
    await app._prepareContext();
    assert.equal(app.leftTabs.focusedParent, 'all');
    assert.ok(app.leftTabs.activeParents.has('all'));
    assert.equal(app.leftGroups['weapon'].expanded, false);

    // Mock element and event for right-clicking 'weapon' tab
    const weaponTabEl = {
        tagName: 'BUTTON',
        dataset: { type: 'weapon' },
        classList: { contains: (cls) => cls === 'bad-left-tab' },
        closest: (selector) => {
            if (selector.includes('bad-left-tab-group')) {
                return { classList: { contains: (c) => c === 'expanded' && app.leftGroups['weapon']?.expanded } };
            }
            if (selector.includes('bad-left-tab')) return weaponTabEl;
            return null;
        }
    };
    const fakeEvent = {
        target: weaponTabEl,
        preventDefault: () => {},
        stopPropagation: () => {},
        stopImmediatePropagation: () => {}
    };

    // 1. Right click on weapon when not in focus -> multi-selects weapon
    app._onContextMenuCapture(fakeEvent);
    assert.ok(app.leftTabs.activeParents.has('weapon'), 'Weapon should now be selected');
    assert.equal(flags.showUnequipped_weapon, undefined, 'Flag should not be toggled when selecting unfocused tab');

    // Re-prepare context to simulate render update (weapon is now focused/expanded)
    await app._prepareContext();
    assert.equal(app.leftTabs.focusedParent, 'weapon');
    assert.equal(app.leftGroups['weapon'].expanded, true);

    // 2. Right click on weapon when in focus -> toggles showUnequipped_weapon flag
    app._onContextMenuCapture(fakeEvent);
    assert.equal(flags.showUnequipped_weapon, true, 'Flag should be toggled to true when right-clicking focused tab');

    // 3. Right click on weapon again when in focus -> toggles showUnequipped_weapon back to false
    app._onContextMenuCapture(fakeEvent);
    assert.equal(flags.showUnequipped_weapon, false, 'Flag should be toggled back to false');
});

test('ActionDisplayApp builds and renders Spell Components exclusion tab group with expanded sub-tabs', async () => {
    const token = {
        id: 'tok-archmage',
        name: 'Archmage',
        actor: {
            id: 'act-archmage',
            name: 'Archmage',
            uuid: 'Actor.act-archmage',
            isOwner: true,
            getFlag: () => null
        }
    };

    const app = new ActionDisplayApp(token);
    app.activePage = 1;

    const testActions = [
        new Action({
            id: 'feat-spellcasting',
            name: 'Spellcasting',
            left: ['feat'],
            right: [
                TabRef.from('economy', 'standard', 'action'),
                TabRef.from('components', 'vocal'),
                TabRef.from('components', 'somatic'),
                TabRef.from('components', 'material')
            ],
            page: 1
        })
    ];

    actionDisplay.getActions = async () => testActions;

    // 1. Initial context
    const ctx = await app._prepareContext();
    const compTab = ctx.actionTypes.find(t => t.id === 'components');
    assert.ok(compTab, 'Spell Components tab should be present in actionTypes');
    assert.ok(compTab.label);
    assert.equal(compTab.subTabs.length, 3);
    assert.deepEqual(compTab.subTabs.map(s => s.id), ['vocal', 'somatic', 'material']);

    // 2. Focus the components tab
    app.rightTabs.focusedParent = 'components';
    const ctxFocused = await app._prepareContext();
    const compTabFocused = ctxFocused.actionTypes.find(t => t.id === 'components');
    assert.equal(compTabFocused.expanded, true, 'Spell Components group should be marked as expanded when focused');
});

test('ActionDisplayApp shift+left click on tabs and subtabs always selects/unselects without toggling equip-prepared', async () => {
    adapter.system = new Dnd5eSystemAdapter();
    const flags = {};
    const mockActor = {
        uuid: 'Actor.shift-test-isolated',
        isOwner: true,
        getFlag: (mod, key) => flags[key] ?? false,
        setFlag: async (mod, key, val) => { flags[key] = val; }
    };
    const app = new ActionDisplayApp({ actor: mockActor });
    app.render = () => {};
    const testActions = [
        new Action({ id: '1', name: 'Sword', left: ['weapon'], right: [TabRef.from('economy', 'standard', 'action')], page: 1 }),
        new Action({ id: '2', name: 'Fireball', left: ['spell', 'spell-3'], right: [TabRef.from('economy', 'standard', 'action')], page: 1 }),
        new Action({ id: '3', name: 'Shield', left: ['spell', 'spell-1'], right: [TabRef.from('economy', 'standard', 'reaction')], page: 1 })
    ];
    actionDisplay.getActions = async () => testActions;

    // 1. Initial state: 'all' is active
    await app._prepareContext();
    assert.equal(app.leftTabs.focusedParent, 'all');

    // 2. Shift+Left Click on left parent tab 'weapon' -> multi-selects 'weapon'
    const shiftClickEvent = {
        shiftKey: true,
        preventDefault: () => {}
    };
    await app._onChangeLeftItemType(shiftClickEvent, { dataset: { type: 'weapon' } });
    assert.ok(app.leftTabs.activeParents.has('weapon'), 'Weapon should now be selected');
    assert.equal(flags.showUnequipped_weapon, undefined, 'Flag should NOT be toggled on shift+left click');

    // 3. Shift+Left Click on left parent tab 'spell' -> multi-selects 'spell' in addition to 'weapon'
    await app._onChangeLeftItemType(shiftClickEvent, { dataset: { type: 'spell' } });
    assert.ok(app.leftTabs.activeParents.has('weapon'), 'Weapon should remain selected');
    assert.ok(app.leftTabs.activeParents.has('spell'), 'Spell should now also be selected');
    assert.equal(flags.showAll_spell, undefined, 'Flag should NOT be toggled on shift+left click');

    // 4. Shift+Left Click on 'weapon' again -> unselects 'weapon', leaving 'spell'
    await app._onChangeLeftItemType(shiftClickEvent, { dataset: { type: 'weapon' } });
    assert.equal(app.leftTabs.activeParents.has('weapon'), false, 'Weapon should be unselected');
    assert.ok(app.leftTabs.activeParents.has('spell'), 'Spell should remain selected');

    // 5. Shift+Left Click on left sub-tab (e.g. spell level 1)
    const mockParentGroup = {
        querySelector: (sel) => sel.includes('.bad-left-tab') ? { dataset: { type: 'spell' } } : null
    };
    const mockSubTabEl = {
        dataset: { type: 'spell-1' },
        closest: (sel) => sel.includes('.bad-left-tab-group') ? mockParentGroup : null
    };
    await app._onChangeLeftSubItemType(shiftClickEvent, mockSubTabEl);
    assert.ok(app.leftTabs.activeSubTypes.has('spell-1'), 'Spell level 1 subtab should be selected');
    assert.equal(flags.showUnprepared_spell, undefined, 'showUnprepared flag should NOT be toggled on shift+left click');

    // 6. Shift+Left Click on right parent tab and sub-tab
    // Reset rightTabs to default ('all') to test toggling 'economy'
    app.rightTabs.resetToDefault();
    await app._onChangeActionType(shiftClickEvent, { dataset: { type: 'economy' } });
    assert.ok(app.rightTabs.activeParents.has('economy'), 'Economy should be selected');

    const mockRightParentGroup = {
        querySelector: (sel) => sel.includes('.bad-right-tab') ? { dataset: { type: 'economy' } } : null
    };
    const mockRightSubTabEl = {
        dataset: { type: 'action' },
        closest: (sel) => sel.includes('.bad-right-tab-group') ? mockRightParentGroup : null
    };
    await app._onChangeSubActionType(shiftClickEvent, mockRightSubTabEl);
    assert.ok(app.rightTabs.activeSubTypes.has('action'), 'Action subtab should be selected');

    // 7. Shift+Left Click on right sub-tab again -> unselects 'action'
    await app._onChangeSubActionType(shiftClickEvent, mockRightSubTabEl);
    assert.equal(app.rightTabs.activeSubTypes.has('action'), false, 'Action subtab should be unselected');
});

