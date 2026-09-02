import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import '../setup.js';
import { ActionDisplayApp } from '../../src/ui/action-display-app.js';
import { ControlBarManager } from '../../src/ui/app/control-bar-manager.js';
import { Dnd5eSystemContextModifier } from '../../src/adapters/system/context-modifier/dnd5e-system-context-modifier.js';
import { Pf1SystemAdapter } from '../../src/adapters/system/pf1-system-adapter.js';
import { Pf2eSystemAdapter } from '../../src/adapters/system/pf2e-system-adapter.js';
import { HUDTab } from '../../src/ui/hud-tab.js';
import { MODULE_ID } from '../../src/constants.js';

test('showTooltips setting defaults to false', () => {
    const settingValue = game.settings.get(MODULE_ID, 'showTooltips');
    assert.equal(settingValue, false, 'showTooltips should be false by default');
});

test('ActionDisplayApp._prepareContext populates context.showTooltips and control button tooltips based on setting', async () => {
    const app = new ActionDisplayApp({ actor: { id: 'test-actor', isOwner: true } });

    // 1. When showTooltips is false (default)
    await game.settings.set(MODULE_ID, 'showTooltips', false);
    const contextDefault = await app._prepareContext({});
    assert.equal(contextDefault.showTooltips, false);
    for (const btn of [...contextDefault.controlButtons.left, ...contextDefault.controlButtons.right]) {
        assert.equal(btn.tooltip, null, `Button ${btn.id} should have null tooltip when showTooltips is false`);
    }

    // 2. When showTooltips is true
    await game.settings.set(MODULE_ID, 'showTooltips', true);
    try {
        const contextEnabled = await app._prepareContext({});
        assert.equal(contextEnabled.showTooltips, true);
        for (const btn of [...contextEnabled.controlButtons.left, ...contextEnabled.controlButtons.right]) {
            assert.ok(typeof btn.tooltip === 'string' && btn.tooltip.length > 0, `Button ${btn.id} should have tooltip when showTooltips is true`);
        }
    } finally {
        await game.settings.set(MODULE_ID, 'showTooltips', false);
    }
});

test('Dnd5eSystemContextModifier sets right-click tab tooltips only when showTooltips is true', () => {
    const modifier = new Dnd5eSystemContextModifier({});
    const mockApp = {
        actor: {
            id: 'actor-1',
            isOwner: true,
            getFlag: () => false
        },
        leftTabs: {
            activeParents: new Set(),
            activeSubTypes: new Set()
        }
    };

    const makeTabGroups = () => [
        new HUDTab({ id: 'all', label: 'All Items' }),
        new HUDTab({ id: 'spell', label: 'Spells' }),
        new HUDTab({ id: 'weapon', label: 'Weapons' }),
        new HUDTab({ id: 'equipment', label: 'Equipment' }),
        new HUDTab({ id: 'consumable', label: 'Consumables' }),
        new HUDTab({ id: 'tool', label: 'Tools' }),
        new HUDTab({ id: 'backpack', label: 'Backpacks' }),
        new HUDTab({ id: 'loot', label: 'Loot' })
    ];

    // Case 1: showTooltips = false
    const contextDisabled = { itemTypes: makeTabGroups(), showTooltips: false };
    modifier.modifyContext(contextDisabled, mockApp);
    for (const tab of contextDisabled.itemTypes) {
        assert.equal(tab.tooltip, '', `Tab ${tab.id} should have empty tooltip when showTooltips is false`);
    }

    // Case 2: showTooltips = true
    const contextEnabled = { itemTypes: makeTabGroups(), showTooltips: true };
    modifier.modifyContext(contextEnabled, mockApp);
    const allTab = contextEnabled.itemTypes.find(t => t.id === 'all');
    assert.ok(allTab.tooltip.includes('BAD.tabs.allTooltip') || allTab.tooltip.includes('<b>Right Click:</b> Toggle Show All'));

    const spellTab = contextEnabled.itemTypes.find(t => t.id === 'spell');
    assert.ok(spellTab.tooltip.includes('BAD.tabs.unpreparedSpellsTooltip') || spellTab.tooltip.includes('<b>Right Click:</b> Toggle Show Unprepared Spells'));

    const weaponTab = contextEnabled.itemTypes.find(t => t.id === 'weapon');
    assert.ok(weaponTab.tooltip.includes('BAD.tabs.unequippedWeaponsTooltip') || weaponTab.tooltip.includes('<b>Right Click:</b> Toggle Show Unequipped Weapons'));

    const equipmentTab = contextEnabled.itemTypes.find(t => t.id === 'equipment');
    assert.ok(equipmentTab.tooltip.includes('BAD.tabs.unequippedEquipmentTooltip') || equipmentTab.tooltip.includes('<b>Right Click:</b> Toggle Show Unequipped Equipment'));

    const toolTab = contextEnabled.itemTypes.find(t => t.id === 'tool');
    assert.ok(toolTab.tooltip.includes('BAD.tabs.unequippedItemsTooltip') || toolTab.tooltip.includes('<b>Right Click:</b> Toggle Show Unequipped Items'));
});

