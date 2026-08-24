import { MODULE_ID } from './constants.js';
import { actionDisplay } from './action-display.js';
import { ActionDisplayApp } from './ui/action-display-app.js';
import { syncActorFavorites } from './favorites/favorites-manager.js';
import { log } from './lib/logger.js';

/**
 * Toggle the Action Display HUD for a token or the currently controlled token.
 * @param {Token} [explicitToken=null] Optional token to toggle HUD for
 * @returns {boolean} True if a toggle action was executed, false otherwise
 */
export function toggleHUD(explicitToken = null) {
    let token = explicitToken ?? canvas?.tokens?.controlled?.[0] ?? null;

    if (!token && game.user?.character) {
        token = game.user.character.getActiveTokens?.()?.[0]
            ?? canvas?.tokens?.placeables?.find(t => t.actor?.id === game.user.character.id)
            ?? null;
    }

    const currentApp = actionDisplay.activeApp;
    const isCurrentAppOpen = Boolean(currentApp && (currentApp.rendered || currentApp.element));

    if (isCurrentAppOpen) {
        // If a different token is now controlled, switch the HUD to the new token
        if (token && currentApp.token && currentApp.token !== token && currentApp.token.id !== token.id) {
            if (currentApp.element) {
                currentApp.element.style.display = 'none';
            }
            currentApp.close();
            actionDisplay.activeApp = null;

            if (token.document?.isOwner || token.actor?.isOwner) {
                if (token.actor) {
                    syncActorFavorites(token.actor);
                }
                const newApp = new ActionDisplayApp(token);
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
            { key: 'Space', modifiers: [globalThis.KeyboardManager?.MODIFIER_KEYS?.SHIFT ?? 'Shift'] }
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
