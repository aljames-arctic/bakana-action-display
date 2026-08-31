// Main entry point for Bakana's Action Display
import './settings.js';
import { registerKeybindings, setLastSelectedToken } from './keybindings.js';
import { adapter } from './adapters/index.js';
import { actionDisplay } from './action-display.js';
import { ActionDisplayApp } from './ui/action-display-app.js';
import { log } from './lib/logger.js';
import { MODULE_ID } from './constants.js';
import { syncActorFavorites } from './favorites/favorites-manager.js';
import { CombatMovementTracker } from './combat/combat-movement-tracker.js';

let closeDetachedHUD = false;
let renderDebounceTimer = null;

// Initialize hook
Hooks.once('init', async () => {
    log.info("Initializing Bakana's Action Display");

    // Initialize the unified adapter (Foundry, System, Module layers) first
    await adapter.init();

    // Register module keybindings (Shift+Space toggle)
    registerKeybindings();

    // Wrap TokenHUD prototype methods (bind, clear, close)
    wrapTokenHUD();

    // Wrap Token.prototype._onClickRight during init so it is bound correctly by all tokens' InteractionManagers
    const TokenClass = adapter.foundry.Token;
    const originalRightClick = TokenClass?.prototype?._onClickRight;
    if (originalRightClick) {
        TokenClass.prototype._onClickRight = function (event) {
            const isTokenHUDOpen = Boolean(canvas?.hud?.token?.rendered && (canvas.hud.token.object === this || canvas.hud.token.object?.id === this.id));
            const currentApp = actionDisplay.activeApp;
            if (isTokenHUDOpen && (currentApp?.token === this || currentApp?.token?.id === this.id)) {
                const persist = game.settings.get(MODULE_ID, 'persistDetached');
                if (persist && currentApp?.isDetached) {
                    closeDetachedHUD = true;
                }
            }
            return originalRightClick.call(this, event);
        };
    }

    // Initialize the core coordinator
    actionDisplay.init();

    // Expose the official API for other modules and macros
    game.modules.get(MODULE_ID).api = actionDisplay;
});

/**
 * Wrap TokenHUD prototype methods (bind, clear, close) to coordinate HUD lifecycle.
 */
function wrapTokenHUD() {
    const hudClass = canvas?.hud?.token?.constructor;
    if (!hudClass?.prototype || hudClass._badWrapped) return;
    hudClass._badWrapped = true;
    log.info(`Wrapping ${hudClass.name}.prototype.bind, clear, and close`);

    const originalBind = hudClass.prototype.bind;
    hudClass.prototype.bind = function (object, ...args) {
        const result = originalBind.apply(this, [object, ...args]);
        handleHUDBind(object);
        return result;
    };

    const originalClear = hudClass.prototype.clear;
    hudClass.prototype.clear = function (...args) {
        const result = originalClear.apply(this, args);
        handleHUDClose();
        return result;
    };

    const originalClose = hudClass.prototype.close;
    hudClass.prototype.close = function (...args) {
        const currentApp = actionDisplay.activeApp;
        if (this.object && (this.object === currentApp?.token || this.object?.id === currentApp?.token?.id)) {
            return originalClose.apply(this, args);
        }
        handleHUDClose();
        return originalClose.apply(this, args);
    };
}

/**
 * Shared helper to close the HUD if it is attached, if persistence is disabled,
 * or if a close was explicitly triggered by right-clicking the token.
 */
function handleHUDClose() {
    const currentApp = actionDisplay.activeApp;
    if (currentApp) {
        const hud = canvas?.hud?.token;
        if (hud?.object && (hud.object === currentApp.token || hud.object?.id === currentApp.token?.id)) {
            return;
        }

        const persist = game.settings.get(MODULE_ID, 'persistDetached');
        const shouldClose = currentApp.isTracked || !persist || closeDetachedHUD;

        if (shouldClose) {
            if (currentApp.element) {
                currentApp.element.style.display = 'none';
            }
            currentApp.close();
            actionDisplay.activeApp = null;
        }
    }
    closeDetachedHUD = false; // Always reset
}

/**
 * Check if an updated or modified document belongs to the active HUD's actor.
 * Handles both standard linked actors and synthetic unlinked token actors.
 * @param {Actor} [docActor]
 * @param {Document} [docParent]
 * @returns {boolean}
 */
