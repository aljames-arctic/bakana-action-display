import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Dnd5eSystemAdapter } from '../../src/adapters/system/dnd5e-system-adapter.js';

test('Dnd5eSystemAdapter initialization and labels', () => {
    const adapter = new Dnd5eSystemAdapter();
    assert.equal(adapter.systemId, 'dnd5e');
    assert.equal(adapter.getItemTypeIcon('weapon'), 'fas fa-sword');
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

    adapter.init(actor);

    // Cantrip -> no slots
    const cantrip = { type: 'spell', system: { level: 0, method: 'prepared', prepared: true } };
    assert.deepEqual(adapter.calculateUses(cantrip), { available: null, max: null });

    // Level 1 spell
    const spell1 = { type: 'spell', system: { level: 1, method: 'prepared', prepared: true } };
    assert.deepEqual(adapter.calculateUses(spell1), { available: 3, max: 4 });

    // Pact spell
    const pactSpell = { type: 'spell', system: { level: 2, method: 'pact', prepared: true } };
    assert.deepEqual(adapter.calculateUses(pactSpell), { available: 2, max: 2 });
});

test('Dnd5eSystemAdapter modifyActions full transformation pipeline', async () => {
    const adapter = new Dnd5eSystemAdapter();

    const weaponItem = {
        id: 'weapon-1',
        name: 'Longsword',
        type: 'weapon',
        system: {
            equipped: true,
            activities: [
                {
                    id: 'act-weapon',
                    name: 'Attack',
                    type: 'attack',
                    activation: { type: 'action' }
                }
            ]
        }
    };

    const spellItem = {
        id: 'spell-1',
        name: 'Healing Word',
        type: 'spell',
        system: {
            level: 1,
            method: 'prepared',
            prepared: true,
            activities: [
                {
                    id: 'act-spell',
                    name: 'Cast',
                    type: 'cast',
                    activation: { type: 'bonus' }
                }
            ]
        }
    };

    const featItem = {
        id: 'feat-1',
        name: 'Shield Master Reaction',
        type: 'feat',
        system: {
            activation: { type: 'reaction' },
            uses: { value: 1, max: 2 },
            activities: [
                {
                    id: 'act-feat',
                    name: 'Block',
                    type: 'utility',
                    activation: { type: 'reaction', override: true }
                }
            ]
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
    const page1Actions = modified.filter(a => a.page === 1);
    const page2Actions = modified.filter(a => a.page === 2);

    assert.equal(page1Actions.length, 3, 'Should transform weapon, spell, and feat activities on Page 1');
    assert.equal(page2Actions.length, 6, 'Should extract 6 core ability items on Page 2');

    const weaponAction = page1Actions.find(a => a.id === 'act-weapon');
    assert.equal(weaponAction.subactions[0].tabs[0].label, 'action');
    assert.deepEqual(weaponAction.itemTypes, ['weapon']);

    const spellAction = page1Actions.find(a => a.id === 'act-spell');
    assert.equal(spellAction.subactions[0].tabs[0].label, 'bonus');
    assert.deepEqual(spellAction.uses, { available: 3, max: 4 });

    const featAction = page1Actions.find(a => a.id === 'act-feat');
    assert.equal(featAction.subactions[0].tabs[0].label, 'reaction');

    const dexAbility = page2Actions.find(a => a.id === 'ability-dex');
    assert.equal(dexAbility.type, 'ability');
    assert.equal(dexAbility.section, 'core');
    assert.deepEqual(dexAbility.itemTypes, ['savingThrow']);
    assert.deepEqual(dexAbility.itemCategories, [['savingThrow'], ['abilityCheck']]);
    assert.equal(dexAbility.subactions.length, 2);
    assert.equal(dexAbility.collapseDropdownIfSingle, true);
});

test('Dnd5eSystemAdapter extractCheckActions generates core saves, core checks, and skills', () => {
    const adapter = new Dnd5eSystemAdapter('dnd5e');
    const mockActor = {
        system: {
            skills: {
                acr: { ability: 'dex', label: 'Acrobatics' },
                ath: { ability: 'str', label: 'Athletics' }
            }
        }
    };

    const checks = adapter.extractCheckActions(mockActor);
    // 6 core ability items (each with 2 activities) + 2 skills = 8 items
    assert.equal(checks.length, 8);

    const coreAbilities = checks.filter(c => c.type === 'ability');
    assert.equal(coreAbilities.length, 6);
    assert.ok(coreAbilities.every(c => c.section === 'core' && c.page === 2 && c.subactions.length === 2));

    const skills = checks.filter(c => c.type === 'skill');
    assert.equal(skills.length, 2);
    assert.ok(skills.every(s => s.section === 'other' && s.page === 2));

    const acrSkill = skills.find(s => s.id === 'skill-acr');
    assert.equal(acrSkill.name, 'Acrobatics');
    assert.equal(acrSkill.tabs[0].label, 'dex');
});
