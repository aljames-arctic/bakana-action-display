import { adapter } from '../adapters/index.js';
import { actionDisplay } from '../action-display.js';
import { log } from '../lib/logger.js';
import { toSet } from '../lib/utils.js';
import { MODULE_ID } from '../constants.js';
import { HUDTabColumn } from './hud-tab-column.js';
import { HUDTab } from './hud-tab.js';
import { createActionContextMenu } from './app/context-menu-manager.js';
import { showActivityDropdown } from './app/dropdown-manager.js';
import { categorizeActions } from '../categorization/categorization-manager.js';
import { syncActorFavorites } from '../favorites/favorites-manager.js';

// Cache to persist tab states per actor across HUD rebuilds
const activeTabCache = new Map();
let lastActiveTabState = null;

/**
 * Modern ApplicationV2-based HUD overlay for Bakana's Action Display.
 * Uses HandlebarsApplicationMixin for rendering and the Actions API for event handling.
 * Positions itself dynamically relative to the selected token, or floats freely if detached.
 * Supports dragging and persists its position and attachment state.
 */
export class ActionDisplayApp extends adapter.foundry.HandlebarsApplicationMixin(adapter.foundry.ApplicationV2) {
    // #region Application Initialization & Lifecycle

    constructor(token, options = {}) {
        super(options);
        this.token = token;
        this.actor = token.actor;
        this.actions = [];
        this.totalPages = 1;

        const actorKey = this.actor?.uuid;
        const cached = this.retrieveActorTabCache(actorKey);
        const parsedPage = Number(cached?.activePage ?? 1);
        this.activePage = (!isNaN(parsedPage) && parsedPage > 0) ? parsedPage : 1;
        this._cachedPages = cached?.pages ?? {
            '1-left': cached?.left,
            '1-right': cached?.right
        };
        this._tabColumns = {};

        // HUD Attachment/Position Mode (persisted client-side)
        this.positionMode = game.settings.get(MODULE_ID, 'hudPositionMode');

        // Dragging state
        this._dragData = null;

        // Bind listeners once for event delegation and capture phases to prevent GC churn
        this._boundOnPointerDownCapture = this._onPointerDownCapture.bind(this);
        this._boundOnContextMenuCapture = this._onContextMenuCapture.bind(this);
        this._onDragStart = this._onDragStart.bind(this);
        this._onDragMove = this._onDragMove.bind(this);
        this._onDragEnd = this._onDragEnd.bind(this);
    }

    getTabColumn(side, page = this.activePage) {
        const parsedPage = Number(page ?? 1);
        const pageNum = (!isNaN(parsedPage) && parsedPage > 0) ? parsedPage : 1;
        if (!this._tabColumns) this._tabColumns = {};
        const key = `${pageNum}-${side}`;
        if (!this._tabColumns[key]) {
            this._tabColumns[key] = new HUDTabColumn({
                side,
                defaultParent: 'all',
                cached: this._cachedPages?.[key],
                getDefaultSubTypes: () => {
                    if (pageNum === 2) return side === 'right' ? ['all'] : [];
                    return side === 'left'
                        ? adapter.getDefaultActiveLeftSubTypes()
                        : adapter.getDefaultActiveSubTypes();
                }
            });
        }
        return this._tabColumns[key];
    }

    get leftTabs() {
        return this.getTabColumn('left', this.activePage);
    }

    get rightTabs() {
        return this.getTabColumn('right', this.activePage);
    }

    previousPage() {
        const parsed = Number(this.activePage ?? 1);
        const current = (!isNaN(parsed) && parsed > 0) ? parsed : 1;
        if (this.totalPages <= 1) {
            this.activePage = 1;
        } else if (current <= 1) {
            this.activePage = this.totalPages;
        } else {
            this.activePage = current - 1;
        }
        this._saveTabState();
        this.render();
    }

    nextPage() {
        const parsed = Number(this.activePage ?? 1);
        const current = (!isNaN(parsed) && parsed > 0) ? parsed : 1;
        if (this.totalPages <= 1) {
            this.activePage = 1;
        } else if (current >= this.totalPages) {
            this.activePage = 1;
        } else {
            this.activePage = current + 1;
        }
        this._saveTabState();
        this.render();
    }

    /**
     * Is the HUD in detached (floating) mode?
     * @type {boolean}
     */
    get isDetached() {
        return this.positionMode === 'detached';
    }

    /**
     * Is the HUD in attached (dynamic token tracking) mode?
     * @type {boolean}
     */
    get isAttached() {
        return this.positionMode === 'attached';
    }

    /**
     * Is the HUD in pinned (fixed offset token tracking) mode?
     * @type {boolean}
     */
    get isPinned() {
        return this.positionMode === 'pinned';
    }

    /**
     * Is the HUD tracking token position (either attached or pinned)?
     * @type {boolean}
     */
    get isTracked() {
        return this.positionMode !== 'detached';
    }

    // #endregion

    // #region Application Context & Rendering

    /**
     * Save active tab states for this actor to in-memory cache and client setting if enabled.
     * Capped to at most 25 most-recently-used actors using LRU pruning.
     */
    _saveTabState() {
        const actorKey = this.actor?.uuid;

        if (!this._cachedPages) this._cachedPages = {};
        this._cachedPages[`${this.activePage}-left`] = this.leftTabs.serialize();
        this._cachedPages[`${this.activePage}-right`] = this.rightTabs.serialize();

        const serialized = {
            activePage: this.activePage,
            left: this.leftTabs.serialize(),
            right: this.rightTabs.serialize(),
            pages: this._cachedPages
        };

        // Track most recent active tab selections for seamless actor switching
        lastActiveTabState = serialized;

        if (!actorKey) return;

        // Always update in-memory cache for fast session lookups
        activeTabCache.set(actorKey, serialized);

        // Persist client-side across refreshes if enabled (capped at 25 actors)
        if (game.settings.get(MODULE_ID, 'persistTabState')) {
            try {
                const MAX_PERSISTED_ACTORS = 25;
                const allStates = foundry.utils.duplicate(game.settings.get(MODULE_ID, 'hudTabStates') ?? {});

                // Re-insert key to refresh its LRU position (most recent at end)
                delete allStates[actorKey];
                allStates[actorKey] = serialized;

                // Enforce LRU cap of 25 actors by pruning oldest entries from front
                const keys = Object.keys(allStates);
                if (keys.length > MAX_PERSISTED_ACTORS) {
                    const toPrune = keys.slice(0, keys.length - MAX_PERSISTED_ACTORS);
                    for (const key of toPrune) {
                        delete allStates[key];
                    }
                }

                game.settings.set(MODULE_ID, 'hudTabStates', allStates);
            } catch (err) {
                log.error("Failed to save persisted tab state:", err);
            }
        }
    }

