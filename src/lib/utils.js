/**
 * Helper to safely localize a key, falling back to a default string if the key is not found.
 * @param {string} key The translation key
 * @param {string} fallback The fallback string if the key is not found
 * @returns {string} The localized string or fallback
 */
export function localize(key, fallback) {
    return game.i18n?.has(key) ? game.i18n.localize(key) : fallback;
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
        if (val !== null && val !== undefined) {
            set.add(val);
        }
    }
    return set;
}
