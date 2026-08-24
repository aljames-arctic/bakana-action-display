import test from 'node:test';
import assert from 'node:assert/strict';
import '../setup.js';
import { ActionDisplayApp } from '../../src/ui/action-display-app.js';
import { actionDisplay } from '../../src/action-display.js';
import { HUDTab } from '../../src/ui/hud-tab.js';
import { adapter } from '../../src/adapters/index.js';
import { Dnd5eSystemAdapter } from '../../src/adapters/system/dnd5e-system-adapter.js';

test('ActionDisplayApp previousPage and nextPage cycle through pages without cyclePage or all-tab triggers', async () => {
    assert.equal(typeof ActionDisplayApp.prototype.cyclePage, 'undefined', 'old cyclePage method should be removed');

    const app = new ActionDisplayApp({ actor: { id: 'test-actor' } });
    app.totalPages = 3;
    app.activePage = 1;
    let renderCount = 0;
    app.render = () => { renderCount++; };
    app._saveTabState = () => {};

    // Test nextPage navigation
    app.nextPage();
    assert.equal(app.activePage, 2);
    app.nextPage();
    assert.equal(app.activePage, 3);
    app.nextPage();
    assert.equal(app.activePage, 1); // Wrap around at boundary

    // Test previousPage navigation
    app.previousPage();
    assert.equal(app.activePage, 3); // Wrap around at lower boundary
    app.previousPage();
    assert.equal(app.activePage, 2);

    // Verify _onChangeLeftItemType does not advance page when clicking 'all'
    app.leftGroups = {
        all: new HUDTab({ id: 'all', level: 0 })
    };
    app.leftTabs.activeParents.add('all');
    await app._onChangeLeftItemType({ preventDefault: () => {} }, { dataset: { type: 'all' } });
    assert.equal(app.activePage, 2, 'clicking all when all is active should no longer change activePage');
});

test('ActionDisplayApp _onChangePage sets target page if valid', async () => {
    const app = new ActionDisplayApp({ actor: { id: 'test-actor' } });
    app.totalPages = 4;
    app.activePage = 1;
    app.render = () => {};
    app._saveTabState = () => {};

    await app._onChangePage({ preventDefault: () => {} }, { dataset: { page: '3' } });
    assert.equal(app.activePage, 3);

    // Invalid page out of bounds should not change activePage
    await app._onChangePage({ preventDefault: () => {} }, { dataset: { page: '99' } });
    assert.equal(app.activePage, 3);
});

test('ActionDisplayApp _prepareContext populates pages metadata correctly', async () => {
    const app = new ActionDisplayApp({ actor: { id: 'test-actor' } });
    app.activePage = 2;
    app._saveTabState = () => {};

    // Mock getActions to return items across 2 pages
    actionDisplay.getActions = async () => [
        { id: 'act-1', name: 'Slash', page: 1, left: ['weapon'] },
        { id: 'act-2', name: 'Save', page: 2, left: ['savingThrow'] }
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
        modifyContext: () => {}
    };

    const context = await app._prepareContext({});
    assert.equal(context.totalPages, 2);
    assert.equal(context.activePage, 2);
    assert.equal(context.hasMultiplePages, true);
    assert.equal(context.pages.length, 2);
    assert.deepEqual(context.pages[0], { page: 1, active: false });
    assert.deepEqual(context.pages[1], { page: 2, active: true });
});

test('ActionDisplayApp _onCloseHUD calls close on the application', async () => {
    const app = new ActionDisplayApp({ actor: { id: 'test-actor' } });
    let closeCalled = false;
    app.close = async () => { closeCalled = true; };

    assert.equal(typeof ActionDisplayApp.DEFAULT_OPTIONS.actions.closeHUD, 'function');
    await app._onCloseHUD({ preventDefault: () => {}, stopPropagation: () => {} }, {});
    assert.equal(closeCalled, true);
});

test('ActionDisplayApp Page 2 right tab column initializes activeSubTypes to empty set and displays actions on parent tab selection', async () => {
    const app = new ActionDisplayApp({ actor: { id: 'test-actor' } });
    app.activePage = 2;
    app._saveTabState = () => {};

    const rightCol = app.getTabColumn('right', 2);
    assert.deepEqual(Array.from(rightCol.activeSubTypes), []);

    // Select 'ability' parent tab
    const abilityTab = new HUDTab({
        id: 'ability',
        label: 'Ability',
        subTabs: [
            { id: 'all', label: 'All Actions' },
            { id: 'str', label: 'Strength' },
            { id: 'dex', label: 'Dexterity' }
        ]
    });
    const parentGroups = { ability: abilityTab };
    rightCol.selectParent('ability', parentGroups);

    assert.equal(rightCol.activeParents.has('ability'), true);
    assert.deepEqual(Array.from(rightCol.activeSubTypes), []);
});

test('ActionDisplayApp Page 2 populates Tools left filter tab and filters tool proficiency actions', async () => {
    adapter.system = new Dnd5eSystemAdapter();
    const app = new ActionDisplayApp({ actor: { id: 'test-actor', getFlag: () => false, flags: {} } });
    app.activePage = 2;
    app._saveTabState = () => {};

    const mockActions = [
        { id: 'ability-dex', name: 'Dexterity', page: 2, left: ['savingThrow'], itemCategories: [['savingThrow'], ['abilityCheck']], right: [{ path: 'ability/dex', root: 'ability', label: 'dex' }] },
        { id: 'skill-ste', name: 'Stealth', page: 2, left: ['abilityCheck'], right: [{ path: 'ability/dex', root: 'ability', label: 'dex' }] },
        { id: 'tool-thief', name: "Thieves' Tools", page: 2, left: ['tool'], right: [{ path: 'ability/dex', root: 'ability', label: 'dex' }] },
        { id: 'tool-alchemist', name: "Alchemist's Supplies", page: 2, left: ['tool'], right: [{ path: 'ability/int', root: 'ability', label: 'int' }] }
    ];

    actionDisplay.getActions = async () => mockActions;

    // Test with 'all' left tab active
    const ctxAll = await app._prepareContext({});
    assert.equal(ctxAll.itemTypes.some(t => t.id === 'tool'), true);
    const toolTab = ctxAll.itemTypes.find(t => t.id === 'tool');
    assert.equal(toolTab.label, 'DND5E.ItemTypeToolPlural');
    assert.equal(toolTab.icon, 'fas fa-hammer');
    assert.equal(ctxAll.items.length, 4);

    // Test filtering by 'tool' left tab
    app.leftTabs.activeParents.clear();
    app.leftTabs.activeParents.add('tool');
    const ctxTools = await app._prepareContext({});
    assert.equal(ctxTools.items.length, 2);
    assert.deepEqual(ctxTools.items.map(i => i.id).sort(), ['tool-alchemist', 'tool-thief']);

    // Test filtering with right-side ability tab (e.g. dex)
    app.rightTabs.activeParents.clear();
    app.rightTabs.activeParents.add('ability');
    app.rightTabs.activeSubTypes.clear();
    app.rightTabs.activeSubTypes.add('dex');
    const ctxDexTools = await app._prepareContext({});
    assert.equal(ctxDexTools.items.length, 1);
    assert.equal(ctxDexTools.items[0].id, 'tool-thief');
});


