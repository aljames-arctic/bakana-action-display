import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { BaseSystemAdapter } from '../../src/adapters/system/base-system-adapter.js';
import { TabRef } from '../../src/ui/tab-ref.js';

test('BaseSystemAdapter initialization and metadata', () => {
    const adapter = new BaseSystemAdapter('test-system');
    assert.equal(adapter.systemId, 'test-system');
    assert.equal(adapter.shouldExtractItem({ type: 'any' }), true);
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
        tabs: [TabRef.from('economy', 'action')],
        itemTypes: ['weapon']
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
        { id: 'sub-2', name: 'Second Strike', activationType: 'action', sort: 2, tabs: [TabRef.from('economy', 'action')] },
        { id: 'sub-1', name: 'First Strike', activationType: 'action', sort: 1, tabs: [TabRef.from('economy', 'action')] }
    ];

    const filtered = adapter.filterSubactions(subactions, {
        right: { activeParents: new Set(['all']), activeSubTypes: new Set() }
    });

    assert.equal(filtered.length, 2);
    assert.equal(filtered[0].id, 'sub-2'); // filterSubactions filters array of subactions matching context
});
