/**
 * Structured tab reference node that automatically derives its root parent 
 * and hierarchy path array by walking up parent tree links.
 */
export class TabRef {
    /**
     * @param {Object} options
     * @param {string} options.id Tab identifier (e.g. 'action', 'evocation', 'vocal')
     * @param {string} [options.label] Display label (e.g. 'Action', 'Evocation', 'Vocal')
     * @param {TabRef|null} [options.parent=null] Parent TabRef node in the tree
     */
    constructor({ id, label = '', parent = null } = {}) {
        this.id = id;
        this.label = label;
        this.parent = parent;
    }

    /**
     * Top-level root parent ID (e.g., 'economy', 'spells', 'components').
     * Delegates up parent links recursively until reaching the root node.
     * @type {string}
     */
    get root() {
        return this.parent ? this.parent.root : this.id;
    }

    /**
     * Direct parent tab ID if one exists, otherwise the root parent ID.
     * @type {string}
     */
    get parentId() {
        return this.parent ? this.parent.id : this.id;
    }

    /**
     * Full path array from root down to this leaf node.
     * Delegates up parent links recursively and appends current node ID.
     * e.g. ['spells', 'level_1', 'evocation']
     * @type {string[]}
     */
    get path() {
        return this.parent ? [...this.parent.path, this.id] : [this.id];
    }

    /**
     * Support positional indexing fallback (tab[0], tab[1]) for legacy array compatibility.
     * @param {number} index 
     * @returns {string|undefined}
     */
    at(index) {
        return this.path[index];
    }

    /**
     * Custom JSON serialization (serializes to path array for clean JSON representations).
     * @returns {string[]}
     */
    toJSON() {
        return this.path;
    }
}
