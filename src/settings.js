import { MODULE_ID } from "./constants.js";
import { log } from "./lib/logger.js";
import { actionDisplay } from "./action-display.js";
import { CategorizationConfigApp } from "./categorization/categorization-config-app.js";
import { EconomyColorsConfigApp } from "./ui/economy-colors-config-app.js";
import { ModuleIntegrationsConfigApp } from "./ui/module-integrations-config-app.js";
import { hasActiveModuleAdapters } from "./adapters/module/index.js";

Hooks.once('init', () => {
    // ==========================================
    // World Scope Settings & Menus
    // ==========================================

    // Register Categorization Configuration Menu Button
    game.settings.registerMenu(MODULE_ID, 'categorizationMenu', {
        name: game.i18n.localize('BAD.settings.categorizationMenu.name'),
        label: game.i18n.localize('BAD.settings.categorizationMenu.label'),
        hint: game.i18n.localize('BAD.settings.categorizationMenu.hint'),
        icon: 'fas fa-layer-group',
        type: CategorizationConfigApp,
        restricted: true
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

    // Register Module Integration Configuration Storage (Midi-QOL filter automation-only)
    game.settings.register(MODULE_ID, 'midiQolFilterAutomationOnly', {
        scope: 'world',
        config: false,
        type: Boolean,
        default: true,
        onChange: () => {
            if (actionDisplay.activeApp && actionDisplay.activeApp.rendered) {
                actionDisplay.activeApp.render();
            }
        }
    });

    // Register Module Integration Configuration Menu Button (only visible if at least one adapter module is loaded)
    if (hasActiveModuleAdapters()) {
        game.settings.registerMenu(MODULE_ID, 'moduleIntegrationsMenu', {
            name: game.i18n.localize('BAD.settings.moduleIntegrationsMenu.name'),
            label: game.i18n.localize('BAD.settings.moduleIntegrationsMenu.label'),
            hint: game.i18n.localize('BAD.settings.moduleIntegrationsMenu.hint'),
            icon: 'fas fa-puzzle-piece',
            type: ModuleIntegrationsConfigApp,
            restricted: true
        });
    }

    // Register Center on Token Button Setting (World Scope, default disabled)
    game.settings.register(MODULE_ID, 'enableCenterOnToken', {
        name: game.i18n.localize('BAD.settings.enableCenterOnToken.name'),
        hint: game.i18n.localize('BAD.settings.enableCenterOnToken.hint'),
        scope: 'world',
        config: true,
        type: Boolean,
        default: false,
        onChange: () => {
            if (actionDisplay.activeApp && actionDisplay.activeApp.rendered) {
                actionDisplay.activeApp.render();
            }
        }
    });

    // ==========================================
    // User Scope Settings & Menus
    // ==========================================

    // Register Economy Colors Menu Button (User Scope)
    game.settings.registerMenu(MODULE_ID, 'economyColorsMenu', {
        name: game.i18n.localize('BAD.settings.economyColorsMenu.name'),
        label: game.i18n.localize('BAD.settings.economyColorsMenu.label'),
        hint: game.i18n.localize('BAD.settings.economyColorsMenu.hint'),
        icon: 'fas fa-palette',
        type: EconomyColorsConfigApp,
        restricted: false
    });

    // Register Action Economy Indicators Setting (User Scope, default disabled, configured in menu)
    game.settings.register(MODULE_ID, 'enableEconomyIndicators', {
        scope: 'user',
        config: false,
        type: Boolean,
        default: false,
        onChange: () => {
            if (actionDisplay.activeApp && actionDisplay.activeApp.rendered) {
                actionDisplay.activeApp.render();
            }
        }
    });

    // Register Action Economy Colors Configuration Storage (User Scope)
    game.settings.register(MODULE_ID, 'economyColors', {
        scope: 'user',
        config: false,
        type: Object,
        default: {},
        onChange: () => {
            if (actionDisplay.activeApp && actionDisplay.activeApp.rendered) {
                actionDisplay.activeApp.render();
            }
        }
    });

    // Register HUD Opacity Setting (Slider)
    game.settings.register(MODULE_ID, 'hudOpacity', {
        name: game.i18n.localize('BAD.settings.hudOpacity.name'),
        hint: game.i18n.localize('BAD.settings.hudOpacity.hint'),
        scope: 'user',
        config: true,
        type: Number,
        range: {
            min: 0.1,
            max: 1.0,
            step: 0.05
        },
        default: 0.88,
        onChange: value => {
            document.documentElement.style.setProperty('--bad-hud-opacity', value);
        }
    });

    // Register HUD Scale Setting (Slider)
    game.settings.register(MODULE_ID, 'hudScale', {
        name: game.i18n.localize('BAD.settings.hudScale.name'),
        hint: game.i18n.localize('BAD.settings.hudScale.hint'),
        scope: 'user',
        config: true,
        type: Number,
        range: {
            min: 0.5,
            max: 1.5,
            step: 0.05
        },
        default: 1.0,
        onChange: value => {
            document.documentElement.style.setProperty('--bad-hud-scale', value);
        }
    });

    // Register HUD Font Size Setting (Slider)
    game.settings.register(MODULE_ID, 'fontSize', {
        name: game.i18n.localize('BAD.settings.fontSize.name'),
        hint: game.i18n.localize('BAD.settings.fontSize.hint'),
        scope: 'user',
        config: true,
        type: Number,
        range: {
            min: 10,
            max: 24,
            step: 1
        },
        default: 14,
        onChange: value => {
            document.documentElement.style.setProperty('--bad-hud-font-size', `${value}px`);
        }
    });

    // Register Persist Tab State setting
    game.settings.register(MODULE_ID, 'persistTabState', {
        name: game.i18n.localize('BAD.settings.persistTabState.name'),
        hint: game.i18n.localize('BAD.settings.persistTabState.hint'),
        scope: 'user',
        config: true,
        type: Boolean,
        default: true
    });

    // Register Persist Detached HUD Setting
    game.settings.register(MODULE_ID, 'persistDetached', {
        name: game.i18n.localize('BAD.settings.persistDetached.name'),
        hint: game.i18n.localize('BAD.settings.persistDetached.hint'),
        scope: 'user',
        config: true,
        type: Boolean,
        default: true
    });

    // Register Toggle Tab Selection Setting
    game.settings.register(MODULE_ID, 'toggleTabSelection', {
        name: game.i18n.localize('BAD.settings.toggleTabSelection.name'),
        hint: game.i18n.localize('BAD.settings.toggleTabSelection.hint'),
        scope: 'user',
        config: true,
        type: Boolean,
        default: false
    });

    // Register HUD Attachment Side Setting (Vertical vs Horizontal)
    game.settings.register(MODULE_ID, 'hudAnchorSide', {
        name: game.i18n.localize('BAD.settings.hudAnchorSide.name'),
        hint: game.i18n.localize('BAD.settings.hudAnchorSide.hint'),
        scope: 'user',
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
        scope: 'user',
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
        scope: 'user',
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

    // ==========================================
    // Client Scope Settings
    // ==========================================

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

    // Register Show Depleted Items Setting (hidden from config menu, managed via HUD control bar)
    game.settings.register(MODULE_ID, 'showDepleted', {
        scope: 'client',
        config: false,
        type: Boolean,
        default: false
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

    // Register HUD Tab States (persisted actor tab selections object)
    game.settings.register(MODULE_ID, 'hudTabStates', {
        scope: 'client',
        config: false,
        type: Object,
        default: {}
    });

    // Apply initial CSS variables (opacity, scale, font size) to the document root
    const initialOpacity = game.settings.get(MODULE_ID, 'hudOpacity');
    document.documentElement.style.setProperty('--bad-hud-opacity', initialOpacity);

    const initialScale = game.settings.get(MODULE_ID, 'hudScale');
    document.documentElement.style.setProperty('--bad-hud-scale', initialScale);

    const initialFontSize = game.settings.get(MODULE_ID, 'fontSize');
    document.documentElement.style.setProperty('--bad-hud-font-size', `${initialFontSize}px`);
});

/**
 * Injects styled subsection headers for World, User, and Client settings into the SettingsConfig dialog.
 * Moves user-scoped menus (like economyColorsMenu) to the User Settings section so they appear under User Settings.
 * @param {HTMLElement|Object} html Rendered settings config DOM element or jQuery collection
 */
export function injectSettingsHeaders(html) {
    const root = (typeof HTMLElement !== 'undefined' && html instanceof HTMLElement) ? html : (html?.[0] ?? html);
    if (!root || typeof root.querySelector !== 'function') return;

    // 1. Move economyColorsMenu (User Menu) into the User Settings section before hudOpacity if both are present
    const economyMenuSelector = [
        `[data-key="${MODULE_ID}.economyColorsMenu"]`,
        `[data-setting-id="${MODULE_ID}.economyColorsMenu"]`,
        `[data-entry-id="${MODULE_ID}.economyColorsMenu"]`
    ].join(', ');
    const hudOpacitySelector = [
        `[name="${MODULE_ID}.hudOpacity"]`,
        `[data-setting-id="${MODULE_ID}.hudOpacity"]`,
        `[data-entry-id="${MODULE_ID}.hudOpacity"]`
    ].join(', ');

    const economyMenuEl = root.querySelector(economyMenuSelector);
    const hudOpacityEl = root.querySelector(hudOpacitySelector);

    if (economyMenuEl && hudOpacityEl) {
        const economyFg = economyMenuEl.closest('.form-group') ?? economyMenuEl;
        const hudOpacityFg = hudOpacityEl.closest('.form-group') ?? hudOpacityEl;
        if (economyFg && hudOpacityFg && economyFg.parentNode && economyFg.parentNode === hudOpacityFg.parentNode) {
            if (economyFg.nextElementSibling !== hudOpacityFg) {
                hudOpacityFg.parentNode.insertBefore(economyFg, hudOpacityFg);
            }
        }
    }

    // 2. Insert section headers before the respective first setting in each scope
    const sections = [
        {
            keys: ['categorizationMenu', 'moduleIntegrationsMenu', 'enableCenterOnToken'],
            scope: 'world',
            title: game.i18n.localize('BAD.settingsSections.world') ?? 'World Settings',
            icon: 'fas fa-globe'
        },
        {
            keys: ['economyColorsMenu', 'hudOpacity'],
            scope: 'user',
            title: game.i18n.localize('BAD.settingsSections.user') ?? 'User Settings',
            icon: 'fas fa-user'
        },
        {
            keys: ['logVerbosity'],
            scope: 'client',
            title: game.i18n.localize('BAD.settingsSections.client') ?? 'Client Settings',
            icon: 'fas fa-desktop'
        }
    ];

    for (const section of sections) {
        let targetEl = null;
        for (const key of section.keys) {
            const selector = [
                `[data-setting-id="${MODULE_ID}.${key}"]`,
                `[data-entry-id="${MODULE_ID}.${key}"]`,
                `[name="${MODULE_ID}.${key}"]`,
                `[data-key="${MODULE_ID}.${key}"]`
            ].join(', ');
            targetEl = root.querySelector(selector);
            if (targetEl) break;
        }

        if (!targetEl) continue;

        const formGroup = targetEl.closest('.form-group') ?? targetEl;
        if (!formGroup || !formGroup.parentNode) continue;

        // Ensure we don't insert duplicate headers
        const prev = formGroup.previousElementSibling;
        if (prev?.classList?.contains('bad-settings-section-header') && prev?.dataset?.scope === section.scope) {
            continue;
        }

        const header = document.createElement('div');
        header.className = 'bad-settings-section-header';
        header.dataset.scope = section.scope;
        header.innerHTML = `<i class="${section.icon}"></i><span>${section.title}</span>`;
        formGroup.parentNode.insertBefore(header, formGroup);
    }
}

Hooks.on('renderSettingsConfig', (app, html) => {
    injectSettingsHeaders(html);
});

