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
    assert.equal(adapter.matchesEconomyTabs(action, { all: { active: true } }), true);

    // Economy action active -> match
    assert.equal(adapter.matchesEconomyTabs(action, {
        economy: { subTabs: { action: { active: true } } }
    }), true);

    // Exclusion filter check
    assert.equal(adapter.matchesEconomyTabs(action, {
        economy: {
            subTabs: {
                action: { active: true },
                weapon: { active: true, exclude: true }
            }
        }
    }), false);
});
