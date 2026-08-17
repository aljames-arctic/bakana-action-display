import { MODULE_ID } from "./constants.js";
import { log } from "./lib/logger.js";
import { actionDisplay } from "./action-display.js";
import { CategorizationConfigApp } from "./categorization/categorization-config-app.js";

Hooks.once('init', () => {
    // Register Log Verbosity Setting
    game.settings.register(MODULE_ID, 'logVerbosity', {
        name: game.i18n.localize('BAD.settings.logVerbosity.name'),
        hint: game.i18n.localize('BAD.settings.logVerbosity.hint'),
        scope: 'client',
        config: true,
        type: String,
        default: 'warn',
        choices: {
            'error': game.i18n.localize('BAD.settings.logVerbosity.choices.error'),
            'warn': game.i18n.localize('BAD.settings.logVerbosity.choices.warn'),
            'info': game.i18n.localize('BAD.settings.logVerbosity.choices.info'),
            'debug': game.i18n.localize('BAD.settings.logVerbosity.choices.debug')
        },
        onChange: value => {
            log.setVerbosity(value);
        }
    });

    // Register Persist Detached HUD Setting
    game.settings.register(MODULE_ID, 'persistDetached', {
        name: game.i18n.localize('BAD.settings.persistDetached.name'),
        hint: game.i18n.localize('BAD.settings.persistDetached.hint'),
        scope: 'client',
        config: true,
        type: Boolean,
        default: true
    });

    // Register Filter Out of Resources Setting (hidden from config menu, managed via HUD footer)
    game.settings.register(MODULE_ID, 'filterNoResources', {
        scope: 'client',
        config: false,
        type: Boolean,
        default: false
    });

    // Register HUD Opacity Setting (Slider)
    game.settings.register(MODULE_ID, 'hudOpacity', {
        name: game.i18n.localize('BAD.settings.hudOpacity.name'),
        hint: game.i18n.localize('BAD.settings.hudOpacity.hint'),
        scope: 'client',
        config: true,
        type: Number,
        range: {
            min: 0.1,
            max: 1.0,
            step: 0.05
        },
        default: 0.88,
        // Reactively update the CSS variable instantly when changed
        onChange: value => {
            document.documentElement.style.setProperty('--bad-hud-opacity', value);
        }
    });

    // Register HUD Scale Setting (Slider)
    game.settings.register(MODULE_ID, 'hudScale', {
        name: game.i18n.localize('BAD.settings.hudScale.name'),
        hint: game.i18n.localize('BAD.settings.hudScale.hint'),
        scope: 'client',
        config: true,
        type: Number,
        range: {
            min: 0.5,
            max: 1.5,
            step: 0.05
        },
        default: 1.0,
        // Reactively update the CSS variable instantly when changed
        onChange: value => {
            document.documentElement.style.setProperty('--bad-hud-scale', value);
        }
    });

    // Register HUD Font Size Setting (Slider)
    game.settings.register(MODULE_ID, 'fontSize', {
        name: game.i18n.localize('BAD.settings.fontSize.name'),
        hint: game.i18n.localize('BAD.settings.fontSize.hint'),
        scope: 'client',
        config: true,
        type: Number,
        range: {
            min: 10,
            max: 24,
            step: 1
        },
        default: 14,
        // Reactively update the CSS variable instantly when changed
        onChange: value => {
            document.documentElement.style.setProperty('--bad-hud-font-size', `${value}px`);
        }
    });

    // Register Persist Tab State setting
    game.settings.register(MODULE_ID, 'persistTabState', {
        name: game.i18n.localize('BAD.settings.persistTabState.name'),
        hint: game.i18n.localize('BAD.settings.persistTabState.hint'),
        scope: 'client',
        config: true,
        type: Boolean,
        default: true
    });

    // Register Toggle Tab Selection Setting
    game.settings.register(MODULE_ID, 'toggleTabSelection', {
        name: game.i18n.localize('BAD.settings.toggleTabSelection.name'),
        hint: game.i18n.localize('BAD.settings.toggleTabSelection.hint'),
        scope: 'client',
        config: true,
        type: Boolean,
        default: false
    });

    // Register HUD Attachment Side Setting (Vertical vs Horizontal)
    game.settings.register(MODULE_ID, 'hudAnchorSide', {
        name: game.i18n.localize('BAD.settings.hudAnchorSide.name'),
        hint: game.i18n.localize('BAD.settings.hudAnchorSide.hint'),
        scope: 'client',
        config: true,
        type: String,
        default: 'vertical',
        choices: {
            'vertical': game.i18n.localize('BAD.settings.hudAnchorSide.choices.vertical'),
            'horizontal': game.i18n.localize('BAD.settings.hudAnchorSide.choices.horizontal')
        },
        onChange: () => {
            if (actionDisplay.activeApp && actionDisplay.activeApp.rendered) {
                actionDisplay.activeApp.setPosition();
            }
        }
    });

    // Register HUD Grid Offset Setting (Vertical)
    game.settings.register(MODULE_ID, 'hudGridOffset', {
        name: game.i18n.localize('BAD.settings.hudGridOffset.name'),
        hint: game.i18n.localize('BAD.settings.hudGridOffset.hint'),
        scope: 'client',
        config: true,
        type: Number,
        range: {
            min: 0,
            max: 1,
            step: 0.1
        },
        default: 0.5,
        onChange: () => {
            if (actionDisplay.activeApp && actionDisplay.activeApp.rendered) {
                actionDisplay.activeApp.setPosition();
            }
        }
    });

    // Register HUD Grid Offset Setting (Horizontal)
    game.settings.register(MODULE_ID, 'hudGridOffsetHorizontal', {
        name: game.i18n.localize('BAD.settings.hudGridOffsetHorizontal.name'),
        hint: game.i18n.localize('BAD.settings.hudGridOffsetHorizontal.hint'),
        scope: 'client',
        config: true,
        type: Number,
        range: {
            min: 0,
            max: 3,
            step: 0.1
        },
        default: 0.5,
        onChange: () => {
            if (actionDisplay.activeApp && actionDisplay.activeApp.rendered) {
                actionDisplay.activeApp.setPosition();
            }
        }
    });

    // Register HUD Tab States (persisted actor tab selections object)
    game.settings.register(MODULE_ID, 'hudTabStates', {
        scope: 'client',
        config: false,
        type: Object,
        default: {}
    });

    // Register HUD Position Mode (attached/pinned/detached)
    game.settings.register(MODULE_ID, 'hudPositionMode', {
        scope: 'client',
        config: false,
        type: String,
        default: 'attached'
    });

    // Register HUD Pinned Offset (fixed offset relative to token top-left)
    game.settings.register(MODULE_ID, 'hudPinnedOffset', {
        scope: 'client',
        config: false,
        type: Object,
        default: { x: 0, y: -50 }
    });

    // Register HUD Detached Position (coordinates)
    game.settings.register(MODULE_ID, 'hudDetachedPosition', {
        scope: 'client',
        config: false,
        type: Object,
        default: null
    });

    // Register Categorization Configuration Menu Button
    game.settings.registerMenu(MODULE_ID, 'categorizationMenu', {
        name: game.i18n.localize('BAD.settings.categorizationMenu.name'),
        label: game.i18n.localize('BAD.settings.categorizationMenu.label'),
        hint: game.i18n.localize('BAD.settings.categorizationMenu.hint'),
        icon: 'fas fa-layer-group',
        type: CategorizationConfigApp,
        restricted: false
    });

    // Register Categorization Configuration Storage
    game.settings.register(MODULE_ID, 'categorizationConfig', {
        scope: 'world',
        config: false,
        type: Object,
        default: {
            enabled: false,
            categories: []
        },
        onChange: () => {
            if (actionDisplay.activeApp && actionDisplay.activeApp.rendered) {
                actionDisplay.activeApp.render();
            }
        }
    });

    // Apply the initial opacity and scale values to the document root
    const initialOpacity = game.settings.get(MODULE_ID, 'hudOpacity');
    document.documentElement.style.setProperty('--bad-hud-opacity', initialOpacity);

    const initialScale = game.settings.get(MODULE_ID, 'hudScale');
    document.documentElement.style.setProperty('--bad-hud-scale', initialScale);

    const initialFontSize = game.settings.get(MODULE_ID, 'fontSize');
    document.documentElement.style.setProperty('--bad-hud-font-size', `${initialFontSize}px`);
});
