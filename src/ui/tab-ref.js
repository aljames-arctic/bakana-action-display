/**
 * Structured tab reference node that pre-computes and caches its root parent ID
 * and hierarchy path string at construction.
 */
export class TabRef {
    /**
     * @param {Object} options
     * @param {string} options.label Tab identifier/label (e.g. 'action', 'evocation', 'vocal')
     * @param {TabRef|null} [options.parent=null] Parent TabRef node in the tree
     */
    constructor({ label, parent = null } = {}) {
        this.label = label;
        this.parent = parent;

        // Pre-compute and cache root ID and path string for O(1) high-performance lookups
        this.root = parent ? parent.root : label;
        this.path = parent ? `${parent.path}/${label}` : label;
    }

    /**
     * Helper to create a nested parent/child TabRef node.
     * @param {string} rootLabel Root tab label (e.g. 'economy', 'components')
     * @param {string} [subLabel] Sub tab label (e.g. 'action', 'vocal')
     * @returns {TabRef}
     */
    static from(rootLabel, subLabel) {
        if (!subLabel || subLabel === 'none') {
            return new TabRef({ label: rootLabel });
        }
        const parent = new TabRef({ label: rootLabel });
        return new TabRef({ label: subLabel, parent });
    }
}
