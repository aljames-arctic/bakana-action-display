import test from 'node:test';
import assert from 'node:assert/strict';
import '../setup.js';
import { ActionDisplayApp } from '../../src/ui/action-display-app.js';
import { actionDisplay } from '../../src/action-display.js';
import { HUDTab } from '../../src/ui/hud-tab.js';

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
