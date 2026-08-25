/**
 * Entry-boundary normalizers for external API inputs.
 * Normalizes polymorphic or loose external arguments into strict, concrete data contracts
 * before passing them to internal module classes.
 */

/**
 * @typedef {Object} ConcreteTabColumnState
 * @property {string[]} parents Active parent tab IDs
 * @property {string} focusedParent Focused parent tab ID
 * @property {string[]} subTypes Active sub-type IDs
 */

/**
 * @typedef {Object} ConcreteTabSelectionConfig
 * @property {ConcreteTabColumnState|null} left Left column state contract
 * @property {ConcreteTabColumnState|null} right Right column state contract
 */

/**
 * Normalize external polymorphic token input into a concrete Token placeable object.
 * @param {*} target External input (Token, TokenDocument, Actor, ID string, UUID string)
 * @returns {Token|null} Concrete Token instance or null
 */
export function normalizeToken(target) {
    if (!target) return null;

    // Concrete Token placeable object
    if (target.actor && target.document) {
        return target;
    }

    // TokenDocument
    if (target.object && target.actor) {
        return target.object;
    }

    // Actor instance
    if (typeof target.getActiveTokens === 'function') {
        const active = target.getActiveTokens();
        if (active && active.length > 0) return active[0];
        return canvas?.tokens?.placeables?.find(t => t.actor === target) ?? null;
    }

    // String ID or UUID
    if (typeof target === 'string') {
        const byId = canvas?.tokens?.get?.(target);
        if (byId) return byId;

        if (typeof fromUuidSync === 'function') {
            const doc = fromUuidSync(target);
            if (doc?.object) return doc.object;
            if (typeof doc?.getActiveTokens === 'function') {
                const active = doc.getActiveTokens();
                if (active && active.length > 0) return active[0];
            }
        }
    }

    return null;
}

/**
 * Normalize external polymorphic actor input into a concrete Actor document.
 * @param {*} target External input (Actor, Token, TokenDocument, ID string, UUID string)
 * @returns {Actor|null} Concrete Actor instance or null
 */
export function normalizeActor(target) {
    if (!target) return null;

    if (target instanceof globalThis.Actor || (target.system && !target.actor && typeof target.getRollData === 'function')) {
        return target;
    }

    if (target.actor instanceof globalThis.Actor || target.actor?.system) {
        return target.actor;
    }

    const token = normalizeToken(target);
    if (token?.actor) {
        return token.actor;
    }

    return null;
}

/**
 * Normalize external page input into a concrete positive integer.
 * @param {*} page Page input
 * @returns {number|null} Concrete page number or null
 */
export function normalizePage(page) {
    if (page === undefined || page === null) return null;
    const parsed = Number(page);
    if (!isNaN(parsed) && parsed > 0) {
        return Math.floor(parsed);
    }
    return null;
}

/**
 * Normalize external tab column input into a concrete TabColumnState contract.
 * @param {*} input Tab column specification (string, string[], or object)
 * @param {string} [defaultParent='all'] Default parent tab identifier
 * @returns {ConcreteTabColumnState|null}
 */
export function normalizeTabColumnState(input, defaultParent = 'all') {
    if (input === undefined || input === null) return null;

    if (typeof input === 'string') {
        const parent = input.trim();
        if (!parent || parent === defaultParent) {
            return {
                parents: [defaultParent],
                focusedParent: defaultParent,
                subTypes: []
            };
        }
        return {
            parents: [parent],
            focusedParent: parent,
            subTypes: []
        };
    }

    if (Array.isArray(input)) {
        const parents = input.map(p => String(p).trim()).filter(Boolean);
        if (parents.length === 0 || parents.includes(defaultParent)) {
            return {
                parents: [defaultParent],
                focusedParent: defaultParent,
                subTypes: []
            };
        }
        return {
            parents,
            focusedParent: parents[0] ?? defaultParent,
            subTypes: []
        };
    }

    if (typeof input === 'object') {
        const rawParents = input.parents ?? (input.parent ? [input.parent] : (input.id ? [input.id] : null));
        let parents = [defaultParent];

        if (rawParents !== null) {
            const arr = Array.isArray(rawParents) ? rawParents : (rawParents instanceof Set ? Array.from(rawParents) : [rawParents]);
            parents = arr.map(p => String(p).trim()).filter(Boolean);
            if (parents.length === 0) parents = [defaultParent];
        } else if (input.focusedParent) {
            parents = [String(input.focusedParent).trim()];
        }

        const focusedParent = input.focusedParent
            ? String(input.focusedParent).trim()
            : (parents.includes(defaultParent) ? defaultParent : (parents[0] ?? defaultParent));

        const rawSubs = input.subTypes ?? input.subType ?? input.subs;
        let subTypes = [];
        if (rawSubs !== undefined && rawSubs !== null) {
            const arr = Array.isArray(rawSubs) ? rawSubs : (rawSubs instanceof Set ? Array.from(rawSubs) : [rawSubs]);
            subTypes = arr.map(s => String(s).trim()).filter(Boolean);
        }

        return {
            parents,
            focusedParent,
            subTypes
        };
    }

    return null;
}

/**
 * Normalize external options into a concrete TabSelectionConfig.
 * @param {Object} options Options containing tabs, leftTabs, and/or rightTabs
 * @returns {ConcreteTabSelectionConfig}
 */
export function normalizeTabConfig(options = {}) {
    const rawTabs = options.tabs ?? {};
    const rawLeft = options.leftTabs ?? rawTabs.left;
    const rawRight = options.rightTabs ?? rawTabs.right;

    return {
        left: normalizeTabColumnState(rawLeft, 'all'),
        right: normalizeTabColumnState(rawRight, 'all')
    };
}
