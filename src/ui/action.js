import { TabRef } from './tab-ref.js';

/**
 * Encapsulates a top-level action or sub-action displayed in the Bakana's Action Display HUD.
 */
export class Action {
    /**
     * @param {Object} options
     * @param {string} options.id Unique item/action/activity ID
     * @param {string} options.name Display name of the action
     * @param {string} [options.type=''] Foundry Item or Activity type
     * @param {string} [options.img=''] Icon image URL/path
     * @param {TabRef[]} [options.tabs] Array of TabRef instances
     * @param {string[]} [options.itemTypes] Hierarchical category list for left-side tabs
     * @param {boolean} [options.hidden=false] System-level hidden state
     * @param {boolean} [options.isHidden=false] User-flagged hidden override state
     * @param {boolean} [options.available=true] Action availability state
     * @param {Object} [options.uses] Resource tracking object { available, max, isUpcast, ... }
     * @param {Function|null} [options.roll=null] Async roll callback
     * @param {Item|null} [options.originalItem=null] Foundry Item instance
     * @param {Action[]} [options.subactions=[]] Array of child Action instances
     * @param {Object|null} [options.originalActivity=null] Underlying system Activity instance
     * @param {Object|null} [options.linkedAction=null] Linked document/item data (e.g. compendium spell)
     * @param {Object} [options.extra={}] Additional metadata
     */
    constructor({
        id,
        name,
        type = '',
        img = '',
        tabs = [TabRef.from('all')],
        itemTypes = [],
        hidden = false,
        isHidden = false,
        available = true,
        uses = { available: null, max: null },
        roll = null,
        originalItem = null,
        subactions = [],
        originalActivity = null,
        linkedAction = null,
        extra = {}
    } = {}) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.img = img;
        this.tabs = tabs;
        this.itemTypes = itemTypes;
        this.hidden = hidden;
        this.isHidden = isHidden;
        this.available = available;
        this.uses = uses;
        this.roll = roll;
        this.originalItem = originalItem;
        this.subactions = subactions;
        this.originalActivity = originalActivity;
        this.linkedAction = linkedAction;
        this.extra = extra;
    }

    /**
     * Helper: check if action has sub-actions
     * @returns {boolean}
     */
    get hasSubactions() {
        return this.subactions.length > 0;
    }

    /**
     * Helper: check if action is depleted of resources
     * @returns {boolean}
     */
    get isDepleted() {
        if (!this.uses || this.uses.available === null) return false;
        return this.uses.available <= 0 && !this.uses.isUpcast;
    }
}
