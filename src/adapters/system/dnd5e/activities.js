import { TabRef } from '../../../ui/tab-ref.js';

export function normalizeActivationType(type) {
    if (!type || type === 'none' || type === '') return null;
    return String(type).toLowerCase();
}

export function extractItemSpell(obj) {
    if (!obj) return null;
    const isItemInstance = typeof Item !== 'undefined' && obj.spell instanceof Item;
    return obj.linkedAction ?? obj.cachedSpell ?? (isItemInstance || obj.spell?.type === 'spell' ? obj.spell : null);
}

export function resolveRootSpellDocument(sub, parentItem) {
    if (!sub) return null;

    let doc = sub.linkedAction;
    const activity = sub.originalActivity;
    if (!doc && activity) {
        doc = extractItemSpell(activity);
        if (!doc && activity.spell?.uuid && typeof fromUuidSync === 'function') {
            try {
                doc = fromUuidSync(activity.spell.uuid);
            } catch (e) {
                // ignore sync resolution errors
            }
        }
    }

    const maxDepth = 5;
    let depth = 0;
    while (doc && depth < maxDepth) {
        const nextDoc = extractItemSpell(doc);
        if (nextDoc && nextDoc !== doc) {
            doc = nextDoc;
            depth++;
        } else {
            break;
        }
    }

    if (doc) return doc;

    if (activity?.spell && typeof activity.spell === 'object' && (typeof Item === 'undefined' || !(activity.spell instanceof Item))) {
        return activity.spell;
    }

    if (activity?.type === 'cast') {
        return activity.spell || activity;
    }

    const origItem = sub.originalItem ?? parentItem;
    if (origItem?.type === 'spell') {
        return origItem;
    }

    return null;
}

export function getActivityActivationType(activity, item, linkedAction = null) {
    const actOverride = activity.activation?.override ?? activity.system?.activation?.override;
    if (actOverride) {
        const overrideType = normalizeActivationType(activity.activation?.type ?? activity.system?.activation?.type);
        if (overrideType) return overrideType;
    }

    const spellDoc = linkedAction ?? resolveRootSpellDocument({ originalActivity: activity, linkedAction: activity.spell });
    const spellType = normalizeActivationType(spellDoc?.system?.activation?.type ?? spellDoc?.activation?.type);
    if (spellType) return spellType;

    return normalizeActivationType(item.system?.activation?.type)
        ?? normalizeActivationType(activity.activation?.type ?? activity.system?.activation?.type)
        ?? 'none';
}

function containerHasComponent(container, component) {
    if (!container) return false;
    const target = container.value ?? container;
    if (target instanceof Set) return target.has(component);
    if (Array.isArray(target)) return target.includes(component);
    if (typeof target === 'object') return !!target[component];
    return false;
}

function docHasComponent(doc, component) {
    if (!doc) return false;
    return containerHasComponent(doc, component) ||
           containerHasComponent(doc.system?.properties ?? doc.properties, component) ||
           containerHasComponent(doc.system?.components ?? doc.components, component);
}

export function requiresComponent(sub, component) {
    if (!sub) return false;
    const docsToCheck = [sub, sub.linkedAction, sub.originalActivity, sub.originalItem, resolveRootSpellDocument(sub)];
    return docsToCheck.some(doc => docHasComponent(doc, component));
}

export function getComponentTabs(doc) {
    return ['vocal', 'somatic', 'material']
        .filter(comp => requiresComponent(doc, comp))
        .map(comp => TabRef.from('components', comp));
}
