// Main entry point for Bakana's Action Display
import './settings.js';
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

    // Wrap Token.prototype._onClickRight during init so it is bound correctly by all tokens' InteractionManagers
    const TokenClass = adapter.foundry.Token;
    const originalRightClick = TokenClass.prototype._onClickRight;
    if (originalRightClick) {
        TokenClass.prototype._onClickRight = function (event) {
            const isTokenHUDOpen = Boolean(canvas?.hud?.token?.rendered && (canvas.hud.token.object === this || canvas.hud.token.object?.id === this.id));
            if (isTokenHUDOpen && activeApp && (activeApp.token === this || activeApp.token?.id === this.id)) {
                const persist = game.settings.get(MODULE_ID, 'persistDetached');
                if (persist && activeApp.isDetached) {
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
    if (activeApp) {
        const persist = game.settings.get(MODULE_ID, 'persistDetached');
        const shouldClose = activeApp.isTracked || !persist || closeDetachedHUD;

        if (shouldClose) {
            if (activeApp.element) {
                activeApp.element.style.display = 'none';
            }
            activeApp.close();
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
    if (!activeApp || !activeApp.actor) return false;
    const activeActor = activeApp.actor;
    const activeToken = activeApp.token;

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
    if (!activeApp?.rendered && !activeApp?.element) return;
    if (renderDebounceTimer) clearTimeout(renderDebounceTimer);
    renderDebounceTimer = setTimeout(() => {
        renderDebounceTimer = null;
        if (activeApp?.rendered || activeApp?.element) {
            activeApp.render();
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

// Hook into Token HUD rendering to display our overlay
Hooks.on('renderTokenHUD', (tokenHUD, html, data) => {
    const token = tokenHUD.object;
    if (!token || !token.document.isOwner) return;

    closeDetachedHUD = false;

    if (token.actor) {
        syncActorFavorites(token.actor);
    }

    // If we already have an active rendered app for this token, preserve it to keep its tab/scroll state
    if (activeApp && (activeApp.token === token || activeApp.token?.id === token.id) && (activeApp.rendered || activeApp.element)) {
        return;
    }

    // Close any existing app for a different token
    if (activeApp) {
        if (activeApp.element) {
            activeApp.element.style.display = 'none';
        }
        activeApp.close();
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
    if (activeApp && activeApp.isTracked) {
        activeApp.setPosition();
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

// Hook into synthetic Token document updates (actor delta mutations)
Hooks.on('updateToken', (tokenDoc, changes, options, userId) => {
    if (activeApp && (tokenDoc?.id === activeApp.token?.id || tokenDoc?.actor?.id === activeApp.actor?.id)) {
        requestHUDRender();
    }
});
