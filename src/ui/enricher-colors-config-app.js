import { MODULE_ID } from '../constants.js';
import { log } from '../lib/logger.js';
import { adapter } from '../adapters/index.js';
import { ENRICHER_TYPES, DEFAULT_ENRICHER_COLORS, ENRICHER_COLOR_PRESETS, applyEnricherCssVariables } from './enricher-presets.js';

/**
 * Modern ApplicationV2 configuration menu for item summary tooltip enricher colors.
 */
export class EnricherColorsConfigApp extends adapter.foundry.HandlebarsApplicationMixin(adapter.foundry.ApplicationV2) {
    /** @override */
    static DEFAULT_OPTIONS = {
        id: 'bad-enricher-colors-config-app',
        classes: ['bad-enricher-colors-config-window'],
        tag: 'div',
        window: {
            frame: true,
            title: 'BAD.enricherColors.title',
            resizable: true
        },
        position: {
            width: 560,
            height: 'auto'
        },
        actions: {
            resetDefaults: EnricherColorsConfigApp.prototype._onResetDefaults,
            saveConfig: EnricherColorsConfigApp.prototype._onSaveConfig,
            closeConfig: EnricherColorsConfigApp.prototype._onCloseConfig
        }
    };

    /** @override */
    static get PARTS() {
        const path = game.modules?.get(MODULE_ID)?.path ?? `modules/${MODULE_ID}`;
        return {
            config: {
                template: `${path}/templates/enricher-colors-config.html`,
                scrollable: ['.bad-enricher-colors-list']
            }
        };
    }

    constructor(options = {}) {
        super(options);
        const stored = game.settings.get(MODULE_ID, 'enricherColors') ?? {};
        this.colors = {
            ...DEFAULT_ENRICHER_COLORS,
            ...adapter.foundry.duplicate(stored)
        };
        this.selectedPreset = '';
    }

    /** @override */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const enricherTypes = ENRICHER_TYPES.map(type => {
            const color = this.colors[type.id] ?? type.defaultColor;
            return {
                id: type.id,
                label: type.label,
                desc: type.desc,
                defaultColor: type.defaultColor,
                icon: type.icon,
                sampleText: type.sampleText,
                color
            };
        });

        const presets = Object.values(ENRICHER_COLOR_PRESETS).map(p => ({
            id: p.id,
            label: game.i18n.localize(p.label) ?? p.id,
            selected: this.selectedPreset === p.id
        }));

        context.enricherTypes = enricherTypes;
        context.presets = presets;
        return context;
    }

    /** @override */
    _onRender(context, options) {
        super._onRender?.(context, options);
        this._attachInputListeners();
    }

    /**
     * Attach input listeners to sync color pickers, text inputs, and live badge previews in real time.
     * @private
     */
    _attachInputListeners() {
        if (!this.element || this._listenersAttached) return;
        this._listenersAttached = true;

        // Delegated change listener for presets
        this.element.addEventListener('change', (event) => {
            const presetSelect = event.target.closest('.bad-enricher-preset-select');
            if (presetSelect) {
                this.applyPreset(presetSelect.value);
            }
        });

        // Delegated input listener for color pickers & text inputs
        this.element.addEventListener('input', (event) => {
            const picker = event.target.closest('.bad-enricher-color-picker');
            if (picker) {
                const typeId = picker.dataset.typeId;
                const value = picker.value;
                if (typeId && value) {
                    this.colors[typeId] = value;
                    this._updateRowPreview(typeId, value);
                }
                return;
            }

            const input = event.target.closest('.bad-enricher-color-input');
            if (input) {
                const typeId = input.dataset.typeId;
                const value = input.value?.trim();
                if (typeId && /^#[0-9A-Fa-f]{6}$/.test(value)) {
                    this.colors[typeId] = value;
                    this._updateRowPreview(typeId, value);
                }
            }
        });
    }

    /**
     * Update the live badge preview and inputs for a given enricher type.
     * @param {string} typeId
     * @param {string} colorHex
     * @private
     */
    _updateRowPreview(typeId, colorHex) {
        const row = this.element.querySelector(`.bad-enricher-color-row[data-type-id="${typeId}"]`);
        if (!row) return;

        const colorPicker = row.querySelector('.bad-enricher-color-picker');
        if (colorPicker && colorPicker.value !== colorHex) colorPicker.value = colorHex;

        const textInput = row.querySelector('.bad-enricher-color-input');
        if (textInput && textInput.value !== colorHex) textInput.value = colorHex;

        const previewBadge = row.querySelector('.bad-enricher-badge-preview');
        if (previewBadge) {
            previewBadge.style.setProperty(`--bad-preview-color`, colorHex);
        }
    }

    /**
     * Apply a color palette preset to current colors and re-render.
     * @param {string} presetId
     */
    applyPreset(presetId) {
        this.selectedPreset = presetId;
        const preset = ENRICHER_COLOR_PRESETS[presetId];
        if (preset?.colors) {
            for (const type of ENRICHER_TYPES) {
                if (preset.colors[type.id]) {
                    this.colors[type.id] = preset.colors[type.id];
                }
            }
        }
        this.render();
    }

    /**
     * Reset all colors to default HUD values.
     */
    async _onResetDefaults(event, target) {
        event?.preventDefault?.();
        this.colors = { ...DEFAULT_ENRICHER_COLORS };
        this.selectedPreset = '';
        this.render();
    }

    /**
     * Save configuration, update CSS custom properties, and notify user.
     */
    async _onSaveConfig(event, target) {
        event?.preventDefault?.();

        // Sync directly from DOM inputs if element exists
        if (this.element) {
            const colorInputs = this.element.querySelectorAll('.bad-enricher-color-input');
            for (const input of colorInputs) {
                const typeId = input.dataset.typeId;
                const val = input.value?.trim();
                if (typeId && /^#[0-9A-Fa-f]{6}$/.test(val)) {
                    this.colors[typeId] = val;
                }
            }
        }

        const payload = adapter.foundry.duplicate(this.colors);
        await game.settings.set(MODULE_ID, 'enricherColors', payload);
        applyEnricherCssVariables(payload);
        ui.notifications?.info?.(game.i18n.localize('BAD.enricherColors.saved'));
        await this.close();
    }

    /**
     * Close the modal without saving changes.
     */
    async _onCloseConfig(event, target) {
        event?.preventDefault?.();
        await this.close();
    }
}
