import { ActionDisplayAPI } from './action-display-api.js';

export { ActionDisplayAPI };

/**
 * Factory helper to create a new ActionDisplayAPI instance bound to a coordinator.
 * @param {ActionDisplay} coordinator Coordinator instance
 * @returns {ActionDisplayAPI}
 */
export function createAPI(coordinator) {
    return new ActionDisplayAPI(coordinator);
}

