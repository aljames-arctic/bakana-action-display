import test from 'node:test';
import assert from 'node:assert/strict';
import '../setup.js';
import {
    evaluateBooleanExpression,
    categorizeActions,
    normalizeCategorizationConfig,
    validateExpression,
    getDefaultCategories
} from '../../src/categorization/categorization-manager.js';
import { Action } from '../../src/ui/action.js';
import { log } from '../../src/lib/logger.js';

test('normalizeCategorizationConfig creates strict contract from arbitrary input', () => {
    const emptyConfig = normalizeCategorizationConfig();
    assert.deepEqual(emptyConfig, { enabled: false, categories: [] });

    const partialConfig = normalizeCategorizationConfig({
        enabled: true,
        categories: [
            {
                name: 'Weapons',
                expression: 'item.type === "weapon"',
                fallthrough: true,
                subcategories: [
                    { name: 'Daggers', expression: 'item.name.includes("dagger")' }
                ]
            }
        ]
    });

    assert.equal(partialConfig.enabled, true);
    assert.equal(partialConfig.categories.length, 1);
    assert.equal(partialConfig.categories[0].name, 'Weapons');
    assert.equal(partialConfig.categories[0].expression, 'item.type === "weapon"');
    assert.equal(partialConfig.categories[0].fallthrough, true);
    assert.ok(partialConfig.categories[0].id.startsWith('cat_'));
    assert.equal(partialConfig.categories[0].subcategories.length, 1);
    assert.equal(partialConfig.categories[0].subcategories[0].name, 'Daggers');
    assert.equal(partialConfig.categories[0].subcategories[0].expression, 'item.name.includes("dagger")');
    assert.ok(partialConfig.categories[0].subcategories[0].id.startsWith('sub_'));
});

test('categorizeActions permits duplicate category names and categories named Other Actions', () => {
    const sword = new Action({ id: '1', name: 'Longsword', type: 'weapon' });
    const config = {
        enabled: true,
        categories: [
            { id: 'c1', name: 'Other Actions', expression: 'item.type === "weapon"', subcategories: [] },
            { id: 'c2', name: 'Other Actions', expression: 'item.type === "spell"', subcategories: [] }
        ]
    };

    const result = categorizeActions([sword], config);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'Other Actions');
    assert.deepEqual(result[0].items, [sword]);
});

test('validateExpression verifies valid and invalid syntax', () => {
    assert.equal(validateExpression('item.type === "weapon"').valid, true);
    assert.equal(validateExpression('item.name.toLowerCase().includes("dagger")').valid, true);
    assert.equal(validateExpression('item.system?.level === 0 || item.type === "cantrip"').valid, true);
    assert.equal(validateExpression('action.left.includes("weapon")').valid, true);
    assert.equal(validateExpression('actor.name === "Hero"').valid, true);
    assert.equal(validateExpression('token.name === "Token"').valid, true);
    assert.equal(validateExpression('user.isGM === true').valid, true);
    assert.equal(validateExpression('user.name === "DM"').valid, true);
    assert.equal(validateExpression('').valid, false);
    assert.equal(validateExpression('item.type ===').valid, false);
    assert.equal(validateExpression('&& invalid').valid, false);
});