    /**
     * Retrieve active tab states for this actor from in-memory cache or client setting.
     */
    retrieveActorTabCache(actorKey) {
        let cached = activeTabCache.get(actorKey);
        if (!cached && game.settings.get(MODULE_ID, 'persistTabState')) {
            const allStates = game.settings.get(MODULE_ID, 'hudTabStates') ?? {};
            cached = (actorKey ? allStates[actorKey] : null) ?? lastActiveTabState;
            if (cached && actorKey) {
                activeTabCache.set(actorKey, cached);
            }
        } else if (!cached && lastActiveTabState) {
            cached = lastActiveTabState;
        }
        return cached;
    }

    /**
     * Close the application, logging the transition.
     */
    async close(options = {}) {
        log.debug(`ActionDisplayApp.close() initiated for token: ${this.token?.name}, state: ${this.state}`);
        // Hide the element instantly to prevent any default close animations/transitions
        // from causing visual glitches (like shifting and covering the token).
        if (this.element) {
            this.element.style.display = 'none';
        }

        // Clean up menu states and close any open dropdowns/context menus to prevent visual leaks
        this._clearMenuState();
        if (this._boundOutsidePointerDown) {
            window.removeEventListener('pointerdown', this._boundOutsidePointerDown, { capture: true });
        }
        this._contextMenu = null;
        this.actions = []; // Reset actions array to release references

        const result = await super.close(options);
        log.debug(`ActionDisplayApp.close() completed, new state: ${this.state}`);
        return result;
    }

    /**
     * Configure default options for the ApplicationV2.
     */
    static DEFAULT_OPTIONS = {
        id: 'bakana-action-display-app',
        classes: ['bakana-action-display-window'],
        tag: 'div',
        window: {
            frame: false, // BORDERLESS! Removes the default window frame
            title: "Bakana's Action Display"
        },
        position: {
            width: 'auto',
            height: 'auto'
        },
        // Declarative Actions API - maps data-action attributes in HTML to static handlers
        actions: {
            changeLeftItemType: ActionDisplayApp.prototype._onChangeLeftItemType,
            changeLeftSubItemType: ActionDisplayApp.prototype._onChangeLeftSubItemType,
            changeActionType: ActionDisplayApp.prototype._onChangeActionType,
            changeSubActionType: ActionDisplayApp.prototype._onChangeSubActionType,
            toggleAnchor: ActionDisplayApp.prototype._onToggleAnchor,
            closeHUD: ActionDisplayApp.prototype._onCloseHUD,
            rollAction: ActionDisplayApp.prototype._onRollAction,
            toggleFilterResources: ActionDisplayApp.prototype._onToggleFilterResources,
            previousPage: ActionDisplayApp.prototype._onPreviousPage,
            nextPage: ActionDisplayApp.prototype._onNextPage,
            changePage: ActionDisplayApp.prototype._onChangePage
        }
    };

    /**
     * Define the templates (parts) that make up this application.
     */
    static get PARTS() {
        const path = game.modules.get(MODULE_ID)?.path ?? `modules/${MODULE_ID}`;
        return {
            hud: {
                template: `${path}/templates/action-display.html`,
                scrollable: ['.bad-tab-content']
            }
        };
    }

    /**
     * Prepare the rendering context (equivalent to getData in AppV1).
     */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const allActions = await (actionDisplay.getActions ? actionDisplay.getActions(this.actor) : adapter.getActions(this.actor));
        this.actions = allActions; // Cache all processed actions for high-performance UI lookups
        this.totalPages = allActions.reduce((max, a) => Math.max(max, a.page ?? 1), 1);
        const rawActions = allActions.filter(a => (a.page ?? 1) === this.activePage);

        const existingItemCombinations = new Set();
        const existingCombinations = new Set();

        // 1. Single-pass loop: Extract unique tabs and filter actions simultaneously (O(N) vs O(3N))
        for (const action of rawActions) {
            const categories = action.itemCategories ?? (action.left?.length ? [action.left] : []);
            for (const cat of categories) {
                if (cat?.length) {
                    existingItemCombinations.add(cat.join('/'));
                }
            }

            if (action.right) {
                for (const tab of action.right) {
                    if (tab?.path) existingCombinations.add(tab.path);
                }
            }
        }

        // Always ensure 'hidden' tab is present if we are currently viewing it,
        // even if it is empty, to prevent jarring automatic tab switches when unhiding the last item.
        if (this.leftTabs.activeParents.has('hidden')) {
            existingItemCombinations.add('hidden');
        }

        // 2. Build the left-side hierarchy dynamically using the adapter
        const leftGroups = {};

        // Always ensure 'all' parent is present if we have actions
        if (rawActions.length > 0) {
            leftGroups['all'] = new HUDTab({
                id: 'all',
                label: adapter.getItemTypeLabel('all'),
                icon: adapter.getItemTypeIcon('all'),
                active: this.leftTabs.activeParents.has('all'),
                expanded: this.leftTabs.activeParents.has('all'),
                activeParent: false,
                subTabs: []
            });
        }

        for (const combo of existingItemCombinations) {
            if (!combo || typeof combo !== 'string') continue;
            const parts = combo.split('/');
            const parentId = parts[0];
            const subId = parts[1]; // might be undefined (spell level)

            if (!leftGroups[parentId]) {
                const isActive = this.leftTabs.activeParents.has(parentId);
                leftGroups[parentId] = new HUDTab({
                    id: parentId,
                    label: adapter.getItemTypeLabel(parentId),
                    icon: adapter.getItemTypeIcon(parentId),
                    active: isActive,
                    expanded: isActive,
                    activeParent: false, // Will compute post-loop
                    subTabs: []
                });
            }

            if (subId) {
                const isActive = this.leftTabs.activeParents.has(parentId);
                const isSubActive = this.leftTabs.activeSubTypes.has(subId);
                leftGroups[parentId].addSubTab({
                    id: subId,
                    label: adapter.getItemSubTabLabel(parentId, subId),
                    active: isActive && isSubActive
                });
            }
        }

