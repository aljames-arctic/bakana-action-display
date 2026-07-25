import { log } from '../../lib/logger.js';
import { actionDisplay } from '../../action-display.js';

export function openActivitySubContextMenu(app, targetLi, subaction) {
    const menuItems = [
        {
            name: "SIDEBAR.Edit",
            icon: '<i class="fas fa-edit"></i>',
            condition: () => {
                if (!app.actor?.isOwner) return false;
                const entity = subaction?.originalActivity ?? subaction?.originalItem ?? app.actor?.items?.get(subaction?.id);
                return Boolean(entity && (typeof entity.sheet?.render === "function" || typeof entity.edit === "function"));
            },
            callback: () => {
                if (actionDisplay.activeSystemAdapter?.openEditSheet) {
                    actionDisplay.activeSystemAdapter.openEditSheet(subaction);
                } else {
                    const entity = subaction?.originalActivity ?? subaction?.originalItem ?? app.actor?.items?.get(subaction?.id);
                    if (typeof entity?.sheet?.render === "function") {
                        entity.sheet.render(true);
                    } else if (typeof entity?.edit === "function") {
                        entity.edit();
                    }
                }
            }
        }
    ];

    const ContextMenuClass = globalThis.foundry?.applications?.ux?.ContextMenu ?? globalThis.ContextMenu?.implementation ?? class {};
    const targetBody = app?.element?.ownerDocument?.body ?? globalThis.document?.body;
    const subMenu = new ContextMenuClass(targetBody, ".context-item", menuItems, {
        jQuery: false
    });
    setTimeout(() => {
        if (typeof subMenu?.render === "function") {
            subMenu.render(targetLi)?.catch?.(err => log.debug("SubContextMenu render error:", err));
        }
    }, 10);
}

export function buildSubactionMenuItem(sub, event) {
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
            log.debug(`Rolling sub-action: ${sub.name} via dropdown`);
            sub.roll(event);
        }
    };
}

export function showActivityDropdown(app, target, subactions, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    log.debug(`showActivityDropdown | "${target.dataset.actionId}" with ${subactions.length} items:`, subactions.map(s => s.name));
    const menuItems = subactions.map(sub => buildSubactionMenuItem(sub, event));

    if (app._activeLeftClickMenu) {
        app._activeLeftClickMenu.close();
        app._activeLeftClickMenu = null;
    }

    if (app._contextMenu) {
        try {
            app._contextMenu.close()?.catch?.(err => {
                log.debug("ContextMenu.close promise rejected:", err);
            });
        } catch (err) {
            log.debug("ContextMenu.close threw synchronously:", err);
        }
    }
    if (app._activeContextMenuTarget) {
        app._activeContextMenuTarget.classList.remove('bad-menu-active');
        app._activeContextMenuTarget = null;
    }

    app._activeMenuTarget = target;
    target.classList.add('bad-dropdown-active');

    const ContextMenuClass = globalThis.foundry?.applications?.ux?.ContextMenu ?? globalThis.ContextMenu?.implementation ?? class {};
    const menu = new ContextMenuClass(app.element, ".bad-action-item", menuItems, {
        jQuery: false,
        onClose: () => {
            log.debug("Left-click dropdown menu closed");
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
            log.debug(`showActivityDropdown | menu.render error:`, e);
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
                        app._activeLeftClickMenu?.close();
                        app._activeLeftClickMenu = null;
                        if (actionDisplay.activeSystemAdapter?.openEditSheet) {
                            actionDisplay.activeSystemAdapter.openEditSheet(sub);
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
