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

// Initialize hook
Hooks.once('init', async () => {
    log.info("Initializing Bakana's Action Display");

    // Wrap Token.prototype._onClickRight during init so it is bound correctly by all tokens' InteractionManagers
    const TokenClass = adapter.foundry.Token;
    const originalRightClick = TokenClass.prototype._onClickRight;
    if (typeof originalRightClick === 'function') {
        TokenClass.prototype._onClickRight = function (event) {
            log.debug("Token.prototype._onClickRight called");
            if (activeApp && activeApp.token === this) {
                const persist = game.settings.get(MODULE_ID, 'persistDetached');
                if (persist && activeApp.isDetached) {
                    log.debug("Right-clicked the same token with a detached HUD. Setting closeDetachedHUD flag.");
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
            log.debug(`HUD Hook | Closing activeApp (state: ${activeApp.state})`);
            if (activeApp.element) {
                activeApp.element.style.display = 'none';
            }
            activeApp.close();
            activeApp = null;
        } else {
            log.debug("HUD Hook | activeApp is detached and persist is enabled, keeping it open");
        }
    }
    closeDetachedHUD = false; // Always reset
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
            log.debug(`${hudClass.name}.prototype.clear called`);
            handleHUDClose();
            return originalClear.apply(this, args);
        };

        const originalClose = hudClass.prototype.close;
        hudClass.prototype.close = function (...args) {
            log.debug(`${hudClass.name}.prototype.close called`);
            handleHUDClose();
            return originalClose.apply(this, args);
        };
    }
});

// Hook into Token HUD rendering to display our overlay
Hooks.on('renderTokenHUD', (tokenHUD, html, data) => {
    const token = tokenHUD.object;
    if (!token || !token.document.isOwner) return;

    log.debug("renderTokenHUD hook fired for token:", token.name);

    if (token.actor) {
        syncActorFavorites(token.actor);
    }

    // If we already have an activeApp for this token, preserve it to keep its tab/scroll state
    if (activeApp && activeApp.token.id === token.id) {
        log.debug("renderTokenHUD | activeApp already exists for this token, preserving instance");
        return;
    }

    // Close any existing app for a different token
    if (activeApp) {
        log.debug(`renderTokenHUD | activeApp exists for a different token (state: ${activeApp.state}), closing it`);
        if (activeApp.element) {
            activeApp.element.style.display = 'none';
        }
        activeApp.close();
        activeApp = null;
    }

    // Initialize and render the new Action Display App
    log.info("Rendering ActionDisplayApp for token:", token.name);
    activeApp = new ActionDisplayApp(token);
    actionDisplay.activeApp = activeApp;
    activeApp.render(true);
});

// Hook into Token HUD closing to close our overlay if tracked or closed via token click
Hooks.on('closeTokenHUD', (tokenHUD, html) => {
    log.debug("closeTokenHUD hook fired");
    handleHUDClose();
});

// Hook into canvas pan to update attached HUD position dynamically
Hooks.on('canvasPan', (canvas, pan) => {
    if (activeApp && activeApp.isTracked) {
        activeApp.updatePosition();
    }
});
