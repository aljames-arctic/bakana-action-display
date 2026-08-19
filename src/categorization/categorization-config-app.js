import { MODULE_ID } from '../constants.js';
import { log } from '../lib/logger.js';
import {
    normalizeCategorizationConfig,
    getDefaultCategories,
    validateExpression
} from './categorization-manager.js';
import { actionDisplay } from '../action-display.js';

/**
 * Modern ApplicationV2 configuration menu for HUD action categorization.
 */
export class CategorizationConfigApp extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
    /** @override */
    static DEFAULT_OPTIONS = {
        id: 'bad-categorization-config-app',
        classes: ['bad-categorization-config-window'],
        tag: 'div',
        window: {
            frame: true,
            title: 'BAD.categorization.title',
            resizable: true
        },
        position: {
            width: 720,
            height: 'auto'
        },
        actions: {
            toggleEnabled: CategorizationConfigApp.prototype._onToggleEnabled,
            addCategory: CategorizationConfigApp.prototype._onAddCategory,
            addSubCategory: CategorizationConfigApp.prototype._onAddSubCategory,
            removeCategory: CategorizationConfigApp.prototype._onRemoveCategory,
            removeSubCategory: CategorizationConfigApp.prototype._onRemoveSubCategory,
            loadPresets: CategorizationConfigApp.prototype._onLoadPresets,
            saveConfig: CategorizationConfigApp.prototype._onSaveConfig,
            closeConfig: CategorizationConfigApp.prototype._onCloseConfig
        }
    };

    /** @override */
    static get PARTS() {
        const path = game.modules?.get(MODULE_ID)?.path ?? `modules/${MODULE_ID}`;
        return {
            config: {
                template: `${path}/templates/categorization-config.html`
            }
        };
    }

    constructor(options = {}) {
        super(options);
        const stored = game.settings.get(MODULE_ID, 'categorizationConfig');
        this.config = normalizeCategorizationConfig(stored);
        this._dragState = null;
    }

    /** @override */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.config = this.config;
        return context;
    }

    /** @override */
    _onRender(context, options) {
        super._onRender?.(context, options);
        this._attachDragListeners();
        this._attachInputListeners();
    }

    /**
     * Attach input change listeners to sync form inputs directly to this.config in real time.
     */
    _attachInputListeners() {
        if (!this.element) return;

        const inputs = this.element.querySelectorAll('input[type="text"]');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                this._syncFormData();
            });
        });
    }

    /**
     * Attach native HTML5 drag-and-drop listeners for reordering categories and subcategories.
     */
    _attachDragListeners() {
        if (!this.element) return;

        // Category drag handles & cards
        const catCards = this.element.querySelectorAll('.bad-config-cat-card');
        catCards.forEach(card => {
            const catIndex = Number(card.dataset.catIndex);
            const handle = card.querySelector('.bad-config-drag-handle[data-drag-type="category"]');

            if (handle) {
                handle.addEventListener('mousedown', () => {
                    card.setAttribute('draggable', 'true');
                });
            }

            card.addEventListener('dragstart', (e) => {
                this._syncFormData();
                this._dragState = { type: 'category', fromIndex: catIndex };
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', JSON.stringify(this._dragState));
                card.classList.add('dragging');
            });

            card.addEventListener('dragend', () => {
                card.setAttribute('draggable', 'false');
                card.classList.remove('dragging');
                this._clearDragHighlights();
                this._dragState = null;
            });

            card.addEventListener('dragover', (e) => {
                if (this._dragState?.type === 'category') {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    card.classList.add('drag-over');
                }
            });

            card.addEventListener('dragleave', () => {
                card.classList.remove('drag-over');
            });

            card.addEventListener('drop', (e) => {
                if (this._dragState?.type === 'category') {
                    e.preventDefault();
                    card.classList.remove('drag-over');
                    const toIndex = catIndex;
                    const fromIndex = this._dragState.fromIndex;
                    if (fromIndex !== toIndex && fromIndex >= 0 && toIndex >= 0) {
                        this._syncFormData();
                        const [moved] = this.config.categories.splice(fromIndex, 1);
                        this.config.categories.splice(toIndex, 0, moved);
                        this.render();
                    }
                }
            });
        });

        // Subcategory drag handles & rows
        const subRows = this.element.querySelectorAll('.bad-config-sub-row');
        subRows.forEach(row => {
            const catIndex = Number(row.dataset.catIndex);
            const subIndex = Number(row.dataset.subIndex);
            const handle = row.querySelector('.bad-config-drag-handle[data-drag-type="subcategory"]');

            if (handle) {
                handle.addEventListener('mousedown', () => {
                    row.setAttribute('draggable', 'true');
                });
            }

            row.addEventListener('dragstart', (e) => {
                e.stopPropagation();
                this._syncFormData();
                this._dragState = { type: 'subcategory', catIndex, fromIndex: subIndex };
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', JSON.stringify(this._dragState));
                row.classList.add('dragging');
            });

            row.addEventListener('dragend', (e) => {
                e.stopPropagation();
                row.setAttribute('draggable', 'false');
                row.classList.remove('dragging');
                this._clearDragHighlights();
                this._dragState = null;
            });

            row.addEventListener('dragover', (e) => {
                if (this._dragState?.type === 'subcategory' && this._dragState.catIndex === catIndex) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'move';
                    row.classList.add('drag-over');
                }
            });

            row.addEventListener('dragleave', (e) => {
                e.stopPropagation();
                row.classList.remove('drag-over');
            });

            row.addEventListener('drop', (e) => {
                if (this._dragState?.type === 'subcategory' && this._dragState.catIndex === catIndex) {
                    e.preventDefault();
                    e.stopPropagation();
                    row.classList.remove('drag-over');
                    const toIndex = subIndex;
                    const fromIndex = this._dragState.fromIndex;
                    if (fromIndex !== toIndex && fromIndex >= 0 && toIndex >= 0) {
                        this._syncFormData();
                        const subs = this.config.categories[catIndex].subcategories;
                        const [moved] = subs.splice(fromIndex, 1);
                        subs.splice(toIndex, 0, moved);
                        this.render();
                    }
                }
            });
        });
    }

    _clearDragHighlights() {
        if (!this.element) return;
        this.element.querySelectorAll('.drag-over, .dragging').forEach(el => {
            el.classList.remove('drag-over', 'dragging');
            el.setAttribute('draggable', 'false');
        });
    }

    /**
     * Read current form input values into this.config data model.
     */
    _syncFormData() {
        if (!this.element) return;

        const enabledCheckbox = this.element.querySelector('input[name="categorizationEnabled"]');
        if (enabledCheckbox) {
            this.config.enabled = enabledCheckbox.checked;
        }

        const catElements = this.element.querySelectorAll('.bad-config-cat-row');
        catElements.forEach(catEl => {
            const catIndex = Number(catEl.dataset.catIndex);
            if (isNaN(catIndex) || !this.config.categories[catIndex]) return;

            const nameInput = catEl.querySelector('.bad-cat-name-input');
            const exprInput = catEl.querySelector('.bad-cat-expr-input');
            if (nameInput) this.config.categories[catIndex].name = nameInput.value;
            if (exprInput) this.config.categories[catIndex].expression = exprInput.value;

            const subElements = catEl.parentElement?.querySelectorAll('.bad-config-sub-row') ?? [];
            subElements.forEach(subEl => {
                const subIndex = Number(subEl.dataset.subIndex);
                if (isNaN(subIndex) || !this.config.categories[catIndex].subcategories?.[subIndex]) return;

                const subNameInput = subEl.querySelector('.bad-sub-name-input');
                const subExprInput = subEl.querySelector('.bad-sub-expr-input');
                if (subNameInput) this.config.categories[catIndex].subcategories[subIndex].name = subNameInput.value;
                if (subExprInput) this.config.categories[catIndex].subcategories[subIndex].expression = subExprInput.value;
            });
        });
    }

    /* -------------------------------------------- */
    /*  Action Handlers                             */
    /* -------------------------------------------- */

    _onToggleEnabled(event, target) {
        this._syncFormData();
        this.config.enabled = target.checked;
    }

    _onAddCategory(event, target) {
        event.preventDefault();
        this._syncFormData();
        this.config.categories.push({
            id: `cat_${Date.now()}_${this.config.categories.length}`,
            name: '',
            expression: '',
            subcategories: []
        });
        this.render();
    }

    _onAddSubCategory(event, target) {
        event.preventDefault();
        this._syncFormData();
        const catIndex = Number(target.dataset.catIndex);
        if (isNaN(catIndex) || !this.config.categories[catIndex]) return;

        if (!Array.isArray(this.config.categories[catIndex].subcategories)) {
            this.config.categories[catIndex].subcategories = [];
        }

        this.config.categories[catIndex].subcategories.push({
            id: `sub_${Date.now()}_${this.config.categories[catIndex].subcategories.length}`,
            name: '',
            expression: ''
        });
        this.render();
    }

    _onRemoveCategory(event, target) {
        event.preventDefault();
        this._syncFormData();
        const catIndex = Number(target.dataset.catIndex);
        if (isNaN(catIndex) || !this.config.categories[catIndex]) return;

        this.config.categories.splice(catIndex, 1);
        this.render();
    }

    _onRemoveSubCategory(event, target) {
        event.preventDefault();
        this._syncFormData();
        const catIndex = Number(target.dataset.catIndex);
        const subIndex = Number(target.dataset.subIndex);
        if (isNaN(catIndex) || isNaN(subIndex) || !this.config.categories[catIndex]?.subcategories?.[subIndex]) return;

        this.config.categories[catIndex].subcategories.splice(subIndex, 1);
        this.render();
    }

    _onLoadPresets(event, target) {
        event.preventDefault();
        this.config.categories = getDefaultCategories(actionDisplay?.activeSystemAdapter);
        this.render();
    }

    async _onSaveConfig(event, target) {
        event.preventDefault();
        this._syncFormData();

        // Validate category & subcategory names and expressions
        for (const cat of this.config.categories) {
            const trimmedName = (cat.name ?? '').trim();
            if (!trimmedName) {
                ui?.notifications?.warn?.(game.i18n.localize('BAD.categorization.emptyNameWarning'));
                return;
            }
            if (cat.expression) {
                const check = validateExpression(cat.expression);
                if (!check.valid) {
                    ui?.notifications?.warn?.(
                        game.i18n.format('BAD.categorization.invalidExpressionWarning', { expr: cat.expression })
                    );
                    return;
                }
            }

            for (const sub of (cat.subcategories ?? [])) {
                const trimmedSubName = (sub.name ?? '').trim();
                if (!trimmedSubName) {
                    ui?.notifications?.warn?.(game.i18n.localize('BAD.categorization.emptyNameWarning'));
                    return;
                }
                if (sub.expression) {
                    const check = validateExpression(sub.expression);
                    if (!check.valid) {
                        ui?.notifications?.warn?.(
                            game.i18n.format('BAD.categorization.invalidExpressionWarning', { expr: sub.expression })
                        );
                        return;
                    }
                }
            }
        }

        const normalized = normalizeCategorizationConfig(this.config);
        await game.settings.set(MODULE_ID, 'categorizationConfig', normalized);
        log.info("Categorization configuration saved successfully");

        ui?.notifications?.info?.(game.i18n.localize('BAD.categorization.saved'));

        if (actionDisplay.activeApp && actionDisplay.activeApp.rendered) {
            actionDisplay.activeApp.render();
        }

        this.close();
    }

    _onCloseConfig(event, target) {
        event.preventDefault();
        this.close();
    }
}
