import test from 'node:test';
import assert from 'node:assert/strict';
import '../setup.js';
import { CategorizationConfigApp } from '../../src/categorization/categorization-config-app.js';
import { MODULE_ID } from '../../src/constants.js';

test('CategorizationConfigApp initializes with stored settings', async () => {
    game.settings.set(MODULE_ID, 'categorizationConfig', {
        enabled: true,
        categories: [{ id: 'c1', name: 'Weapons', expression: 'type === "weapon"', subcategories: [] }]
    });

    const app = new CategorizationConfigApp();
    assert.equal(app.config.enabled, true);
    assert.equal(app.config.categories.length, 1);
    assert.equal(app.config.categories[0].name, 'Weapons');

    const context = await app._prepareContext({});
    assert.equal(context.config.enabled, true);
    assert.equal(context.config.categories.length, 1);
});

test('CategorizationConfigApp action handlers mutate configuration state', async () => {
    game.settings.set(MODULE_ID, 'categorizationConfig', { enabled: false, categories: [] });
    const app = new CategorizationConfigApp();
    app.render = () => {};

    // 1. Toggle Enabled
    app._onToggleEnabled({}, { checked: true });
    assert.equal(app.config.enabled, true);

    // 2. Add Category
    app._onAddCategory({ preventDefault: () => {} }, {});
    assert.equal(app.config.categories.length, 1);
    app.config.categories[0].name = 'Spells';
    app.config.categories[0].expression = 'type === "spell"';

    // 3. Add Subcategory
    app._onAddSubCategory({ preventDefault: () => {} }, { dataset: { catIndex: '0' } });
    assert.equal(app.config.categories[0].subcategories.length, 1);
    app.config.categories[0].subcategories[0].name = 'Cantrips';
    app.config.categories[0].expression = 'system.level === 0';

    // 4. Load Presets
    app._onLoadPresets({ preventDefault: () => {} }, {});
    assert.equal(app.config.categories.length, 3);
    assert.equal(app.config.categories[0].name, 'Weapons');

    // 5. Remove Subcategory
    if (app.config.categories[0].subcategories.length > 0) {
        app._onRemoveSubCategory({ preventDefault: () => {} }, { dataset: { catIndex: '0', subIndex: '0' } });
    }

    // 6. Remove Category
    app._onRemoveCategory({ preventDefault: () => {} }, { dataset: { catIndex: '0' } });
    assert.equal(app.config.categories.length, 2);
});

test('CategorizationConfigApp _onSaveConfig validates reserved names and persists to settings', async () => {
    const app = new CategorizationConfigApp();
    let closed = false;
    app.close = () => { closed = true; };

    let warned = false;
    ui.notifications.warn = () => { warned = true; };

    // Test 1: Category with empty name is rejected
    app.config.categories = [{ id: 'c1', name: '', expression: 'type === "weapon"', subcategories: [] }];
    await app._onSaveConfig({ preventDefault: () => {} }, {});
    assert.equal(warned, true);
    assert.equal(closed, false);

    // Test 2: Category with reserved name "Others" is rejected
    warned = false;
    app.config.categories = [{ id: 'c1', name: 'Others', expression: 'type === "weapon"', subcategories: [] }];
    await app._onSaveConfig({ preventDefault: () => {} }, {});
    assert.equal(warned, true);
    assert.equal(closed, false);

    // Test 3: Valid category saves successfully
    warned = false;
    app.config.categories = [{ id: 'c1', name: 'Weapons', expression: 'type === "weapon"', subcategories: [] }];
    await app._onSaveConfig({ preventDefault: () => {} }, {});
    assert.equal(warned, false);
    assert.equal(closed, true);

    const saved = game.settings.get(MODULE_ID, 'categorizationConfig');
    assert.equal(saved.categories[0].name, 'Weapons');
});
