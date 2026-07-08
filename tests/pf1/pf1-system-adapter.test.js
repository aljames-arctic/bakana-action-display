import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Pf1SystemAdapter } from '../../src/adapters/system/pf1-system-adapter.js';

test('Pf1SystemAdapter initialization and extractable item types', () => {
    const adapter = new Pf1SystemAdapter();
    assert.equal(adapter.systemId, 'pf1');
    assert.equal(adapter.shouldExtractItem({ type: 'spell' }), true);
    assert.equal(adapter.shouldExtractItem({ type: 'attack' }), true);
    assert.equal(adapter.shouldExtractItem({ type: 'buff' }), true);
    assert.equal(adapter.shouldExtractItem({ type: 'class' }), false);
});

test('Pf1SystemAdapter label lookups and spell sub-tab labels', () => {
    const adapter = new Pf1SystemAdapter();

    assert.equal(adapter.getItemSubTabLabel('spell', 'cantrip'), 'PF1.CantripPlural');
    assert.equal(adapter.getItemSubTabLabel('spell', '1'), 'PF1.SpellLevel1');
    assert.equal(adapter.getItemSubTabLabel('spell', 'sla'), 'PF1.SpellLike');

    assert.equal(adapter.getActionSubTabLabel('action'), 'PF1.Activation.action.Plural');
    assert.equal(adapter.getActionSubTabLabel('bonus'), 'PF1.Activation.swift.Single');
    assert.equal(adapter.getActionSubTabLabel('reaction'), 'PF1.Activation.immediate.Single');
});

test('Pf1SystemAdapter sort orders', () => {
    const adapter = new Pf1SystemAdapter();

    assert.equal(adapter.getItemSubTabSortOrder('spell', 'cantrip'), 0);
    assert.equal(adapter.getItemSubTabSortOrder('spell', '1'), 3);
    assert.equal(adapter.getItemSubTabSortOrder('spell', 'sla'), 12);
});
