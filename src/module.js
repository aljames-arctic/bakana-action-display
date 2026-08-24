// Main entry point for Bakana's Action Display
import './settings.js';
import { registerKeybindings, setLastSelectedToken } from './keybindings.js';
import { adapter } from './adapters/index.js';
import { actionDisplay } from './action-display.js';
import { ActionDisplayApp } from './ui/action-display-app.js';
import { log } from './lib/logger.js';
import { MODULE_ID } from './constants.js';
import { syncActorFavorites } from './favorites/favorites-manager.js';

let activeApp = null;
let closeDetachedHUD = false;
let renderDebounceTimer = null;

// Initialize hook
Hooks.once('init', async () => {
    log.info("Initializing Bakana's Action Display");

    // Register module keybindings (Shift+Space toggle)
    registerKeybindings();

    // Wrap Token.prototype._onClickRight during init so it is bound correctly by all tokens' InteractionManagers
    const TokenClass = adapter.foundry.Token;
    const originalRightClick = TokenClass.prototype._onClickRight;
    if (originalRightClick) {
        TokenClass.prototype._onClickRight = function (event) {
            const isTokenHUDOpen = Boolean(canvas?.hud?.token?.rendered && (canvas.hud.token.object === this || canvas.hud.token.object?.id === this.id));
            const currentApp = actionDisplay.activeApp ?? activeApp;
            if (isTokenHUDOpen && (currentApp?.token === this || currentApp?.token?.id === this.id)) {
                const persist = game.settings.get(MODULE_ID, 'persistDetached');
                if (persist && currentApp?.isDetached) {
                    closeDetachedHUD = true;
                }
            }
            return originalRightClick.call(this, event);
        };
    }

    // Initialize the unified adapter (Foundry, System, Module layers)
    await adapter.init();

    // Initialize the core coordinator
    actionDisplay.init();

    // Expose the official API for other modules and macros
    game.modules.get(MODULE_ID).api = actionDisplay;
});

/**
 * Shared helper to close the HUD if it is attached, if persistence is disabled,
 * or if a close was explicitly triggered by right-clicking the token.
 */
