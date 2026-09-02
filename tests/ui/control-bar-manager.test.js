import test from 'node:test';
import assert from 'node:assert/strict';
import '../setup.js';
import { ControlBarManager } from '../../src/ui/app/control-bar-manager.js';
import { ActionDisplayApp } from '../../src/ui/action-display-app.js';
import { MODULE_ID } from '../../src/constants.js';

test('ControlBarManager.prepareControlButtons prepares structured button models for left and right groups', () => {
    const mockContext = {
        showDepleted: false,
        autoTrackCombat: true,
        autoToggleCombat: true,
        enableCombatAutoTrackButton: true,
        showItemSummaries: false,
        enableItemSummaryButton: true,
        autoCenterOnToken: false,
        enableCenterOnToken: true,
        persistHUD: true
    };

    const buttons = ControlBarManager.prepareControlButtons(mockContext, true);
    assert.equal(Array.isArray(buttons.left), true);
    assert.equal(Array.isArray(buttons.right), true);
    assert.equal(buttons.left.length, 3);
    assert.equal(buttons.right.length, 3);

    // Left buttons
    const filterBtn = buttons.left.find(b => b.id === 'filter-resources');
    assert.ok(filterBtn);
    assert.equal(filterBtn.action, 'toggleFilterResources');
    assert.equal(filterBtn.contextAction, null);
    assert.equal(filterBtn.isActive, false);
    assert.equal(filterBtn.icon, 'fas fa-eye-slash');

    const combatTrackBtn = buttons.left.find(b => b.id === 'combat-track');
    assert.ok(combatTrackBtn);
    assert.equal(combatTrackBtn.action, 'toggleCombatAutoTrack');
    assert.equal(combatTrackBtn.contextAction, 'toggleCombatAutoToggle');
    assert.equal(combatTrackBtn.isActive, true);
    assert.equal(combatTrackBtn.isSecondaryActive, true);
    assert.equal(combatTrackBtn.isVisible, true);

    const summaryBtn = buttons.left.find(b => b.id === 'summary-toggle');
    assert.ok(summaryBtn);
    assert.equal(summaryBtn.action, 'toggleItemSummaries');
    assert.equal(summaryBtn.contextAction, null);
    assert.equal(summaryBtn.isVisible, true);

    // Right buttons
    const recenterBtn = buttons.right.find(b => b.id === 'recenter');
    assert.ok(recenterBtn);
    assert.equal(recenterBtn.action, 'recenterToken');
    assert.equal(recenterBtn.contextAction, 'toggleAutoCenter');
    assert.equal(recenterBtn.isActive, false);
    assert.equal(recenterBtn.isVisible, true);

    const pinBtn = buttons.right.find(b => b.id === 'pin');
    assert.ok(pinBtn);
    assert.equal(pinBtn.action, 'toggleAnchor');
    assert.equal(pinBtn.contextAction, 'toggleHUDPersistence');
    assert.equal(pinBtn.isActive, true);
    assert.equal(pinBtn.icon, 'fas fa-link'); // Attached state

    const closeBtn = buttons.right.find(b => b.id === 'close');
    assert.ok(closeBtn);
    assert.equal(closeBtn.action, 'closeHUD');
    assert.equal(closeBtn.contextAction, null);
    assert.equal(closeBtn.icon, 'fas fa-times');

    // Control buttons should not have tooltips
    for (const btn of [...buttons.left, ...buttons.right]) {
        assert.equal(btn.tooltip, undefined, `Button ${btn.id} should not have a tooltip`);
    }
});

test('ControlBarManager.prepareControlButtons updates dynamic icons based on state', () => {
    // 1. Filter button shows open eye when showDepleted is true
    const buttonsDepleted = ControlBarManager.prepareControlButtons({ showDepleted: true }, true);
    const filterBtn = buttonsDepleted.left.find(b => b.id === 'filter-resources');
    assert.equal(filterBtn.icon, 'fas fa-eye');
    assert.equal(filterBtn.isActive, true);

    // 2. Pin button shows fa-unlink when HUD is detached
    const buttonsDetached = ControlBarManager.prepareControlButtons({ persistHUD: false }, false);
    const pinBtn = buttonsDetached.right.find(b => b.id === 'pin');
    assert.equal(pinBtn.icon, 'fas fa-unlink');
    assert.equal(pinBtn.isActive, false);
});

