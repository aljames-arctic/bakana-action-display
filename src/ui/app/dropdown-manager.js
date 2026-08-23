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
                return Boolean(entity?.sheet?.render || entity?.edit);
            },
            callback: () => {
                adapter.openEditSheet(subaction);
            }
        }
    ];

    const ContextMenuClass = adapter.foundry.ContextMenu;
    const targetBody = app?.element?.ownerDocument?.body ?? document.body;
    const subMenu = new ContextMenuClass(targetBody, ".context-item", menuItems, {
        jQuery: false
    });
    subMenu?.render?.(targetLi)?.catch?.(err => log.error("SubContextMenu render error:", err));
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
            log.debug(`Rolling subaction "${sub.name}" via dropdown:`, { action: sub, item, actor, token, user });
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
        const prevLeftMenu = app._activeLeftClickMenu;
        app._activeLeftClickMenu = null;
        try {
            prevLeftMenu.close()?.catch?.(err => {
                log.debug("LeftClickMenu.close promise rejected:", err);
            });
        } catch (err) {
            log.debug("LeftClickMenu.close threw synchronously:", err);
        }
    }

    if (app._activeContextMenuTarget && app._contextMenu) {
        const prevContextTarget = app._activeContextMenuTarget;
        app._activeContextMenuTarget = null;
        try {
            app._contextMenu.close()?.catch?.(err => {
                log.debug("ContextMenu.close promise rejected:", err);
            });
        } catch (err) {
            log.debug("ContextMenu.close threw synchronously:", err);
        }
        prevContextTarget?.classList?.remove?.('bad-menu-active');
    }

    app._activeMenuTarget = target;
    target.classList.add('bad-dropdown-active');

    const ContextMenuClass = adapter.foundry.ContextMenu;
    const targetBody = app?.element?.ownerDocument?.body ?? document.body;

    const applyPositioning = (menuEl) => {
        if (!menuEl) return;
        if (menuEl.parentElement !== targetBody) {
            targetBody.appendChild(menuEl);
        }

        const rect = target.getBoundingClientRect?.() ?? { left: 0, top: 0, right: 100, bottom: 30, width: 100, height: 30 };
        const viewportHeight = window?.innerHeight ?? 1080;
        const spaceBelow = viewportHeight - rect.bottom - 15;
        const spaceAbove = rect.top - 15;
        const neededHeight = subactions.length * 36 + 15;

        // Prefer down: only place above if space below is critically constrained (< 80px) and space above is larger
        const placeAbove = spaceBelow < Math.min(neededHeight, 80) && spaceAbove > spaceBelow;
        const availableSpace = placeAbove ? spaceAbove : spaceBelow;
        const maxHeight = Math.max(60, Math.min(neededHeight, availableSpace));

        const styles = {
            position: 'fixed',
            left: `${rect.left}px`,
            top: placeAbove ? `${Math.max(10, rect.top - Math.min(neededHeight, maxHeight))}px` : `${rect.bottom}px`,
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
            menuEl.style?.setProperty?.(prop, val, 'important');
        }

        Array.from(menuEl.children ?? []).forEach(child => {
            child.style?.setProperty?.('max-height', `${maxHeight}px`, 'important');
            child.style?.setProperty?.('overflow-y', 'auto', 'important');
        });
    };

    const options = {
        jQuery: false,
        onOpen: () => {
            const menuEl = document.querySelector('#context-menu, .context-menu');
            applyPositioning(menuEl);
        },
        onClose: () => {
            target?.classList?.remove?.('bad-dropdown-active');
            if (app._activeLeftClickMenu === menu) app._activeLeftClickMenu = null;
            if (app._activeMenuTarget === target) app._activeMenuTarget = null;
            const menuEl = document.querySelector('#context-menu, .context-menu');
            menuEl?.remove?.();
        }
    };

    const menu = new ContextMenuClass(targetBody, ".bad-action-item", menuItems, options);
    menu._setPosition = (html) => {
        const menuEl = html instanceof HTMLElement ? html : html?.[0] ?? document.querySelector('#context-menu, .context-menu');
        if (menuEl) applyPositioning(menuEl);
    };
    menu.setPosition = menu._setPosition;

    const origClose = typeof menu.close === 'function' ? menu.close.bind(menu) : null;
    menu.close = async (closeOptions = {}) => {
        const menuEl = document.querySelector('#context-menu, .context-menu');
        try {
            if (origClose) await origClose(closeOptions);
        } catch (err) {
            log.debug("LeftClickMenu close error:", err);
        } finally {
            menuEl?.remove?.();
            target?.classList?.remove?.('bad-dropdown-active');
            if (app._activeLeftClickMenu === menu) app._activeLeftClickMenu = null;
            if (app._activeMenuTarget === target) app._activeMenuTarget = null;
        }
    };

    app._activeLeftClickMenu = menu;

    menu.render(target)?.then?.(() => {
        const menuEl = document.querySelector('#context-menu, .context-menu');
        if (menuEl) {
            applyPositioning(menuEl);

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
                        adapter.openEditSheet(sub);
                    });
                }
                const itemData = menuItems[idx];
                if (itemData?.usesHtml && !li.querySelector('.bad-menu-uses')) {
                    li.insertAdjacentHTML('beforeend', itemData.usesHtml);
                }
            });
        }
    })?.catch?.(e => {
        log.error(`showActivityDropdown | menu.render error:`, e);
    });
}
