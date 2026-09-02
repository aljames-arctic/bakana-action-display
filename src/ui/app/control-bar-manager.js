import { log } from '../../lib/logger.js';

/**
 * @typedef {Object} ControlBarButtonConfig
 * @property {string} id Unique button identifier (e.g. 'filter-resources')
 * @property {string} className CSS classes for the button
 * @property {string} action Declarative left-click action name
 * @property {string|null} contextAction Declarative right-click action name
 * @property {string} icon FontAwesome icon class
 * @property {boolean} isActive Primary active flag (illuminated purple state)
 * @property {boolean} isSecondaryActive Secondary active flag (e.g. orange outline state)
 * @property {boolean} isVisible Whether button should be rendered
 * @property {string|null} tooltip Localized tooltip text when showTooltips is enabled
 * @property {string} ariaLabel Accessibility label
 */

/**
 * @typedef {Object} ControlBarModel
 * @property {ControlBarButtonConfig[]} left Left-aligned control buttons
 * @property {ControlBarButtonConfig[]} right Right-aligned control buttons
 */

export class ControlBarManager {
    /**
     * Prepares structured control button view models for template rendering.
     * @param {Object} context Prepared application context containing settings flags
     * @param {boolean} isAttached Whether HUD is currently attached to token
     * @returns {ControlBarModel}
     */
    static prepareControlButtons(context, isAttached) {
        const showTooltips = Boolean(context.showTooltips);
        const showDepleted = Boolean(context.showDepleted);
        const autoTrackCombat = Boolean(context.autoTrackCombat);
        const autoToggleCombat = Boolean(context.autoToggleCombat);
        const enableCombatAutoTrack = Boolean(context.enableCombatAutoTrackButton);
        const showItemSummaries = Boolean(context.showItemSummaries);
        const enableItemSummaryButton = Boolean(context.enableItemSummaryButton);
        const autoCenterOnToken = Boolean(context.autoCenterOnToken);
        const enableCenterOnToken = Boolean(context.enableCenterOnToken);
        const persistHUD = Boolean(context.persistHUD);

        const left = [
            {
                id: 'filter-resources',
                className: 'bad-control-btn bad-filter-resources-btn',
                action: 'toggleFilterResources',
                contextAction: null,
                icon: showDepleted ? 'fas fa-eye' : 'fas fa-eye-slash',
                isActive: showDepleted,
                isSecondaryActive: false,
                isVisible: true,
                tooltip: showTooltips
                    ? (showDepleted
                        ? (game.i18n?.localize?.('BAD.controlButtons.filterResources.tooltipHide') ?? 'Hide Depleted Items')
                        : (game.i18n?.localize?.('BAD.controlButtons.filterResources.tooltipShow') ?? 'Show Depleted Items'))
                    : null,
                ariaLabel: game.i18n?.localize?.('BAD.controlButtons.filterResources.label') ?? 'Filter Resources'
            },
            {
                id: 'combat-track',
                className: 'bad-control-btn bad-combat-track-btn',
                action: 'toggleCombatAutoTrack',
                contextAction: 'toggleCombatAutoToggle',
                icon: 'fas fa-sword',
                isActive: autoTrackCombat,
                isSecondaryActive: autoToggleCombat,
                isVisible: enableCombatAutoTrack,
                tooltip: showTooltips
                    ? (game.i18n?.localize?.('BAD.controlButtons.combatTrack.tooltip')
                        ?? 'Left Click: Follow Active Combatant Turn\nRight Click: Toggle Auto-Select Token on Turn Change')
                    : null,
                ariaLabel: game.i18n?.localize?.('BAD.controlButtons.combatTrack.label') ?? 'Combat Turn Tracker'
            },
            {
                id: 'summary-toggle',
                className: 'bad-control-btn bad-summary-toggle-btn',
                action: 'toggleItemSummaries',
                contextAction: null,
                icon: 'fas fa-question',
                isActive: showItemSummaries,
                isSecondaryActive: false,
                isVisible: enableItemSummaryButton,
                tooltip: showTooltips
                    ? (showItemSummaries
                        ? (game.i18n?.localize?.('BAD.controlButtons.itemSummary.tooltipDisable') ?? 'Disable Rich Item Summaries')
                        : (game.i18n?.localize?.('BAD.controlButtons.itemSummary.tooltipEnable') ?? 'Enable Rich Item Summaries (without holding ?)'))
                    : null,
                ariaLabel: game.i18n?.localize?.('BAD.controlButtons.itemSummary.label') ?? 'Item Summary Tooltips'
            }
        ];

        const right = [
            {
                id: 'recenter',
                className: 'bad-control-btn bad-recenter-btn',
                action: 'recenterToken',
                contextAction: 'toggleAutoCenter',
                icon: 'fas fa-crosshairs',
                isActive: autoCenterOnToken,
                isSecondaryActive: false,
                isVisible: enableCenterOnToken,
                tooltip: showTooltips
                    ? (game.i18n?.localize?.('BAD.controlButtons.recenter.tooltip')
                        ?? 'Left Click: Recenter Canvas on Active Combatant\nRight Click: Toggle Auto-Centering on Turn Change')
                    : null,
                ariaLabel: game.i18n?.localize?.('BAD.controlButtons.recenter.label') ?? 'Recenter View'
            },
            {
                id: 'pin',
                className: 'bad-control-btn bad-pin-btn',
                action: 'toggleAnchor',
                contextAction: 'toggleHUDPersistence',
                icon: isAttached ? 'fas fa-link' : 'fas fa-unlink',
                isActive: persistHUD,
                isSecondaryActive: false,
                isVisible: true,
                tooltip: showTooltips
                    ? (isAttached
                        ? (game.i18n?.localize?.('BAD.controlButtons.anchor.tooltipAttached')
                            ?? 'Left Click: Detach HUD from Token\nRight Click: Toggle HUD Persistence on Outside Click')
                        : (game.i18n?.localize?.('BAD.controlButtons.anchor.tooltipDetached')
                            ?? 'Left Click: Attach HUD to Token\nRight Click: Toggle HUD Persistence on Outside Click'))
                    : null,
                ariaLabel: game.i18n?.localize?.('BAD.controlButtons.anchor.label') ?? 'HUD Placement & Persistence'
            },
            {
                id: 'close',
                className: 'bad-control-btn bad-close-btn',
                action: 'closeHUD',
                contextAction: null,
                icon: 'fas fa-times',
                isActive: false,
                isSecondaryActive: false,
                isVisible: true,
                tooltip: showTooltips
                    ? (game.i18n?.localize?.('BAD.controlButtons.close.tooltip') ?? 'Close HUD')
                    : null,
                ariaLabel: game.i18n?.localize?.('BAD.controlButtons.close.label') ?? 'Close HUD'
            }
        ];

        return { left, right };
    }

