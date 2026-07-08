/**
 * Base context menu manager for system adapters.
 * Manages system-specific action card context menu items and tab right-click shortcuts.
 */
export class BaseSystemContextMenuManager {
    constructor(adapter) {
        this.adapter = adapter;
    }

    /**
     * Get system-specific context menu items for action cards.
     * @param {ApplicationV2} app The ActionDisplayApp instance
     * @returns {Object[]} Array of context menu item specifications
     */
    getContextMenuItems(app) {
        return [];
    }

    /**
     * Handle right-click events on tab elements.
     * @param {ApplicationV2} app The ActionDisplayApp instance
     * @param {HTMLElement} el The tab element right-clicked
     * @param {Event} event The trigger event
     * @returns {boolean} True if handled by the system context manager
     */
    onTabRightClick(app, el, event) {
        return false;
    }

    /**
     * Utility to resolve the original item document from a context menu element dataset.
     * @param {ApplicationV2} app The ActionDisplayApp instance
     * @param {HTMLElement} el The clicked context menu target element
     * @returns {Object|null} The resolved Item document
     */
    getContextItem(app, el) {
        const actionId = el?.dataset?.actionId;
        if (!actionId) return null;
        const action = app.actions?.find(a => a.id === actionId);
        return action?.originalItem ?? action ?? null;
    }
}
