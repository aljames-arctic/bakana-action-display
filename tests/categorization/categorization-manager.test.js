import test from 'node:test';
import assert from 'node:assert/strict';
import '../setup.js';
import {
    evaluateBooleanExpression,
    categorizeActions,
    normalizeCategorizationConfig,
    isReservedCategoryName,
    validateExpression,
    getDefaultCategories
} from '../../src/categorization/categorization-manager.js';
import { Action } from '../../src/ui/action.js';

test('normalizeCategorizationConfig creates strict contract from arbitrary input', () => {
    const emptyConfig = normalizeCategorizationConfig();
    assert.deepEqual(emptyConfig, { enabled: false, categories: [] });

    const partialConfig = normalizeCategorizationConfig({
        enabled: true,
        categories: [
            {
                name: 'Weapons',
                expression: 'type === "weapon"',
                subcategories: [
                    { name: 'Daggers', expression: 'name.includes("dagger")' }
                ]
            }
        ]
    });

    assert.equal(partialConfig.enabled, true);
    assert.equal(partialConfig.categories.length, 1);
    assert.equal(partialConfig.categories[0].name, 'Weapons');
    assert.equal(partialConfig.categories[0].expression, 'type === "weapon"');
    assert.ok(partialConfig.categories[0].id.startsWith('cat_'));
    assert.equal(partialConfig.categories[0].subcategories.length, 1);
    assert.equal(partialConfig.categories[0].subcategories[0].name, 'Daggers');
    assert.equal(partialConfig.categories[0].subcategories[0].expression, 'name.includes("dagger")');
    assert.ok(partialConfig.categories[0].subcategories[0].id.startsWith('sub_'));
});

test('isReservedCategoryName identifies reserved keywords case-insensitively', () => {
    assert.equal(isReservedCategoryName('Others'), true);
    assert.equal(isReservedCategoryName('others'), true);
    assert.equal(isReservedCategoryName(' Other '), true);
    assert.equal(isReservedCategoryName('Weapons'), false);
    assert.equal(isReservedCategoryName('Spells'), false);
    assert.equal(isReservedCategoryName(''), false);
    assert.equal(isReservedCategoryName(null), false);
});

test('validateExpression verifies valid and invalid syntax', () => {
    assert.equal(validateExpression('type === "weapon"').valid, true);
    assert.equal(validateExpression('name.toLowerCase().includes("dagger")').valid, true);
    assert.equal(validateExpression('system?.level === 0 || type === "cantrip"').valid, true);
    assert.equal(validateExpression('').valid, false);
    assert.equal(validateExpression('type ===').valid, false);
    assert.equal(validateExpression('&& invalid').valid, false);
});

test('evaluateBooleanExpression evaluates action and item properties safely', () => {
    const weaponAction = new Action({
        id: 'w1',
        name: 'Silver Dagger',
        type: 'weapon',
        originalItem: { id: 'w1', name: 'Silver Dagger', type: 'weapon', system: { equipped: true, level: 0 } }
    });

    assert.equal(evaluateBooleanExpression('type === "weapon"', weaponAction), true);
    assert.equal(evaluateBooleanExpression('name.toLowerCase().includes("dagger")', weaponAction), true);
    assert.equal(evaluateBooleanExpression('name.toLowerCase().includes("sword")', weaponAction), false);
    assert.equal(evaluateBooleanExpression('system.equipped === true', weaponAction), true);
    assert.equal(evaluateBooleanExpression('system.level === 0', weaponAction), true);
    assert.equal(evaluateBooleanExpression('system.level === 5', weaponAction), false);

    // Fault tolerance tests
    assert.equal(evaluateBooleanExpression('', weaponAction), false);
    assert.equal(evaluateBooleanExpression(null, weaponAction), false);
    assert.equal(evaluateBooleanExpression('invalid syntax +++', weaponAction), false);
    assert.equal(evaluateBooleanExpression('nonExistent.nested.deepProperty === 123', weaponAction), false);
});

test('categorizeActions returns null when disabled or categories are empty', () => {
    const actions = [new Action({ id: '1', name: 'Dagger', type: 'weapon' })];
    assert.equal(categorizeActions(actions, { enabled: false, categories: [] }), null);
    assert.equal(categorizeActions(actions, { enabled: true, categories: [] }), null);
    assert.equal(categorizeActions(actions, null), null);
});

