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
    assert.ok(context.vocalConditions.some(c => c.id === 'silenced'), 'Silenced should be in vocal conditions');
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
        statuses: new Set(['silenced']),
        effects: [
            { disabled: false, isSuppressed: false, statuses: new Set(['restrained']) },
            { disabled: true, isSuppressed: false, statuses: new Set(['paralyzed']) },
            { disabled: false, isSuppressed: false, getFlag: (mod, key) => key === 'statusId' ? 'blinded' : null }
        ]
    };

    const statuses = dndAdapter.getActorStatuses(actor);
    assert.equal(statuses.has('silenced'), true);
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

    // 2. Gain 'silenced' -> auto-ban 'vocal'
    actor.statuses.add('silenced');
    adapter.updateTabs(actor, tabColumn);
    assert.equal(tabColumn.activeParents.has('components'), true);
    assert.equal(tabColumn.activeSubTypes.has('vocal'), true);
    assert.deepEqual(flags.autoBanState?.conditions?.vocal, ['silenced']);

    // 3. Gain 'restrained' -> auto-ban 'somatic'
    actor.statuses.add('restrained');
    dndAdapter.updateTabs(actor, tabColumn);
    assert.equal(tabColumn.activeParents.has('components'), true);
    assert.equal(tabColumn.activeSubTypes.has('vocal'), true);
    assert.equal(tabColumn.activeSubTypes.has('somatic'), true);
    assert.deepEqual(flags.autoBanState?.conditions?.somatic, ['restrained']);

    // 4. Lose 'silenced' (restrained remains) -> vocal unbanned, somatic remains banned
    actor.statuses.delete('silenced');
    adapter.updateTabs(actor, tabColumn);
    assert.equal(tabColumn.activeParents.has('components'), true);
    assert.equal(tabColumn.activeSubTypes.has('vocal'), false);
    assert.equal(tabColumn.activeSubTypes.has('somatic'), true);
    assert.deepEqual(flags.autoBanState?.conditions?.vocal, []);
    assert.deepEqual(flags.autoBanState?.conditions?.somatic, ['restrained']);

    // 5. Lose 'restrained' -> all conditions lost, somatic unbanned, components parent removed
    actor.statuses.delete('restrained');
    adapter.updateTabs(actor, tabColumn);
    assert.equal(tabColumn.activeParents.has('components'), false);
    assert.equal(tabColumn.activeSubTypes.has('somatic'), false);
    assert.deepEqual(flags.autoBanState?.conditions?.somatic, []);
});

