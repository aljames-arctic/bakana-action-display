/**
 * Entry-boundary normalizers for external API inputs.
 * Validates and converts unverified inputs into strict concrete data contracts,
 * throwing informative errors when validation fails.
 */

/**
 * Normalize unverified token input into a concrete Token placeable object.
 * @param {UnverifiedTokenInput} [target] Token input
 * @returns {Token|null} Concrete Token instance or null if omitted
 * @throws {TypeError|Error} If target is provided but invalid or unresolvable
 */
export function normalizeToken(target) {
    if (target === undefined || target === null) return null;

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
        const canvasToken = canvas?.tokens?.placeables?.find(t => t.actor === target);
        if (canvasToken) return canvasToken;
        throw new Error(`Cannot resolve an active Token on canvas for Actor "${target.name ?? target.id ?? 'unknown'}".`);
    }

    // String ID or UUID
    if (typeof target === 'string') {
        const trimmed = target.trim();
        if (!trimmed) {
            throw new TypeError("Token identifier string cannot be empty.");
        }

        const byId = canvas?.tokens?.get?.(trimmed);
        if (byId) return byId;

        if (typeof fromUuidSync === 'function') {
            const doc = fromUuidSync(trimmed);
            if (doc?.object) return doc.object;
            if (typeof doc?.getActiveTokens === 'function') {
                const active = doc.getActiveTokens();
                if (active && active.length > 0) return active[0];
            }
        }

        throw new Error(`Cannot resolve Token from identifier "${trimmed}".`);
    }

    throw new TypeError("Invalid token target: expected a Token, TokenDocument, Actor, or token ID/UUID string.");
}

/**
 * Normalize unverified actor input into a concrete Actor document.
 * @param {UnverifiedActorInput} [target] Actor input
 * @returns {Actor|null} Concrete Actor instance or null if omitted
 * @throws {TypeError|Error} If target is provided but invalid or unresolvable
 */
export function normalizeActor(target) {
    if (target === undefined || target === null) return null;

    if (target instanceof globalThis.Actor || (target.system && !target.actor && typeof target.getRollData === 'function')) {
        return target;
    }

    if (target.actor instanceof globalThis.Actor || (target.actor?.system && typeof target.actor?.getRollData === 'function')) {
        return target.actor;
    }

    if (target.actor) {
        return target.actor;
    }

    const token = normalizeToken(target);
    if (token?.actor) {
        return token.actor;
    }

    throw new Error("Cannot resolve an Actor document from the provided target.");
}

/**
 * Normalize unverified page input into a concrete positive integer.
 * @param {UnverifiedPageInput} [page] Page input
 * @returns {number|null} Concrete positive integer or null if omitted
 * @throws {TypeError} If page is provided but is not a valid positive integer
 */
export function normalizePage(page) {
    if (page === undefined || page === null) return null;

    if (typeof page === 'number') {
        if (!Number.isInteger(page) || page < 1) {
            throw new TypeError(`Invalid page number ${page}: expected a positive integer.`);
        }
        return page;
    }

    if (typeof page === 'string') {
        const trimmed = page.trim();
        if (/^\d+$/.test(trimmed)) {
            const parsed = Number(trimmed);
            if (parsed > 0) return parsed;
        }
        throw new TypeError(`Invalid page number "${page}": expected a positive integer.`);
    }

    throw new TypeError(`Invalid page input type "${typeof page}": expected a positive integer.`);
}

/**
 * Normalize unverified tab column input into a concrete TabColumnState contract.
 * @param {UnverifiedTabColumnInput} [input] Tab column specification
 * @param {string} [defaultParent='all'] Default parent tab identifier
 * @returns {TabColumnState|null} Concrete TabColumnState or null if omitted
 * @throws {TypeError} If input is provided but invalid
 */
