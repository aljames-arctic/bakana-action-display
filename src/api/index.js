import { ActionDisplayAPI } from './action-display-api.js';
import {
    normalizeToken,
    normalizeActor,
    normalizePage,
    normalizeTabColumnState,
    normalizeTabConfig
} from './api-normalizer.js';

export {
    ActionDisplayAPI,
    normalizeToken,
    normalizeActor,
    normalizePage,
    normalizeTabColumnState,
    normalizeTabConfig
};

/**
 * Factory helper to create a new ActionDisplayAPI instance bound to a coordinator.
 * @param {ActionDisplay} coordinator Coordinator instance
 * @returns {ActionDisplayAPI}
 */
export function createAPI(coordinator) {
    return new ActionDisplayAPI(coordinator);
}


