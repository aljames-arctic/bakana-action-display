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
        items: [],
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
    assert.deepEqual(spellAction.itemTypes, ['spell', '3']);
    assert.deepEqual(spellAction.uses, { available: 2, max: 3 });

    // Injected Strike verification
    const strikeAction = modified.find(a => a.id === 'strike-longsword');
    assert.equal(strikeAction.name, 'Longsword Strike');
    assert.equal(strikeAction.type, 'weapon');
});