function isMatchingActor(docActor, docParent) {
    const currentApp = actionDisplay.activeApp;
    if (!currentApp?.rendered || !currentApp.actor) return false;
    const activeActor = currentApp.actor;
    const activeToken = currentApp.token;

    // Check direct actor ID or UUID match
    if (docActor) {
        if (docActor.id && activeActor.id && docActor.id === activeActor.id) return true;
        if (docActor.uuid && activeActor.uuid && docActor.uuid === activeActor.uuid) return true;
    }

    // Check parent document match (for embedded items/activities)
    if (docParent) {
        if (docParent.id && activeActor.id && docParent.id === activeActor.id) return true;
        if (docParent.uuid && activeActor.uuid && docParent.uuid === activeActor.uuid) return true;
        if (activeToken && docParent.token) {
            if (docParent.token.id && activeToken.id && docParent.token.id === activeToken.id) return true;
            if (docParent.token.uuid && activeToken.uuid && docParent.token.uuid === activeToken.uuid) return true;
        }
    }

    return false;
}

/**
 * Request a debounced re-render of the active HUD when documents mutate.
 */
function requestHUDRender() {
    const currentApp = actionDisplay.activeApp;
    if (!currentApp?.rendered) return;
    if (renderDebounceTimer) clearTimeout(renderDebounceTimer);
    renderDebounceTimer = setTimeout(() => {
        renderDebounceTimer = null;
        const appToRender = actionDisplay.activeApp;
        if (appToRender?.rendered) {
            appToRender.render();
        }
    }, 50);
}

// Ready hook
Hooks.once('ready', async () => {
    log.info("Ready");

    // Wrap TokenHUD prototype methods on ready if not already wrapped
    wrapTokenHUD();
});

/**
 * Handle initial binding of TokenHUD to a token (opening TokenHUD).
 * @param {Token} token
 */
export function handleHUDBind(token) {
    if (!token || !token.document?.isOwner) return;

    setLastSelectedToken(token);
    closeDetachedHUD = false;

    if (token.actor) {
        syncActorFavorites(token.actor);
    }

    const currentApp = actionDisplay.activeApp;

    // If we already have an active rendered app for this token, preserve it to keep its tab/scroll state
    if ((currentApp?.token === token || currentApp?.token?.id === token.id) && currentApp?.rendered) {
        return;
    }

    // Close any existing app for a different token
    if (currentApp) {
        if (currentApp.element) {
            currentApp.element.style.display = 'none';
        }
        currentApp.close();
        actionDisplay.activeApp = null;
    }

    // Initialize and render the new Action Display App
    const newApp = new ActionDisplayApp(token);
    actionDisplay.activeApp = newApp;
    newApp.render(true);
}

// Hook into Token selection to track the last selected token for hotkey toggle
Hooks.on('controlToken', (token, controlled) => {
    if (controlled && (token?.document?.isOwner || token?.actor?.isOwner)) {
        setLastSelectedToken(token);
    }
});

// Hook into Token HUD rendering to update attached overlay position if open
Hooks.on('renderTokenHUD', (tokenHUD, html, data) => {
    const token = tokenHUD?.object;
    if (!token) return;
    const currentApp = actionDisplay.activeApp;
    if (currentApp?.rendered && (currentApp.token === token || currentApp.token?.id === token.id)) {
        if (currentApp.isTracked) {
            currentApp.setPosition();
        }
    }
});

// Hook into Token HUD closing to close our overlay if tracked or closed via token click
Hooks.on('closeTokenHUD', (tokenHUD, html) => {
    const currentApp = actionDisplay.activeApp;
    if (tokenHUD?.object && (tokenHUD.object === currentApp?.token || tokenHUD.object?.id === currentApp?.token?.id)) {
        return;
    }
    handleHUDClose();
});

// Hook into canvas pan to update attached HUD position dynamically
Hooks.on('canvasPan', (canvas, pan) => {
    const currentApp = actionDisplay.activeApp;
    if (currentApp?.isTracked) {
        currentApp.setPosition();
    }
});

// Hook into Item updates/creations/deletions on the active token's actor (e.g. ammo counts, uses, charges, item additions)
Hooks.on('updateItem', (item, changes, options, userId) => {
    if (isMatchingActor(item?.actor, item?.parent)) {
        requestHUDRender();
    }
});

Hooks.on('createItem', (item, options, userId) => {
    if (isMatchingActor(item?.actor, item?.parent)) {
        requestHUDRender();
    }
});

Hooks.on('deleteItem', (item, options, userId) => {
    if (isMatchingActor(item?.actor, item?.parent)) {
        requestHUDRender();
    }
});

