import { BaseSystemContextMenuManager } from './base-system-context-menu-manager.js';
import { log } from '../../../lib/logger.js';
import { MODULE_ID } from '../../../constants.js';

export class Dnd5eSystemContextMenuManager extends BaseSystemContextMenuManager {
    constructor(adapter) {
        super(adapter);
    }

    #getOwnerItem(app, el) {
        if (!app.actor?.isOwner) return null;
        return this.getContextItem(app, el);
    }

    getContextMenuItems(app) {
        return [
            {
                name: "BAD.common.prepareSpell",
                icon: '<i class="fas fa-book"></i>',
                condition: el => {
                    const item = this.#getOwnerItem(app, el);
                    return item?.type === 'spell' && !['innate', 'atwill', 'pact'].includes(item.system.method) && !item.system.prepared;
                },
                callback: async el => {
                    const item = this.#getOwnerItem(app, el);
                    if (item) {
                        log.debug(`Preparing spell: ${item.name}`);
                        await item.update({ "system.prepared": 1 });
                    }
                }
            },
            {
                name: "BAD.common.unprepareSpell",
                icon: '<i class="fas fa-book-dead"></i>',
                condition: el => {
                    const item = this.#getOwnerItem(app, el);
                    return item?.type === 'spell' && !['innate', 'atwill', 'pact'].includes(item.system.method) && !!item.system.prepared;
                },
                callback: async el => {
                    const item = this.#getOwnerItem(app, el);
                    if (item) {
                        log.debug(`Unpreparing spell: ${item.name}`);
                        await item.update({ "system.prepared": 0 });
                    }
                }
            },
            {
                name: "BAD.common.equipItem",
                icon: '<i class="fas fa-shield-halved"></i>',
                condition: el => {
                    const item = this.#getOwnerItem(app, el);
                    return item && ['weapon', 'equipment'].includes(item.type) && !this.adapter.getItemEquipped(item);
                },
                callback: async el => {
                    const item = this.#getOwnerItem(app, el);
                    if (item) {
                        log.debug(`Equipping item: ${item.name}`);
                        await item.update({ "system.equipped": true });
                    }
                }
            },
            {
                name: "BAD.common.unequipItem",
                icon: '<i class="fas fa-shield-slash"></i>',
                condition: el => {
                    const item = this.#getOwnerItem(app, el);
                    return item && ['weapon', 'equipment'].includes(item.type) && this.adapter.getItemEquipped(item);
                },
                callback: async el => {
                    const item = this.#getOwnerItem(app, el);
                    if (item) {
                        log.debug(`Unequipping item: ${item.name}`);
                        await item.update({ "system.equipped": false });
                    }
                }
            }
        ];
    }

    onTabRightClick(app, el, event) {
        if (el.dataset.type !== 'all' || !app.actor?.isOwner) return false;

        const parentType = el.closest('.bad-left-tab-group')?.querySelector('.bad-left-tab')?.dataset.type;
        const flagMap = {
            spell: 'showUnprepared',
            weapon: 'showUnequipped_weapon',
            equipment: 'showUnequipped_equipment'
        };

        const flagKey = flagMap[parentType];
        if (flagKey) {
            const current = app.actor.getFlag(MODULE_ID, flagKey) ?? false;
            app.actor.setFlag(MODULE_ID, flagKey, !current);
            return true;
        }

        return false;
    }
}
