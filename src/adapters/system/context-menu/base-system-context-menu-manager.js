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
     * Set a module flag on an actor optimistically in memory and persist it asynchronously.
     * @param {Actor} actor Target actor document
     * @param {string} scope Module scope identifier
     * @param {string} key Flag key
     * @param {*} value Flag value
     * @returns {Promise<Actor>|undefined} Persistence promise
     */
    setActorFlagOptimistic(actor, scope, key, value) {
        if (!actor) return;
        if (!actor.flags) actor.flags = {};
        if (!actor.flags[scope]) actor.flags[scope] = {};
        actor.flags[scope][key] = value;
        if (actor._source?.flags) {
            if (!actor._source.flags[scope]) actor._source.flags[scope] = {};
            actor._source.flags[scope][key] = value;
        }
        return actor.setFlag?.(scope, key, value, { badInternal: true });
    }

    /**
     * Set multiple module flags on an actor optimistically in memory and persist them asynchronously.
     * @param {Actor} actor Target actor document
     * @param {string} scope Module scope identifier
     * @param {Object.<string, *>} flags Map of flag keys to values
     * @returns {Promise<Actor|Actor[]>|undefined} Persistence promise
     */
    updateActorFlagsOptimistic(actor, scope, flags) {
        if (!actor) return;
        if (!actor.flags) actor.flags = {};
        if (!actor.flags[scope]) actor.flags[scope] = {};
        for (const [key, value] of Object.entries(flags)) {
            actor.flags[scope][key] = value;
        }
        if (actor._source?.flags) {
            if (!actor._source.flags[scope]) actor._source.flags[scope] = {};
            for (const [key, value] of Object.entries(flags)) {
                actor._source.flags[scope][key] = value;
            }
        }
        if (actor.update) {
            const updates = {};
            for (const [key, value] of Object.entries(flags)) {
                updates[`flags.${scope}.${key}`] = value;
            }
            return actor.update(updates, { badInternal: true });
        }
        const promises = [];
        for (const [key, value] of Object.entries(flags)) {
            promises.push(actor.setFlag?.(scope, key, value, { badInternal: true }));
        }
        return Promise.all(promises);
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
        return action?.originalItem ?? null;
    }
}
