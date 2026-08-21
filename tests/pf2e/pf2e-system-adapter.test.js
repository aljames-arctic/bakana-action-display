import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Pf2eSystemAdapter } from '../../src/adapters/system/pf2e-system-adapter.js';

test('Pf2eSystemAdapter initialization and extractable item types', () => {
    const adapter = new Pf2eSystemAdapter();
    assert.equal(adapter.systemId, 'pf2e');
    assert.equal(adapter.shouldExtractItem({ type: 'action' }), true);
    assert.equal(adapter.shouldExtractItem({ type: 'feat' }), true);
    assert.equal(adapter.shouldExtractItem({ type: 'spell' }), true);
    assert.equal(adapter.shouldExtractItem({ type: 'equipment' }), false);
    const defaultCategories = adapter.getDefaultCategories();
    assert.equal(defaultCategories.length, 4);
    assert.equal(defaultCategories[0].name, 'Favorites');
    assert.equal(defaultCategories[1].name, 'Weapons & Strikes');
    assert.equal(defaultCategories[2].name, 'Spells');
    assert.equal(defaultCategories[2].subcategories[0].name, 'Cantrips');
    assert.equal(defaultCategories[2].subcategories[1].name, 'Ranked Spells');
    assert.equal(defaultCategories[3].name, 'Feats & Actions');
});

test('Pf2eSystemAdapter label lookups', () => {
    const adapter = new Pf2eSystemAdapter();

    assert.equal(adapter.getItemTypeLabel('feat'), 'PF2E.Item.Feat.Plural');
    assert.equal(adapter.getItemTypeLabel('spell'), 'PF2E.Item.Spell.Plural');
    assert.equal(adapter.getItemTypeLabel('weapon'), 'PF2E.TraitWeapons');

    assert.equal(adapter.getItemSubTabLabel('spell', 'focus'), 'PF2E.Focus.Spells');
    assert.equal(adapter.getItemSubTabLabel('spell', 'innate'), 'PF2E.PreparationTypeInnate');
    assert.equal(adapter.getItemSubTabLabel('spell', 'ritual'), 'PF2E.Actor.Character.Spellcasting.Tab.Rituals');
    assert.equal(adapter.getItemSubTabLabel('spell', '0'), 'PF2E.TraitCantrip');
    assert.equal(adapter.getItemSubTabLabel('spell', '3'), 'PF2E.Item.Spell.Rank.3');
});

test('Pf2eSystemAdapter sort order lookups', () => {
    const adapter = new Pf2eSystemAdapter();

    assert.equal(adapter.getItemTypeSortOrder('weapon'), 1);
    assert.equal(adapter.getItemTypeSortOrder('feat'), 4);
    assert.equal(adapter.getItemTypeSortOrder('spell'), 5);

    assert.equal(adapter.getActionSubTabSortOrder('economy', 'all'), 0);
    assert.equal(adapter.getActionSubTabSortOrder('economy', 'action'), 1);
    assert.equal(adapter.getActionSubTabSortOrder('economy', 'reaction'), 2);
});

test('Pf2eSystemAdapter modifyActions full transformation pipeline', async () => {
    const adapter = new Pf2eSystemAdapter();

    const spellcastingEntry = {
        id: 'entry-1',
        name: 'Arcane Spells',
        isFocusPool: false,
        isSpontaneous: true,
        isInnate: false,
        spells: [
            { id: 'spell-fireball' }
        ],
        system: {
            slots: {
                slot3: { value: 2, max: 3 }
            }
        }
    };

    const strike = {
        slug: 'longsword',
        label: 'Longsword Strike',
        item: {
            type: 'weapon',
            img: 'longsword.png',
            system: {}
        }
    };

    const actor = {
        items: new foundry.utils.Collection(),
        spellcasting: [spellcastingEntry],
        system: {
            actions: [strike]
        }
    };

    const featItem = {
        id: 'feat-1',
        name: 'Power Attack',
        type: 'feat',
        system: {
            actionType: { value: 'action' },
            frequency: { value: 1, max: 1 }
        }
    };

    const spellItem = {
        id: 'spell-fireball',
        name: 'Fireball',
        type: 'spell',
        rank: 3,
        system: {}
    };

    const rawActions = [
        { id: 'act-1', originalItem: featItem },
        { id: 'act-2', originalItem: spellItem }
    ];

    const modified = await adapter.modifyActions(rawActions, actor);

    assert.equal(modified.length, 3, 'Should format feat, spell, and injected Strike');

    // Feat verification
    const featAction = modified.find(a => a.id === 'act-1');
    assert.equal(featAction.activationType, 'action');
    assert.deepEqual(featAction.uses, { available: 1, max: 1 });

    // Spell verification
    const spellAction = modified.find(a => a.id === 'act-2');
    assert.equal(spellAction.name, 'Fireball (Arcane Spells)');
    assert.deepEqual(spellAction.left, ['spell', '3']);
    assert.deepEqual(spellAction.uses, { available: 2, max: 3 });

    // Injected Strike verification
    const strikeAction = modified.find(a => a.id === 'strike-longsword');
    assert.equal(strikeAction.name, 'Longsword Strike');
    assert.equal(strikeAction.type, 'weapon');
});

