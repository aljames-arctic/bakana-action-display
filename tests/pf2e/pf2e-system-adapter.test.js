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
    assert.equal(adapter.shouldExtractItem({ type: 'consumable' }), true);
    assert.equal(adapter.shouldExtractItem({ type: 'equipment' }), true);
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
    assert.equal(adapter.getItemTypeLabel('consumable'), 'PF2E.Item.Consumable.Plural');
    assert.equal(adapter.getItemTypeLabel('equipment'), 'PF2E.Item.Physical.Equipment');

    assert.equal(adapter.getItemSubTabLabel('spell', 'focus'), 'PF2E.Focus.Spells');
    assert.equal(adapter.getItemSubTabLabel('spell', 'innate'), 'PF2E.PreparationTypeInnate');
    assert.equal(adapter.getItemSubTabLabel('spell', 'ritual'), 'PF2E.Actor.Character.Spellcasting.Tab.Rituals');
    assert.equal(adapter.getItemSubTabLabel('spell', '0'), 'PF2E.TraitCantrip');
    assert.equal(adapter.getItemSubTabLabel('spell', '3'), 'PF2E.Item.Spell.Rank.3');
});

test('Pf2eSystemAdapter sort order lookups', () => {
    const adapter = new Pf2eSystemAdapter();

    assert.equal(adapter.getItemTypeSortOrder('weapon'), 1);
    assert.equal(adapter.getItemTypeSortOrder('equipment'), 2);
    assert.equal(adapter.getItemTypeSortOrder('consumable'), 3);
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

    let potionConsumed = false;
    const consumableItem = {
        id: 'item-potion',
        name: 'Elixir of Life',
        type: 'consumable',
        system: {
            quantity: 3,
            equipped: { carryType: 'held', handsHeld: 1 }
        },
        consume: () => { potionConsumed = true; }
    };

    const rawActions = [
        { id: 'act-1', originalItem: featItem },
        { id: 'act-2', originalItem: spellItem },
        { id: 'act-3', originalItem: consumableItem }
    ];

    const modified = await adapter.modifyActions(rawActions, actor);

    assert.equal(modified.length, 4, 'Should format feat, spell, consumable, and injected Strike');

    // Feat verification
    const featAction = modified.find(a => a.id === 'act-1');
    assert.equal(featAction.activationType, 'action');
    assert.deepEqual(featAction.uses, { available: 1, max: 1 });

    // Spell verification
    const spellAction = modified.find(a => a.id === 'act-2');
    assert.equal(spellAction.name, 'Fireball (Arcane Spells)');
    assert.deepEqual(spellAction.left, ['spell', '3']);
    assert.deepEqual(spellAction.uses, { available: 2, max: 3 });

    // Consumable verification
    const consumableAction = modified.find(a => a.id === 'act-3');
    assert.equal(consumableAction.name, 'Elixir of Life');
    assert.deepEqual(consumableAction.left, ['consumable']);
    assert.deepEqual(consumableAction.uses, { available: 3, max: null });
    consumableAction.roll({});
    assert.equal(potionConsumed, true);

    // Injected Strike verification
    const strikeAction = modified.find(a => a.id === 'strike-longsword');
    assert.equal(strikeAction.name, 'Longsword Strike');
    assert.equal(strikeAction.type, 'weapon');
});

