import { log } from '../lib/logger.js';
import { actionDisplay } from '../action-display.js';

/**
 * @typedef {Object} SubCategory
 * @property {string} id Unique identifier for the subcategory
 * @property {string} name Display name
 * @property {string} expression Boolean test expression string
 */

/**
 * @typedef {Object} Category
 * @property {string} id Unique identifier for the category
 * @property {string} name Display name
 * @property {string} expression Boolean test expression string
 * @property {SubCategory[]} subcategories Array of child subcategories
 */

/**
 * @typedef {Object} CategorizationConfig
 * @property {boolean} enabled Canonical boolean flag indicating whether categorization is active
 * @property {Category[]} categories List of category definitions
 */

/**
 * Normalizes raw or partial categorization configuration into a strict contract object.
 *
 * @param {Object} [raw] Raw configuration object from settings or user input
 * @returns {CategorizationConfig} Strict normalized configuration
 */
export function normalizeCategorizationConfig(raw) {
    const isObject = raw && typeof raw === 'object';
    const enabled = Boolean(isObject ? raw.enabled : false);
    const rawCategories = Array.isArray(raw?.categories) ? raw.categories : [];

    const categories = rawCategories.map((cat, catIndex) => {
        const catId = typeof cat?.id === 'string' && cat.id.length > 0 ? cat.id : `cat_${Date.now()}_${catIndex}`;
        const name = typeof cat?.name === 'string' ? cat.name : '';
        const expression = typeof cat?.expression === 'string' ? cat.expression : '';
        const rawSubs = Array.isArray(cat?.subcategories) ? cat.subcategories : [];

        const subcategories = rawSubs.map((sub, subIndex) => {
            const subId = typeof sub?.id === 'string' && sub.id.length > 0 ? sub.id : `sub_${Date.now()}_${subIndex}`;
            const subName = typeof sub?.name === 'string' ? sub.name : '';
            const subExpr = typeof sub?.expression === 'string' ? sub.expression : '';
            return {
                id: subId,
                name: subName,
                expression: subExpr
            };
        });

        return {
            id: catId,
            name,
            expression,
            subcategories
        };
    });

    return {
        enabled,
        categories
    };
}

/**
 * Validate syntax of a boolean expression string.
 *
 * @param {string} expression JS boolean expression
 * @returns {{ valid: boolean, error: string|null }} Validation result
 */
export function validateExpression(expression) {
    if (!expression || typeof expression !== 'string' || !expression.trim()) {
        return { valid: false, error: 'Expression cannot be empty.' };
    }
    try {
        new Function(
            'action', 'item', 'actor', 'token',
            `"use strict"; return Boolean(${expression.trim()});`
        );
        return { valid: true, error: null };
    } catch (err) {
        return { valid: false, error: err.message ?? 'Syntax error' };
    }
}

/**
 * Safely evaluates a boolean expression string against an Action instance.
 *
 * @param {string} expression JS boolean expression
 * @param {Object} action The Action instance being evaluated
 * @param {Object} [context={}] Additional context such as actor or token documents
 * @returns {boolean} True if expression evaluates to truthy
 */
export function evaluateBooleanExpression(expression, action, context = {}) {
    if (!expression || typeof expression !== 'string') return false;
    const expr = expression.trim();
    if (!expr) return false;

    try {
        const item = action?.originalItem ?? action ?? {};
        const actor = context?.actor ?? action?.actor ?? item?.actor ?? actionDisplay?.activeApp?.actor ?? null;
        const token = context?.token ?? action?.token ?? actor?.token ?? actionDisplay?.activeApp?.token ?? null;

        const evaluator = new Function(
            'action', 'item', 'actor', 'token',
            `"use strict"; return Boolean(${expr});`
        );

        return Boolean(evaluator(action, item, actor, token));
    } catch (err) {
        log.error(`Failed to evaluate boolean expression: "${expression}"`, err);
        return false;
    }
}

/**
 * Partition a list of actions into categorized sections and sub-sections based on user configuration.
 *
 * @param {Object[]} actions Array of Action instances
 * @param {CategorizationConfig} config Categorization configuration object
 * @param {string} [catchAllLabel='Other Actions'] Localized name for the catch-all category for uncategorized actions
 * @param {Object} [context={}] Evaluation context containing actor and token documents
 * @returns {Object[]|null} List of categorized sections or null if categorization is disabled
 */