export function normalizeTabColumnState(input, defaultParent = 'all') {
    if (input === undefined || input === null) return null;

    if (typeof input === 'string') {
        const parent = input.trim();
        if (!parent) {
            throw new TypeError("Invalid tab input: tab identifier cannot be empty.");
        }
        if (parent === defaultParent) {
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
        if (input.length === 0) {
            throw new TypeError("Invalid tab input: tab array cannot be empty.");
        }

        const parents = [];
        for (const item of input) {
            if (typeof item !== 'string' || !item.trim()) {
                throw new TypeError(`Invalid tab array item "${item}": expected non-empty string identifier.`);
            }
            parents.push(item.trim());
        }

        if (parents.includes(defaultParent)) {
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
        const hasParentKey = input.parents !== undefined || input.parent !== undefined || input.id !== undefined || input.focusedParent !== undefined;
        const hasSubKey = input.subTypes !== undefined || input.subType !== undefined || input.subs !== undefined;

        if (!hasParentKey && !hasSubKey) {
            throw new TypeError("Invalid tab configuration object: must specify parent tab or sub-type identifiers.");
        }

        let parents = [defaultParent];
        const rawParents = input.parents ?? (input.parent !== undefined ? [input.parent] : (input.id !== undefined ? [input.id] : null));

        if (rawParents !== null) {
            const arr = Array.isArray(rawParents) ? rawParents : (rawParents instanceof Set ? Array.from(rawParents) : [rawParents]);
            parents = [];
            for (const item of arr) {
                if (typeof item !== 'string' || !item.trim()) {
                    throw new TypeError(`Invalid parent tab item "${item}": expected non-empty string identifier.`);
                }
                parents.push(item.trim());
            }
            if (parents.length === 0) parents = [defaultParent];
        } else if (input.focusedParent !== undefined) {
            if (typeof input.focusedParent !== 'string' || !input.focusedParent.trim()) {
                throw new TypeError("Invalid focusedParent: expected non-empty string identifier.");
            }
            parents = [input.focusedParent.trim()];
        }

        let focusedParent = defaultParent;
        if (input.focusedParent !== undefined) {
            if (typeof input.focusedParent !== 'string' || !input.focusedParent.trim()) {
                throw new TypeError("Invalid focusedParent: expected non-empty string identifier.");
            }
            focusedParent = input.focusedParent.trim();
        } else {
            focusedParent = parents.includes(defaultParent) ? defaultParent : (parents[0] ?? defaultParent);
        }

        const rawSubs = input.subTypes ?? input.subType ?? input.subs;
        let subTypes = [];
        if (rawSubs !== undefined && rawSubs !== null) {
            const arr = Array.isArray(rawSubs) ? rawSubs : (rawSubs instanceof Set ? Array.from(rawSubs) : [rawSubs]);
            for (const item of arr) {
                if (typeof item !== 'string' || !item.trim()) {
                    throw new TypeError(`Invalid sub-type item "${item}": expected non-empty string identifier.`);
                }
                subTypes.push(item.trim());
            }
        }

        return {
            parents,
            focusedParent,
            subTypes
        };
    }

    throw new TypeError(`Invalid tab column input type "${typeof input}": expected string, array of strings, or configuration object.`);
}

/**
 * Normalize unverified options into a concrete TabSelectionConfig.
 * @param {UnverifiedTabSelectionConfig} [options={}] Options containing tab column specifications
 * @returns {TabSelectionConfig}
 * @throws {TypeError} If options or any tab specifications are invalid
 */
export function normalizeTabConfig(options = {}) {
    if (options === undefined || options === null) {
        return { left: null, right: null };
    }

    if (typeof options !== 'object' || Array.isArray(options)) {
        throw new TypeError(`Invalid tab configuration type "${typeof options}": expected an options object.`);
    }

    const rawTabs = options.tabs ?? {};
    if (typeof rawTabs !== 'object' || Array.isArray(rawTabs)) {
        throw new TypeError("Invalid options.tabs: expected an object containing left/right column configurations.");
    }

    const rawLeft = options.leftTabs ?? rawTabs.left;
    const rawRight = options.rightTabs ?? rawTabs.right;

    return {
        left: normalizeTabColumnState(rawLeft, 'all'),
        right: normalizeTabColumnState(rawRight, 'all')
    };
}