test('Pf1SystemAdapter and Pf2eSystemAdapter set right-click tab tooltips when showTooltips is true', () => {
    const pf1 = new Pf1SystemAdapter();
    const pf2e = new Pf2eSystemAdapter();

    const mockApp = {
        actor: {
            id: 'actor-1',
            isOwner: true,
            getFlag: () => false
        }
    };

    // PF1
    const pf1ContextDisabled = {
        itemTypes: [
            new HUDTab({ id: 'all', label: 'All' }),
            new HUDTab({ id: 'weapon', label: 'Weapons' }),
            new HUDTab({ id: 'buff', label: 'Buffs' }),
            new HUDTab({ id: 'equipment', label: 'Equipment' })
        ],
        showTooltips: false
    };
    pf1.modifyContext(pf1ContextDisabled, mockApp);
    for (const tab of pf1ContextDisabled.itemTypes) {
        assert.equal(tab.tooltip, '');
    }

    const pf1ContextEnabled = {
        itemTypes: [
            new HUDTab({ id: 'all', label: 'All' }),
            new HUDTab({ id: 'weapon', label: 'Weapons' }),
            new HUDTab({ id: 'buff', label: 'Buffs' }),
            new HUDTab({ id: 'equipment', label: 'Equipment' })
        ],
        showTooltips: true
    };
    pf1.modifyContext(pf1ContextEnabled, mockApp);
    assert.ok(pf1ContextEnabled.itemTypes.find(t => t.id === 'all').tooltip.includes('BAD.tabs.allTooltip') || pf1ContextEnabled.itemTypes.find(t => t.id === 'all').tooltip.includes('<b>Right Click:</b> Toggle Show All'));
    assert.ok(pf1ContextEnabled.itemTypes.find(t => t.id === 'buff').tooltip.includes('BAD.tabs.inactiveBuffsTooltip') || pf1ContextEnabled.itemTypes.find(t => t.id === 'buff').tooltip.includes('<b>Right Click:</b> Toggle Show Inactive Buffs'));

    // PF2e
    const pf2eContextDisabled = {
        itemTypes: [
            new HUDTab({ id: 'all', label: 'All' }),
            new HUDTab({ id: 'weapon', label: 'Weapons' }),
            new HUDTab({ id: 'consumable', label: 'Consumables' }),
            new HUDTab({ id: 'equipment', label: 'Equipment' })
        ],
        showTooltips: false
    };
    pf2e.modifyContext(pf2eContextDisabled, mockApp);
    for (const tab of pf2eContextDisabled.itemTypes) {
        assert.equal(tab.tooltip, '');
    }

    const pf2eContextEnabled = {
        itemTypes: [
            new HUDTab({ id: 'all', label: 'All' }),
            new HUDTab({ id: 'weapon', label: 'Weapons' }),
            new HUDTab({ id: 'consumable', label: 'Consumables' }),
            new HUDTab({ id: 'equipment', label: 'Equipment' })
        ],
        showTooltips: true
    };
    pf2e.modifyContext(pf2eContextEnabled, mockApp);
    assert.ok(pf2eContextEnabled.itemTypes.find(t => t.id === 'all').tooltip.includes('BAD.tabs.allTooltip') || pf2eContextEnabled.itemTypes.find(t => t.id === 'all').tooltip.includes('<b>Right Click:</b> Toggle Show All'));
    assert.ok(pf2eContextEnabled.itemTypes.find(t => t.id === 'consumable').tooltip.includes('BAD.tabs.unequippedItemsTooltip') || pf2eContextEnabled.itemTypes.find(t => t.id === 'consumable').tooltip.includes('<b>Right Click:</b> Toggle Show Unequipped Items'));
});

