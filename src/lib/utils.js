/**
 * Helper to safely localize a key, falling back to a default string if the key is not found.
 * @param {string} key The translation key
 * @param {string} fallback The fallback string if the key is not found
 * @returns {string} The localized string or fallback
 */
export function localize(key, fallback) {
    if (!game.i18n) return fallback;
    if (game.i18n.has?.(key)) {
        return game.i18n.localize(key) ?? fallback;
    }
    const val = game.i18n.localize?.(key);
    return (val && val !== key) ? val : fallback;
}

/**
 * Safely convert an array, iterable, or existing Set into a Set.
 * Optionally transforms elements via `mapFn` without creating intermediate array allocations.
 * @param {Iterable|Set|null|undefined} input
 * @param {Function|null} [mapFn=null] Optional mapper callback (element => value)
 * @returns {Set}
 */
export function toSet(input, mapFn = null) {
    if (!input) return new Set();
    if (!mapFn) {
        return input instanceof Set ? input : new Set(input);
    }
    const set = new Set();
    for (const item of input) {
        const val = mapFn(item);
        if (val != null) {
            set.add(val);
        }
    }
    return set;
}

/**
 * Efficiently determine if two Sets (or iterables) share at least one common element.
 * Iterates through the smaller set when both are Sets.
 * @param {Set|Iterable|null|undefined} setA
 * @param {Set|Iterable|null|undefined} setB
 * @returns {boolean}
 */
export function hasIntersection(setA, setB) {
    if (!setA || !setB) return false;
    if (setA instanceof Set && setB instanceof Set) {
        const [smaller, larger] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
        for (const elem of smaller) {
            if (larger.has(elem)) return true;
        }
        return false;
    }
    for (const elem of setA) {
        if (setB.has?.(elem)) return true;
    }
    return false;
}
