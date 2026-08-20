import { log } from '../../lib/logger.js';
import { adapter } from '../../adapters/index.js';
import { isActorItemFavorite, setActorItemFavorite } from '../../favorites/favorites-manager.js';

/**
 * Manages UI context menus for action items inside ActionDisplayApp.
 */
export class ContextMenuManager {
    /**
     * @param {ApplicationV2} app Active ActionDisplayApp instance
     * @param {HTMLElement} element Root application DOM element
     */
    constructor(app, element) {
        this.app = app;
        this.element = element;
    }

    /**
     * Build and bind the Foundry ContextMenu instance for action cards.
     * @returns {ContextMenu} The created ContextMenu instance
     */
    createActionContextMenu() {
        const menuItems = [
            {
                name: "SIDEBAR.Edit",
                icon: '<i class="fas fa-edit"></i>',
                condition: el => {
                    if (!this.app.actor?.isOwner) return false;
                    const action = this.app.actions?.find(a => a.id === el.dataset.actionId);
                    const item = action?.originalItem ?? this.app.actor?.items?.get(el.dataset.actionId);
                    return Boolean(item && typeof item.sheet?.render === "function");
                },
                callback: el => {
                    const action = this.app.actions?.find(a => a.id === el.dataset.actionId);
                    if (action && adapter.openEditSheet) {
                        adapter.openEditSheet(action);
                    } else {
                        const item = action?.originalItem ?? this.app.actor?.items?.get(el.dataset.actionId);
                        item?.sheet?.render(true);
                    }
                }
            },
            {
                name: "BAD.actionMenu.addFavorite",
                icon: '<i class="fas fa-star"></i>',
                condition: el => {
                    if (!this.app.actor?.isOwner) return false;
                    const action = this.app.actions?.find(a => a.id === el.dataset.actionId);
                    const item = action?.originalItem ?? this.app.actor?.items?.get(el.dataset.actionId);
                    return Boolean(item && !isActorItemFavorite(this.app.actor, item));
                },
                callback: async el => {
                    const action = this.app.actions?.find(a => a.id === el.dataset.actionId);
                    const item = action?.originalItem ?? this.app.actor?.items?.get(el.dataset.actionId);
                    if (item) {
                        await setActorItemFavorite(this.app.actor, item, true);
                        this.app.render();
                    }
                }
            },
            {
                name: "BAD.actionMenu.removeFavorite",
                icon: '<i class="far fa-star"></i>',
                condition: el => {
                    if (!this.app.actor?.isOwner) return false;
                    const action = this.app.actions?.find(a => a.id === el.dataset.actionId);
                    const item = action?.originalItem ?? this.app.actor?.items?.get(el.dataset.actionId);
                    return Boolean(item && isActorItemFavorite(this.app.actor, item));
                },
                callback: async el => {
                    const action = this.app.actions?.find(a => a.id === el.dataset.actionId);
                    const item = action?.originalItem ?? this.app.actor?.items?.get(el.dataset.actionId);
                    if (item) {
                        await setActorItemFavorite(this.app.actor, item, false);
                        this.app.render();
                    }
                }
            },
            {
                name: "BAD.core.hideAction",
                icon: '<i class="fas fa-eye-slash"></i>',
                condition: el => {
                    if (!this.app.actor?.isOwner) return false;
                    const action = this.app.actions?.find(a => a.id === el.dataset.actionId);
                    return action && !action.isHidden;
                },
                callback: el => {
                    this.app._toggleActionHidden(el.dataset.actionId, true);
                }
            },
            {
                name: "BAD.core.unhideAction",
                icon: '<i class="fas fa-eye"></i>',
                condition: el => {
                    if (!this.app.actor?.isOwner) return false;
                    const action = this.app.actions?.find(a => a.id === el.dataset.actionId);
                    return action && action.isHidden;
                },
                callback: el => {
                    this.app._toggleActionHidden(el.dataset.actionId, false);
                }
            }
        ];

        const systemItems = adapter.getContextMenuItems(this.app);
        if (systemItems.length > 0) {
            menuItems.push(...systemItems);
        }

        const options = {
            jQuery: false,
            onOpen: (target) => {
                log.debug("Context menu opened on target:", target);
                if (this.app._activeLeftClickMenu) {
                    this.app._activeLeftClickMenu.close();
                    this.app._activeLeftClickMenu = null;
                }
                if (this.app._activeMenuTarget) {
                    this.app._activeMenuTarget.classList.remove('bad-dropdown-active');
                    this.app._activeMenuTarget = null;
                }
                this.app._activeContextMenuTarget = target;
                this.element.querySelectorAll('.bad-action-item').forEach(el => {
                    if (el !== target) el.classList.remove('bad-menu-active');
                });
                target.classList.add('bad-menu-active');
                this.element.querySelector('.bakana-action-display-container')?.classList.add('has-context-menu');
            },
            onClose: () => {
                log.debug("Context menu closed");
                if (this.app._activeContextMenuTarget) {
                    this.app._activeContextMenuTarget.classList.remove('bad-menu-active');
                }
                this.app._activeContextMenuTarget = null;
                this.element.querySelector('.bakana-action-display-container')?.classList.remove('has-context-menu');
            }
        };

        const ContextMenuClass = adapter.foundry.ContextMenu;
        return new ContextMenuClass(this.element, ".bad-action-item", menuItems, options);
    }
}

/**
 * Factory helper to instantiate ContextMenuManager and construct the action context menu.
 * @param {ApplicationV2} app Active ActionDisplayApp instance
 * @param {HTMLElement} element Root application DOM element
 * @returns {ContextMenu} The created ContextMenu instance
 */
export function createActionContextMenu(app, element) {
    const manager = new ContextMenuManager(app, element);
    return manager.createActionContextMenu();
}
