import test from 'node:test';
import assert from 'node:assert/strict';
import '../setup.js';
import { MODULE_ID } from '../../src/constants.js';
import { adapter } from '../../src/adapters/index.js';
import { Dnd5eSystemAdapter } from '../../src/adapters/system/dnd5e-system-adapter.js';
import { Dnd5eAutoBanConfigApp, DEFAULT_DND5E_AUTOBAN_CONFIG } from '../../src/ui/dnd5e-autoban-config-app.js';
import { ActionDisplayApp } from '../../src/ui/action-display-app.js';
import { HUDTabColumn } from '../../src/ui/hud-tab-column.js';
import { actionDisplay } from '../../src/action-display.js';

test('Dnd5eAutoBanConfigApp prepares context, adds/removes conditions, resets defaults, and saves config', async () => {
    game.system = { id: 'dnd5e' };
    adapter.system = new Dnd5eSystemAdapter();
    const app = new Dnd5eAutoBanConfigApp();

    const context = await app._prepareContext({});
    assert.equal(context.config.enabled, true);
    assert.ok(context.availableStatuses.length > 0, 'Available statuses should be populated');
    assert.ok(context.vocalConditions.some(c => c.id === 'silence'), 'Silence should be in vocal conditions');
    assert.ok(context.somaticConditions.some(c => c.id === 'restrained'), 'Restrained should be in somatic conditions');

    // Test addCondition
    app.element = {
        querySelector: (sel) => sel.includes('vocal') ? { value: 'deafened' } : null
    };

    const mockAddTarget = {
        dataset: { type: 'vocal' }
    };
    app._onAddCondition({ preventDefault: () => {} }, mockAddTarget);
    assert.ok(app.config.vocal.includes('deafened'), 'Deafened added to vocal conditions');

    // Test removeCondition
    const mockRemoveTarget = {
        dataset: { type: 'vocal', id: 'deafened' }
    };
    app._onRemoveCondition({ preventDefault: () => {} }, mockRemoveTarget);
    assert.equal(app.config.vocal.includes('deafened'), false, 'Deafened removed from vocal conditions');

    // Test resetDefaults
    app.config.vocal = [];
    app._onResetDefaults({ preventDefault: () => {} }, {});
    assert.deepEqual(app.config.vocal, DEFAULT_DND5E_AUTOBAN_CONFIG.vocal);

    // Test saveConfig
    let saved = false;
    app.close = () => { saved = true; };
    await app._onSaveConfig({ preventDefault: () => {} }, {});
    assert.equal(saved, true);
});

test('Dnd5eSystemAdapter getActorStatuses extracts statuses from actor.statuses and active effects', () => {
    const dndAdapter = new Dnd5eSystemAdapter();

    const actor = {
        statuses: new Set(['silence']),
        effects: [
            { disabled: false, isSuppressed: false, statuses: new Set(['restrained']) },
            { disabled: true, isSuppressed: false, statuses: new Set(['paralyzed']) },
            { disabled: false, isSuppressed: false, getFlag: (mod, key) => key === 'statusId' ? 'blinded' : null }
        ]
    };

    const statuses = dndAdapter.getActorStatuses(actor);
    assert.equal(statuses.has('silence'), true);
    assert.equal(statuses.has('restrained'), true);
    assert.equal(statuses.has('blinded'), true);
    assert.equal(statuses.has('paralyzed'), false, 'Disabled effect status ignored');
});

test('Dnd5eSystemAdapter syncActorAutoBans applies auto-bans on condition gain and removes on condition loss', () => {
    const dndAdapter = new Dnd5eSystemAdapter();
    game.system = { id: 'dnd5e' };

    const flags = {};
    const actor = {
        isOwner: true,
        statuses: new Set(),
        effects: [],
        getFlag: (mod, key) => flags[key] ?? null,
        setFlag: async (mod, key, val) => { flags[key] = val; }
    };

    const tabColumn = new HUDTabColumn({
        side: 'right',
        defaultParent: 'all'
    });

    // 1. Initial sync (no conditions) -> no bans
    adapter.updateTabs(actor, tabColumn);
    assert.equal(tabColumn.activeParents.has('components'), false);
    assert.equal(tabColumn.activeSubTypes.has('vocal'), false);

    // 2. Gain 'silence' -> auto-ban 'vocal'
    actor.statuses.add('silence');
    adapter.updateTabs(actor, tabColumn);
    assert.equal(tabColumn.activeParents.has('components'), true);
    assert.equal(tabColumn.activeSubTypes.has('vocal'), true);
    assert.equal(flags.autoBannedComponents?.vocal, true);

    // 3. Gain 'restrained' -> auto-ban 'somatic'
    actor.statuses.add('restrained');
    dndAdapter.updateTabs(actor, tabColumn);
    assert.equal(tabColumn.activeParents.has('components'), true);
    assert.equal(tabColumn.activeSubTypes.has('vocal'), true);
    assert.equal(tabColumn.activeSubTypes.has('somatic'), true);
    assert.equal(flags.autoBannedComponents?.somatic, true);

    // 4. Lose 'silence' (restrained remains) -> vocal unbanned, somatic remains banned
    actor.statuses.delete('silence');
    adapter.updateTabs(actor, tabColumn);
    assert.equal(tabColumn.activeParents.has('components'), true);
    assert.equal(tabColumn.activeSubTypes.has('vocal'), false);
    assert.equal(tabColumn.activeSubTypes.has('somatic'), true);
    assert.equal(flags.autoBannedComponents?.vocal, false);
    assert.equal(flags.autoBannedComponents?.somatic, true);

    // 5. Lose 'restrained' -> all conditions lost, somatic unbanned, components parent removed
    actor.statuses.delete('restrained');
    adapter.updateTabs(actor, tabColumn);
    assert.equal(tabColumn.activeParents.has('components'), false);
    assert.equal(tabColumn.activeSubTypes.has('somatic'), false);
    assert.equal(flags.autoBannedComponents?.somatic, false);
});

