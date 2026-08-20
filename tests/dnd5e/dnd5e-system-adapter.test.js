import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Dnd5eSystemAdapter } from '../../src/adapters/system/dnd5e-system-adapter.js';
import { categorizeActions } from '../../src/categorization/categorization-manager.js';

test('Dnd5eSystemAdapter initialization and labels', () => {
    const adapter = new Dnd5eSystemAdapter();
    assert.equal(adapter.systemId, 'dnd5e');
    assert.equal(adapter.getItemTypeIcon('weapon'), 'fas fa-sword');
    assert.equal(adapter.getItemTypeIcon('equipment'), 'fas fa-shield');
    const defaultCategories = adapter.getDefaultCategories();
    assert.equal(defaultCategories.length, 6);
    assert.equal(defaultCategories[0].name, 'Favorites');
    assert.equal(defaultCategories[1].name, 'Weapons');
    assert.equal(defaultCategories[2].name, 'Spells');
    assert.equal(defaultCategories[2].subcategories.length, 3);
    assert.equal(defaultCategories[3].name, 'Features');
    assert.equal(defaultCategories[4].name, 'Abilities');
    assert.equal(defaultCategories[4].expression, 'action.type === "ability"');
    assert.equal(defaultCategories[4].subcategories.length, 0);
    assert.equal(defaultCategories[5].name, 'Skills');
    assert.equal(defaultCategories[5].expression, 'action.type === "skill"');
    assert.equal(defaultCategories[5].subcategories.length, 6);
    assert.equal(defaultCategories[5].subcategories[0].name, 'Strength');
    assert.equal(defaultCategories[5].subcategories[0].expression, 'action.right.some(t => t.label === "str")');
    assert.equal(defaultCategories[5].subcategories[1].name, 'Dexterity');
    assert.equal(defaultCategories[5].subcategories[1].expression, 'action.right.some(t => t.label === "dex")');
    assert.equal(defaultCategories[5].subcategories[2].name, 'Constitution');
    assert.equal(defaultCategories[5].subcategories[2].expression, 'action.right.some(t => t.label === "con")');
    assert.equal(defaultCategories[5].subcategories[3].name, 'Intelligence');
    assert.equal(defaultCategories[5].subcategories[3].expression, 'action.right.some(t => t.label === "int")');
    assert.equal(defaultCategories[5].subcategories[4].name, 'Wisdom');
    assert.equal(defaultCategories[5].subcategories[4].expression, 'action.right.some(t => t.label === "wis")');
    assert.equal(defaultCategories[5].subcategories[5].name, 'Charisma');
    assert.equal(defaultCategories[5].subcategories[5].expression, 'action.right.some(t => t.label === "cha")');
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
            properties: new Set(['vocal', 'somatic']),
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
        items: new foundry.utils.Collection([weaponItem, spellItem, featItem]),
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
    assert.equal(weaponAction.subactions[0].right[0].label, 'action');
    assert.deepEqual(weaponAction.right.map(t => t.path), ['economy/action']);
    assert.deepEqual(weaponAction.left, ['weapon']);

    const spellAction = page1Actions.find(a => a.id === 'act-spell');
    assert.equal(spellAction.subactions[0].right[0].label, 'bonus');
    assert.deepEqual(spellAction.right.map(t => t.path), ['economy/bonus', 'components/vocal', 'components/somatic']);
    assert.deepEqual(spellAction.uses, { available: 3, max: 4 });

    const featAction = page1Actions.find(a => a.id === 'act-feat');
    assert.equal(featAction.subactions[0].right[0].label, 'reaction');
    assert.deepEqual(featAction.right.map(t => t.path), ['economy/reaction']);

    const dexAbility = page2Actions.find(a => a.id === 'ability-dex');
    assert.equal(dexAbility.type, 'ability');
    assert.equal(dexAbility.section, 'core');
    assert.deepEqual(dexAbility.left, ['savingThrow']);
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
    assert.equal(acrSkill.right[0].label, 'dex');
});