test('evaluateBooleanExpression evaluates action and item properties safely', () => {
    const weaponAction = new Action({
        id: 'w1',
        name: 'Silver Dagger',
        type: 'weapon',
        originalItem: { id: 'w1', name: 'Silver Dagger', type: 'weapon', system: { equipped: true, level: 0 } }
    });

    assert.equal(evaluateBooleanExpression('item.type === "weapon"', weaponAction), true);
    assert.equal(evaluateBooleanExpression('action.type === "weapon"', weaponAction), true);
    assert.equal(evaluateBooleanExpression('item.name.toLowerCase().includes("dagger")', weaponAction), true);
    assert.equal(evaluateBooleanExpression('item.name.toLowerCase().includes("sword")', weaponAction), false);
    assert.equal(evaluateBooleanExpression('item.system.equipped === true', weaponAction), true);
    assert.equal(evaluateBooleanExpression('item.system.level === 0', weaponAction), true);
    assert.equal(evaluateBooleanExpression('item.system.level === 5', weaponAction), false);

    // Test action.left and action.right
    weaponAction.left = ['weapon', 'melee'];
    weaponAction.right = [{ label: 'action', root: 'economy', path: 'economy/action' }];
    assert.deepEqual(weaponAction.left, ['weapon', 'melee']);
    assert.deepEqual(weaponAction.right, [{ label: 'action', root: 'economy', path: 'economy/action' }]);
    assert.equal(evaluateBooleanExpression('action.left.includes("weapon")', weaponAction), true);
    assert.equal(evaluateBooleanExpression('action.left.includes("melee")', weaponAction), true);
    assert.equal(evaluateBooleanExpression('action.left.includes("spell")', weaponAction), false);
    assert.equal(evaluateBooleanExpression('action.right.some(t => t.label === "action")', weaponAction), true);

    // Test actor, token, and user exposure
    const mockActor = {
        name: 'Hero Actor',
        flags: {
            'bakana-action-display': {
                favorites: {
                    'action-dagger': true
                }
            }
        },
        getFlag(mod, key) {
            return this.flags?.[mod]?.[key];
        }
    };
    const mockToken = { name: 'Hero Token' };
    const mockUser = { name: 'Dungeon Master', isGM: true };
    const daggerAction = new Action({ id: 'action-dagger', name: 'Dagger', type: 'weapon' });
    daggerAction.originalItem = { id: 'action-dagger', name: 'Dagger', type: 'weapon' };

    assert.equal(
        evaluateBooleanExpression('actor.name === "Hero Actor"', daggerAction, { actor: mockActor, token: mockToken, user: mockUser }),
        true
    );
    assert.equal(
        evaluateBooleanExpression('token.name === "Hero Token"', daggerAction, { actor: mockActor, token: mockToken, user: mockUser }),
        true
    );
    assert.equal(
        evaluateBooleanExpression('user.isGM === true', daggerAction, { actor: mockActor, token: mockToken, user: mockUser }),
        true
    );
    assert.equal(
        evaluateBooleanExpression('user.name === "Dungeon Master"', daggerAction, { actor: mockActor, token: mockToken, user: mockUser }),
        true
    );
    assert.equal(
        evaluateBooleanExpression('actor.getFlag("bakana-action-display", "favorites")?.[item.id]', daggerAction, { actor: mockActor }),
        true
    );
    assert.equal(
        evaluateBooleanExpression('actor.getFlag("bakana-action-display", "favorites")?.[item.id]', weaponAction, { actor: mockActor }),
        false
    );
    // Explicit Boolean(...) wrapper by user is also supported
    assert.equal(
        evaluateBooleanExpression('Boolean(actor.getFlag("bakana-action-display", "favorites")?.[item.id])', daggerAction, { actor: mockActor }),
        true
    );

    // Unfavorited actor with getFlag returns falsy/false without Boolean wrapper
    const actorWithoutFavorites = {
        name: 'New Actor',
        flags: {},
        getFlag: () => undefined
    };
    assert.equal(
        evaluateBooleanExpression('actor.getFlag("bakana-action-display", "favorites")?.[item.id]', daggerAction, { actor: actorWithoutFavorites }),
        false
    );

    // Fault tolerance & error logging tests (including undeclared shorthand variables)
    const originalError = log.error;
    const loggedErrors = [];
    log.error = (msg, err) => { loggedErrors.push({ msg, err }); };
    try {
        assert.equal(evaluateBooleanExpression('', weaponAction), false);
        assert.equal(evaluateBooleanExpression(null, weaponAction), false);
        assert.equal(evaluateBooleanExpression('invalid syntax +++', weaponAction), false);
        assert.equal(evaluateBooleanExpression('nonExistent.nested.deepProperty === 123', weaponAction), false);
        assert.equal(evaluateBooleanExpression('unknownVar === 42', weaponAction), false);
        // Shorthand variables and context no longer in scope must evaluate to false
        assert.equal(evaluateBooleanExpression('type === "weapon"', weaponAction), false);
        assert.equal(evaluateBooleanExpression('left.includes("weapon")', weaponAction), false);
        assert.equal(evaluateBooleanExpression('context.actor === null', weaponAction), false);
        assert.equal(loggedErrors.length, 6);
        assert.match(loggedErrors[0].msg, /Failed to evaluate boolean expression/);
    } finally {
        log.error = originalError;
    }
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
                expression: 'item.type === "weapon"',
                subcategories: [
                    { id: 's1', name: 'daggers', expression: 'item.name.toLowerCase().includes("dagger")' },
                    { id: 's2', name: 'short sword', expression: 'item.name.toLowerCase().includes("shortsword")' }
                ]
            },
            {
                id: 'c2',
                name: 'SPELLS',
                expression: 'item.type === "spell"',
                subcategories: []
            },
            {
                id: 'c3',
                name: 'FEATURES',
                expression: 'item.type === "feat"',
                subcategories: []
            },
            {
                id: 'c4',
                name: 'EMPTY_CATEGORY',
                expression: 'item.type === "does_not_exist"',
                subcategories: []
            }
        ]
    };

    const result = categorizeActions(actions, config);
    assert.ok(Array.isArray(result));

    // c4 should be excluded because it has 0 items
    assert.equal(result.length, 4); // WEAPONS, SPELLS, FEATURES, Other Actions (for potion)

    // 1. WEAPONS
    const weaponsSection = result[0];
    assert.equal(weaponsSection.name, 'WEAPONS');
    assert.equal(weaponsSection.items.length, 0); // items partitioned into subsections
    assert.equal(weaponsSection.subsections.length, 3); // daggers, short sword, Other Actions (warhammer)
    assert.equal(weaponsSection.subsections[0].name, 'daggers');
    assert.deepEqual(weaponsSection.subsections[0].items, [dagger]);
    assert.equal(weaponsSection.subsections[1].name, 'short sword');
    assert.deepEqual(weaponsSection.subsections[1].items, [shortsword]);
    assert.equal(weaponsSection.subsections[2].name, 'Other Actions');
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
    assert.equal(othersSection.name, 'Other Actions');
    assert.deepEqual(othersSection.items, [potion]);
    assert.equal(othersSection.subsections.length, 0);
});