test('HUDTabColumn preserves banned components when selecting action economy or all actions tabs', () => {
    game.system = { id: 'dnd5e' };
    adapter.system = new Dnd5eSystemAdapter();
    const tabColumn = new HUDTabColumn({
        side: 'right',
        defaultParent: 'all'
    });

    // Ban 'vocal' component
    tabColumn.activeParents.add('components');
    tabColumn.activeSubTypes.add('vocal');

    const groups = {
        'all': { getAllSubTabIds: () => new Set(['all']) },
        'standard': { getAllSubTabIds: () => new Set(['action', 'bonus', 'reaction']) },
        'components': { getAllSubTabIds: () => new Set(['vocal', 'somatic', 'material']) }
    };

    // 1. Select 'standard' (Action Economy) parent tab
    tabColumn.selectParent('standard', groups);
    assert.equal(tabColumn.activeParents.has('standard'), true);
    assert.equal(tabColumn.activeParents.has('components'), true, 'components parent preserved');
    assert.equal(tabColumn.activeSubTypes.has('vocal'), true, 'vocal ban preserved');

    // 2. Select 'all' parent tab
    tabColumn.selectParent('all', groups);
    assert.equal(tabColumn.activeParents.has('all'), true);
    assert.equal(tabColumn.activeParents.has('components'), true, 'components parent preserved when all selected');
    assert.equal(tabColumn.activeSubTypes.has('vocal'), true, 'vocal ban preserved when all selected');

    // 3. Player manually left-clicks 'vocal' to remove ban
    tabColumn.selectSub('components', 'vocal', groups, true);
    assert.equal(tabColumn.activeSubTypes.has('vocal'), false, 'vocal unbanned on manual click');
    assert.equal(tabColumn.activeParents.has('components'), false, 'components removed when no subtabs active');
});

test('Dnd5eSystemTabFilterManager filters spells matching auto-banned components', () => {
    const dndAdapter = new Dnd5eSystemAdapter();
    const filterManager = dndAdapter.filterManager;

    const vocalSpell = {
        name: 'Vocal Spell',
        properties: new Set(['vocal', 'somatic']),
        right: [
            { root: 'components', label: 'vocal' },
            { root: 'components', label: 'somatic' },
            { root: 'standard', label: 'action' }
        ]
    };

    const somaticOnlySpell = {
        name: 'Somatic Only Spell',
        properties: new Set(['somatic']),
        right: [
            { root: 'components', label: 'somatic' },
            { root: 'standard', label: 'action' }
        ]
    };

    const groups = {
        'all': { getAllSubTabIds: () => new Set(['all']) },
        'standard': { getAllSubTabIds: () => new Set(['action', 'bonus', 'reaction']) },
        'components': { getAllSubTabIds: () => new Set(['vocal', 'somatic', 'material']) }
    };

    // Filter context with vocal banned
    const filterContext = {
        right: {
            activeParents: new Set(['all', 'components']),
            activeSubTypes: new Set(['vocal']),
            groups
        }
    };

    assert.equal(filterManager.matchesEconomyTabs(vocalSpell, filterContext), false, 'Vocal spell filtered out');
    assert.equal(filterManager.matchesEconomyTabs(somaticOnlySpell, filterContext), true, 'Somatic-only spell allowed');

    // Filter context after vocal unbanned
    const unbannedContext = {
        right: {
            activeParents: new Set(['all']),
            activeSubTypes: new Set(),
            groups
        }
    };

    assert.equal(filterManager.matchesEconomyTabs(vocalSpell, unbannedContext), true, 'Vocal spell visible after unban');
    assert.equal(filterManager.matchesEconomyTabs(somaticOnlySpell, unbannedContext), true, 'Somatic spell visible');
});
