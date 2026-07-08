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
