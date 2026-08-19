import test from 'node:test';
import assert from 'node:assert/strict';
import '../setup.js';
import { ActionDisplayApp } from '../../src/ui/action-display-app.js';
import { actionDisplay } from '../../src/action-display.js';
import { MODULE_ID } from '../../src/constants.js';

test('ActionDisplayApp _prepareContext categorizes actions when categorization is enabled', async () => {
    const app = new ActionDisplayApp({ actor: { id: 'test-actor' } });
    app.activePage = 1;
    app._saveTabState = () => {};

    // Enable categorization setting with categories
    game.settings.set(MODULE_ID, 'categorizationConfig', {
        enabled: true,
        categories: [
            {
                id: 'c1',
                name: 'WEAPONS',
                expression: 'item.type === "weapon"',
                subcategories: [
                    { id: 's1', name: 'daggers', expression: 'item.name.toLowerCase().includes("dagger")' }
                ]
            }
        ]
    });

    actionDisplay.getActions = async () => [
        { id: 'act-1', name: 'Dagger', page: 1, type: 'weapon', left: ['weapon'], right: [{ path: 'all' }] },
        { id: 'act-2', name: 'Longsword', page: 1, type: 'weapon', left: ['weapon'], right: [{ path: 'all' }] },
        { id: 'act-3', name: 'Fireball', page: 1, type: 'spell', left: ['spell'], right: [{ path: 'all' }] }
    ];

    actionDisplay.activeSystemAdapter = {
        getItemTypeLabel: (id) => id,
        getItemTypeIcon: () => '',
        getItemSubTabLabel: (parent, sub) => sub,
        getItemTypeSortOrder: () => 1,
        getItemSubTabSortOrder: () => 1,
        getActionTypeLabel: (id) => id,
        getActionTypeIcon: () => '',
        getActionSubTabLabel: (id) => id,
        getActionTypeSortOrder: () => 1,
        getActionSubTabSortOrder: () => 1,
        isExclusionTab: () => false,
        matchesEconomyTabs: () => true,
        modifyContext: () => {}
    };

    const context = await app._prepareContext({});
    assert.equal(context.isCategorized, true);
    assert.ok(Array.isArray(context.categorizedSections));
    assert.equal(context.categorizedSections.length, 2);

    // Section 1: WEAPONS with daggers and Others
    assert.equal(context.categorizedSections[0].name, 'WEAPONS');
    assert.equal(context.categorizedSections[0].subsections.length, 2);
    assert.equal(context.categorizedSections[0].subsections[0].name, 'daggers');
    assert.equal(context.categorizedSections[0].subsections[0].items[0].name, 'Dagger');
    assert.equal(context.categorizedSections[0].subsections[1].name, 'BAD.categorization.others');
    assert.equal(context.categorizedSections[0].subsections[1].items[0].name, 'Longsword');

    // Section 2: Top-level Others with Fireball
    assert.equal(context.categorizedSections[1].name, 'BAD.categorization.others');
    assert.equal(context.categorizedSections[1].items[0].name, 'Fireball');
});

test('ActionDisplayApp _prepareContext uses standard layout when categorization is disabled', async () => {
    const app = new ActionDisplayApp({ actor: { id: 'test-actor' } });
    app.activePage = 1;
    app._saveTabState = () => {};

    // Disable categorization setting
    game.settings.set(MODULE_ID, 'categorizationConfig', {
        enabled: false,
        categories: []
    });

    actionDisplay.getActions = async () => [
        { id: 'act-1', name: 'Dagger', page: 1, type: 'weapon', left: ['weapon'], right: [{ path: 'all' }] }
    ];

    actionDisplay.activeSystemAdapter = {
        getItemTypeLabel: (id) => id,
        getItemTypeIcon: () => '',
        getItemSubTabLabel: (parent, sub) => sub,
        getItemTypeSortOrder: () => 1,
        getItemSubTabSortOrder: () => 1,
        getActionTypeLabel: (id) => id,
        getActionTypeIcon: () => '',
        getActionSubTabLabel: (id) => id,
        getActionTypeSortOrder: () => 1,
        getActionSubTabSortOrder: () => 1,
        isExclusionTab: () => false,
        matchesEconomyTabs: () => true,
        modifyContext: () => {}
    };

    const context = await app._prepareContext({});
    assert.equal(context.isCategorized, false);
    assert.equal(context.categorizedSections, null);
    assert.equal(context.items.length, 1);
});
