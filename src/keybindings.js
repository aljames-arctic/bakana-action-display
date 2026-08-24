import { MODULE_ID } from './constants.js';
import { actionDisplay } from './action-display.js';
import { ActionDisplayApp } from './ui/action-display-app.js';
import { syncActorFavorites } from './favorites/favorites-manager.js';
import { adapter } from './adapters/index.js';
import { log } from './lib/logger.js';

let lastSelectedTokenRef = null;
let lastSelectedTokenId = null;

/**
 * Record a token as the last selected / interacted token.
 * @param {Token|null} token
 */
export function setLastSelectedToken(token) {
    if (!token) return;
    if (token.document?.isOwner || token.actor?.isOwner) {
        lastSelectedTokenRef = token;
        lastSelectedTokenId = token.id;
    }
}

/**
 * Retrieve the last selected token if it still exists on the active canvas and user has ownership.
 * @returns {Token|null}
 */
export function getLastSelectedToken() {
    if (!lastSelectedTokenId && !lastSelectedTokenRef) return null;

    let token = null;
    if (canvas?.tokens?.get && lastSelectedTokenId) {
        token = canvas.tokens.get(lastSelectedTokenId);
    }
    if (!token && lastSelectedTokenRef) {
        const isPresent = canvas?.tokens?.placeables?.some(t => t === lastSelectedTokenRef || t.id === lastSelectedTokenId);
        if (isPresent) token = lastSelectedTokenRef;
    }

    if (token && !token.destroyed && !token._destroyed && (token.document?.isOwner || token.actor?.isOwner)) {
        return token;
    }

    return null;
}

/**
 * Toggle the Action Display HUD for a token, the currently controlled token, or the last selected token.
 * @param {Token} [explicitToken=null] Optional token to toggle HUD for
 * @returns {boolean} True if a toggle action was executed, false otherwise
 */
export function toggleHUD(explicitToken = null) {
    let token = explicitToken ?? canvas?.tokens?.controlled?.[0] ?? null;

    // If a token is explicitly passed or currently controlled on canvas, update lastSelectedToken
    if (token) {
        setLastSelectedToken(token);
    } else {
        // Fall back to the last selected token on canvas
        token = getLastSelectedToken();
    }

    // If still no token, fall back to user's assigned character token
    if (!token && game.user?.character) {
        token = game.user.character.getActiveTokens?.()?.[0]
            ?? canvas?.tokens?.placeables?.find(t => t.actor?.id === game.user.character.id)
            ?? null;
        if (token) {
            setLastSelectedToken(token);
        }
    }

    const currentApp = actionDisplay.activeApp;
    const isCurrentAppOpen = Boolean(currentApp && (currentApp.rendered || currentApp.element));

    if (isCurrentAppOpen) {
        // If a different token is now controlled, switch the HUD to the new token
        const controlledToken = canvas?.tokens?.controlled?.[0];
        if (controlledToken && currentApp.token && currentApp.token !== controlledToken && currentApp.token.id !== controlledToken.id) {
            if (currentApp.element) {
                currentApp.element.style.display = 'none';
            }
            currentApp.close();
            actionDisplay.activeApp = null;

            if (controlledToken.document?.isOwner || controlledToken.actor?.isOwner) {
                setLastSelectedToken(controlledToken);
                if (controlledToken.actor) {
                    syncActorFavorites(controlledToken.actor);
                }
                const newApp = new ActionDisplayApp(controlledToken);
                actionDisplay.activeApp = newApp;
                newApp.render(true);
                return true;
            }
            return true;
        }

        // Otherwise close the currently open HUD
        if (currentApp.element) {
            currentApp.element.style.display = 'none';
        }
        currentApp.close();
        actionDisplay.activeApp = null;
        return true;
    }

    // HUD is currently closed - open for target token if valid
    if (token) {
        if (!token.document?.isOwner && !token.actor?.isOwner) {
            return false;
        }
        setLastSelectedToken(token);
        if (token.actor) {
            syncActorFavorites(token.actor);
        }
        const newApp = new ActionDisplayApp(token);
        actionDisplay.activeApp = newApp;
        newApp.render(true);
        return true;
    }

    return false;
}

/**
 * Register module keybindings in Foundry VTT.
 */
export function registerKeybindings() {
    actionDisplay.toggleHandler = toggleHUD;

    if (!game.keybindings?.register) return;

    log.info("Registering module keybindings");

    game.keybindings.register(MODULE_ID, 'toggleHUD', {
        name: 'BAD.keybindings.toggleHUD.name',
        hint: 'BAD.keybindings.toggleHUD.hint',
        editable: [
            { key: 'Space', modifiers: [adapter.foundry.KeyboardManager?.MODIFIER_KEYS?.SHIFT ?? 'Shift'] }
        ],
        onDown: () => {
            const isEnabled = Boolean(game.settings.get(MODULE_ID, 'enableToggleHotkey'));
            if (!isEnabled) return false;
            return toggleHUD();
        },
        restricted: false,
        precedence: globalThis.CONST?.KEYBINDING_PRECEDENCE?.NORMAL ?? 0
    });
}
