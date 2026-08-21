import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Pf1SystemAdapter } from '../../src/adapters/system/pf1-system-adapter.js';

test('Pf1SystemAdapter initialization and extractable item types', () => {
    const adapter = new Pf1SystemAdapter();
    assert.equal(adapter.systemId, 'pf1');
    assert.equal(adapter.shouldExtractItem({ type: 'spell' }), true);
    assert.equal(adapter.shouldExtractItem({ type: 'attack' }), true);
    assert.equal(adapter.shouldExtractItem({ type: 'buff' }), true);
    assert.equal(adapter.shouldExtractItem({ type: 'class' }), false);
    const defaultCategories = adapter.getDefaultCategories();
    assert.equal(defaultCategories.length, 4);
    assert.equal(defaultCategories[0].name, 'Favorites');
    assert.equal(defaultCategories[1].name, 'Weapons');
    assert.ok(defaultCategories[1].expression.includes('attack'));
    assert.equal(defaultCategories[2].name, 'Spells');
    assert.equal(defaultCategories[3].name, 'Features');
    assert.ok(defaultCategories[3].expression.includes('buff'));
});

test('Pf1SystemAdapter label lookups and spell sub-tab labels', () => {
    const adapter = new Pf1SystemAdapter();

    assert.equal(adapter.getItemSubTabLabel('spell', 'cantrip'), 'PF1.Cantrip');
    assert.equal(adapter.getItemSubTabLabel('spell', '1'), 'PF1.SpellLevels.1');
    assert.equal(adapter.getItemSubTabLabel('spell', 'sla'), 'PF1.SpellBookSpelllike');

    assert.equal(adapter.getActionSubTabLabel('action'), 'PF1.Activation.action.Plural');
    assert.equal(adapter.getActionSubTabLabel('bonus'), 'PF1.Activation.swift.Single');
    assert.equal(adapter.getActionSubTabLabel('reaction'), 'PF1.Activation.immediate.Single');
});

test('Pf1SystemAdapter sort orders', () => {
    const adapter = new Pf1SystemAdapter();

    assert.equal(adapter.getItemSubTabSortOrder('spell', 'cantrip'), 999);
    assert.equal(adapter.getItemSubTabSortOrder('spell', '1'), 2);
    assert.equal(adapter.getItemSubTabSortOrder('spell', 'sla'), 999);
});

test('Pf1SystemAdapter modifyActions full transformation pipeline', async () => {
    const adapter = new Pf1SystemAdapter();

    const spellItem = {
        id: 'spell-1',
        name: 'Magic Missile',
        type: 'spell',
        system: {
            level: 1,
            spellbook: 'primary',
            actions: [
                {
                    id: 'act-sub-1',
                    name: 'Cast Missile',
                    activation: { type: 'standard' }
                }
            ]
        }
    };

    const buffItem = {
        id: 'buff-1',
        name: 'Haste',
        type: 'buff',
        system: {
            active: true,
            actions: []
        }
    };

    const actor = {
        items: new foundry.utils.Collection([spellItem, buffItem]),
        system: {
            attributes: {
                spells: {
                    spellbooks: {
                        primary: {
                            spells: {
                                spell1: { value: 3, max: 4 }
                            }
                        }
                    }
                }
            }
        }
    };

    const rawActions = [
        { id: 'act-spell', originalItem: spellItem },
        { id: 'act-buff', originalItem: buffItem }
    ];

    const modified = await adapter.modifyActions(rawActions, actor);

    assert.equal(modified.length, 2, 'Should format both spell and buff actions');

    const spellAction = modified.find(a => a.id === 'act-spell');
    assert.equal(spellAction.activationType, 'action');
    assert.deepEqual(spellAction.left, ['spell', '1']);
    assert.deepEqual(spellAction.uses, { available: 3, max: 4 });

    const buffAction = modified.find(a => a.id === 'act-buff');
    assert.deepEqual(buffAction.left, ['buff']);
    assert.equal(buffAction.isActive, true);
});