// Hook into Actor updates (spell slots, resources, hp, flags, status conditions)
Hooks.on('updateActor', (actor, changes, options, userId) => {
    if (!actor) return;
    if (options?.badInternal) return;

    // If the change only affects internal bakana-action-display flags (e.g. autoBanState, favorites, hiddenItems),
    // the UI interaction has already rendered or handled it locally; do not trigger a second HUD render.
    const metadataKeys = new Set(['_id', 'id', '_stats']);
    const nonMetaKeys = Object.keys(changes ?? {}).filter(k => !metadataKeys.has(k) && !k.startsWith('_stats.'));
    const isOnlyModuleFlags = nonMetaKeys.length > 0 && nonMetaKeys.every(key => {
        if (key.startsWith(`flags.${MODULE_ID}`)) return true;
        if (key === 'flags') {
            const flagKeys = Object.keys(changes.flags ?? {});
            return flagKeys.length === 1 && flagKeys[0] === MODULE_ID;
        }
        return false;
    });

    if (isOnlyModuleFlags) {
        return;
    }

    const currentApp = actionDisplay.activeApp;
    const isCurrent = isMatchingActor(actor, null);
    adapter.updateTabs(actor, isCurrent ? currentApp?.rightTabs : null);
    if (isCurrent && currentApp?.rendered) {
        requestHUDRender();
    }
});

// Hook into ActiveEffect updates (status conditions gained/lost) on actors
function handleActiveEffectChange(effect) {
    const actor = (effect?.parent instanceof Actor) ? effect.parent : (effect?.target instanceof Actor) ? effect.target : null;
    if (!actor) return;
    const currentApp = actionDisplay.activeApp;
    const isCurrent = isMatchingActor(actor, null);
    adapter.updateTabs(actor, isCurrent ? currentApp?.rightTabs : null);
    if (isCurrent && currentApp?.rendered) {
        requestHUDRender();
    }
}

Hooks.on('createActiveEffect', (effect, options, userId) => {
    handleActiveEffectChange(effect);
});

Hooks.on('updateActiveEffect', (effect, changes, options, userId) => {
    handleActiveEffectChange(effect);
});

Hooks.on('deleteActiveEffect', (effect, options, userId) => {
    handleActiveEffectChange(effect);
});

/**
 * Handle combat turn updates, dynamically switching or auto-toggling HUD visibility.
 * @param {Combat} combat Active combat document
 */
export function handleCombatTurnChange(combat) {
    CombatMovementTracker.resetTurn(combat);
    const isFeatureEnabled = Boolean(game.settings.get(MODULE_ID, 'enableCombatAutoTrackButton'));
    const isAutoTrackCombat = Boolean(game.settings.get(MODULE_ID, 'autoTrackCombat'));
    const isAutoToggleActive = isFeatureEnabled && Boolean(game.settings.get(MODULE_ID, 'autoToggleCombat'));
    const isAutoTrackActive = isFeatureEnabled && isAutoTrackCombat;

    const currentApp = actionDisplay.activeApp;
    const combatant = combat?.combatant;
    const token = combatant?.token?.object
        ?? canvas?.tokens?.get?.(combatant?.tokenId)
        ?? (combatant?.token && canvas?.tokens?.placeables?.includes(combatant?.token) ? combatant?.token : null)
        ?? combatant?.actor?.getActiveTokens?.()?.[0]
        ?? null;

    if (token) {
        const isMyTurn = Boolean(token && adapter.foundry.isUserInCharge(token));

        if (!isMyTurn) {
            // Not my turn: auto-close HUD if right-click auto-toggle is active
            if (isAutoToggleActive && currentApp?.rendered) {
                if (currentApp.element) {
                    currentApp.element.style.display = 'none';
                }
                currentApp.close();
                actionDisplay.activeApp = null;
                return;
            }
        } else {
            // It is my turn:
            const isSameToken = currentApp?.token === token || currentApp?.token?.id === token.id;

            if (currentApp?.rendered) {
                // HUD is already open:
                if (isSameToken) {
                    requestHUDRender();
                    return;
                }
                // Different token: switch only if left-click auto-track is active
                if (isAutoTrackActive) {
                    if (currentApp.element) {
                        currentApp.element.style.display = 'none';
                    }
                    currentApp.close();
                    actionDisplay.activeApp = null;

                    setLastSelectedToken(token);
                    if (token.actor) {
                        syncActorFavorites(token.actor);
                    }

                    const newApp = new ActionDisplayApp(token);
                    actionDisplay.activeApp = newApp;
                    newApp.render(true);
                    return;
                }
            } else if (isAutoToggleActive) {
                // HUD is closed: auto-open if right-click auto-toggle is active
                setLastSelectedToken(token);
                if (token.actor) {
                    syncActorFavorites(token.actor);
                }

                const newApp = new ActionDisplayApp(token);
                actionDisplay.activeApp = newApp;
                newApp.render(true);
                return;
            }
        }
    }

    requestHUDRender();
}

