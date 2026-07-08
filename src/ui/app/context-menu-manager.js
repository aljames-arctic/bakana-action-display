import { log } from '../../lib/logger.js';
import { actionDisplay } from '../../action-display.js';

/**
 * Manages UI context menus for action items inside ActionDisplayApp.
 */
export class ContextMenuManager {
    constructor(app, element) {
        this.app = app;
        this.element = element;
    }

    createActionContextMenu() {
        const menuItems = [
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

        if (actionDisplay.activeSystemAdapter?.getContextMenuItems) {
            const systemItems = actionDisplay.activeSystemAdapter.getContextMenuItems(this.app);
            menuItems.push(...systemItems);
        }

        const options = {
            jQuery: false,
            onOpen: (target) => {
                log.debug("Context menu opened on target:", target);
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

        const ContextMenuClass = globalThis.foundry?.applications?.ux?.ContextMenu ?? globalThis.ContextMenu?.implementation ?? class {};
        return new ContextMenuClass(this.element, ".bad-action-item", menuItems, options);
    }
}

export function createActionContextMenu(app, element) {
    const manager = new ContextMenuManager(app, element);
    return manager.createActionContextMenu();
}