test('categorizeActions partitions actions into top-level categories and subcategories', () => {
    const dagger = new Action({ id: '1', name: 'Dagger of Venom', type: 'weapon' });
    const shortsword = new Action({ id: '2', name: 'Shortsword +1', type: 'weapon' });
    const warhammer = new Action({ id: '3', name: 'Warhammer', type: 'weapon' });
    const fireball = new Action({ id: '4', name: 'Fireball', type: 'spell' });
    const sneakAttack = new Action({ id: '5', name: 'Sneak Attack', type: 'feat' });
    const potion = new Action({ id: '6', name: 'Healing Potion', type: 'consumable' });

    const actions = [dagger, shortsword, warhammer, fireball, sneakAttack, potion];

    const config = {
        enabled: true,
        categories: [
            {
                id: 'c1',
                name: 'WEAPONS',
                expression: 'type === "weapon"',
                subcategories: [
                    { id: 's1', name: 'daggers', expression: 'name.toLowerCase().includes("dagger")' },
                    { id: 's2', name: 'short sword', expression: 'name.toLowerCase().includes("shortsword")' }
                ]
            },
            {
                id: 'c2',
                name: 'SPELLS',
                expression: 'type === "spell"',
                subcategories: []
            },
            {
                id: 'c3',
                name: 'FEATURES',
                expression: 'type === "feat"',
                subcategories: []
            },
            {
                id: 'c4',
                name: 'EMPTY_CATEGORY',
                expression: 'type === "does_not_exist"',
                subcategories: []
            }
        ]
    };

    const result = categorizeActions(actions, config, 'Others');
    assert.ok(Array.isArray(result));

    // c4 should be excluded because it has 0 items
    assert.equal(result.length, 4); // WEAPONS, SPELLS, FEATURES, Others (for potion)

    // 1. WEAPONS
    const weaponsSection = result[0];
    assert.equal(weaponsSection.name, 'WEAPONS');
    assert.equal(weaponsSection.items.length, 0); // items partitioned into subsections
    assert.equal(weaponsSection.subsections.length, 3); // daggers, short sword, Others (warhammer)
    assert.equal(weaponsSection.subsections[0].name, 'daggers');
    assert.deepEqual(weaponsSection.subsections[0].items, [dagger]);
    assert.equal(weaponsSection.subsections[1].name, 'short sword');
    assert.deepEqual(weaponsSection.subsections[1].items, [shortsword]);
    assert.equal(weaponsSection.subsections[2].name, 'Others');
    assert.deepEqual(weaponsSection.subsections[2].items, [warhammer]);

    // 2. SPELLS
    const spellsSection = result[1];
    assert.equal(spellsSection.name, 'SPELLS');
    assert.deepEqual(spellsSection.items, [fireball]);
    assert.equal(spellsSection.subsections.length, 0);

    // 3. FEATURES
    const featuresSection = result[2];
    assert.equal(featuresSection.name, 'FEATURES');
    assert.deepEqual(featuresSection.items, [sneakAttack]);
    assert.equal(featuresSection.subsections.length, 0);

    // 4. Remainder at top level (Healing Potion)
    const othersSection = result[3];
    assert.equal(othersSection.name, 'Others');
    assert.deepEqual(othersSection.items, [potion]);
    assert.equal(othersSection.subsections.length, 0);
});

test('categorizeActions supports custom localized Others keyword (e.g. French Autres)', () => {
    const sword = new Action({ id: '1', name: 'Longsword', type: 'weapon' });
    const potion = new Action({ id: '2', name: 'Potion de Soin', type: 'consumable' });

    const config = {
        enabled: true,
        categories: [
            {
                id: 'c1',
                name: 'ARMES',
                expression: 'type === "weapon"',
                subcategories: [
                    { id: 's1', name: 'dagues', expression: 'name.toLowerCase().includes("dague")' }
                ]
            }
        ]
    };

    const result = categorizeActions([sword, potion], config, 'Autres');
    assert.equal(result.length, 2);

    // Subcategory remainder within ARMES should be "Autres"
    assert.equal(result[0].name, 'ARMES');
    assert.equal(result[0].subsections.length, 1);
    assert.equal(result[0].subsections[0].name, 'Autres');
    assert.deepEqual(result[0].subsections[0].items, [sword]);

    // Top-level remainder should be "Autres"
    assert.equal(result[1].name, 'Autres');
    assert.deepEqual(result[1].items, [potion]);
});

test('getDefaultCategories provides standard preset configuration', () => {
    const presets = getDefaultCategories();
    assert.ok(Array.isArray(presets));
    assert.equal(presets.length, 3);
    assert.equal(presets[0].name, 'WEAPONS');
    assert.equal(presets[0].subcategories.length, 2);
    assert.equal(presets[1].name, 'SPELLS');
    assert.equal(presets[2].name, 'FEATURES');
});
