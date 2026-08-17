import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { BaseSystemAdapter } from '../../src/adapters/system/base-system-adapter.js';
import { TabRef } from '../../src/ui/tab-ref.js';

test('BaseSystemAdapter initialization and metadata', () => {
    const adapter = new BaseSystemAdapter('test-system');
    assert.equal(adapter.systemId, 'test-system');
    assert.equal(adapter.shouldExtractItem({ type: 'any' }), true);
    const defaultCategories = adapter.getDefaultCategories();
    assert.equal(defaultCategories.length, 3);
    assert.equal(defaultCategories[0].name, 'Weapons');
    assert.equal(defaultCategories[1].name, 'Spells');
    assert.equal(defaultCategories[2].name, 'Features');
});

test('BaseSystemAdapter label and icon getters', () => {
    const adapter = new BaseSystemAdapter('test-system');

    assert.equal(adapter.getItemTypeIcon('all'), 'fas fa-border-all');
    assert.equal(adapter.getItemTypeIcon('unknown'), 'fas fa-question');

    assert.equal(adapter.getActionTypeIcon('all'), 'fas fa-border-all');
    assert.equal(adapter.getActionTypeIcon('none'), 'fas fa-ban');
    assert.equal(adapter.getActionTypeIcon('unknown'), 'fas fa-question');

    assert.equal(adapter.getItemSubTabLabel('spell', 'melee'), 'MELEE');
    assert.equal(adapter.getActionTypeLabel('action'), 'ACTION');
    assert.equal(adapter.getActionSubTabLabel('action'), 'ACTION');
});

test('BaseSystemAdapter sort order lookups', () => {
    const adapter = new BaseSystemAdapter('test-system');

    assert.equal(adapter.getItemTypeSortOrder('all'), 0);
    assert.equal(adapter.getItemTypeSortOrder('weapon'), 1);
    assert.equal(adapter.getItemTypeSortOrder('unknown'), 999);

    assert.equal(adapter.getItemSubTabSortOrder('spell', 'all'), 0);
    assert.equal(adapter.getItemSubTabSortOrder('spell', 'itemCharges'), 99);
    assert.equal(adapter.getItemSubTabSortOrder('spell', '3'), 4);
    assert.equal(adapter.getItemSubTabSortOrder('spell', 'foo'), 999);

    assert.equal(adapter.getActionTypeSortOrder('economy'), 1);
    assert.equal(adapter.getActionSubTabSortOrder('economy', 'all'), 0);
});

test('BaseSystemAdapter matchesEconomyTabs matching logic', () => {
    const adapter = new BaseSystemAdapter('test-system');

    const action = {
        rightTab: [TabRef.from('economy', 'action')],
        leftTab: ['weapon']
    };

    // All active -> match
    assert.equal(adapter.matchesEconomyTabs(action, {
        right: { activeParents: new Set(['all']), activeSubTypes: new Set() }
    }), true);

    // Economy action active -> match
    assert.equal(adapter.matchesEconomyTabs(action, {
        right: {
            activeParents: new Set(['economy']),
            activeSubTypes: new Set(['action']),
            groups: { economy: { subTabs: [{ id: 'action' }] } }
        }
    }), true);
});

test('BaseSystemAdapter resource depletion check', () => {
    const adapter = new BaseSystemAdapter('test-system');

    assert.equal(adapter._isResourceDepleted({ uses: { available: 0 } }), true);
    assert.equal(adapter._isResourceDepleted({ uses: { available: 1 } }), false);
    assert.equal(adapter._isResourceDepleted({ uses: null }), false);
});

test('BaseSystemAdapter filterSubactions filtering and sorting', () => {
    const adapter = new BaseSystemAdapter('test-system');

    const subactions = [
        { id: 'sub-2', name: 'Second Strike', activationType: 'action', sort: 2, rightTab: [TabRef.from('economy', 'action')] },
        { id: 'sub-1', name: 'First Strike', activationType: 'action', sort: 1, rightTab: [TabRef.from('economy', 'action')] }
    ];

    const filtered = adapter.filterSubactions(subactions, {
        right: { activeParents: new Set(['all']), activeSubTypes: new Set() }
    });

    assert.equal(filtered.length, 2);
    assert.equal(filtered[0].id, 'sub-2'); // filterSubactions filters array of subactions matching context
});

import { HUDTabColumn } from '../../src/ui/hud-tab-column.js';

test('BaseSystemAdapter default active sub-types and HUDTabColumn initialization', () => {
    const adapter = new BaseSystemAdapter('test-system');
    assert.deepEqual(adapter.getDefaultActiveLeftSubTypes(), []);
    assert.deepEqual(adapter.getDefaultActiveSubTypes(), []);

    globalThis.actionDisplay = { activeSystemAdapter: adapter };
    const leftTabs = new HUDTabColumn({
        side: 'left',
        getDefaultSubTypes: () => actionDisplay.activeSystemAdapter.getDefaultActiveLeftSubTypes()
    });
    const rightTabs = new HUDTabColumn({
        side: 'right',
        getDefaultSubTypes: () => actionDisplay.activeSystemAdapter.getDefaultActiveSubTypes()
    });
    assert.equal(leftTabs.side, 'left');
    assert.equal(rightTabs.side, 'right');
    assert.deepEqual([...leftTabs.activeSubTypes], []);
    assert.deepEqual([...rightTabs.activeSubTypes], []);

    const page2Column = new HUDTabColumn({ side: 'left', defaultParent: 'all' });
    assert.equal(page2Column.focusedParent, 'all');
    assert.equal(page2Column.activeParents.has('all'), true);
});