        // Convert to array and sort by system adapter order
        const itemTypes = Object.values(leftGroups);
        itemTypes.sort((a, b) => adapter.getItemTypeSortOrder(a.id) - adapter.getItemTypeSortOrder(b.id));

        // Post-process leftGroups to set active, expanded, and activeParent, and sort sub-tabs
        for (const parent of itemTypes) {
            const validSubIds = toSet(parent.subTabs, t => t.id);
            const activeSubsForParent = Array.from(this.leftTabs.activeSubTypes).filter(id => validSubIds.has(id));

            parent.active = this.leftTabs.activeParents.has(parent.id);
            if (parent.subTabs.length > 0 && parent.active && activeSubsForParent.length > 0) {
                parent.activeParent = true;
            }
            parent.expanded = parent.id === this.leftTabs.focusedParent || activeSubsForParent.length > 0;

            if (parent.subTabs.length > 0) {
                parent.subTabs.sort((a, b) => adapter.getItemSubTabSortOrder(parent.id, a.id) - adapter.getItemSubTabSortOrder(parent.id, b.id));
            }
        }

        // Cache leftGroups on the instance for use in event handlers/action rolling
        this.leftGroups = leftGroups;

        // Prune active left sub-tabs that are no longer available in any active parent
        this.leftTabs.prune(leftGroups);

        // If no active left parent type is available, default to 'all'
        if (itemTypes.length && !itemTypes.some(p => this.leftTabs.activeParents.has(p.id))) {
            this.leftTabs.resetToDefault();
            const allTab = itemTypes.find(t => t.id === 'all');
            if (allTab) {
                allTab.active = true;
                allTab.expanded = true;
            }
        }

        // 3. Build the right-side hierarchy dynamically using the adapter
        const parentGroups = {};

        // Always ensure 'all' parent is present if we have actions
        if (rawActions.length > 0) {
            parentGroups['all'] = new HUDTab({
                id: 'all',
                label: adapter.getActionTypeLabel('all'),
                icon: adapter.getActionTypeIcon('all'),
                active: this.rightTabs.activeParents.has('all'),
                expanded: this.rightTabs.activeParents.has('all'),
                activeParent: false,
                subTabs: []
            });
        }

        for (const combo of existingCombinations) {
            if (!combo || typeof combo !== 'string') continue;
            const parts = combo.split('/');
            const parentId = parts[0];
            const subId = parts[1]; // might be undefined

            if (!parentGroups[parentId]) {
                const isActive = this.rightTabs.activeParents.has(parentId);
                parentGroups[parentId] = new HUDTab({
                    id: parentId,
                    label: adapter.getActionTypeLabel(parentId),
                    icon: adapter.getActionTypeIcon(parentId),
                    active: isActive,
                    expanded: isActive,
                    activeParent: false, // Will compute post-loop
                    subTabs: []
                });
            }

            if (subId) {
                const isActive = this.rightTabs.activeParents.has(parentId);
                const isSubActive = this.rightTabs.activeSubTypes.has(subId);
                const isExclusion = adapter.isExclusionTab(parentId);
                parentGroups[parentId].addSubTab({
                    id: subId,
                    label: adapter.getActionSubTabLabel(subId),
                    active: !isExclusion && isActive && isSubActive,
                    excluded: isExclusion && isActive && isSubActive
                });
            }
        }

        // Convert to array and sort by system adapter order
        const actionTypes = Object.values(parentGroups);
        actionTypes.sort((a, b) => adapter.getActionTypeSortOrder(a.id) - adapter.getActionTypeSortOrder(b.id));

        // Sort sub-tabs within each parent using system adapter order
        for (const parent of actionTypes) {
            const skipAll = adapter.isExclusionTab(parent.id);

            if (parent.subTabs.length > 0 && !skipAll) {
                const isActive = parent.id === this.rightTabs.focusedParent;
                const validSubIds = toSet(parent.subTabs, t => t.id);
                const activeSubsForParent = Array.from(this.rightTabs.activeSubTypes).filter(id => validSubIds.has(id));

                parent.addSubTab({
                    id: 'all',
                    label: adapter.getActionSubTabLabel('all'),
                    active: isActive && activeSubsForParent.length === 0
                });
                parent.subTabs.sort((a, b) => adapter.getActionSubTabSortOrder(parent.id, a.id) - adapter.getActionSubTabSortOrder(parent.id, b.id));
            }
        }

        // Post-process parentGroups to set active, expanded, and activeParent
        for (const parent of actionTypes) {
            if (adapter.isExclusionTab(parent.id)) continue; // Exclude exclusion tabs from activeParent calculation
            const validSubIds = toSet(parent.subTabs, t => t.id);
            const activeSubsForParent = Array.from(this.rightTabs.activeSubTypes).filter(id => validSubIds.has(id));

            parent.active = this.rightTabs.activeParents.has(parent.id);
            if (parent.subTabs.length > 0 && parent.active && activeSubsForParent.length > 0) {
                parent.activeParent = true;
            }
            parent.expanded = parent.id === this.rightTabs.focusedParent || activeSubsForParent.length > 0;
        }

        // Cache parentGroups on the instance for use in event handlers/action rolling
        this.parentGroups = parentGroups;

        // Prune active sub-tabs that are no longer available in any active parent
        this.rightTabs.prune(parentGroups, id => adapter.isExclusionTab(id));

        // If no active parent type is available, default to 'all'
        if (actionTypes.length && !actionTypes.some(p => this.rightTabs.activeParents.has(p.id))) {
            this.rightTabs.resetToDefault();
            const allTab = actionTypes.find(t => t.id === 'all');
            if (allTab) {
                allTab.active = true;
                allTab.expanded = true;
            }
        }

        // 4. Filter actions based on state
        const visibleActions = rawActions.filter(action => this._matchesFilters(action));
        this.displayedActions = visibleActions;

        context.itemTypes = itemTypes;
        context.actionTypes = actionTypes;
        context.items = visibleActions;
        context.layout = 'flat'; // Default layout template mode
        context.isAttached = this.isAttached;
        context.isPinned = this.isPinned;
        context.isDetached = this.isDetached;
        context.filterNoResources = game.settings.get(MODULE_ID, 'filterNoResources');