test('ControlBarManager.dispatchContextAction declaratively executes data-context-action and blurs target', async () => {
    let actionInvoked = false;
    let targetBlurred = false;
    let defaultPrevented = false;
    let propagationStopped = false;
    let immediatePropagationStopped = false;

    const mockApp = {
        constructor: {
            DEFAULT_OPTIONS: {
                contextActions: {
                    testContextAction: async (event, target) => {
                        actionInvoked = true;
                    }
                }
            }
        }
    };

    const mockButton = {
        dataset: { contextAction: 'testContextAction' },
        blur: () => { targetBlurred = true; },
        closest: (selector) => selector === '[data-context-action]' ? mockButton : null
    };

    const mockEvent = {
        target: mockButton,
        preventDefault: () => { defaultPrevented = true; },
        stopPropagation: () => { propagationStopped = true; },
        stopImmediatePropagation: () => { immediatePropagationStopped = true; }
    };

    const handled = await ControlBarManager.dispatchContextAction(mockApp, mockEvent);
    assert.equal(handled, true);
    assert.equal(actionInvoked, true, 'Registered context action must be invoked');
    assert.equal(targetBlurred, true, 'Target button must be blurred on context click');
    assert.equal(defaultPrevented, true, 'Default must be prevented');
    assert.equal(propagationStopped, true, 'Propagation must be stopped');
    assert.equal(immediatePropagationStopped, true, 'Immediate propagation must be stopped');
});

test('ControlBarManager.dispatchContextAction falls back to class-based handlers when data-context-action is absent', async () => {
    let combatTrackTriggered = false;
    let recenterTriggered = false;
    let pinTriggered = false;

    const mockApp = {
        constructor: { DEFAULT_OPTIONS: { contextActions: {} } },
        _onRightClickCombatAutoTrack: async () => { combatTrackTriggered = true; },
        _onRightClickRecenterToken: async () => { recenterTriggered = true; },
        _onRightClickToggleAnchor: async () => { pinTriggered = true; }
    };

    // 1. Combat track button fallback
    const combatBtn = {
        className: 'bad-control-btn bad-combat-track-btn',
        blur: () => {},
        closest: (sel) => sel === '.bad-combat-track-btn' ? combatBtn : null
    };
    let handled = await ControlBarManager.dispatchContextAction(mockApp, {
        target: combatBtn,
        preventDefault: () => {},
        stopPropagation: () => {},
        stopImmediatePropagation: () => {}
    });
    assert.equal(handled, true);
    assert.equal(combatTrackTriggered, true);

    // 2. Recenter button fallback
    const recenterBtn = {
        className: 'bad-control-btn bad-recenter-btn',
        blur: () => {},
        closest: (sel) => sel === '.bad-recenter-btn' ? recenterBtn : null
    };
    handled = await ControlBarManager.dispatchContextAction(mockApp, {
        target: recenterBtn,
        preventDefault: () => {},
        stopPropagation: () => {},
        stopImmediatePropagation: () => {}
    });
    assert.equal(handled, true);
    assert.equal(recenterTriggered, true);

    // 3. Pin button fallback
    const pinBtn = {
        className: 'bad-control-btn bad-pin-btn',
        blur: () => {},
        closest: (sel) => sel === '.bad-pin-btn' ? pinBtn : null
    };
    handled = await ControlBarManager.dispatchContextAction(mockApp, {
        target: pinBtn,
        preventDefault: () => {},
        stopPropagation: () => {},
        stopImmediatePropagation: () => {}
    });
    assert.equal(handled, true);
    assert.equal(pinTriggered, true);
});

test('ControlBarManager.dispatchContextAction returns false for non-action elements', async () => {
    const mockApp = {
        constructor: { DEFAULT_OPTIONS: { contextActions: {} } }
    };
    const plainElement = {
        closest: () => null
    };
    const handled = await ControlBarManager.dispatchContextAction(mockApp, {
        target: plainElement
    });
    assert.equal(handled, false);
});

test('ActionDisplayApp._prepareContext populates controlButtons model', async () => {
    const app = new ActionDisplayApp({ actor: { id: 'test-actor' } });
    await game.settings.set(MODULE_ID, 'enableCombatAutoTrackButton', true);
    await game.settings.set(MODULE_ID, 'autoTrackCombat', true);
    await game.settings.set(MODULE_ID, 'enableCenterOnToken', true);
    await game.settings.set(MODULE_ID, 'autoCenterOnToken', true);

    const context = await app._prepareContext({});
    assert.ok(context.controlButtons);
    assert.ok(context.controlButtons.left);
    assert.ok(context.controlButtons.right);

    const combatBtn = context.controlButtons.left.find(b => b.id === 'combat-track');
    assert.equal(combatBtn.isVisible, true);
    assert.equal(combatBtn.isActive, true);
    assert.equal(combatBtn.contextAction, 'toggleCombatAutoToggle');

    const recenterBtn = context.controlButtons.right.find(b => b.id === 'recenter');
    assert.equal(recenterBtn.isVisible, true);
    assert.equal(recenterBtn.isActive, true);
    assert.equal(recenterBtn.contextAction, 'toggleAutoCenter');

    // Cleanup
    await game.settings.set(MODULE_ID, 'enableCombatAutoTrackButton', false);
    await game.settings.set(MODULE_ID, 'autoTrackCombat', false);
    await game.settings.set(MODULE_ID, 'enableCenterOnToken', false);
    await game.settings.set(MODULE_ID, 'autoCenterOnToken', false);
});