    /**
     * Declarative dispatch for right-click contextmenu events.
     * Intercepts elements with [data-context-action], blurs the element to prevent
     * focus styling retention, stops event propagation, and invokes the registered handler.
     * @param {Object} app The ActionDisplayApp instance
     * @param {Event} event The triggering contextmenu event
     * @returns {Promise<boolean>} True if event was handled
     */
    static async dispatchContextAction(app, event) {
        const contextTarget = event?.target?.closest?.('[data-context-action]');
        if (contextTarget) {
            event.preventDefault?.();
            event.stopPropagation?.();
            event.stopImmediatePropagation?.();
            contextTarget.blur?.();

            const actionName = contextTarget.dataset.contextAction;
            const handler = app.constructor?.DEFAULT_OPTIONS?.contextActions?.[actionName]
                ?? app[actionName];

            if (typeof handler === 'function') {
                try {
                    await handler.call(app, event, contextTarget);
                } catch (err) {
                    log.error(`ControlBarManager.dispatchContextAction | Error executing action "${actionName}":`, err);
                }
            } else {
                log.warn(`ControlBarManager.dispatchContextAction | No handler registered for context action "${actionName}"`);
            }
            return true;
        }

        // Fallback for elements/tests querying legacy class selectors without data-context-action
        const combatTrackBtn = event?.target?.closest?.('.bad-combat-track-btn');
        if (combatTrackBtn) {
            event.preventDefault?.();
            event.stopPropagation?.();
            event.stopImmediatePropagation?.();
            combatTrackBtn.blur?.();
            await app._onRightClickCombatAutoTrack(event, combatTrackBtn);
            return true;
        }

        const recenterBtn = event?.target?.closest?.('.bad-recenter-btn');
        if (recenterBtn) {
            event.preventDefault?.();
            event.stopPropagation?.();
            event.stopImmediatePropagation?.();
            recenterBtn.blur?.();
            await app._onRightClickRecenterToken(event, recenterBtn);
            return true;
        }

        const pinBtn = event?.target?.closest?.('.bad-pin-btn');
        if (pinBtn) {
            event.preventDefault?.();
            event.stopPropagation?.();
            event.stopImmediatePropagation?.();
            pinBtn.blur?.();
            await app._onRightClickToggleAnchor(event, pinBtn);
            return true;
        }

        return false;
    }
}