test('Pf2eSystemAdapter filters stowed and dropped items unless showUnequipped or showAll is enabled', async () => {
    const adapter = new Pf2eSystemAdapter();

    const heldWeapon = { id: 'w-held', name: 'Dagger', type: 'weapon', system: { equipped: { carryType: 'held', handsHeld: 1 } } };
    const stowedWeapon = { id: 'w-stowed', name: 'Crossbow', type: 'weapon', system: { equipped: { carryType: 'stowed', handsHeld: 0 } } };
    const droppedWeapon = { id: 'w-dropped', name: 'Halberd', type: 'weapon', system: { equipped: { carryType: 'dropped', handsHeld: 0 } } };
    const naturalAttack = { id: 'w-beak', name: 'Beak', type: 'weapon', isPhysical: false, category: 'unarmed', system: {} };

    const strikes = [
        { slug: 'held', label: 'Dagger', item: heldWeapon },
        { slug: 'stowed', label: 'Crossbow', item: stowedWeapon },
        { slug: 'dropped', label: 'Halberd', item: droppedWeapon },
        { slug: 'beak', label: 'Beak', item: naturalAttack }
    ];

    // Case 1: Default (showAll = false, showUnequipped = false) -> stowed and dropped are filtered out
    const actorDefault = {
        getFlag: () => false,
        system: { actions: strikes }
    };
    const modifiedDefault = await adapter.modifyActions([], actorDefault);
    const heldAction = modifiedDefault.find(a => a.id === 'strike-held');
    const beakAction = modifiedDefault.find(a => a.id === 'strike-beak');
    assert.ok(heldAction);
    assert.equal(heldAction.available, true);
    assert.ok(beakAction);
    assert.equal(beakAction.available, true);
    assert.equal(modifiedDefault.some(a => a.id === 'strike-stowed'), false);
    assert.equal(modifiedDefault.some(a => a.id === 'strike-dropped'), false);

    // Case 2: showAll = true -> stowed and dropped appear with available = false
    const actorShowAll = {
        getFlag: (mod, key) => key === 'showAll',
        system: { actions: strikes }
    };
    const modifiedShowAll = await adapter.modifyActions([], actorShowAll);
    const stowedAction = modifiedShowAll.find(a => a.id === 'strike-stowed');
    const droppedAction = modifiedShowAll.find(a => a.id === 'strike-dropped');
    const beakShowAllAction = modifiedShowAll.find(a => a.id === 'strike-beak');
    assert.ok(stowedAction);
    assert.equal(stowedAction.available, false);
    assert.ok(droppedAction);
    assert.equal(droppedAction.available, false);
    assert.ok(beakShowAllAction);
    assert.equal(beakShowAllAction.available, true);

    // Case 3: showUnequipped_weapon = true
    const actorShowWeapon = {
        getFlag: (mod, key) => key === 'showUnequipped_weapon',
        system: { actions: strikes }
    };
    const modifiedShowWeapon = await adapter.modifyActions([], actorShowWeapon);
    assert.equal(modifiedShowWeapon.some(a => a.id === 'strike-stowed'), true);
    assert.equal(modifiedShowWeapon.some(a => a.id === 'strike-dropped'), true);
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
    const itemsMap = new Map([['wpn-1', weaponItem]]);
    const app = {
        actor: {
            isOwner: true,
            items: itemsMap,
            getFlag: (mod, key) => flags[key] ?? false,
            setFlag: (mod, key, val) => { flags[key] = val; }
        },
        actions: [
            { id: 'act-1', originalItem: weaponItem }
        ]
    };

    const menuItems = adapter.getContextMenuItems(app);
    const updateEquipItem = menuItems.find(m => m.name === 'BAD.pf2e.updateEquipState');
    assert.ok(updateEquipItem);
    assert.ok(Array.isArray(updateEquipItem.submenu));

    const hold1Item = updateEquipItem.submenu.find(m => m.name === 'BAD.pf2e.carryTypeHeld1');
    const hold2Item = updateEquipItem.submenu.find(m => m.name === 'BAD.pf2e.carryTypeHeld2');
    const wearItem = updateEquipItem.submenu.find(m => m.name === 'BAD.pf2e.carryTypeWorn');
    const stowItem = updateEquipItem.submenu.find(m => m.name === 'BAD.pf2e.carryTypeStowed');
    const dropItem = updateEquipItem.submenu.find(m => m.name === 'BAD.pf2e.carryTypeDropped');

    assert.ok(hold1Item);
    assert.ok(hold2Item);
    assert.ok(wearItem);
    assert.ok(stowItem);
    assert.ok(dropItem);

    const mockEl = { dataset: { actionId: 'act-1' } };

    // Parent item condition
    assert.equal(updateEquipItem.condition(mockEl), true);

    // Active state checks
    assert.equal(hold1Item.active(weaponItem), false);
    assert.equal(stowItem.active(weaponItem), true);

    // Test Hold 1H
    await hold1Item.callback(weaponItem);
    assert.equal(updatedPayload['system.equipped.carryType'], 'held');
    assert.equal(updatedPayload['system.equipped.handsHeld'], 1);

    // Test Hold 2H
    await hold2Item.callback(weaponItem);
    assert.equal(updatedPayload['system.equipped.carryType'], 'held');
    assert.equal(updatedPayload['system.equipped.handsHeld'], 2);

    // Test Wear
    await wearItem.callback(weaponItem);
    assert.equal(updatedPayload['system.equipped.carryType'], 'worn');
    assert.equal(updatedPayload['system.equipped.handsHeld'], 0);

    // Test Stow
    weaponItem.system.equipped = { carryType: 'held', handsHeld: 1 };
    assert.equal(stowItem.active(weaponItem), false);
    await stowItem.callback(weaponItem);
    assert.equal(updatedPayload['system.equipped.carryType'], 'stowed');
    assert.equal(updatedPayload['system.equipped.handsHeld'], 0);

    // Test Drop
    await dropItem.callback(weaponItem);
    assert.equal(updatedPayload['system.equipped.carryType'], 'dropped');
    assert.equal(updatedPayload['system.equipped.handsHeld'], 0);

    // Natural attack (Beak) should NOT have updateEquipState option and is always equipped
    const beakItem = {
        id: 'beak-1',
        name: 'Beak',
        type: 'weapon',
        isPhysical: false,
        category: 'unarmed',
        system: {
            traits: { value: ['unarmed', 'finesse'] }
        }
    };
    app.actions.push({ id: 'act-beak', originalItem: beakItem });
    const beakEl = { dataset: { actionId: 'act-beak' } };

    assert.equal(updateEquipItem.condition(beakEl), false);
    assert.equal(adapter.getItemEquipped(beakItem), true);

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