test('Pf2eSystemAdapter context menu manager provides carry type options and tab right-click handling', async () => {
    const adapter = new Pf2eSystemAdapter();

    let updatedPayload = null;
    const weaponItem = {
        id: 'wpn-1',
        name: 'Greatsword',
        type: 'weapon',
        system: {
            equipped: { carryType: 'stowed', handsHeld: 0 }
        },
        update: async (data) => { updatedPayload = data; }
    };

    const flags = {};
    const app = {
        actor: {
            isOwner: true,
            getFlag: (mod, key) => flags[key] ?? false,
            setFlag: (mod, key, val) => { flags[key] = val; }
        },
        actions: [
            { id: 'act-1', originalItem: weaponItem }
        ]
    };

    const menuItems = adapter.getContextMenuItems(app);
    const hold1Item = menuItems.find(m => m.name === 'BAD.pf2e.carryTypeHeld1');
    const hold2Item = menuItems.find(m => m.name === 'BAD.pf2e.carryTypeHeld2');
    const wearItem = menuItems.find(m => m.name === 'BAD.pf2e.carryTypeWorn');
    const stowItem = menuItems.find(m => m.name === 'BAD.pf2e.carryTypeStowed');
    const dropItem = menuItems.find(m => m.name === 'BAD.pf2e.carryTypeDropped');

    assert.ok(hold1Item);
    assert.ok(hold2Item);
    assert.ok(wearItem);
    assert.ok(stowItem);
    assert.ok(dropItem);

    const mockEl = { dataset: { actionId: 'act-1' } };

    // Item is stowed: hold1, hold2, wear, drop conditions are true; stow is false
    assert.equal(hold1Item.condition(mockEl), true);
    assert.equal(hold2Item.condition(mockEl), true);
    assert.equal(wearItem.condition(mockEl), true);
    assert.equal(stowItem.condition(mockEl), false);
    assert.equal(dropItem.condition(mockEl), true);

    // Test Hold 1H
    await hold1Item.callback(mockEl);
    assert.equal(updatedPayload['system.equipped.carryType'], 'held');
    assert.equal(updatedPayload['system.equipped.handsHeld'], 1);

    // Test Hold 2H
    await hold2Item.callback(mockEl);
    assert.equal(updatedPayload['system.equipped.carryType'], 'held');
    assert.equal(updatedPayload['system.equipped.handsHeld'], 2);

    // Test Wear
    await wearItem.callback(mockEl);
    assert.equal(updatedPayload['system.equipped.carryType'], 'worn');
    assert.equal(updatedPayload['system.equipped.handsHeld'], 0);

    // Test Stow
    weaponItem.system.equipped = { carryType: 'held', handsHeld: 1 };
    assert.equal(stowItem.condition(mockEl), true);
    await stowItem.callback(mockEl);
    assert.equal(updatedPayload['system.equipped.carryType'], 'stowed');
    assert.equal(updatedPayload['system.equipped.handsHeld'], 0);

    // Test Drop
    await dropItem.callback(mockEl);
    assert.equal(updatedPayload['system.equipped.carryType'], 'dropped');
    assert.equal(updatedPayload['system.equipped.handsHeld'], 0);

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