export function categorizeActions(actions, config, catchAllLabel, context = {}) {
    const normalizedConfig = normalizeCategorizationConfig(config);
    if (!normalizedConfig.enabled || normalizedConfig.categories.length === 0) {
        return null;
    }

    const othersLabel = (typeof catchAllLabel === 'string' && catchAllLabel.trim().length > 0)
        ? catchAllLabel.trim()
        : 'Other Actions';

    // Map each category to an internal bucket structure
    const categoryMap = new Map();
    for (const cat of normalizedConfig.categories) {
        const subMap = new Map();
        for (const sub of cat.subcategories) {
            subMap.set(sub.id, {
                subcategory: sub,
                items: []
            });
        }
        categoryMap.set(cat.id, {
            category: cat,
            directItems: [],
            subBuckets: subMap,
            othersItems: []
        });
    }

    const topLevelOthers = [];

    // Distribute each action into its matching category / subcategory
    for (const action of (actions ?? [])) {
        let matchedCategoryBucket = null;

        for (const [catId, bucket] of categoryMap.entries()) {
            if (evaluateBooleanExpression(bucket.category.expression, action, context)) {
                matchedCategoryBucket = bucket;
                break;
            }
        }

        if (matchedCategoryBucket) {
            const hasSubcategories = matchedCategoryBucket.category.subcategories.length > 0;
            if (hasSubcategories) {
                let matchedSubBucket = null;
                for (const [subId, subEntry] of matchedCategoryBucket.subBuckets.entries()) {
                    if (evaluateBooleanExpression(subEntry.subcategory.expression, action, context)) {
                        matchedSubBucket = subEntry;
                        break;
                    }
                }

                if (matchedSubBucket) {
                    matchedSubBucket.items.push(action);
                } else {
                    // Remainder at subcategory level
                    matchedCategoryBucket.othersItems.push(action);
                }
            } else {
                // No subcategories defined for this category
                matchedCategoryBucket.directItems.push(action);
            }
        } else {
            // Remainder at top level
            topLevelOthers.push(action);
        }
    }

    // Build the final output structure containing only non-empty sections and subsections
    const categorizedSections = [];

    for (const [catId, bucket] of categoryMap.entries()) {
        const totalItemsInCat = bucket.directItems.length
            + bucket.othersItems.length
            + Array.from(bucket.subBuckets.values()).reduce((sum, s) => sum + s.items.length, 0);

        if (totalItemsInCat === 0) continue;

        const subsections = [];
        for (const [subId, subEntry] of bucket.subBuckets.entries()) {
            if (subEntry.items.length > 0) {
                subsections.push({
                    name: subEntry.subcategory.name,
                    items: subEntry.items
                });
            }
        }

        if (bucket.othersItems.length > 0) {
            subsections.push({
                name: othersLabel,
                items: bucket.othersItems
            });
        }

        categorizedSections.push({
            name: bucket.category.name,
            items: bucket.directItems,
            subsections
        });
    }

    if (topLevelOthers.length > 0) {
        categorizedSections.push({
            name: othersLabel,
            items: topLevelOthers,
            subsections: []
        });
    }

    return categorizedSections;
}

/**
 * Returns default preset categories, delegating to the provided or active system adapter.
 *
 * @param {Object} [adapter] Optional system adapter instance
 * @returns {Category[]} Default category list
 */
export function getDefaultCategories(adapter = actionDisplay?.activeSystemAdapter) {
    if (typeof adapter?.getDefaultCategories === 'function') {
        return adapter.getDefaultCategories();
    }
    return [
        {
            id: 'cat_favorites',
            name: 'Favorites',
            expression: `Boolean(actor?.flags?.['bakana-action-display']?.favorites?.[item.id])`,
            subcategories: []
        },
        {
            id: 'cat_weapons',
            name: 'Weapons',
            expression: `item.type === 'weapon'`,
            subcategories: []
        },
        {
            id: 'cat_spells',
            name: 'Spells',
            expression: `item.type === 'spell'`,
            subcategories: []
        },
        {
            id: 'cat_features',
            name: 'Features',
            expression: `item.type === 'feat'`,
            subcategories: []
        }
    ];
}
