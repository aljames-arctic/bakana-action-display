import { log } from '../../lib/logger.js';
import { actionDisplay } from '../../action-display.js';

export function createActionContextMenu(app, element) {
    const menuItems = [
        {
            name: "BAD.core.hideAction",
            icon: '<i class="fas fa-eye-slash"></i>',
            condition: el => {
                if (!app.actor?.isOwner) return false;
                const action = app.actions?.find(a => a.id === el.dataset.actionId);
                return action && !action.isHidden;
            },
            callback: el => {
                app._toggleActionHidden(el.dataset.actionId, true);
            }
        },
        {
            name: "BAD.core.unhideAction",
            icon: '<i class="fas fa-eye"></i>',
            condition: el => {
                if (!app.actor?.isOwner) return false;
                const action = app.actions?.find(a => a.id === el.dataset.actionId);
                return action && action.isHidden;
            },
            callback: el => {
                app._toggleActionHidden(el.dataset.actionId, false);
            }
        }
    ];

    if (actionDisplay.activeSystemAdapter?.getContextMenuItems) {
        const systemItems = actionDisplay.activeSystemAdapter.getContextMenuItems(app);
        menuItems.push(...systemItems);
    }

    const options = {
        jQuery: false,
        onOpen: (target) => {
            log.debug("Context menu opened on target:", target);
            app._activeContextMenuTarget = target;
            element.querySelectorAll('.bad-action-item').forEach(el => {
                if (el !== target) el.classList.remove('bad-menu-active');
            });
            target.classList.add('bad-menu-active');
            element.querySelector('.bakana-action-display-container')?.classList.add('has-context-menu');
        },
        onClose: () => {
            log.debug("Context menu closed");
            if (app._activeContextMenuTarget) {
                app._activeContextMenuTarget.classList.remove('bad-menu-active');
            }
            app._activeContextMenuTarget = null;
            element.querySelector('.bakana-action-display-container')?.classList.remove('has-context-menu');
        }
    };

    const ContextMenuClass = globalThis.foundry?.applications?.ux?.ContextMenu ?? globalThis.ContextMenu?.implementation ?? class {};
    return new ContextMenuClass(element, ".bad-action-item", menuItems, options);
}
