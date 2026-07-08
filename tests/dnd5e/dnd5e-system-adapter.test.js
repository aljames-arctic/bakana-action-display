import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Dnd5eSystemAdapter } from '../../src/adapters/system/dnd5e-system-adapter.js';

test('Dnd5eSystemAdapter initialization and labels', () => {
    const adapter = new Dnd5eSystemAdapter();
    assert.equal(adapter.systemId, 'dnd5e');
    assert.equal(adapter.getItemTypeIcon('weapon'), 'fas fa-question'); // falls back to base
    assert.equal(adapter.getItemTypeIcon('equipment'), 'fas fa-shield');
});

test('Dnd5eSystemAdapter shouldExtractItem filtering', () => {
    const adapter = new Dnd5eSystemAdapter();
    assert.equal(adapter.shouldExtractItem({ type: 'weapon' }), true);
    assert.equal(adapter.shouldExtractItem({ type: 'spell' }), true);
    assert.equal(adapter.shouldExtractItem({ type: 'feat' }), true);
    assert.equal(adapter.shouldExtractItem({ type: 'class' }), false);
});

test('Dnd5eSystemAdapter spell slot calculation', () => {
    const adapter = new Dnd5eSystemAdapter();

    const actor = {
        system: {
            spells: {
                spell1: { value: 3, max: 4 },
                spell2: { value: 0, max: 3 },
                pact: { value: 2, max: 2 }
            }
        }
    };

    // Cantrip -> no slots
    const cantrip = { type: 'spell', system: { level: 0, preparation: { mode: 'prepared' } } };
    assert.deepEqual(adapter.getSpellSlotUses(actor, cantrip), { available: null, max: null });

    // Level 1 spell
    const spell1 = { type: 'spell', system: { level: 1, preparation: { mode: 'prepared' } } };
    assert.deepEqual(adapter.getSpellSlotUses(actor, spell1), { available: 3, max: 4 });

    // Pact spell
    const pactSpell = { type: 'spell', system: { level: 2, preparation: { mode: 'pact' } } };
    assert.deepEqual(adapter.getSpellSlotUses(actor, pactSpell), { available: 2, max: 2 });
});

test('Dnd5eSystemAdapter modifyActions full transformation pipeline', async () => {
    const adapter = new Dnd5eSystemAdapter();

    const weaponItem = {
        id: 'weapon-1',
        name: 'Longsword',
        type: 'weapon',
        system: {
            equipped: true,
            activation: { type: 'action' }
        }
    };

    const spellItem = {
        id: 'spell-1',
        name: 'Healing Word',
        type: 'spell',
        system: {
            level: 1,
            preparation: { mode: 'prepared', prepared: true },
            activation: { type: 'bonus' }
        }
    };

    const featItem = {
        id: 'feat-1',
        name: 'Shield Master Reaction',
        type: 'feat',
        system: {
            activation: { type: 'reaction' },
            uses: { value: 1, max: 2 }
        }
    };

    const actor = {
        items: [weaponItem, spellItem, featItem],
        system: {
            spells: {
                spell1: { value: 3, max: 4 }
            }
        }
    };

    const rawActions = [
        { id: 'act-weapon', originalItem: weaponItem },
        { id: 'act-spell', originalItem: spellItem },
        { id: 'act-feat', originalItem: featItem }
    ];

    const modified = await adapter.modifyActions(rawActions, actor);

    assert.equal(modified.length, 3, 'Should transform weapon, spell, and feat actions');

    const weaponAction = modified.find(a => a.id === 'act-weapon');
    assert.equal(weaponAction.activationType, 'action');
    assert.deepEqual(weaponAction.itemTypes, ['weapon', 'melee']);

    const spellAction = modified.find(a => a.id === 'act-spell');
    assert.equal(spellAction.activationType, 'bonus');
    assert.deepEqual(spellAction.uses, { available: 3, max: 4 });

    const featAction = modified.find(a => a.id === 'act-feat');
    assert.equal(featAction.activationType, 'reaction');
    assert.deepEqual(featAction.uses, { available: 1, max: 2 });
});
