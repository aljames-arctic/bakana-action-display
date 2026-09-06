import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { localize, format, toSet, hasIntersection } from '../../src/lib/utils.js';

test('localize helper safely translates keys and respects fallbacks', () => {
    // 1. Empty or missing key
    assert.equal(localize(''), '');
    assert.equal(localize(null, 'default'), 'default');
    assert.equal(localize(undefined, 'fallback'), 'fallback');

    // 2. Key when game.i18n is available
    const origI18n = globalThis.game?.i18n;
    try {
        globalThis.game.i18n = {
            has(key) {
                return key === 'BAD.testKey';
            },
            localize(key) {
                return key === 'BAD.testKey' ? 'Localized Value' : key;
            }
        };

        assert.equal(localize('BAD.testKey'), 'Localized Value');
        assert.equal(localize('BAD.missingKey', 'Custom Fallback'), 'Custom Fallback');
        assert.equal(localize('BAD.missingKey'), 'BAD.missingKey');
    } finally {
        globalThis.game.i18n = origI18n;
    }

    // 3. When game.i18n is absent
    const savedI18n = globalThis.game.i18n;
    try {
        delete globalThis.game.i18n;
        assert.equal(localize('BAD.noI18nKey', 'Fallback Value'), 'Fallback Value');
        assert.equal(localize('BAD.noI18nKey'), 'BAD.noI18nKey');
    } finally {
        globalThis.game.i18n = savedI18n;
    }
});

test('format helper safely formats template strings with interpolation data', () => {
    // 1. Empty or missing key
    assert.equal(format(''), '');
    assert.equal(format(null, {}, 'default'), 'default');

    // 2. When game.i18n.format is available and has key
    const origI18n = globalThis.game?.i18n;
    try {
        globalThis.game.i18n = {
            has(key) {
                return key === 'BAD.formattedKey';
            },
            format(key, data) {
                if (key === 'BAD.formattedKey') {
                    return `Hello ${data.name}!`;
                }
                return key;
            },
            localize(key) {
                return key;
            }
        };

        assert.equal(format('BAD.formattedKey', { name: 'World' }), 'Hello World!');
    } finally {
        globalThis.game.i18n = origI18n;
    }

    // 3. Fallback variable substitution when key not found in i18n
    const origI18n2 = globalThis.game?.i18n;
    try {
        globalThis.game.i18n = {
            has() { return false; },
            localize(key) { return key; },
            format(key) { return key; }
        };

        const result = format('Hello {user}, you have {count} items.', { user: 'Alice', count: 5 }, 'Hello {user}, you have {count} items.');
        assert.equal(result, 'Hello Alice, you have 5 items.');
    } finally {
        globalThis.game.i18n = origI18n2;
    }
});

test('toSet converts iterables and sets with optional mapping', () => {
    assert.deepEqual(Array.from(toSet(null)), []);
    assert.deepEqual(Array.from(toSet(undefined)), []);
    assert.deepEqual(Array.from(toSet([1, 2, 2, 3])), [1, 2, 3]);

    const existingSet = new Set(['a', 'b']);
    assert.equal(toSet(existingSet), existingSet);

    // With mapper
    const mapped = toSet([{ id: 'x' }, { id: 'y' }, { id: null }], item => item.id);
    assert.deepEqual(Array.from(mapped), ['x', 'y']);
});

test('hasIntersection checks for common elements efficiently', () => {
    assert.equal(hasIntersection(null, new Set([1])), false);
    assert.equal(hasIntersection(new Set([1]), null), false);
    assert.equal(hasIntersection(new Set([1, 2]), new Set([2, 3])), true);
    assert.equal(hasIntersection(new Set([1, 2]), new Set([3, 4])), false);
    assert.equal(hasIntersection([1, 2], new Set([2])), true);
});
