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