test('BaseSystemAdapter formatFlatLayout and formatSplitLayout templates', () => {
    const adapter = new BaseSystemAdapter('test-system');
    const items = [
        { id: 'b', name: 'B-Skill', section: 'other' },
        { id: 'a', name: 'A-Core', section: 'core' },
        { id: 'c', name: 'C-Core', section: 'core' }
    ];

    const flatContext = { items };
    adapter.formatFlatLayout(flatContext);
    assert.equal(flatContext.layout, 'flat');

    const splitContext = { items };
    adapter.formatSplitLayout(splitContext);
    assert.equal(splitContext.layout, 'split');
    assert.equal(splitContext.coreItems.length, 2);
    assert.equal(splitContext.coreItems[0].id, 'a'); // Sorted alphabetically
    assert.equal(splitContext.otherItems.length, 1);
    assert.equal(splitContext.showSeparator, true);
});

test('BaseSystemAdapter modifyContext defaults to flat layout regardless of activePage (split layout is Dnd5e exclusive)', () => {
    const adapter = new BaseSystemAdapter('test-system');
    const items = [
        { id: 'b', name: 'B-Skill', section: 'other' },
        { id: 'a', name: 'A-Core', section: 'core' }
    ];

    const ctxStr = { items };
    adapter.modifyContext(ctxStr, { activePage: '2' });
    assert.equal(ctxStr.layout, 'flat');

    const ctxNum = { items };
    adapter.modifyContext(ctxNum, { activePage: 1 });
    assert.equal(ctxNum.layout, 'flat');
});

test('HUDTabColumn resets to default "all" when sole parent is deselected, but not when all main parent tabs are multi-selected', async () => {
    const { HUDTabColumn } = await import('../../src/ui/hud-tab-column.js');
    const col = new HUDTabColumn({ side: 'left', defaultParent: 'all' });
    const groups = {
        all: { id: 'all', subTabs: [] },
        savingThrow: { id: 'savingThrow', subTabs: [] },
        abilityCheck: { id: 'abilityCheck', subTabs: [] }
    };

    col.selectParent('savingThrow', groups);
    assert.ok(col.activeParents.has('savingThrow'));

    // Selecting all main parent tabs does NOT revert to 'all'
    col.toggleParent('abilityCheck', groups);
    assert.ok(col.activeParents.has('savingThrow'));
    assert.ok(col.activeParents.has('abilityCheck'));
    assert.ok(!col.activeParents.has('all'));
    assert.equal(col.activeParents.size, 2);

    // Deselecting the sole active parent reverts to 'all'
    col.selectParent('savingThrow', groups);
    assert.ok(col.activeParents.has('savingThrow'));
    col.toggleParent('savingThrow', groups);
    assert.ok(col.activeParents.has('all'));
});

test('ActionDisplayApp _onRollAction bypasses activity dropdown when only one subaction qualifies and collapseDropdownIfSingle is true', async () => {
    const { ActionDisplayApp } = await import('../../src/ui/action-display-app.js');
    const { actionDisplay } = await import('../../src/action-display.js');
    let rolled = false;
    const action = {
        id: 'ability-str',
        name: 'Strength',
        collapseDropdownIfSingle: true,
        subactions: [
            { id: 'save-str', leftTab: ['savingThrow'], roll: () => { rolled = true; } },
            { id: 'check-str', leftTab: ['abilityCheck'], roll: () => {} }
        ]
    };

    actionDisplay.activeSystemAdapter = {
        filterSubactions: () => [action.subactions[0]],
        getActiveExclusionSubs: () => [],
        getDefaultActiveLeftSubTypes: () => [],
        getDefaultActiveSubTypes: () => []
    };

    const app = new ActionDisplayApp({ actor: {} });
    app.displayedActions = [action];
    app._getFilterContext = () => ({});

    let dropdownCalled = false;
    app._showActivityDropdown = () => { dropdownCalled = true; };

    const fakeTarget = { dataset: { actionId: 'ability-str' } };
    await app._onRollAction({ preventDefault: () => {} }, fakeTarget);

    assert.equal(dropdownCalled, false);
    assert.equal(rolled, true);
});

test('ActionDisplayApp _onRollAction preserves dropdown on regular items when collapseDropdownIfSingle is false', async () => {
    const { ActionDisplayApp } = await import('../../src/ui/action-display-app.js');
    const { actionDisplay } = await import('../../src/action-display.js');
    const action = {
        id: 'item-spell',
        name: 'Fireball',
        collapseDropdownIfSingle: false,
        subactions: [
            { id: 'sub-1', name: 'Cast', roll: () => {} },
            { id: 'sub-2', name: 'Versatile', roll: () => {} }
        ]
    };

    actionDisplay.activeSystemAdapter = {
        filterSubactions: () => [action.subactions[0]],
        getActiveExclusionSubs: () => [],
        getDefaultActiveLeftSubTypes: () => [],
        getDefaultActiveSubTypes: () => []
    };

    const app = new ActionDisplayApp({ actor: {} });
    app.displayedActions = [action];
    app._getFilterContext = () => ({});

    let dropdownCalled = false;
    app._showActivityDropdown = () => { dropdownCalled = true; };

    const fakeTarget = { dataset: { actionId: 'item-spell' } };
    await app._onRollAction({ preventDefault: () => {} }, fakeTarget);

    assert.equal(dropdownCalled, true);
});
