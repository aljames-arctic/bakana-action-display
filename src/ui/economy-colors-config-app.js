import { MODULE_ID } from '../constants.js';
import { log } from '../lib/logger.js';
import { adapter } from '../adapters/index.js';
import { actionDisplay } from '../action-display.js';
import { ECONOMY_COLOR_PRESETS } from './economy-presets.js';

/**
 * Modern ApplicationV2 configuration menu for Action Economy indicator colors.
 */
export class EconomyColorsConfigApp extends adapter.foundry.HandlebarsApplicationMixin(adapter.foundry.ApplicationV2) {
    /** @override */
    static DEFAULT_OPTIONS = {
        id: 'bad-economy-colors-config-app',
        classes: ['bad-economy-colors-config-window'],
        tag: 'div',
        window: {
            frame: true,
            title: 'BAD.economyColors.title',
            resizable: true
        },
        position: {
            width: 520,
            height: 'auto'
        },
        actions: {
            resetDefaults: EconomyColorsConfigApp.prototype._onResetDefaults,
            saveConfig: EconomyColorsConfigApp.prototype._onSaveConfig,
            closeConfig: EconomyColorsConfigApp.prototype._onCloseConfig
        }
    };

    /** @override */
    static get PARTS() {
        const path = game.modules?.get(MODULE_ID)?.path ?? `modules/${MODULE_ID}`;
        return {
            config: {
                template: `${path}/templates/economy-colors-config.html`,
                scrollable: ['.bad-economy-colors-list']
            }
        };
    }

    constructor(options = {}) {
        super(options);
        const stored = game.settings.get(MODULE_ID, 'economyColors') ?? {};
        this.colors = foundry.utils.duplicate(stored);
        this.selectedPreset = '';
    }

    /** @override */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const systemTypes = adapter.getEconomyTypes() ?? [];
        
        const economyTypes = systemTypes.map(type => {
            const color = this.colors[type.id] ?? type.defaultColor;
            return {
                id: type.id,
                label: type.label,
                defaultColor: type.defaultColor,
                color
            };
        });

        const presets = Object.values(ECONOMY_COLOR_PRESETS).map(p => ({
            id: p.id,
            label: game.i18n.localize(p.label) ?? p.id,
            selected: this.selectedPreset === p.id
        }));

        context.economyTypes = economyTypes;
        context.presets = presets;
        return context;
    }

    /** @override */
    _onRender(context, options) {
        super._onRender?.(context, options);
        this._attachInputListeners();
    }

    /**
     * Attach input listeners to sync color pickers and text inputs in real time.
     * @private
     */
    _attachInputListeners() {
        if (!this.element) return;

        // Preset dropdown selection
        const presetSelect = this.element.querySelector('.bad-economy-preset-select');
        if (presetSelect) {
            presetSelect.addEventListener('change', (event) => {
                this.applyPreset(event.target.value);
            });
        }

        // Sync color picker changes to text inputs and preview bars
        const colorPickers = this.element.querySelectorAll('.bad-economy-color-picker');
        for (const picker of colorPickers) {
            picker.addEventListener('input', (event) => {
                const typeId = event.target.dataset.typeId;
                const value = event.target.value;
                this.colors[typeId] = value;

                const textInput = this.element.querySelector(`.bad-economy-color-input[data-type-id="${typeId}"]`);
                if (textInput) textInput.value = value;

                const preview = this.element.querySelector(`.bad-economy-preview[data-type-id="${typeId}"]`);
                if (preview) preview.style.backgroundColor = value;
            });
        }

        // Sync text input changes to color pickers and preview bars
        const textInputs = this.element.querySelectorAll('.bad-economy-color-input');
        for (const input of textInputs) {
            input.addEventListener('input', (event) => {
                const typeId = event.target.dataset.typeId;
                const value = event.target.value.trim();
                if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                    this.colors[typeId] = value;

                    const picker = this.element.querySelector(`.bad-economy-color-picker[data-type-id="${typeId}"]`);
                    if (picker) picker.value = value;

                    const preview = this.element.querySelector(`.bad-economy-preview[data-type-id="${typeId}"]`);
                    if (preview) preview.style.backgroundColor = value;
                }
            });
        }
    }

    /**
     * Apply a color palette preset to current colors and re-render.
     * @param {string} presetId
     */
    applyPreset(presetId) {
        this.selectedPreset = presetId;
        const preset = ECONOMY_COLOR_PRESETS[presetId];
        if (preset?.colors) {
            const systemTypes = adapter.getEconomyTypes() ?? [];
            for (const type of systemTypes) {
                if (preset.colors[type.id]) {
                    this.colors[type.id] = preset.colors[type.id];
                }
            }
        }
        this.render();
    }

    /**
     * Reset all colors to default system values.
     */
    async _onResetDefaults(event, target) {
        event.preventDefault();
        this.colors = {};
        this.selectedPreset = '';
        this.render();
    }

    /**
     * Save configuration and notify user.
     */
    async _onSaveConfig(event, target) {
        event.preventDefault();
        await game.settings.set(MODULE_ID, 'economyColors', this.colors);
        ui.notifications?.info?.(game.i18n.localize('BAD.economyColors.saved'));
        if (actionDisplay.activeApp?.rendered) {
            actionDisplay.activeApp.render();
        }
        await this.close();
    }

    /**
     * Close the modal without saving changes.
     */
    async _onCloseConfig(event, target) {
        event.preventDefault();
        await this.close();
    }
}