        // Synchronize favorites if system supports them and user is owner
        if (this.actor?.isOwner) {
            syncActorFavorites(this.actor);
        }

        // Apply categorization if enabled
        const rawCatConfig = game.settings.get(MODULE_ID, 'categorizationConfig');
        const isCategorizationEnabled = Boolean(rawCatConfig?.enabled);
        if (isCategorizationEnabled) {
            const othersLabel = game.i18n.localize('BAD.categorization.others') ?? 'Other Actions';
            const categorized = categorizeActions(visibleActions, rawCatConfig, othersLabel, {
                actor: this.actor,
                token: this.token,
                user: game.user
            });
            context.isCategorized = true;
            context.categorizedSections = categorized ?? [];
        } else {
            context.isCategorized = false;
            context.categorizedSections = null;
        }

        const parsedActivePage = Number(this.activePage ?? 1);
        const currentActivePage = (!isNaN(parsedActivePage) && parsedActivePage > 0) ? parsedActivePage : 1;
        const pages = [];
        for (let i = 1; i <= this.totalPages; i++) {
            pages.push({
                page: i,
                active: i === currentActivePage
            });
        }
        context.pages = pages;
        context.activePage = currentActivePage;
        context.totalPages = this.totalPages;
        context.hasMultiplePages = this.totalPages > 1;

        // Delegate to system adapter to allow system-specific context modifications and layout selection
        adapter?.modifyContext?.(context, this);

        // Save serialized tab selections for active actor
        this._saveTabState();

