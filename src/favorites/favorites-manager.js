import { MODULE_ID } from '../constants.js';
import { log } from '../lib/logger.js';
import { actionDisplay } from '../action-display.js';

/**
 * Get the favorites map from an actor document.
 *
 * @param {Object} actor Actor document
 * @returns {Record<string, boolean>} Map of itemId to boolean
 */
export function getActorFavorites(actor) {
    if (!actor || typeof actor.getFlag !== 'function') return {};
    return actor.getFlag(MODULE_ID, 'favorites') ?? {};
}

/**
 * Check whether an item is favorited on an actor, checking both actor-level flag and system adapter.
 *
 * @param {Object} actor Actor document
 * @param {Object|string} item Item document, Action instance, or itemId string
 * @param {Object} [adapter=actionDisplay.activeSystemAdapter] System adapter
 * @returns {boolean} True if favorited
 */
export function isActorItemFavorite(actor, item, adapter = actionDisplay?.activeSystemAdapter) {
    if (!actor || !item) return false;
    const itemId = typeof item === 'string' ? item : (item.id ?? item._id);
    if (!itemId) return false;

    const favorites = getActorFavorites(actor);
    if (favorites[itemId] === true) return true;

    if (adapter?.hasFavorites?.()) {
        const itemDoc = typeof item === 'object' ? (item.originalItem ?? item) : actor.items?.get(itemId);
        if (itemDoc && adapter.isFavorite(actor, itemDoc)) {
            return true;
        }
    }

    return false;
}

/**
 * Set or unset favorite state for an item on an actor, updating both the system-level state and actor flag map.
 *
 * @param {Object} actor Actor document
 * @param {Object|string} item Item document, Action instance, or itemId string
 * @param {boolean} isFavorite Target favorite state
 * @param {Object} [adapter=actionDisplay.activeSystemAdapter] System adapter
 * @returns {Promise<void>}
 */
export async function setActorItemFavorite(actor, item, isFavorite, adapter = actionDisplay?.activeSystemAdapter) {
    if (!actor || !item) return;
    const itemId = typeof item === 'string' ? item : (item.id ?? item._id);
    if (!itemId) return;

    const targetFavorite = Boolean(isFavorite);
    const itemDoc = typeof item === 'object' ? (item.originalItem ?? item) : actor.items?.get(itemId);

    // 1. Update system level if supported
    if (adapter?.hasFavorites?.() && itemDoc) {
        try {
            await adapter.setFavorite(actor, itemDoc, targetFavorite);
        } catch (err) {
            log.error(`setActorItemFavorite | Failed to set system favorite for item "${itemDoc.name}":`, err);
        }
    }

    // 2. Update actor level flag
    try {
        const current = { ...getActorFavorites(actor) };
        if (targetFavorite) {
            current[itemId] = true;
            if (typeof actor.setFlag === 'function') {
                await actor.setFlag(MODULE_ID, 'favorites', current);
            }
        } else {
            delete current[itemId];
            if (typeof actor.update === 'function') {
                await actor.update({
                    [`flags.${MODULE_ID}.favorites.-=${itemId}`]: null
                });
            } else if (typeof actor.setFlag === 'function') {
                await actor.setFlag(MODULE_ID, 'favorites', current);
            }
        }
    } catch (err) {
        log.error(`setActorItemFavorite | Failed to update actor flag for item ID "${itemId}":`, err);
    }
}

/**
 * Synchronize the actor's favorites flag map with the system-level favorites if the system supports favorites.
 *
 * @param {Object} actor Actor document
 * @param {Object} [adapter=actionDisplay.activeSystemAdapter] System adapter
 * @returns {Promise<void>}
 */
export async function syncActorFavorites(actor, adapter = actionDisplay?.activeSystemAdapter) {
    if (!actor || !adapter?.hasFavorites?.() || !actor.isOwner) return;

    try {
        const currentFlags = { ...getActorFavorites(actor) };
        const updatedFlags = {};
        let hasChanges = false;

        for (const item of (actor.items ?? [])) {
            if (!item?.id) continue;
            const isSysFav = Boolean(adapter.isFavorite(actor, item));
            if (isSysFav) {
                updatedFlags[item.id] = true;
                if (!currentFlags[item.id]) {
                    hasChanges = true;
                }
            } else {
                if (currentFlags[item.id]) {
                    hasChanges = true;
                }
            }
        }

        for (const id of Object.keys(currentFlags)) {
            if (!updatedFlags[id]) {
                hasChanges = true;
            }
        }

        if (hasChanges) {
            log.debug(`syncActorFavorites | Synchronizing favorites flag for actor "${actor.name}"`);
            if (typeof actor.setFlag === 'function') {
                await actor.setFlag(MODULE_ID, 'favorites', updatedFlags);
            }
        }
    } catch (err) {
        log.error(`syncActorFavorites | Failed to synchronize favorites for actor "${actor.name}":`, err);
    }
}