test('categorizeActions supports custom localized catch-all keyword (e.g. French Autres)', () => {
    const sword = new Action({ id: '1', name: 'Longsword', type: 'weapon' });
    const potion = new Action({ id: '2', name: 'Potion de Soin', type: 'consumable' });

    const config = {
        enabled: true,
        categories: [
            {
                id: 'c1',
                name: 'ARMES',
                expression: 'item.type === "weapon"',
                subcategories: [
                    { id: 's1', name: 'dagues', expression: 'item.name.toLowerCase().includes("dague")' }
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

test('getDefaultCategories provides standard preset configuration and delegates to adapter', () => {
    const presets = getDefaultCategories();
    assert.ok(Array.isArray(presets));
    assert.equal(presets.length, 4);
    assert.equal(presets[0].name, 'Favorites');
    assert.equal(presets[1].name, 'Weapons');
    assert.equal(presets[2].name, 'Spells');
    assert.equal(presets[3].name, 'Features');

    // Test delegation to custom adapter
    const customAdapter = {
        getDefaultCategories: () => [
            { id: 'c1', name: 'Custom Cat', expression: 'item.type === "custom"', subcategories: [] }
        ]
    };
    const delegated = getDefaultCategories(customAdapter);
    assert.equal(delegated.length, 1);
    assert.equal(delegated[0].name, 'Custom Cat');
});

test('categorizeActions with fallthrough allows matched items to appear in multiple categories or fall through to remainder', () => {
    const dagger = new Action({ id: '1', name: 'Dagger', type: 'weapon' });
    const potion = new Action({ id: '2', name: 'Healing Potion', type: 'consumable' });

    const config = {
        enabled: true,
        categories: [
            // Category 1: Fallthrough category that matches everything with 'Dagger' or 'Potion' in the name
            {
                id: 'c1',
                name: 'QUICK ACCESS',
                expression: 'item.name.includes("Dagger") || item.name.includes("Potion")',
                fallthrough: true,
                subcategories: []
            },
            // Category 2: Consumes weapons
            {
                id: 'c2',
                name: 'WEAPONS',
                expression: 'item.type === "weapon"',
                fallthrough: false,
                subcategories: []
            }
        ]
    };

    const result = categorizeActions([dagger, potion], config);
    assert.equal(result.length, 3);

    // 1. QUICK ACCESS (fallthrough) contains both dagger and potion
    assert.equal(result[0].name, 'QUICK ACCESS');
    assert.deepEqual(result[0].items, [dagger, potion]);

    // 2. WEAPONS (non-fallthrough) matched and consumed dagger
    assert.equal(result[1].name, 'WEAPONS');
    assert.deepEqual(result[1].items, [dagger]);

    // 3. Other Actions contains potion because it fell through Quick Access and was not consumed by Weapons
    assert.equal(result[2].name, 'Other Actions');
    assert.deepEqual(result[2].items, [potion]);
});

test('categorizeActions supports empty category name creating separator sections', () => {
    const sword = new Action({ id: '1', name: 'Longsword', type: 'weapon' });
    const config = {
        enabled: true,
        categories: [
            { id: 'c1', name: '', expression: 'item.type === "weapon"', subcategories: [] }
        ]
    };

    const result = categorizeActions([sword], config);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, '');
    assert.deepEqual(result[0].items, [sword]);
});

test('categorizeActions sorts items alphabetically in categories and subcategories', () => {
    const sword = new Action({ id: '1', name: 'Zweihander', type: 'weapon' });
    const dagger = new Action({ id: '2', name: 'Dagger', type: 'weapon' });
    const axe = new Action({ id: '3', name: 'Battleaxe', type: 'weapon' });
    const bow = new Action({ id: '4', name: 'Shortbow', type: 'weapon' });

    const config = {
        enabled: true,
        categories: [
            {
                id: 'c1',
                name: 'Weapons',
                expression: 'item.type === "weapon"',
                subcategories: [
                    { id: 's1', name: 'Blades', expression: 'item.name === "Zweihander" || item.name === "Dagger"' },
                    { id: 's2', name: 'Other Weapons', expression: 'true' }
                ]
            }
        ]
    };

    const result = categorizeActions([sword, dagger, axe, bow], config);
    assert.equal(result.length, 1);
    const blades = result[0].subsections.find(s => s.name === 'Blades');
    const others = result[0].subsections.find(s => s.name === 'Other Weapons');

    // Blades should be sorted Dagger -> Zweihander
    assert.deepEqual(blades.items.map(i => i.name), ['Dagger', 'Zweihander']);
    // Other Weapons should be sorted Battleaxe -> Shortbow
    assert.deepEqual(others.items.map(i => i.name), ['Battleaxe', 'Shortbow']);
});