// Hook into Combat updates and turn advancements to update End Turn button visibility and auto-track
Hooks.on('updateCombat', (combat, changes, options, userId) => {
    handleCombatTurnChange(combat);
});

Hooks.on('deleteCombat', (combat, options, userId) => {
    CombatMovementTracker.clear();
    const isFeatureEnabled = Boolean(game.settings.get(MODULE_ID, 'enableCombatAutoTrackButton'));
    const isAutoToggleActive = isFeatureEnabled && Boolean(game.settings.get(MODULE_ID, 'autoToggleCombat'));
    if (isAutoToggleActive) {
        const currentApp = actionDisplay.activeApp;
        if (currentApp?.rendered) {
            if (currentApp.element) {
                currentApp.element.style.display = 'none';
            }
            currentApp.close();
            actionDisplay.activeApp = null;
        }
    }
    requestHUDRender();
});

Hooks.on('combatTurn', (combat, updateData, updateOptions) => {
    handleCombatTurnChange(combat);
});

Hooks.on('combatRound', (combat, updateData, updateOptions) => {
    handleCombatTurnChange(combat);
});

// Hook into Combatant changes (token added/removed from combat, initiative rolled)
Hooks.on('createCombatant', (combatant, options, userId) => {
    requestHUDRender();
});

Hooks.on('deleteCombatant', (combatant, options, userId) => {
    requestHUDRender();
});

Hooks.on('updateCombatant', (combatant, changes, options, userId) => {
    requestHUDRender();
});

// Hook into token position changes before database persistence to record movement
Hooks.on('preUpdateToken', (tokenDoc, changes, options, userId) => {
    CombatMovementTracker.recordTokenMovement(tokenDoc, changes, options);
});

// Hook into synthetic Token document updates (actor delta mutations, position updates)
Hooks.on('updateToken', (tokenDoc, changes, options, userId) => {
    if (options?.badInternal) return;
    CombatMovementTracker.recordTokenMovement(tokenDoc, changes, options);
    const metadataKeys = new Set(['_id', 'id', '_stats']);
    const nonMetaKeys = Object.keys(changes ?? {}).filter(k => !metadataKeys.has(k) && !k.startsWith('_stats.'));
    const isOnlyModuleFlags = nonMetaKeys.length > 0 && nonMetaKeys.every(key => {
        if (key.startsWith(`flags.${MODULE_ID}`) || key.startsWith(`actorData.flags.${MODULE_ID}`) || key.startsWith(`delta.flags.${MODULE_ID}`)) return true;
        if (key === 'flags') {
            const flagKeys = Object.keys(changes.flags ?? {});
            return flagKeys.length === 1 && flagKeys[0] === MODULE_ID;
        }
        return false;
    });

    if (isOnlyModuleFlags) return;

    const currentApp = actionDisplay.activeApp;
    if (currentApp?.rendered && (tokenDoc?.id === currentApp.token?.id || tokenDoc?.actor?.id === currentApp.actor?.id)) {
        requestHUDRender();
    }
});

// Hook into Application rendering to ensure newly opened sheets/windows sit above the HUD
Hooks.on('renderApplication', (app, html) => {
    const currentHUD = actionDisplay?.activeApp;
    if (!currentHUD?.element) return;
    const hudEl = currentHUD.element;
    const appEl = app?.element?.[0] ?? app?.element ?? html?.[0] ?? html;
    if (!appEl || appEl === hudEl || hudEl.contains?.(appEl)) return;
    if (appEl.closest?.('#context-menu, .context-menu, .bad-item-summary-tooltip')) return;

    const hudZ = parseInt(hudEl.style?.zIndex, 10) || 100;
    const appZ = parseInt(appEl.style?.zIndex, 10) || 0;
    if (appZ <= hudZ) {
        const newZ = hudZ + 1;
        if (appEl.style) {
            appEl.style.zIndex = `${newZ}`;
        }
    }
});
