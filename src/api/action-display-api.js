import { ActionDisplayApp } from '../ui/action-display-app.js';
import { log } from '../lib/logger.js';

/**
 * Official Public API for Bakana's Action Display.
 * Enables external modules and macros to programmatically open, close, and configure the HUD.
 */
export class ActionDisplayAPI {
    /**
     * @param {ActionDisplay} actionDisplay Coordinator singleton instance
     */
    constructor(actionDisplay) {
        this._actionDisplay = actionDisplay;
    }

    /**
     * Active HUD application instance, or null if closed.
     * @type {ActionDisplayApp|null}
     */
    get activeApp() {
        return this._actionDisplay?.activeApp ?? null;
    }

    /**
     * Check if the HUD is currently open/rendered.
     * @returns {boolean}
     */
    isOpen() {
        return Boolean(this._actionDisplay?.activeApp?.rendered);
    }

    /**
     * Resolve a token from various polymorphic input types.
     * Normalizes Token, TokenDocument, Actor, token ID string, or token UUID string into a concrete Token object.
     * @param {*} target The target token, document, actor, ID, or UUID
     * @returns {Token|null}
     */
    resolveToken(target) {
        if (!target) return null;

        // Concrete Token placeable object
        if (target.actor && target.document) {
            return target;
        }

        // TokenDocument
        if (target.object && target.actor) {
            return target.object;
        }

        // Actor
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
     * Open Bakana's Action Display for a specific token, optionally navigating to a specific page and selecting tabs.
     *
     * Supported calling signatures:
     * - `api.open(token, { page: 2, tabs: { left: 'spells', right: 'bonus' } })`
     * - `api.open({ token, page: 2, tabs: { left: 'spells' } })`
     * - `api.open(token, { page: 2, leftTabs: 'spells', rightTabs: 'bonus' })`
     *
     * @param {Token|TokenDocument|Actor|string|Object} tokenOrOptions Token instance/identifier or full options object
     * @param {Object} [options={}] Additional configuration options
     * @param {Token|TokenDocument|Actor|string} [options.token] Target token if not passed as first argument
     * @param {number} [options.page] Page number to open to (e.g. 1, 2, 3)
     * @param {Object} [options.tabs] Tab selections for left and/or right columns
     * @param {string|string[]|Object} [options.tabs.left] Left column tab selection
     * @param {string|string[]|Object} [options.tabs.right] Right column tab selection
     * @param {string|string[]|Object} [options.leftTabs] Shortcut for options.tabs.left
     * @param {string|string[]|Object} [options.rightTabs] Shortcut for options.tabs.right
     * @param {boolean} [options.render=true] Whether to render the application
     * @param {boolean} [options.force=false] Force creating a new HUD application instance
     * @returns {Promise<ActionDisplayApp|null>} The opened ActionDisplayApp instance
     */
    async open(tokenOrOptions, options = {}) {
        let rawToken = tokenOrOptions;
        let config = options;

        if (tokenOrOptions && typeof tokenOrOptions === 'object' && !tokenOrOptions.actor && !tokenOrOptions.document && typeof tokenOrOptions.getActiveTokens !== 'function' && !(tokenOrOptions instanceof Set) && (tokenOrOptions.token !== undefined || tokenOrOptions.page !== undefined || tokenOrOptions.tabs !== undefined || tokenOrOptions.leftTabs !== undefined || tokenOrOptions.rightTabs !== undefined)) {
            config = tokenOrOptions;
            rawToken = config.token;
        }

        const resolvedToken = this.resolveToken(rawToken);
        const token = resolvedToken
            ?? canvas?.tokens?.controlled?.[0]
            ?? (typeof game.user?.character?.getActiveTokens === 'function' ? game.user.character.getActiveTokens()[0] : null)
            ?? this._actionDisplay?.activeApp?.token
            ?? null;

        if (!token) {
            log.warn("Cannot open Action Display: no valid token could be resolved.");
            return null;
        }

        const targetPage = config.page !== undefined ? Number(config.page) : null;
        const tabConfig = { ...(config.tabs ?? {}) };
        if (config.leftTabs !== undefined) tabConfig.left = config.leftTabs;
        if (config.rightTabs !== undefined) tabConfig.right = config.rightTabs;

        let app = this._actionDisplay.activeApp;
        const isSameToken = Boolean(app && (app.token === token || app.token?.id === token.id));

        if (!app || !isSameToken || config.force) {
            if (app) {
                if (app.element) app.element.style.display = 'none';
                await app.close();
                this._actionDisplay.activeApp = null;
            }
            app = new ActionDisplayApp(token);
            this._actionDisplay.activeApp = app;
        }

        if (targetPage !== null && !isNaN(targetPage) && targetPage > 0) {
            app.activePage = targetPage;
        }

        if (tabConfig.left !== undefined || tabConfig.right !== undefined) {
            app.setTabs(tabConfig, app.activePage);
        }

        if (config.render !== false) {
            await app.render(true);
            app.bringToFront?.();
        }

        return app;
    }

    /**
     * Close the currently open Action Display HUD.
     * @returns {Promise<void>}
     */
    async close() {
        const app = this._actionDisplay?.activeApp;
        if (app) {
            if (app.element) app.element.style.display = 'none';
            await app.close();
            this._actionDisplay.activeApp = null;
        }
    }

    /**
     * Toggle the HUD for a specific token or the active/controlled token.
     * @param {Token|TokenDocument|Actor|string|Object} [tokenOrOptions] Target token or options
     * @param {Object} [options] Options passed to open() if toggling open
     * @returns {Promise<boolean>} True if opened, false if closed
     */
    async toggle(tokenOrOptions, options = {}) {
        if (this.isOpen()) {
            const currentToken = this._actionDisplay.activeApp?.token;
            const targetToken = tokenOrOptions ? this.resolveToken(tokenOrOptions?.token ?? tokenOrOptions) : null;
            if (!targetToken || targetToken === currentToken || targetToken.id === currentToken?.id) {
                await this.close();
                return false;
            }
        }
        const app = await this.open(tokenOrOptions, options);
        return Boolean(app);
    }

    /**
     * Set the active page on the currently open HUD.
     * @param {number} page Page number
     * @returns {Promise<ActionDisplayApp|null>}
     */
    async setPage(page) {
        const app = this._actionDisplay?.activeApp;
        if (!app) return null;
        const pageNum = Number(page);
        if (!isNaN(pageNum) && pageNum > 0) {
            app.activePage = pageNum;
            await app.render(false);
        }
        return app;
    }

    /**
     * Set tab selections on the currently open HUD.
     * @param {Object} tabConfig Tab configuration for left and/or right columns
     * @param {number} [page] Optional page to configure (defaults to activePage)
     * @returns {Promise<ActionDisplayApp|null>}
     */
    async setTabs(tabConfig, page) {
        const app = this._actionDisplay?.activeApp;
        if (!app) return null;
        app.setTabs(tabConfig, page ?? app.activePage);
        await app.render(false);
        return app;
    }

    /**
     * Get processed actions for a given actor or token via the unified adapter pipeline.
     * @param {Actor|Token|TokenDocument|string} actorOrToken
     * @returns {Promise<Action[]>}
     */
    async getActions(actorOrToken) {
        if (!actorOrToken) return [];
        let actor = actorOrToken;
        if (actorOrToken.actor) {
            actor = actorOrToken.actor;
        } else {
            const token = this.resolveToken(actorOrToken);
            if (token?.actor) actor = token.actor;
        }
        return this._actionDisplay?.getActions(actor) ?? [];
    }
}
