import { log } from '../../lib/logger.js';
import { adapter } from '../../adapters/index.js';

/**
 * Open a context submenu for an individual subaction/activity item (e.g. right-clicking an activity in the dropdown).
 * @param {ApplicationV2} app Active HUD application
 * @param {HTMLElement} targetLi Target activity list item element
 * @param {Object} subaction The subaction or activity data object
 */
export function openActivitySubContextMenu(app, targetLi, subaction) {
    const menuItems = [
        {
            name: "SIDEBAR.Edit",
            icon: '<i class="fas fa-edit"></i>',
            condition: () => {
                if (!app.actor?.isOwner) return false;
                const entity = subaction?.originalActivity ?? subaction?.originalItem;
                return Boolean(entity && (typeof entity.sheet?.render === "function" || typeof entity.edit === "function"));
            },
            callback: () => {
                if (adapter.openEditSheet) {
                    adapter.openEditSheet(subaction);
                } else {
                    const entity = subaction?.originalActivity ?? subaction?.originalItem;
                    if (typeof entity?.sheet?.render === "function") {
                        entity.sheet.render(true);
                    } else if (typeof entity?.edit === "function") {
                        entity.edit();
                    }
                }
            }
        }
    ];

    const ContextMenuClass = adapter.foundry.ContextMenu;
    const targetBody = app?.element?.ownerDocument?.body ?? document.body;
    const subMenu = new ContextMenuClass(targetBody, ".context-item", menuItems, {
        jQuery: false
    });
    setTimeout(() => {
        if (typeof subMenu?.render === "function") {
            subMenu.render(targetLi)?.catch?.(err => log.error("SubContextMenu render error:", err));
        }
    }, 10);
}

/**
 * Construct a menu item definition for an individual subaction inside the dropdown.
 * @param {Object} sub The subaction data object
 * @param {Event} event The triggering click event
 * @param {ApplicationV2} [app=null] Active HUD application
 * @returns {Object} Menu item configuration
 */
export function buildSubactionMenuItem(sub, event, app = null) {
    const uses = sub.uses;
    const iconHtml = sub.img
        ? `<img class="bad-menu-icon" src="${sub.img}" />`
        : '<i class="fas fa-play bad-menu-icon"></i>';

    let usesHtml = "";
    if (uses && uses.available !== null) {
        const usesText = `${uses.available}${uses.max ? ' / ' + uses.max : ''}`;
        const depletedClass = uses.available === 0 ? " depleted" : "";
        const upcastClass = uses.isUpcast ? " upcast" : "";
        usesHtml = `<span class="bad-menu-uses${depletedClass}${upcastClass}">${usesText}</span>`;
    }

    return {
        name: sub.name ?? "Action",
        icon: `<span class="bad-menu-icon-wrap">${iconHtml}</span>`,
        usesHtml: usesHtml,
        callback: () => {
            const item = sub.originalItem ?? sub;
            const actor = app?.actor ?? null;
            const token = app?.token ?? null;
            const user = game.user;
            log.info(`Rolling subaction "${sub.name}" via dropdown:`, { action: sub, item, actor, token, user });
            sub.roll(event);
        }
    };
}

/**
 * Display the subaction / activity selection dropdown menu anchored to the action card.
 * @param {ApplicationV2} app Active HUD application
 * @param {HTMLElement} target Action card target element
 * @param {Object[]} subactions Array of qualifying subaction objects
 * @param {Event} event Triggering click event
 */
export function showActivityDropdown(app, target, subactions, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const menuItems = subactions.map(sub => buildSubactionMenuItem(sub, event, app));

    if (app._activeLeftClickMenu) {
        try {
            app._activeLeftClickMenu.close()?.catch?.(err => {
                log.debug("LeftClickMenu.close promise rejected:", err);
            });
        } catch (err) {
            log.debug("LeftClickMenu.close threw synchronously:", err);
        }
        app._activeLeftClickMenu = null;
    }

    if (app._activeContextMenuTarget && app._contextMenu) {
        try {
            app._contextMenu.close()?.catch?.(err => {
                log.debug("ContextMenu.close promise rejected:", err);
            });
        } catch (err) {
            log.debug("ContextMenu.close threw synchronously:", err);
        }
        app._activeContextMenuTarget.classList.remove('bad-menu-active');
        app._activeContextMenuTarget = null;
    }

    app._activeMenuTarget = target;
    target.classList.add('bad-dropdown-active');

    const ContextMenuClass = adapter.foundry.ContextMenu;
    const menu = new ContextMenuClass(app.element, ".bad-action-item", menuItems, {
        jQuery: false,
        onClose: () => {
            target.classList.remove('bad-dropdown-active');
            app._activeLeftClickMenu = null;
            app._activeMenuTarget = null;
        }
    });

    app._activeLeftClickMenu = menu;

    setTimeout(async () => {
        try {
            await menu.render(target);
        } catch (e) {
            log.error(`showActivityDropdown | menu.render error:`, e);
        }

        const menuEl = document.querySelector('#context-menu');
        if (menuEl) {
            if (menuEl.parentElement !== document.body) {
                document.body.appendChild(menuEl);
            }

            const lis = menuEl.querySelectorAll('.context-item');
            lis.forEach((li, idx) => {
                const sub = subactions[idx];
                if (sub) {
                    li.addEventListener('contextmenu', (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        ev.stopImmediatePropagation();
                        try {
                            app._activeLeftClickMenu?.close()?.catch?.(err => {
                                log.debug("LeftClickMenu.close promise rejected:", err);
                            });
                        } catch (err) {
                            log.debug("LeftClickMenu.close threw synchronously:", err);
                        }
                        app._activeLeftClickMenu = null;
                        if (adapter.openEditSheet) {
                            adapter.openEditSheet(sub);
                        } else {
                            const entity = sub.originalActivity ?? sub.originalItem;
                            entity?.sheet?.render?.(true);
                        }
                    });
                }
                const itemData = menuItems[idx];
                if (itemData && itemData.usesHtml && !li.querySelector('.bad-menu-uses')) {
                    li.insertAdjacentHTML('beforeend', itemData.usesHtml);
                }
            });

            const rect = target.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom - 15;
            const neededHeight = subactions.length * 36 + 15;
            const maxHeight = Math.max(150, Math.min(neededHeight, spaceBelow));

            const styles = {
                position: 'fixed',
                left: `${rect.left}px`,
                top: `${rect.bottom}px`,
                bottom: 'auto',
                width: `${rect.width}px`,
                'min-width': `${rect.width}px`,
                'box-sizing': 'border-box',
                'z-index': '999999',
                display: 'block',
                visibility: 'visible',
                opacity: '1',
                'max-height': `${maxHeight}px`
            };
            for (const [prop, val] of Object.entries(styles)) {
                menuEl.style.setProperty(prop, val, 'important');
            }
            Array.from(menuEl.children).forEach(child => {
                child.style.setProperty('max-height', `${maxHeight}px`, 'important');
                child.style.setProperty('overflow-y', 'auto', 'important');
            });
        }
    }, 10);
}