test('Dnd5eSystemAdapter modifyContext triggers split layout exclusively on Page 2 for ability/skill checks', () => {
    const adapter = new Dnd5eSystemAdapter();
    const items = [
        { id: 'b', name: 'B-Skill', section: 'other' },
        { id: 'a', name: 'A-Core', section: 'core' }
    ];

    const ctxStr = { items, itemTypes: [] };
    adapter.modifyContext(ctxStr, { activePage: '2' });
    assert.equal(ctxStr.layout, 'split');
    assert.equal(ctxStr.coreItems.length, 1);
    assert.equal(ctxStr.otherItems.length, 1);

    const ctxNum = { items, itemTypes: [] };
    adapter.modifyContext(ctxNum, { activePage: 1 });
    assert.equal(ctxNum.layout, 'flat');
});

test('Dnd5eSystemAdapter favorites integration (hasFavorites, isFavorite, setFavorite)', async () => {
    const adapter = new Dnd5eSystemAdapter();
    assert.equal(adapter.hasFavorites(), true);

    // 1. Direct system.favorite
    const item1 = { id: 'item1', system: { favorite: true }, update: async (data) => { if ('system.favorite' in data) item1.system.favorite = data['system.favorite']; return item1; } };
    assert.equal(adapter.isFavorite({}, item1), true);

    // 2. Legacy flags.dnd5e.favorite
    const item2 = { id: 'item2', flags: { dnd5e: { favorite: true } }, update: async (data) => { if ('flags.dnd5e.favorite' in data) item2.flags.dnd5e.favorite = data['flags.dnd5e.favorite']; return item2; } };
    assert.equal(adapter.isFavorite({}, item2), true);

    // 3. Actor system.favorites collection
    const actor = {
        system: {
            favorites: [{ id: 'item3', type: 'item' }]
        }
    };
    const item3 = { id: 'item3' };
    assert.equal(adapter.isFavorite(actor, item3), true);

    // 4. Unfavorited item
    const item4 = { id: 'item4', system: { favorite: false } };
    assert.equal(adapter.isFavorite(actor, item4), false);

    // 5. setFavorite on item with system.favorite
    await adapter.setFavorite(actor, item1, false);
    assert.equal(item1.system.favorite, false);
    await adapter.setFavorite(actor, item1, true);
    assert.equal(item1.system.favorite, true);

    // 6. setFavorite using actor addFavorite / removeFavorite
    let added = null;
    let removed = null;
    const actorWithMethods = {
        system: {
            addFavorite: async (obj) => { added = obj; },
            removeFavorite: async (id) => { removed = id; }
        }
    };
    const itemWithoutUpdate = { id: 'item5' };
    await adapter.setFavorite(actorWithMethods, itemWithoutUpdate, true);
    assert.deepEqual(added, { id: 'item5', type: 'item' });
    await adapter.setFavorite(actorWithMethods, itemWithoutUpdate, false);
    assert.equal(removed, 'item5');
});

test('Dnd5eSystemAdapter default categorization presets categorize ability and skill actions', () => {
    const adapter = new Dnd5eSystemAdapter();
    const actor = {
        getFlag: () => null,
        system: {
            skills: {
                ath: { ability: 'str', label: 'Athletics' },
                ste: { ability: 'dex', label: 'Stealth' }
            }
        }
    };
    const actions = adapter.extractCheckActions(actor);
    const presets = adapter.getDefaultCategories();
    const categorized = categorizeActions(actions, { enabled: true, categories: presets }, 'Other Actions', { actor });

    assert.ok(categorized);
    const abilitySection = categorized.find(c => c.name === 'Abilities');
    assert.ok(abilitySection);
    assert.equal(abilitySection.items.length, 6);

    const skillSection = categorized.find(c => c.name === 'Skills');
    assert.ok(skillSection);
    const strSub = skillSection.subsections.find(s => s.name === 'Strength');
    assert.ok(strSub);
    assert.equal(strSub.items.some(i => i.name === 'Athletics'), true);

    const dexSub = skillSection.subsections.find(s => s.name === 'Dexterity');
    assert.ok(dexSub);
    assert.equal(dexSub.items.some(i => i.name === 'Stealth'), true);
});