test('Pf1SystemAdapter filters unequipped items unless showUnequipped or showAll is enabled', async () => {
    const adapter = new Pf1SystemAdapter();

    const equippedWeapon = {
        id: 'wpn-1',
        name: 'Longsword',
        type: 'weapon',
        system: {
            equipped: true,
            actions: [{ id: 'a1', name: 'Slash', activation: { type: 'standard' } }]
        }
    };

    const unequippedWeapon = {
        id: 'wpn-2',
        name: 'Dagger',
        type: 'weapon',
        system: {
            equipped: false,
            actions: [{ id: 'a2', name: 'Stab', activation: { type: 'standard' } }]
        }
    };

    const actor = {
        items: new foundry.utils.Collection([equippedWeapon, unequippedWeapon]),
        flags: {
            'bakana-action-display': {
                showUnequipped_weapon: false,
                showAll: false
            }
        },
        getFlag(module, key) {
            return this.flags?.[module]?.[key] ?? false;
        }
    };

    const rawActions = [
        { id: 'act-w1', originalItem: equippedWeapon },
        { id: 'act-w2', originalItem: unequippedWeapon }
    ];

    // 1. By default, unequipped weapon is filtered out
    const modified1 = await adapter.modifyActions(rawActions, actor);
    assert.equal(modified1.length, 1);
    assert.equal(modified1[0].id, 'act-w1');

    // 2. When showUnequipped_weapon is true, unequipped weapon is included with available: false
    actor.flags['bakana-action-display'].showUnequipped_weapon = true;
    const modified2 = await adapter.modifyActions(rawActions, actor);
    assert.equal(modified2.length, 2);
    const unequippedAction = modified2.find(a => a.id === 'act-w2');
    assert.ok(unequippedAction);
    assert.equal(unequippedAction.available, false);
});

test('Pf1SystemAdapter context menu manager provides equip/unequip options and tab right-click handling', async () => {
    const adapter = new Pf1SystemAdapter();

    let updatedEquipped = null;
    const testItem = {
        id: 'item-1',
        name: 'Shield',
        type: 'equipment',
        system: { equipped: false },
        update: async (data) => { updatedEquipped = data['system.equipped']; }
    };

    const flags = {};
    const app = {
        actor: {
            isOwner: true,
            getFlag: (mod, key) => flags[key] ?? false,
            setFlag: (mod, key, val) => { flags[key] = val; }
        },
        actions: [
            { id: 'act-1', originalItem: testItem }
        ]
    };

    const menuItems = adapter.getContextMenuItems(app);
    const equipItem = menuItems.find(m => m.name === 'BAD.common.equipItem');
    const unequipItem = menuItems.find(m => m.name === 'BAD.common.unequipItem');

    assert.ok(equipItem);
    assert.ok(unequipItem);

    const mockEl = { dataset: { actionId: 'act-1' } };

    // Item is unequipped -> equip condition is true, unequip is false
    assert.equal(equipItem.condition(mockEl), true);
    assert.equal(unequipItem.condition(mockEl), false);

    await equipItem.callback(mockEl);
    assert.equal(updatedEquipped, true);

    // Change to equipped
    testItem.system.equipped = true;
    assert.equal(equipItem.condition(mockEl), false);
    assert.equal(unequipItem.condition(mockEl), true);

    await unequipItem.callback(mockEl);
    assert.equal(updatedEquipped, false);

    // Tab right click handling
    const tabElAll = {
        classList: { contains: (cls) => cls === 'bad-left-tab' },
        dataset: { type: 'all' }
    };
    const tabElWeapon = {
        classList: { contains: (cls) => cls === 'bad-left-tab' },
        dataset: { type: 'weapon' }
    };

    assert.equal(adapter.onTabRightClick(app, tabElAll, {}), true);
    assert.equal(flags.showAll, true);
    assert.equal(flags.showUnequipped_weapon, true);

    assert.equal(adapter.onTabRightClick(app, tabElWeapon, {}), true);
    assert.equal(flags.showUnequipped_weapon, false);

    // Context modifier flags
    const context = {
        itemTypes: [
            { id: 'all', showUnprepared: false },
            { id: 'weapon', showUnprepared: false }
        ]
    };
    adapter.modifyContext(context, app);
    assert.equal(context.itemTypes.find(t => t.id === 'all').showUnprepared, true);
    assert.equal(context.itemTypes.find(t => t.id === 'weapon').showUnprepared, true);
});

