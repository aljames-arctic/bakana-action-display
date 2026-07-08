import { log } from '../../lib/logger.js';

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
        name: sub.name || "Action",
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

    app._activeMenuTarget = target;
    target.classList.add('bad-dropdown-active');

    const ContextMenuClass = globalThis.foundry?.applications?.ux?.ContextMenu ?? globalThis.ContextMenu?.implementation ?? class {};
    const menu = new ContextMenuClass(app.element, null, menuItems, {
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