function handleHUDClose() {
    const currentApp = actionDisplay.activeApp ?? activeApp;
    if (currentApp) {
        const persist = game.settings.get(MODULE_ID, 'persistDetached');
        const shouldClose = currentApp.isTracked || !persist || closeDetachedHUD;

        if (shouldClose) {
            if (currentApp.element) {
                currentApp.element.style.display = 'none';
            }
            currentApp.close();
            activeApp = null;
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
    const currentApp = actionDisplay.activeApp ?? activeApp;
    if (!currentApp || !currentApp.actor) return false;
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
    const currentApp = actionDisplay.activeApp ?? activeApp;
    if (!currentApp?.rendered && !currentApp?.element) return;
    if (renderDebounceTimer) clearTimeout(renderDebounceTimer);
    renderDebounceTimer = setTimeout(() => {
        renderDebounceTimer = null;
        const appToRender = actionDisplay.activeApp ?? activeApp;
        if (appToRender?.rendered || appToRender?.element) {
            appToRender.render();
        }
    }, 50);
}

// Ready hook
Hooks.once('ready', async () => {
    log.info("Ready");

    // Wrap the clear and close methods on the actual HUD class prototype (e.g. TokenHUD or TokenHUDPF)
    // to ensure it works across scene changes and supports custom system HUDs in all closing scenarios.
    if (canvas?.hud?.token) {
        const hudClass = canvas.hud.token.constructor;
        log.info(`Wrapping ${hudClass.name}.prototype.clear and close`);

        const originalClear = hudClass.prototype.clear;
        hudClass.prototype.clear = function (...args) {
            handleHUDClose();
            return originalClear.apply(this, args);
        };

        const originalClose = hudClass.prototype.close;
        hudClass.prototype.close = function (...args) {
            handleHUDClose();
            return originalClose.apply(this, args);
        };
    }
});

// Hook into Token selection to track the last selected token for hotkey toggle
Hooks.on('controlToken', (token, controlled) => {
    if (controlled && (token?.document?.isOwner || token?.actor?.isOwner)) {
        setLastSelectedToken(token);
    }
});

// Hook into Token HUD rendering to display our overlay
Hooks.on('renderTokenHUD', (tokenHUD, html, data) => {
    const token = tokenHUD.object;
    if (!token || !token.document.isOwner) return;

    setLastSelectedToken(token);
    closeDetachedHUD = false;

    if (token.actor) {
        syncActorFavorites(token.actor);
    }

    const currentApp = actionDisplay.activeApp ?? activeApp;

    // If we already have an active rendered app for this token, preserve it to keep its tab/scroll state
    if ((currentApp?.token === token || currentApp?.token?.id === token.id) && (currentApp?.rendered || currentApp?.element)) {
        return;
    }

    // Close any existing app for a different token
    if (currentApp) {
        if (currentApp.element) {
            currentApp.element.style.display = 'none';
        }
        currentApp.close();
        activeApp = null;
        actionDisplay.activeApp = null;
    }

    // Initialize and render the new Action Display App
    activeApp = new ActionDisplayApp(token);
    actionDisplay.activeApp = activeApp;
    activeApp.render(true);
});

// Hook into Token HUD closing to close our overlay if tracked or closed via token click
Hooks.on('closeTokenHUD', (tokenHUD, html) => {
    handleHUDClose();
});

// Hook into canvas pan to update attached HUD position dynamically
Hooks.on('canvasPan', (canvas, pan) => {
    const currentApp = actionDisplay.activeApp ?? activeApp;
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

// Hook into Actor updates (spell slots, resources, hp, flags) on the active token's actor
Hooks.on('updateActor', (actor, changes, options, userId) => {
    if (isMatchingActor(actor, null)) {
        requestHUDRender();
    }
});

/**
 * Handle combat turn updates, dynamically switching the HUD token if Combat Auto-Track is enabled.
 * @param {Combat} combat Active combat document
 */
export function handleCombatTurnChange(combat) {
    const isFeatureEnabled = Boolean(game.settings.get(MODULE_ID, 'enableCombatAutoTrackButton'));
    const isAutoTrackActive = Boolean(game.settings.get(MODULE_ID, 'autoTrackCombat'));

    if (isFeatureEnabled && isAutoTrackActive && combat?.started && combat.combatant) {
        const currentCombatant = combat.combatant;
        const token = currentCombatant.token?.object
            ?? canvas?.tokens?.get?.(currentCombatant.tokenId)
            ?? (currentCombatant.token && canvas?.tokens?.placeables?.includes(currentCombatant.token) ? currentCombatant.token : null)
            ?? currentCombatant.actor?.getActiveTokens?.()?.[0]
            ?? null;

        if (token && (token.document?.isOwner || token.actor?.isOwner || game.user?.isGM)) {
            const currentApp = actionDisplay.activeApp ?? activeApp;
            if (currentApp && (currentApp.rendered || currentApp.element)) {
                if (currentApp.token === token || currentApp.token?.id === token.id) {
                    requestHUDRender();
                    return;
                }

                // Switch HUD to the active combatant token
                if (currentApp.element) {
                    currentApp.element.style.display = 'none';
                }
                currentApp.close();
                activeApp = null;
                actionDisplay.activeApp = null;

                setLastSelectedToken(token);
                if (token.actor) {
                    syncActorFavorites(token.actor);
                }

                activeApp = new ActionDisplayApp(token);
                actionDisplay.activeApp = activeApp;
                activeApp.render(true);
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

// Hook into synthetic Token document updates (actor delta mutations)
Hooks.on('updateToken', (tokenDoc, changes, options, userId) => {
    const currentApp = actionDisplay.activeApp ?? activeApp;
    if (currentApp && (tokenDoc?.id === currentApp.token?.id || tokenDoc?.actor?.id === currentApp.actor?.id)) {
        requestHUDRender();
    }
});

// Hook into Application rendering to ensure newly opened sheets/windows sit above the HUD
Hooks.on('renderApplication', (app, html) => {
    const currentHUD = actionDisplay?.activeApp ?? activeApp;
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