test('Tooltip formatting adheres to Left Click and Right Click newline rules', () => {
    // 1. Read en.json and verify all tooltips
    const en = JSON.parse(fs.readFileSync(new URL('../../lang/en.json', import.meta.url), 'utf8')).BAD;

    // Combat turn tracker has both Left Click and Right Click separated by newline and bolded
    assert.equal(
        en.controlButtons.combatTrack.tooltip,
        '<b>Left Click:</b> Follow Active Combatant Turn\n<b>Right Click:</b> Toggle Auto-Select Token on Turn Change'
    );

    // Recenter view has both Left Click and Right Click separated by newline and bolded
    assert.equal(
        en.controlButtons.recenter.tooltip,
        '<b>Left Click:</b> Recenter Canvas on Active Combatant\n<b>Right Click:</b> Toggle Auto-Centering on Turn Change'
    );

    // Placement & persistence has both Left Click and Right Click separated by newline and bolded
    assert.equal(
        en.controlButtons.anchor.tooltipAttached,
        '<b>Left Click:</b> Detach HUD from Token\n<b>Right Click:</b> Toggle HUD Persistence on Outside Click'
    );
    assert.equal(
        en.controlButtons.anchor.tooltipDetached,
        '<b>Left Click:</b> Attach HUD to Token\n<b>Right Click:</b> Toggle HUD Persistence on Outside Click'
    );

    // Single action buttons do not prefix click type
    assert.equal(en.controlButtons.filterResources.tooltipShow, 'Show Depleted Items');
    assert.equal(en.controlButtons.filterResources.tooltipHide, 'Hide Depleted Items');
    assert.equal(en.controlButtons.itemSummary.tooltipEnable, 'Enable Rich Item Summaries (without holding ?)');
    assert.equal(en.controlButtons.itemSummary.tooltipDisable, 'Disable Rich Item Summaries');
    assert.equal(en.controlButtons.close.tooltip, 'Close HUD');

    // Right-click tab tooltips
    for (const [key, val] of Object.entries(en.tabs)) {
        assert.ok(val.startsWith('<b>Right Click:</b>'), `Tab tooltip ${key} should start with "<b>Right Click:</b>"`);
        assert.ok(!val.includes('Right-Click:'), `Tab tooltip ${key} should not contain hyphenated "Right-Click:"`);
    }

    // 2. ControlBarManager fallback strings also adhere when game.i18n.localize is unavailable
    const origLocalize = game.i18n.localize;
    game.i18n.localize = () => null; // force fallbacks
    try {
        const buttons = ControlBarManager.prepareControlButtons({
            showDepleted: false,
            autoTrackCombat: true,
            autoToggleCombat: true,
            enableCombatAutoTrackButton: true,
            showItemSummaries: false,
            enableItemSummaryButton: true,
            autoCenterOnToken: false,
            enableCenterOnToken: true,
            persistHUD: true,
            showTooltips: true
        }, true);

        const combatBtn = buttons.left.find(b => b.id === 'combat-track');
        assert.equal(combatBtn.tooltip, '<b>Left Click:</b> Follow Active Combatant Turn\n<b>Right Click:</b> Toggle Auto-Select Token on Turn Change');

        const recenterBtn = buttons.right.find(b => b.id === 'recenter');
        assert.equal(recenterBtn.tooltip, '<b>Left Click:</b> Recenter Canvas on Active Combatant\n<b>Right Click:</b> Toggle Auto-Centering on Turn Change');

        const pinBtn = buttons.right.find(b => b.id === 'pin');
        assert.equal(pinBtn.tooltip, '<b>Left Click:</b> Detach HUD from Token\n<b>Right Click:</b> Toggle HUD Persistence on Outside Click');

        const closeBtn = buttons.right.find(b => b.id === 'close');
        assert.equal(closeBtn.tooltip, 'Close HUD');
    } finally {
        game.i18n.localize = origLocalize;
    }
});