        return context;
    }

    // #endregion

    // #region Internal Filtering Logic

    /**
     * Helper method to evaluate if an action card matches current left and right tab filter selections.
     * 
     * @param {Object} action The action card to evaluate
     * @returns {boolean} True if the action card should be rendered
     * @private
     */
    _matchesFilters(action) {
        if (!action) return false;

        // Hidden Filter: If 'hidden' tab is selected, ONLY show actions that have action.isHidden === true
        const isHiddenActive = this.leftTabs.activeParents.has('hidden');
        if (isHiddenActive) {
            return Boolean(action.isHidden);
        } else if (action.isHidden) {
            return false; // Hide hidden actions from all other tabs
        }

        // Filter by Left Side (Item Type)
        const categories = action.itemCategories ?? (action.left?.length ? [action.left] : []);
        if (categories.length === 0) return false;

        const matchesLeft = categories.some(leftSub => {
            return leftSub.some(type => {
                if (this.leftTabs.activeParents.has(type)) {
                    const parentGroup = this.leftGroups?.[type];
                    const validSubIds = toSet(parentGroup?.subTabs, t => t.id);
                    const activeSubsForParent = Array.from(this.leftTabs.activeSubTypes).filter(id => validSubIds.has(id));

                    if (activeSubsForParent.length === 0) {
                        return true;
                    } else {
                        const actionSubId = leftSub[1];
                        return this.leftTabs.activeSubTypes.has(actionSubId);
                    }
                }

                if (this.leftTabs.activeParents.has('all')) {
                    const isParentActive = this.leftTabs.activeParents.has(type);
                    if (!isParentActive) {
                        return true;
                    } else {
                        const parentGroup = this.leftGroups?.[type];
                        const validSubIds = toSet(parentGroup?.subTabs, t => t.id);
                        const activeSubsForParent = Array.from(this.leftTabs.activeSubTypes).filter(id => validSubIds.has(id));
                        if (activeSubsForParent.length === 0) {
                            return true;
                        }
                    }
                }

                return false;
            });
        });

        if (!matchesLeft) return false;

        // Filter by Right Side (Action Type & Economy Tabs)
        if (!action.right) return false;

        const filterContext = this._getFilterContext();
        return adapter.matchesEconomyTabs(action, filterContext);
    }

    /**
     * Build the standard HUD filter context object containing active left/right tab states and settings.
     * @returns {Object} Structured filter context { left, right, filterNoResources }
     * @private
     */
    _getFilterContext() {
        return {
            left: {
                activeParents: this.leftTabs.activeParents,
                activeSubTypes: this.leftTabs.activeSubTypes,
                groups: this.leftGroups
            },
            right: {
                activeParents: this.rightTabs.activeParents,
                activeSubTypes: this.rightTabs.activeSubTypes,
                groups: this.parentGroups
            },
            filterNoResources: game.settings.get(MODULE_ID, 'filterNoResources')
        };
    }

    // #endregion

    // #region User Interaction Events & Helpers

    /* -------------------------------------------- */
    /*  Actions Handlers                            */
    /* -------------------------------------------- */

    /**
     * Handle left-side item type (parent) selection clicks.
     * @param {Event} event Click event
     * @param {HTMLElement} target Clicked element
     */
    async _onChangeLeftItemType(event, target) {
        event.preventDefault();
        this._clearMenuState();
        const clickedId = target.dataset.type;
        const tab = this.leftGroups?.[clickedId];
        tab?.onLeftClick(this, this.leftTabs, this.leftGroups, event);
        this.render();
    }

    async _onChangeLeftSubItemType(event, target) {
        event.preventDefault();
        this._clearMenuState();
        const parentGroup = target.closest('.bad-left-tab-group');
        const parentId = parentGroup?.querySelector('.bad-left-tab')?.dataset.type;
        const subTab = this.leftGroups?.[parentId]?.getSubTab(target.dataset.type);
        subTab?.onLeftClick(this, this.leftTabs, this.leftGroups, event);
        this.render();
    }

    _onToggleLeftParent(parentId) {
        const tab = this.leftGroups?.[parentId];
        tab?.onRightClick(this, this.leftTabs, this.leftGroups);
        this.render();
    }

    _onToggleLeftSub(target, type) {
        const parentGroup = target.closest('.bad-left-tab-group');
        const parentId = parentGroup?.querySelector('.bad-left-tab')?.dataset.type;
        const subTab = this.leftGroups?.[parentId]?.getSubTab(type);
        subTab?.onRightClick(this, this.leftTabs, this.leftGroups);
        this.render();
    }

    async _onChangeActionType(event, target) {
        event.preventDefault();
        this._clearMenuState();
        const clickedId = target.dataset.type;
        const tab = this.parentGroups?.[clickedId];
        tab?.onLeftClick(this, this.rightTabs, this.parentGroups, event);
        this.render();
    }

    async _onChangeSubActionType(event, target) {
        event.preventDefault();
        this._clearMenuState();
        const parentGroup = target.closest('.bad-right-tab-group');
        const parentId = parentGroup?.querySelector('.bad-right-tab')?.dataset.type;
        const subTab = this.parentGroups?.[parentId]?.getSubTab(target.dataset.type);
        subTab?.onLeftClick(this, this.rightTabs, this.parentGroups, event);
        this.render();
    }

    _onToggleRightParent(parentId) {
        const tab = this.parentGroups?.[parentId];
        tab?.onRightClick(this, this.rightTabs, this.parentGroups);
        this.render();
    }

    _onToggleRightSub(target, type) {
        const parentGroup = target.closest('.bad-right-tab-group');
        const parentId = parentGroup?.querySelector('.bad-right-tab')?.dataset.type;
        const subTab = this.parentGroups?.[parentId]?.getSubTab(type);
        subTab?.onRightClick(this, this.rightTabs, this.parentGroups);
        this.render();
    }

    /**
     * Toggle between Attached (dynamic), Pinned (fixed offset), and Detached (floating) modes.
     */
    async _onToggleAnchor(event, target) {
        event.preventDefault();
        const el = this.element;

        if (this.isAttached) {
            // Attached -> Pinned
            this.positionMode = 'pinned';

            if (el && this.token) {
                const tokenTransform = this.token.worldTransform;
                const rect = el.getBoundingClientRect();
                const offset = {
                    x: rect.left - tokenTransform.tx,
                    y: rect.top - tokenTransform.ty
                };
                await game.settings.set(MODULE_ID, 'hudPinnedOffset', offset);
            }
        } else if (this.isPinned) {
            // Pinned -> Detached
            this.positionMode = 'detached';

            if (el) {
                const rect = el.getBoundingClientRect();
                const pos = { left: rect.left, top: rect.top };
                await game.settings.set(MODULE_ID, 'hudDetachedPosition', pos);
            }
        } else {
            // Detached -> Attached
            this.positionMode = 'attached';
        }

        await game.settings.set(MODULE_ID, 'hudPositionMode', this.positionMode);
        log.debug(`Toggled HUD position mode to: ${this.positionMode}`);

        this.render();
    }

    /**
     * Handle close button click on the HUD.
     * @param {Event} event
     * @param {HTMLElement} target
     */
    async _onCloseHUD(event, target) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        log.debug("_onCloseHUD called");
        await this.close();
    }

    async _onPreviousPage(event, target) {
        event.preventDefault();
        this._clearMenuState();
        this.previousPage();
    }

    async _onNextPage(event, target) {
        event.preventDefault();
        this._clearMenuState();
        this.nextPage();
    }

    async _onChangePage(event, target) {
        event.preventDefault();
        this._clearMenuState();
        const targetPage = Number(target.dataset.page ?? 1);
        if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= this.totalPages && targetPage !== this.activePage) {
            this.activePage = targetPage;
            this._saveTabState();
            this.render();
        }
    }

    /**
     * Handle action item clicks to roll them.
     * @param {Event} event Click event
     * @param {HTMLElement} target Clicked element
     */
    async _onRollAction(event, target) {
        event.preventDefault();

        if (this._preventReopen) {
            log.debug("_onRollAction | preventReopen is true, toggling off and closing menu");
            this._preventReopen = false;
            this._clearMenuState();
            return;
        }

        // Close any existing open menu state before rolling or opening dropdown
        this._clearMenuState();

        const actionId = target.dataset.actionId;
        const action = (this.displayedActions ?? this.actions)?.find(a => a.id === actionId);

        if (action) {
            const item = action.originalItem ?? action;
            const actor = this.actor;
            const token = this.token;
            const user = game.user;
            log.info(`_onRollAction | Left-clicked action "${action.name}" (${action.id}):`, { action, item, actor, token, user });
            const itemActivities = action.subactions;
            log.debug(`_onRollAction | Action subactions (${itemActivities?.length ?? 0}):`, itemActivities);

            if (itemActivities && itemActivities.length > 0) {
                // Filter sub-actions to only those that match the currently active right-side tabs
                const filterContext = this._getFilterContext();
                const qualifyingSubActions = adapter.system.filterSubactions(itemActivities, filterContext, action.left);

                const subsToShow = qualifyingSubActions.length > 0 ? qualifyingSubActions : itemActivities;
                const showDropdown = subsToShow.length > 1 || (!action.collapseDropdownIfSingle && itemActivities.length > 1 && subsToShow.length === 1);

                if (showDropdown) {
                    this._showActivityDropdown(target, subsToShow, event);
                } else if (subsToShow.length === 1) {
                    const chosenSub = subsToShow[0];
                    const chosenItem = chosenSub.originalItem ?? action.originalItem ?? chosenSub;
                    log.info(`_onRollAction | Rolling subaction "${chosenSub.name}":`, { action: chosenSub, item: chosenItem, actor, token, user });
                    chosenSub.roll(event);
                } else {
                    log.info(`_onRollAction | Rolling action "${action.name}":`, { action, item, actor, token, user });
                    action.roll(event);
                }
            } else {
                log.debug(`_onRollAction | "${action.name}" (${action.id}) has no subactions (length 0)`);
                // No sub-actions: roll directly
                log.info(`_onRollAction | Rolling action "${action.name}":`, { action, item, actor, token, user });
                action.roll(event);
            }
        }
    }

    /**
     * Show the activity dropdown menu for an action with multiple subactions.
     * @param {HTMLElement} target The target action DOM element
     * @param {Action[]} subactions List of subactions to display
     * @param {Event} event The triggering click event
     * @private
     */
    _showActivityDropdown(target, subactions, event) {
        showActivityDropdown(this, target, subactions, event);
    }

    /**
     * Toggle the "Filter Out of Resources" setting.
     */
    async _onToggleFilterResources(event, target) {
        const checked = target.checked;
        await game.settings.set(MODULE_ID, 'filterNoResources', checked);
        log.debug(`Toggled filterNoResources to: ${checked}`);
        this.render();
    }



    /* -------------------------------------------- */
    /*  Positioning & Dragging                      */
    /* -------------------------------------------- */

    /**
     * Hook into the first render to set up permanent event listeners and context menus.
     */
    _onFirstRender(context, options) {
        super._onFirstRender(context, options);
        log.debug(`_onFirstRender | token: ${this.token?.name}`);

        // Prevent clicks inside the HUD from bubbling up to the canvas/document
        this.element.addEventListener('click', (event) => event.stopPropagation());

        // Intercept right-click pointerdown and contextmenu events in the capture phase to support toggling the menu off
        this.element.addEventListener('pointerdown', this._boundOnPointerDownCapture, { capture: true });
        this.element.addEventListener('contextmenu', this._boundOnContextMenuCapture, { capture: true });

        // Event Delegation for Dragging: attach mousedown to the outer element and filter by the handle
        this.element.addEventListener('mousedown', (event) => {
            const handle = event.target.closest('.bad-drag-handle');
            if (handle) this._onDragStart(event);
        });

        // Close dropdown when dragging or clicking outside the active menu/item
        this._boundOutsidePointerDown = (event) => {
            if ((this._activeLeftClickMenu || this._activeContextMenuTarget) && !event.target.closest('#context-menu, .context-menu, .bad-action-item')) {
                this._clearMenuState();
            }
        };
        window.addEventListener('pointerdown', this._boundOutsidePointerDown, { capture: true });

        // Initialize the context menu for action items once
        this._contextMenu = this._createContextMenu();
    }

    /**
     * Hook into the render lifecycle to position the element and measure its dimensions.
     */
    _onRender(context, options) {
        super._onRender(context, options);
        log.debug(`_onRender | token: ${this.token?.name}, state: ${this.state}, isAttached: ${this.isAttached}`);

        // Adjust min-height first so container dimensions reflect the full expanded layout
        this._adjustMinHeight();

        const container = this.element?.querySelector('.bakana-action-display-container');
        this._width = container?.offsetWidth ?? this.element.offsetWidth;
        this._height = container?.offsetHeight ?? this.element.offsetHeight;

        this.setPosition();
    }

    _clearMenuState() {
        log.debug("_clearMenuState | Clearing menu state and closing open menus");

        // Close any open context menus if we have an active target
        if (this._activeContextMenuTarget || this._activeMenuTarget) {
            if (this._contextMenu) {
                try {
                    this._contextMenu.close()?.catch?.(err => {
                        log.debug("ContextMenu.close promise rejected (expected during re-render):", err);
                    });
                } catch (err) {
                    log.debug("ContextMenu.close threw synchronously:", err);
                }
            }
        }

        if (this._activeContextMenuTarget) {
            this._activeContextMenuTarget.classList.remove('bad-menu-active');
            this._activeContextMenuTarget = null;
        }

        if (this._activeMenuTarget) {
            this._activeMenuTarget.classList.remove('bad-dropdown-active');
            this._activeMenuTarget = null;
        }

        this._activeLeftClickMenu?.close();
        this._activeLeftClickMenu = null;
        this._preventReopen = false;
    }

    /**
     * Adjust the min-height of the main container to ensure it is at least
     * as tall as the tallest tab column, keeping them visually connected.
     */
    _adjustMinHeight() {
        const container = this.element.querySelector('.bakana-action-display-container');
        const leftTabs = this.element.querySelector('.bad-left-tabs');
        const rightTabs = this.element.querySelector('.bad-right-tabs');

        if (!container) return;

        // Reset min-height to measure natural layout first
        container.style.minHeight = '';

        // Measure the bottom reach of the tabs relative to the container (only if they have children)
        const leftBottom = (leftTabs && leftTabs.children.length > 0) ? (leftTabs.offsetTop + leftTabs.offsetHeight) : 0;
        const rightBottom = (rightTabs && rightTabs.children.length > 0) ? (rightTabs.offsetTop + rightTabs.offsetHeight) : 0;
        const maxTabBottom = Math.max(leftBottom, rightBottom);

        log.debug(`_adjustMinHeight | leftBottom: ${leftBottom}px, rightBottom: ${rightBottom}px, maxTabBottom: ${maxTabBottom}px`);

        if (maxTabBottom > 0) {
            // Lazy-load and cache the container's bottom padding to prevent expensive getComputedStyle calls
            if (this._containerPaddingBottom === undefined) {
                const containerStyle = window.getComputedStyle(container);
                const parsedPadding = parseFloat(containerStyle.paddingBottom);
                this._containerPaddingBottom = !isNaN(parsedPadding) ? parsedPadding : 0;
            }

            const targetMinHeight = maxTabBottom + this._containerPaddingBottom;
            log.debug(`_adjustMinHeight | Applying min-height: ${targetMinHeight}px to container (paddingBottom: ${this._containerPaddingBottom}px)`);
            container.style.minHeight = `${targetMinHeight}px`;
        }
    }

    /**
     * Intercept pointerdown events in the capture phase to detect clicks (left or right)
     * on the active menu target, preparing to prevent it from reopening.
     * @param {PointerEvent} event The triggering pointerdown event
     * @private
     */
    _onPointerDownCapture(event) {
        if (event.button !== 2 && event.button !== 0) return; // Only care about right-clicks (2) or left-clicks (0)

        const targetItem = event.target.closest('.bad-action-item, .bad-left-sub-tab, .bad-left-tab');
        const activeTarget = event.button === 2 ? this._activeContextMenuTarget : this._activeMenuTarget;
        const activeItem = activeTarget?.closest('.bad-action-item, .bad-left-sub-tab, .bad-left-tab') ?? activeTarget;

        log.debug(`_onPointerDownCapture | button: ${event.button}, targetItem:`, targetItem, `activeItem:`, activeItem);

        if (targetItem && activeItem === targetItem) {
            log.debug("Pointerdown click on active target, preparing to prevent reopen");
            this._preventReopen = true;
        }
    }

    /**
     * Intercept contextmenu events in the capture phase to toggle the menu off
     * if the same item is right-clicked again.
     * @param {Event} event The triggering contextmenu event
     * @private
     */
    _onContextMenuCapture(event) {
        if (event.target.closest('#context-menu, .context-menu, .context-item')) return;
        log.debug(`_onContextMenuCapture | preventReopen: ${this._preventReopen}`);
        if (this._preventReopen) {
            log.debug("Preventing context menu from reopening (toggled off)");
            this._preventReopen = false;

            // Safe close in capture phase (catch promise rejections)
            this._contextMenu?.close()?.catch?.(err => { });

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            return;
        }

        // Intercept right-clicks on left parent tabs
        const leftParentTarget = event.target.closest(".bad-left-tab");
        if (leftParentTarget) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            this._onToggleLeftParent(leftParentTarget.dataset.type);
            return;
        }

        // Intercept right-clicks on right parent tabs
        const rightParentTarget = event.target.closest(".bad-right-tab");
        if (rightParentTarget) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            this._onToggleRightParent(rightParentTarget.dataset.type);
            return;
        }

        // Intercept right-clicks on left sub-tabs
        const leftSubTarget = event.target.closest(".bad-left-sub-tab");
        if (leftSubTarget) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            // Delegate to system adapter for custom right-click behavior (e.g. toggling unprepared spells in dnd5e)
            const handled = adapter.onTabRightClick(this, leftSubTarget, event);
            if (!handled) {
                if (leftSubTarget.dataset.type !== 'all') {
                    // Default fallback: multi-select toggle for other sub-tabs
                    this._onToggleLeftSub(leftSubTarget, leftSubTarget.dataset.type);
                }
            }
            return;
        }

        // Intercept right-clicks on right sub-tabs
        const rightSubTarget = event.target.closest(".bad-right-sub-tab");
        if (rightSubTarget && rightSubTarget.dataset.type !== 'all') {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            this._onToggleRightSub(rightSubTarget, rightSubTarget.dataset.type);
            return;
        }



        const targetItem = event.target.closest('.bad-action-item, .bad-left-sub-tab, .bad-left-tab');
        const activeTarget = this._activeContextMenuTarget;
        const activeItem = activeTarget?.closest('.bad-action-item, .bad-left-sub-tab, .bad-left-tab') ?? activeTarget;

        log.debug(`_onContextMenuCapture | targetItem:`, targetItem, `activeItem:`, activeItem);

        if (targetItem && activeItem === targetItem) {
            log.debug("Right-clicked the same item, toggling context menu off (fallback)");

            this._clearMenuState();

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
        }
    }



    /**
     * Create and bind the Foundry ContextMenu for action items.
     * @returns {ContextMenu} The created ContextMenu instance
     * @private
     */
    _createContextMenu() {
        return createActionContextMenu(this, this.element);
    }

    /**
     * Toggle the hidden state of an action.
     * @param {string} actionId The ID of the action to toggle
     * @param {boolean} shouldHide Whether the action should be hidden
     */
    async _toggleActionHidden(actionId, shouldHide) {
        if (!actionId || !this.actor) return;

        const action = this.actions?.find(a => a.id === actionId);
        if (!action) return;

        const itemId = action.originalItem?.id ?? action.id;
        // NOTE(migration): hiddenItems transitioned from legacy string[] to Record<string, boolean> object map.
        // Array normalization can be removed in a future cleanup once legacy world actor flags have migrated.
        const rawHidden = this.actor.getFlag(MODULE_ID, 'hiddenItems');
        const currentHidden = Array.isArray(rawHidden)
            ? rawHidden.reduce((acc, id) => { acc[id] = true; return acc; }, {})
            : { ...(rawHidden ?? {}) };

        if (shouldHide) {
            currentHidden[itemId] = true;
            log.debug(`Hiding item: ${action.name} (ID: ${itemId})`);
            if (typeof this.actor.setFlag === 'function') {
                await this.actor.setFlag(MODULE_ID, 'hiddenItems', currentHidden);
            }
        } else {
            delete currentHidden[itemId];
            log.debug(`Unhiding item: ${action.name} (ID: ${itemId})`);
            if (typeof this.actor.update === 'function') {
                await this.actor.update({
                    [`flags.${MODULE_ID}.hiddenItems.-=${itemId}`]: null
                });
            } else if (typeof this.actor.setFlag === 'function') {
                await this.actor.setFlag(MODULE_ID, 'hiddenItems', currentHidden);
            }
        }

        this.render();
    }



    _onDragStart(event) {
        event.preventDefault();
        this._clearMenuState();
        const el = this.element;
        if (!el) return;

        // Record starting mouse and window coordinates
        this._dragData = {
            startX: event.clientX,
            startY: event.clientY,
            startLeft: el.offsetLeft,
            startTop: el.offsetTop
        };

        document.addEventListener('mousemove', this._onDragMove);
        document.addEventListener('mouseup', this._onDragEnd);

        log.debug("Drag started");
    }

    _onDragMove(event) {
        event.preventDefault();
        const el = this.element;
        if (!el || !this._dragData) return;

        // Calculate delta
        const dx = event.clientX - this._dragData.startX;
        const dy = event.clientY - this._dragData.startY;

        // Calculate new coordinates
        let left = this._dragData.startLeft + dx;
        let top = this._dragData.startTop + dy;

        // Clamp to screen bounds
        const width = el.offsetWidth;
        const height = el.offsetHeight;
        left = Math.clamp(left, 10, window.innerWidth - width - 10);
        top = Math.clamp(top, 10, window.innerHeight - height - 10);

        // Apply styles directly for ultra-smooth 60fps dragging
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
        el.style.bottom = '';
        el.style.right = '';

        // Dragging while in Attached mode automatically switches to Pinned mode
        if (this.isAttached) {
            this.positionMode = 'pinned';
        }
    }

    async _onDragEnd(event) {
        event.preventDefault();
        document.removeEventListener('mousemove', this._onDragMove);
        document.removeEventListener('mouseup', this._onDragEnd);

        const el = this.element;
        if (el && this._dragData) {
            const rect = el.getBoundingClientRect();

            if (this.positionMode === 'pinned' && this.token) {
                const tokenTransform = this.token.worldTransform;
                const offset = {
                    x: rect.left - tokenTransform.tx,
                    y: rect.top - tokenTransform.ty
                };
                await game.settings.set(MODULE_ID, 'hudPinnedOffset', offset);
                await game.settings.set(MODULE_ID, 'hudPositionMode', 'pinned');
                log.debug("Drag ended in Pinned mode, saved offset:", offset);
            } else {
                const pos = { left: rect.left, top: rect.top };
                await game.settings.set(MODULE_ID, 'hudDetachedPosition', pos);
                await game.settings.set(MODULE_ID, 'hudPositionMode', 'detached');
                log.debug("Drag ended in Detached mode, saved position:", pos);
            }
        }

        this._dragData = null;

        // Re-render to update the control bar icon and tooltip
        this.render();
    }

    /**
     * Position the application window.
     * In Attached mode, anchors dynamically around token in preference order.
     * In Pinned mode, pins top-left of HUD to token top-left with fixed offset (clamped to page).
     * In Detached mode, places it at the user's last dragged screen coordinates.
     */
    setPosition(position = {}) {
        if (this._activeLeftClickMenu || this._activeContextMenuTarget) {
            this._clearMenuState();
        }
        const el = this.element;
        if (!el) return super.setPosition(position);

        const scale = game.settings.get(MODULE_ID, 'hudScale') ?? 1.0;
        const appWidth = this._width ?? el.offsetWidth;
        const appHeight = this._height ?? el.offsetHeight;
        const tabExtension = 150 * scale;

        if (this.positionMode === 'attached' && this.token) {
            // --- ATTACHED MODE (Dynamic Token Placement) ---
            const tokenTransform = this.token.worldTransform;
            const canvasScale = game.canvas.stage?.scale?.x ?? 1;
            const gridSize = game.canvas.grid?.size ?? 100;
            const anchorSide = game.settings.get(MODULE_ID, 'hudAnchorSide') ?? 'vertical';

            const tokenWidth = this.token.w * canvasScale;
            const tokenHeight = this.token.h * canvasScale;

            const tokenLeft = tokenTransform.tx;
            const tokenTop = tokenTransform.ty;

            const isHorizontal = anchorSide === 'horizontal';
            const gridOffset = game.settings.get(MODULE_ID, isHorizontal ? 'hudGridOffsetHorizontal' : 'hudGridOffset') ?? 0.5;
            const pixelOffset = gridOffset * gridSize * canvasScale;

            const extraMargin = isHorizontal ? appWidth + tabExtension : appHeight;
            const room1 = (isHorizontal ? tokenLeft : tokenTop) - pixelOffset - extraMargin;
            const room2 = (isHorizontal ? window.innerWidth - (tokenLeft + tokenWidth) : window.innerHeight - (tokenTop + tokenHeight)) - pixelOffset - extraMargin;

            const side1 = isHorizontal ? 'left' : 'above';
            const side2 = isHorizontal ? 'right' : 'below';
            const label1 = isHorizontal ? 'left' : 'top';
            const label2 = isHorizontal ? 'right' : 'bottom';
            const positionSide = this._chooseAttachedSide(room1, room2, side1, side2, gridOffset, label1, label2);

            let top, left;
            const targetPosition = { width: 'auto', height: 'auto' };

            if (isHorizontal) {
                top = Math.clamp(tokenTop + (tokenHeight / 2) - (appHeight / 2), 10, window.innerHeight - appHeight - 10);
                targetPosition.top = top;
            } else {
                const minLeft = Math.max(10, tabExtension);
                const maxLeft = Math.min(window.innerWidth - appWidth - 10, window.innerWidth - appWidth - tabExtension);
                left = Math.clamp(tokenLeft + (tokenWidth / 2) - (appWidth / 2), minLeft, maxLeft);
                targetPosition.left = left;
            }

            const result = super.setPosition(foundry.utils.mergeObject(position, targetPosition));
            el.style.height = 'auto';

            if (isHorizontal) {
                el.style.top = `${top}px`;
                el.style.bottom = '';
                if (positionSide === 'left') {
                    el.style.right = `${window.innerWidth - tokenLeft + pixelOffset}px`;
                    el.style.left = '';
                } else {
                    el.style.left = `${tokenLeft + tokenWidth + pixelOffset}px`;
                    el.style.right = '';
                }
            } else {
                el.style.left = `${left}px`;
                el.style.right = '';
                if (positionSide === 'above') {
                    el.style.bottom = `${window.innerHeight - tokenTop + pixelOffset}px`;
                    el.style.top = '';
                } else {
                    el.style.top = `${tokenTop + tokenHeight + pixelOffset}px`;
                    el.style.bottom = '';
                }
            }

            return result;

        } else if (this.positionMode === 'pinned' && this.token) {
            // --- PINNED MODE (Fixed Offset to Token Top-Left, Clamped to Page) ---
            const tokenTransform = this.token.worldTransform;
            const tokenLeft = tokenTransform.tx;
            const tokenTop = tokenTransform.ty;

            const pinnedOffset = game.settings.get(MODULE_ID, 'hudPinnedOffset') ?? { x: 0, y: -50 };

            // Top-left corner of HUD is pinned relative to token top-left
            let left = tokenLeft + pinnedOffset.x;
            let top = tokenTop + pinnedOffset.y;

            // Clamp to screen bounds so it is ALWAYS fully on the page
            const minLeft = Math.max(10, tabExtension);
            const maxLeft = Math.min(window.innerWidth - appWidth - 10, window.innerWidth - appWidth - tabExtension);

            left = Math.clamp(left, minLeft, maxLeft);
            top = Math.clamp(top, 10, window.innerHeight - appHeight - 10);

            const targetPosition = foundry.utils.mergeObject(position, {
                left,
                top,
                width: 'auto',
                height: 'auto'
            });

            const result = super.setPosition(targetPosition);
            el.style.height = 'auto';
            el.style.left = `${left}px`;
            el.style.top = `${top}px`;
            el.style.bottom = '';
            el.style.right = '';

            return result;

        } else {
            // --- DETACHED MODE (Floating / Fixed Screen Position) ---
            const savedPos = game.settings.get(MODULE_ID, 'hudDetachedPosition');

            // Clamp to screen bounds to ensure it's always visible (handles resolution changes)
            const left = Math.clamp(savedPos?.left ?? 100, 10, window.innerWidth - appWidth - 10);
            const top = Math.clamp(savedPos?.top ?? 100, 10, window.innerHeight - appHeight - 10);

            const targetPosition = foundry.utils.mergeObject(position, {
                left,
                top,
                width: 'auto',
                height: 'auto'
            });

            el.style.bottom = '';
            el.style.right = '';

            return super.setPosition(targetPosition);
        }
    }

    /**
     * Choose the best side to anchor the HUD based on available space.
     * @private
     */
    _chooseAttachedSide(room1, room2, side1, side2, gridOffset, label1 = side1, label2 = side2) {
        if (room1 >= 0 && room2 >= 0) return room1 >= room2 ? side1 : side2;
        if (room1 >= 0) return side1;
        if (room2 >= 0) return side2;
        log.error(`HUD position with grid offset ${gridOffset} exceeds screen bounds on both ${label1} and ${label2}.`);
        return side2;
    }

    // #endregion
}
