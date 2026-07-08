import { localize } from '../../../lib/utils.js';

export function getSpellSlotUses(actor, level, highestAvailableSlot) {
    const actorSpells = actor?.system?.spells;
    const isPact = level === 'pact';
    const lvl = isPact ? (actorSpells?.pact?.level ?? 0) : (Number(level) || 0);

    if (!isPact && lvl <= 0) return { available: null, max: null };

    const slot = isPact ? actorSpells?.pact : actorSpells?.[`spell${lvl}`];
    const available = slot?.value ?? 0;
    const max = slot?.max ?? 0;

    if (available > 0) {
        return { available, max };
    }
    if (highestAvailableSlot >= lvl) {
        return {
            available: localize('BAD.dnd5e.upcast', 'Upcast'),
            max: null,
            isUpcast: true
        };
    }
    return { available: 0, max };
}

export function hasAvailableUpcastSlots(level, highestAvailableSlot) {
    return highestAvailableSlot >= level;
}

export function calculateSpellSlots(item, actor, highestAvailableSlot) {
    const system = item.system;
    const prepMode = system.method;
    const level = system.level ?? 0;
    
    if (prepMode === 'pact') {
        return getSpellSlotUses(actor, 'pact', highestAvailableSlot);
    } else if (!['innate', 'atwill'].includes(prepMode)) {
        return getSpellSlotUses(actor, level, highestAvailableSlot);
    }
    return { available: null, max: null };
}

export function getHighestAvailableSpellSlot(actor) {
    const actorSpells = actor?.system?.spells;
    if (!actorSpells) return 0;

    let highest = 0;
    for (let i = 9; i >= 1; i--) {
        if (actorSpells[`spell${i}`]?.value > 0) {
            highest = i;
            break;
        }
    }
    if (actorSpells.pact?.value > 0) {
        highest = Math.max(highest, actorSpells.pact.level ?? 0);
    }
    return highest;
}

export function calculateWeaponAmmunition(item, ammoQuantities) {
    const ammoType = item.system.ammunition?.type;
    const quantity = ammoQuantities.get(ammoType) ?? 0;
    return {
        available: quantity,
        max: null
    };
}

export function getAmmoQuantities(actor) {
    const ammoQuantities = new Map();
    for (const i of actor?.items ?? []) {
        if (i.type === 'consumable' && i.system.type?.value === 'ammo') {
            const subtype = i.system.type.subtype;
            if (subtype) {
                const qty = i.system.quantity ?? 0;
                ammoQuantities.set(subtype, (ammoQuantities.get(subtype) ?? 0) + qty);
            }
        }
    }
    return ammoQuantities;
}
