import { BaseSystemContextMenuManager } from './base-system-context-menu-manager.js';
import { MODULE_ID } from '../../../constants.js';

const ALL_FILTER_FLAGS = [
    'showAll',
    'showUnequipped_weapon',
    'showUnequipped_equipment',
    'showUnequipped_consumable'
];

/**
 * Manages PF2e-specific context menu options (Equip/Unequip) and tab right-click filters.
 */
export class Pf2eSystemContextMenuManager extends BaseSystemContextMenuManager {
    /**
     * @param {Pf2eSystemAdapter} adapter Owning PF2e adapter instance
     */
    constructor(adapter) {
        super(adapter);
    }

    /**
     * Resolve the Item document if owned by the current user.
     * @param {ApplicationV2} app Active HUD application
     * @param {HTMLElement} el Clicked DOM element
     * @returns {Item|null}
     */
    #getOwnerItem(app, el) {
        if (!app.actor?.isOwner) return null;
        return this.getContextItem(app, el);
    }

    /**
     * Retrieve system-specific context menu items for PF2e physical items (Hold 1H, Hold 2H, Wear, Stow, Drop).
     * @param {ApplicationV2} app Active HUD application
     * @returns {Object[]} Context menu items definition
     */
    getContextMenuItems(app) {
        return [
            {
                name: "BAD.pf2e.carryTypeHeld1",
                icon: '<i class="fas fa-hand"></i>',
                condition: el => {
                    const item = this.#getOwnerItem(app, el);
                    if (!item || !item.system?.equipped || item.type === 'armor') return false;
                    const { carryType, handsHeld } = item.system.equipped;
                    return !(carryType === 'held' && handsHeld === 1);
                },
                callback: async el => {
                    const item = this.#getOwnerItem(app, el);
                    if (item) {
                        await item.update({
                            "system.equipped.carryType": "held",
                            "system.equipped.handsHeld": 1
                        });
                    }
                }
            },
            {
                name: "BAD.pf2e.carryTypeHeld2",
                icon: '<i class="fas fa-hands"></i>',
                condition: el => {
                    const item = this.#getOwnerItem(app, el);
                    if (!item || !item.system?.equipped || !['weapon', 'equipment'].includes(item.type)) return false;
                    const { carryType, handsHeld } = item.system.equipped;
                    return !(carryType === 'held' && handsHeld === 2);
                },
                callback: async el => {
                    const item = this.#getOwnerItem(app, el);
                    if (item) {
                        await item.update({
                            "system.equipped.carryType": "held",
                            "system.equipped.handsHeld": 2
                        });
                    }
                }
            },
            {
                name: "BAD.pf2e.carryTypeWorn",
                icon: '<i class="fas fa-shirt"></i>',
                condition: el => {
                    const item = this.#getOwnerItem(app, el);
                    if (!item || !item.system?.equipped) return false;
                    return item.system.equipped.carryType !== 'worn';
                },
                callback: async el => {
                    const item = this.#getOwnerItem(app, el);
                    if (item) {
                        await item.update({
                            "system.equipped.carryType": "worn",
                            "system.equipped.handsHeld": 0
                        });
                    }
                }
            },
            {
                name: "BAD.pf2e.carryTypeStowed",
                icon: '<i class="fas fa-box-archive"></i>',
                condition: el => {
                    const item = this.#getOwnerItem(app, el);
                    if (!item || !item.system?.equipped) return false;
                    return item.system.equipped.carryType !== 'stowed';
                },
                callback: async el => {
                    const item = this.#getOwnerItem(app, el);
                    if (item) {
                        await item.update({
                            "system.equipped.carryType": "stowed",
                            "system.equipped.handsHeld": 0
                        });
                    }
                }
            },
            {
                name: "BAD.pf2e.carryTypeDropped",
                icon: '<i class="fas fa-arrow-down"></i>',
                condition: el => {
                    const item = this.#getOwnerItem(app, el);
                    if (!item || !item.system?.equipped) return false;
                    return item.system.equipped.carryType !== 'dropped';
                },
                callback: async el => {
                    const item = this.#getOwnerItem(app, el);
                    if (item) {
                        await item.update({
                            "system.equipped.carryType": "dropped",
                            "system.equipped.handsHeld": 0
                        });
                    }
                }
            }
        ];
    }

    /**
     * Handle right-click on tabs to toggle showAll/showUnequipped actor flags.
     * @param {ApplicationV2} app Active HUD application
     * @param {HTMLElement} el Clicked DOM element
     * @param {Event} event Triggering event
     * @returns {boolean} True if handled
     */
    onTabRightClick(app, el, event) {
        if (!app.actor?.isOwner) return false;

        const isParentTab = el.classList.contains('bad-left-tab');
        const isSubTab = el.classList.contains('bad-left-sub-tab');

        if (isParentTab) {
            const parentType = el.dataset.type;
            if (parentType === 'all') {
                const current = app.actor.getFlag(MODULE_ID, 'showAll') ?? false;
                const nextState = !current;
                for (const key of ALL_FILTER_FLAGS) {
                    app.actor.setFlag(MODULE_ID, key, nextState);
                }
                return true;
            }

            const flagMap = {
                weapon: 'showUnequipped_weapon',
                equipment: 'showUnequipped_equipment',
                consumable: 'showUnequipped_consumable'
            };

            const flagKey = flagMap[parentType];
            if (flagKey) {
                const current = app.actor.getFlag(MODULE_ID, flagKey) ?? false;
                app.actor.setFlag(MODULE_ID, flagKey, !current);
                return true;
            }
            return false;
        }

        if (isSubTab && el.dataset.type === 'all') {
            const parentType = el.closest('.bad-left-tab-group')?.querySelector('.bad-left-tab')?.dataset.type;
            if (parentType === 'all') {
                const current = app.actor.getFlag(MODULE_ID, 'showAll') ?? false;
                const nextState = !current;
                for (const key of ALL_FILTER_FLAGS) {
                    app.actor.setFlag(MODULE_ID, key, nextState);
                }
                return true;
            }

            const flagMap = {
                weapon: 'showUnequipped_weapon',
                equipment: 'showUnequipped_equipment',
                consumable: 'showUnequipped_consumable'
            };

            const flagKey = flagMap[parentType];
            if (flagKey) {
                const current = app.actor.getFlag(MODULE_ID, flagKey) ?? false;
                app.actor.setFlag(MODULE_ID, flagKey, !current);
                return true;
            }
        }

        return false;
    }
}
