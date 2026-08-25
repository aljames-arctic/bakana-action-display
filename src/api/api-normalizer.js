/**
 * Entry-boundary normalizers for external API inputs.
 * Validates and converts unverified inputs into strict concrete data contracts.
 */

/**
 * @typedef {Object} TabColumnState
 * @property {string[]} parents Active parent tab IDs
 * @property {string} focusedParent Focused parent tab ID
 * @property {string[]} subTypes Active sub-type IDs
 */

/**
 * @typedef {Object} TabSelectionConfig
 * @property {TabColumnState|null} left Left column state contract
 * @property {TabColumnState|null} right Right column state contract
 */

/**
 * @typedef {Token|TokenDocument|Actor|string} UnverifiedTokenInput
 */

/**
 * @typedef {Actor|Token|TokenDocument|string} UnverifiedActorInput
 */

/**
 * @typedef {number|string} UnverifiedPageInput
 */

/**
 * @typedef {string|string[]|Object} UnverifiedTabColumnInput
 */

/**
 * @typedef {Object} UnverifiedTabSelectionConfig
 * @property {Object} [tabs] Tab selections for left and right columns
 * @property {UnverifiedTabColumnInput} [tabs.left]
 * @property {UnverifiedTabColumnInput} [tabs.right]
 * @property {UnverifiedTabColumnInput} [leftTabs] Shortcut for tabs.left
 * @property {UnverifiedTabColumnInput} [rightTabs] Shortcut for tabs.right
 */

/**
 * @typedef {Object} UnverifiedOpenOptions
 * @property {UnverifiedTokenInput} [token] Target token if not passed as first argument
 * @property {UnverifiedPageInput} [page] Target page number
 * @property {Object} [tabs] Tab selections
 * @property {UnverifiedTabColumnInput} [tabs.left] Left column tab selection
 * @property {UnverifiedTabColumnInput} [tabs.right] Right column tab selection
 * @property {UnverifiedTabColumnInput} [leftTabs] Shortcut for tabs.left
 * @property {UnverifiedTabColumnInput} [rightTabs] Shortcut for tabs.right
 * @property {boolean} [render] Whether to render the application
 * @property {boolean} [force] Force creating a new application instance
 */

/**
 * Normalize unverified token input into a concrete Token placeable object.
 * @param {UnverifiedTokenInput} [target] Token input
 * @returns {Token|null}
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
 * Normalize unverified actor input into a concrete Actor document.
 * @param {UnverifiedActorInput} [target] Actor input
 * @returns {Actor|null}
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
 * Normalize unverified page input into a concrete positive integer.
 * @param {UnverifiedPageInput} [page] Page input
 * @returns {number|null}
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
 * Normalize unverified tab column input into a concrete TabColumnState contract.
 * @param {UnverifiedTabColumnInput} [input] Tab column specification
 * @param {string} [defaultParent='all'] Default parent tab identifier
 * @returns {TabColumnState|null}
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
 * Normalize unverified options into a concrete TabSelectionConfig.
 * @param {UnverifiedTabSelectionConfig} [options={}] Options containing tab column specifications
 * @returns {TabSelectionConfig}
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