test('Dnd5eSystemAdapter re-bans spell component when gaining a new condition after manual unban', () => {
    const dndAdapter = new Dnd5eSystemAdapter();
    adapter.system = dndAdapter;
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

    const groups = {
        'all': { getAllSubTabIds: () => new Set(['all']) },
        'components': { getAllSubTabIds: () => new Set(['vocal', 'somatic', 'material']) }
    };

    // 1. Actor becomes 'grappled' -> somatic is auto-banned
    actor.statuses.add('grappled');
    adapter.updateTabs(actor, tabColumn);
    assert.equal(tabColumn.activeParents.has('components'), true);
    assert.equal(tabColumn.activeSubTypes.has('somatic'), true, 'Somatic banned when grappled');

    // 2. Player manually unbans somatic
    tabColumn.selectSub('components', 'somatic', groups, true);
    adapter.recordManualTabToggle(actor, 'components', 'somatic', tabColumn.activeSubTypes.has('somatic'));
    assert.equal(tabColumn.activeSubTypes.has('somatic'), false, 'Somatic manually unbanned');
    assert.equal(flags.autoBanState?.manualUnbans?.somatic, true, 'Manual unban recorded in flag');

    // Re-renders/updates while still grappled should keep somatic unbanned
    adapter.updateTabs(actor, tabColumn);
    assert.equal(tabColumn.activeSubTypes.has('somatic'), false, 'Somatic remains unbanned on re-render while grappled');

    // 3. Actor becomes 'petrified' (while still 'grappled') -> somatic should be banned AGAIN
    actor.statuses.add('petrified');
    adapter.updateTabs(actor, tabColumn);
    assert.equal(tabColumn.activeParents.has('components'), true);
    assert.equal(tabColumn.activeSubTypes.has('somatic'), true, 'Somatic banned again upon gaining petrified');
    assert.equal(flags.autoBanState?.manualUnbans?.somatic, false, 'Manual unban reset on new condition');

    // 4. Player manually unbans somatic again
    tabColumn.selectSub('components', 'somatic', groups, true);
    adapter.recordManualTabToggle(actor, 'components', 'somatic', tabColumn.activeSubTypes.has('somatic'));
    assert.equal(tabColumn.activeSubTypes.has('somatic'), false, 'Somatic manually unbanned again');

    // 5. Actor loses 'petrified' (still 'grappled') -> somatic stays unbanned
    actor.statuses.delete('petrified');
    adapter.updateTabs(actor, tabColumn);
    assert.equal(tabColumn.activeSubTypes.has('somatic'), false, 'Somatic stays unbanned when losing petrified');

    // 6. Actor loses 'grappled' (all conditions gone) -> clean reset
    actor.statuses.delete('grappled');
    adapter.updateTabs(actor, tabColumn);
    assert.equal(tabColumn.activeParents.has('components'), false);
    assert.equal(tabColumn.activeSubTypes.has('somatic'), false);
    assert.equal(flags.autoBanState?.manualUnbans?.somatic, false);
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

test('Status condition change while HUD is closed updates banned options without opening the HUD', () => {
    const dndAdapter = new Dnd5eSystemAdapter();
    adapter.system = dndAdapter;
    game.system = { id: 'dnd5e' };

    const flags = {};
    const actor = {
        isOwner: true,
        statuses: new Set(),
        effects: [],
        getFlag: (mod, key) => flags[key] ?? null,
        setFlag: async (mod, key, val) => { flags[key] = val; }
    };

    // Ensure activeApp is null (HUD is closed)
    actionDisplay.activeApp = null;

    // 1. Actor gains 'silenced' while HUD is closed
    actor.statuses.add('silenced');
    adapter.updateTabs(actor, null);

    // Verify flags updated in the background without needing a HUD instance
    assert.deepEqual(flags.autoBanState?.conditions?.vocal, ['silenced']);
    assert.equal(actionDisplay.activeApp, null, 'HUD remains closed');

    // 2. Later, when the HUD is opened for this actor, verify tabColumn reflects the ban
    const newHUDTabColumn = new HUDTabColumn({
        side: 'right',
        defaultParent: 'all'
    });
    adapter.updateTabs(actor, newHUDTabColumn);

    assert.equal(newHUDTabColumn.activeParents.has('components'), true);
    assert.equal(newHUDTabColumn.activeSubTypes.has('vocal'), true, 'Vocal is banned on open HUD');
    assert.equal(newHUDTabColumn.activeSubTypes.has('somatic'), false);
});

test('Manual component toggles when no conditions active alternate cleanly on every click', () => {
    const dndAdapter = new Dnd5eSystemAdapter();
    adapter.system = dndAdapter;
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

    const groups = {
        'all': { getAllSubTabIds: () => new Set(['all']) },
        'components': { getAllSubTabIds: () => new Set(['vocal', 'somatic', 'material']) }
    };

    // Initial sync
    adapter.updateTabs(actor, tabColumn);
    assert.equal(tabColumn.activeSubTypes.has('vocal'), false);

    // Click 1: Unselected -> Selected
    tabColumn.selectSub('components', 'vocal', groups, true);
    adapter.recordManualTabToggle(actor, 'components', 'vocal', tabColumn.activeSubTypes.has('vocal'));
    adapter.updateTabs(actor, tabColumn);
    assert.equal(tabColumn.activeSubTypes.has('vocal'), true, 'Click 1 selects vocal');

    // Click 2: Selected -> Unselected
    tabColumn.selectSub('components', 'vocal', groups, true);
    adapter.recordManualTabToggle(actor, 'components', 'vocal', tabColumn.activeSubTypes.has('vocal'));
    adapter.updateTabs(actor, tabColumn);
    assert.equal(tabColumn.activeSubTypes.has('vocal'), false, 'Click 2 unselects vocal');

    // Click 3: Unselected -> Selected
    tabColumn.selectSub('components', 'vocal', groups, true);
    adapter.recordManualTabToggle(actor, 'components', 'vocal', tabColumn.activeSubTypes.has('vocal'));
    adapter.updateTabs(actor, tabColumn);
    assert.equal(tabColumn.activeSubTypes.has('vocal'), true, 'Click 3 selects vocal');

    // Click 4: Selected -> Unselected
    tabColumn.selectSub('components', 'vocal', groups, true);
    adapter.recordManualTabToggle(actor, 'components', 'vocal', tabColumn.activeSubTypes.has('vocal'));
    adapter.updateTabs(actor, tabColumn);
    assert.equal(tabColumn.activeSubTypes.has('vocal'), false, 'Click 4 unselects vocal');
});

test('Manual unban while grappled unselects somatic on the very first click without reversion', () => {
    const dndAdapter = new Dnd5eSystemAdapter();
    adapter.system = dndAdapter;
    game.system = { id: 'dnd5e' };

    const flags = {};
    const actor = {
        isOwner: true,
        statuses: new Set(['grappled']),
        effects: [],
        getFlag: (mod, key) => flags[key] ?? null,
        setFlag: async (mod, key, val) => { flags[key] = val; }
    };

    const tabColumn = new HUDTabColumn({
        side: 'right',
        defaultParent: 'all'
    });

    const groups = {
        'all': { getAllSubTabIds: () => new Set(['all']) },
        'components': { getAllSubTabIds: () => new Set(['vocal', 'somatic', 'material']) }
    };

    // Initial sync on HUD open while grappled
    adapter.updateTabs(actor, tabColumn);
    assert.equal(tabColumn.activeSubTypes.has('somatic'), true, 'Somatic is auto-banned');

    // Click 1: User clicks somatic to unban it
    tabColumn.selectSub('components', 'somatic', groups, true);
    adapter.recordManualTabToggle(actor, 'components', 'somatic', tabColumn.activeSubTypes.has('somatic'));
    adapter.updateTabs(actor, tabColumn);
    assert.equal(tabColumn.activeSubTypes.has('somatic'), false, 'First click immediately unbans somatic');

    // Subsequent renders while grappled must not re-ban it
    adapter.updateTabs(actor, tabColumn);
    assert.equal(tabColumn.activeSubTypes.has('somatic'), false, 'Subsequent render preserves unban');
});
