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

        // Search filtering state
        this.searchQuery = '';
        this._isSearching = false;
        this._searchSelectionStart = null;
        this._searchSelectionEnd = null;

        // Bind listeners once for event delegation and capture phases to prevent GC churn
        this._boundOnPointerDownCapture = this._onPointerDownCapture.bind(this);
        this._boundOnContextMenuCapture = this._onContextMenuCapture.bind(this);
        this._onDragStart = this._onDragStart.bind(this);
        this._onDragMove = this._onDragMove.bind(this);
        this._onDragEnd = this._onDragEnd.bind(this);
    }

    /**
     * Retrieve or initialize a HUDTabColumn instance for a given side and page number.
     * @param {'left'|'right'} side Left or right side identifier
     * @param {number} [page=this.activePage] Page number
     * @returns {HUDTabColumn}
     */
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
                    return side === 'left'
                        ? adapter.getDefaultActiveLeftSubTypes()
                        : adapter.getDefaultActiveSubTypes();
                }
            });
        }
        return this._tabColumns[key];
    }

    /**
     * Active left-side HUDTabColumn for the current active page.
     * @type {HUDTabColumn}
     */
    get leftTabs() {
        return this.getTabColumn('left', this.activePage);
    }

    /**
     * Active right-side HUDTabColumn for the current active page.
     * @type {HUDTabColumn}
     */
    get rightTabs() {
        return this.getTabColumn('right', this.activePage);
    }

    /**
     * Navigate to the previous HUD page and re-render.
     */
    previousPage() {
        const parsed = Number(this.activePage);
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

    /**
     * Navigate to the next HUD page and re-render.
     */
    nextPage() {
        const parsed = Number(this.activePage);
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
            recenterToken: ActionDisplayApp.prototype._onRecenterToken,
            clearSearch: ActionDisplayApp.prototype._onClearSearch,
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

        // 4. Filter actions based on state & search query
        const query = (this.searchQuery ?? '').trim().toLowerCase();
        const visibleActions = rawActions.filter(action => {
            if (!this._matchesFilters(action)) return false;
            if (!query) return true;
            return this._matchesSearchQuery(action, query);
        });
        this.displayedActions = visibleActions;

        context.itemTypes = itemTypes;
        context.actionTypes = actionTypes;
        context.items = visibleActions;
        context.layout = 'flat'; // Default layout template mode
        context.isAttached = this.isAttached;
        context.isPinned = this.isPinned;
        context.isDetached = this.isDetached;
        context.filterNoResources = game.settings.get(MODULE_ID, 'filterNoResources');
        context.searchQuery = this.searchQuery ?? '';

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

        const parsedActivePage = Number(this.activePage);
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
     * Helper method to evaluate if an action matches the active text search query.
     * @param {Object} action The action to evaluate
     * @param {string} query Lowercase search query string
     * @returns {boolean} True if matching
     * @private
     */
    _matchesSearchQuery(action, query) {
        if (!action || !query) return true;
        if (action.name?.toLowerCase().includes(query)) return true;
        if (action.originalItem?.name?.toLowerCase().includes(query)) return true;
        if (action.subactions?.some(sub => sub.name?.toLowerCase().includes(query))) return true;
        return false;
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

    /**
     * Handle left-side item sub-type selection clicks.
     * @param {Event} event Click event
     * @param {HTMLElement} target Clicked element
     */
    async _onChangeLeftSubItemType(event, target) {
        event.preventDefault();
        this._clearMenuState();
        const parentGroup = target.closest('.bad-left-tab-group');
        const parentId = parentGroup?.querySelector('.bad-left-tab')?.dataset.type;
        const subTab = this.leftGroups?.[parentId]?.getSubTab(target.dataset.type);
        subTab?.onLeftClick(this, this.leftTabs, this.leftGroups, event);
        this.render();
    }

    /**
     * Handle right-click toggling of a left-side parent tab.
     * @param {string} parentId The parent tab ID
     */
    _onToggleLeftParent(parentId) {
        const tab = this.leftGroups?.[parentId];
        tab?.onRightClick(this, this.leftTabs, this.leftGroups);
        this.render();
    }

    /**
     * Handle right-click toggling of a left-side sub-tab.
     * @param {HTMLElement} target Clicked DOM element
     * @param {string} type Sub-tab identifier
     */
    _onToggleLeftSub(target, type) {
        const parentGroup = target.closest('.bad-left-tab-group');
        const parentId = parentGroup?.querySelector('.bad-left-tab')?.dataset.type;
        const subTab = this.leftGroups?.[parentId]?.getSubTab(type);
        subTab?.onRightClick(this, this.leftTabs, this.leftGroups);
        this.render();
    }

    /**
     * Handle right-side action type (parent tab) selection clicks.
     * @param {Event} event Click event
     * @param {HTMLElement} target Clicked element
     */
    async _onChangeActionType(event, target) {
        event.preventDefault();
        this._clearMenuState();
        const clickedId = target.dataset.type;
        const tab = this.parentGroups?.[clickedId];
        tab?.onLeftClick(this, this.rightTabs, this.parentGroups, event);
        this.render();
    }

    /**
     * Handle right-side action sub-tab selection clicks.
     * @param {Event} event Click event
     * @param {HTMLElement} target Clicked element
     */
    async _onChangeSubActionType(event, target) {
        event.preventDefault();
        this._clearMenuState();
        const parentGroup = target.closest('.bad-right-tab-group');
        const parentId = parentGroup?.querySelector('.bad-right-tab')?.dataset.type;
        const subTab = this.parentGroups?.[parentId]?.getSubTab(target.dataset.type);
        subTab?.onLeftClick(this, this.rightTabs, this.parentGroups, event);
        this.render();
    }

    /**
     * Handle right-click toggling of a right-side parent tab.
     * @param {string} parentId The parent tab ID
     */
    _onToggleRightParent(parentId) {
        const tab = this.parentGroups?.[parentId];
        tab?.onRightClick(this, this.rightTabs, this.parentGroups);
        this.render();
    }

    /**
     * Handle right-click toggling of a right-side sub-tab.
     * @param {HTMLElement} target Clicked DOM element
     * @param {string} type Sub-tab identifier
     */
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
        await this.close();
    }

    /**
     * Handle previous page button click.
     * @param {Event} event Click event
     * @param {HTMLElement} target Clicked element
     */
    async _onPreviousPage(event, target) {
        event.preventDefault();
        this._clearMenuState();
        this.previousPage();
    }

    /**
     * Handle next page button click.
     * @param {Event} event Click event
     * @param {HTMLElement} target Clicked element
     */
    async _onNextPage(event, target) {
        event.preventDefault();
        this._clearMenuState();
        this.nextPage();
    }

    /**
     * Handle specific page number selection click.
     * @param {Event} event Click event
     * @param {HTMLElement} target Clicked element
     */
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
                    const chosenItem = chosenSub.originalItem ?? action.originalItem;
                    log.info(`_onRollAction | Rolling subaction "${chosenSub.name}":`, { action: chosenSub, item: chosenItem, actor, token, user });
                    chosenSub.roll(event);
                } else {
                    log.info(`_onRollAction | Rolling action "${action.name}":`, { action, item, actor, token, user });
                    action.roll(event);
                }
            } else {
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
        const current = game.settings.get(MODULE_ID, 'filterNoResources');
        const next = typeof target?.checked === 'boolean' ? target.checked : !current;
        await game.settings.set(MODULE_ID, 'filterNoResources', next);
        this.render();
    }

    /**
     * Recenter the canvas view on the active HUD token.
     */
    async _onRecenterToken(event, target) {
        if (!this.token) return;
        const center = this.token.center ?? {
            x: (this.token.x ?? 0) + ((this.token.w ?? 0) / 2),
            y: (this.token.y ?? 0) + ((this.token.h ?? 0) / 2)
        };
        if (typeof canvas?.animatePan === 'function') {
            await canvas.animatePan({ x: center.x, y: center.y });
        } else if (typeof canvas?.pan === 'function') {
            canvas.pan({ x: center.x, y: center.y });
        }
    }

    /**
     * Clear the search filter query and re-render.
     */
    _onClearSearch(event, target) {
        this.searchQuery = '';
        this._isSearching = false;
        this.render();
    }

    /**
     * Attach input listeners to the search input field for real-time filtering.
     * @private
     */
    _attachSearchListeners() {
        const searchInput = this.element?.querySelector('.bad-search-input');
        if (!searchInput) return;

        searchInput.addEventListener('input', (event) => {
            const query = event.target.value ?? '';
            this.searchQuery = query;
            this._searchSelectionStart = event.target.selectionStart;
            this._searchSelectionEnd = event.target.selectionEnd;
            this._isSearching = true;
            this.render();
        });

        searchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                this.searchQuery = '';
                this._isSearching = false;
                this.render();
            }
        });
    }

    /**
     * Restore input focus and cursor selection range to the search input after re-render.
     * @private
     */
    _restoreSearchFocus() {
        if (!this._isSearching || !this.element) return;
        const searchInput = this.element.querySelector('.bad-search-input');
        if (searchInput) {
            searchInput.focus();
            if (typeof this._searchSelectionStart === 'number' && typeof this._searchSelectionEnd === 'number') {
                searchInput.setSelectionRange(this._searchSelectionStart, this._searchSelectionEnd);
            }
        }
        this._isSearching = false;
    }



    /* -------------------------------------------- */
    /*  Positioning & Dragging                      */
    /* -------------------------------------------- */

    /**
     * Hook into the first render to set up permanent event listeners and context menus.
     */
    _onFirstRender(context, options) {
        super._onFirstRender(context, options);

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

        this._attachSearchListeners();
        this._restoreSearchFocus();

        // Adjust min-height first so container dimensions reflect the full expanded layout
        this._adjustMinHeight();

        const container = this.element?.querySelector('.bakana-action-display-container');
        this._width = container?.offsetWidth ?? this.element.offsetWidth;
        this._height = container?.offsetHeight ?? this.element.offsetHeight;

        this.setPosition();
    }

    /**
     * Clear all active context menu and dropdown target styling and close any open menus.
     */
    _clearMenuState() {
        // Close any open context menus if we have an active target
        if (this._activeContextMenuTarget || this._activeMenuTarget) {
            if (this._contextMenu) {
                try {
                    this._contextMenu.close()?.catch?.(err => {
                        log.error("ContextMenu.close promise rejected (expected during re-render):", err);
                    });
                } catch (err) {
                    log.error("ContextMenu.close threw synchronously:", err);
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

        if (maxTabBottom > 0) {
            // Lazy-load and cache the container's bottom padding to prevent expensive getComputedStyle calls
            if (this._containerPaddingBottom === undefined) {
                const containerStyle = window.getComputedStyle(container);
                const parsedPadding = parseFloat(containerStyle.paddingBottom);
                this._containerPaddingBottom = !isNaN(parsedPadding) ? parsedPadding : 0;
            }

            const targetMinHeight = maxTabBottom + this._containerPaddingBottom;
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

        if (targetItem && activeItem === targetItem) {
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
        if (this._preventReopen) {
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

            // Delegate to system adapter for custom right-click behavior (e.g. toggling showAll/unprepared/unequipped in dnd5e)
            const handled = adapter.onTabRightClick(this, leftParentTarget, event);
            if (!handled) {
                this._onToggleLeftParent(leftParentTarget.dataset.type);
            }
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

        if (targetItem && activeItem === targetItem) {
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
            if (typeof this.actor.setFlag === 'function') {
                await this.actor.setFlag(MODULE_ID, 'hiddenItems', currentHidden);
            }
        } else {
            delete currentHidden[itemId];
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



    /**
     * Initialize drag state on mousedown on the drag handle.
     * @param {MouseEvent} event
     */
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
    }

    /**
     * Update HUD window position during active mouse drag.
     * @param {MouseEvent} event
     */
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

    /**
     * Finalize window position and persist settings on mouseup after dragging.
     * @param {MouseEvent} event
     */
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
            } else {
                const pos = { left: rect.left, top: rect.top };
                await game.settings.set(MODULE_ID, 'hudDetachedPosition', pos);
                await game.settings.set(MODULE_ID, 'hudPositionMode', 'detached');
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
