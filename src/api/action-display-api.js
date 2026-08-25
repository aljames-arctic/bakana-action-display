import { ActionDisplayApp } from '../ui/action-display-app.js';
import { log } from '../lib/logger.js';
import {
    normalizeToken,
    normalizeActor,
    normalizePage,
    normalizeTabConfig
} from './api-normalizer.js';

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
     * Resolve a token from external polymorphic input.
     * @param {UnverifiedTokenInput} target The target token, document, actor, ID, or UUID
     * @returns {Token|null} Concrete Token instance or null
     */
    resolveToken(target) {
        return normalizeToken(target);
    }

    /**
     * Resolve an actor from external polymorphic input.
     * @param {UnverifiedActorInput} target The target actor, token, document, ID, or UUID
     * @returns {Actor|null} Concrete Actor instance or null
     */
    resolveActor(target) {
        return normalizeActor(target);
    }

    /**
     * Open Bakana's Action Display for a specific token, optionally navigating to a specific page and selecting tabs.
     *
     * Supported calling signatures:
     * - `api.open(token, { page: 2, tabs: { left: 'spells', right: 'bonus' } })`
     * - `api.open({ token, page: 2, tabs: { left: 'spells' } })`
     * - `api.open(token, { page: 2, leftTabs: 'spells', rightTabs: 'bonus' })`
     *
     * @param {UnverifiedTokenInput|UnverifiedOpenOptions} tokenOrOptions Token instance/identifier or options object
     * @param {UnverifiedOpenOptions} [options={}] Additional configuration options
     * @returns {Promise<ActionDisplayApp|null>} The opened ActionDisplayApp instance
     */
    async open(tokenOrOptions, options = {}) {
        let rawToken = tokenOrOptions;
        let rawConfig = options;

        if (tokenOrOptions && typeof tokenOrOptions === 'object' && !tokenOrOptions.actor && !tokenOrOptions.document && typeof tokenOrOptions.getActiveTokens !== 'function' && !(tokenOrOptions instanceof Set) && (tokenOrOptions.token !== undefined || tokenOrOptions.page !== undefined || tokenOrOptions.tabs !== undefined || tokenOrOptions.leftTabs !== undefined || tokenOrOptions.rightTabs !== undefined)) {
            rawConfig = tokenOrOptions;
            rawToken = rawConfig.token;
        }

        const resolvedToken = normalizeToken(rawToken);
        const token = resolvedToken
            ?? canvas?.tokens?.controlled?.[0]
            ?? (typeof game.user?.character?.getActiveTokens === 'function' ? game.user.character.getActiveTokens()[0] : null)
            ?? this._actionDisplay?.activeApp?.token
            ?? null;

        if (!token) {
            log.warn("Cannot open Action Display: no valid token could be resolved.");
            return null;
        }

        const targetPage = normalizePage(rawConfig.page);
        const tabConfig = normalizeTabConfig(rawConfig);

        let app = this._actionDisplay.activeApp;
        const isSameToken = Boolean(app && (app.token === token || app.token?.id === token.id));

        if (!app || !isSameToken || Boolean(rawConfig.force)) {
            if (app) {
                if (app.element) app.element.style.display = 'none';
                await app.close();
                this._actionDisplay.activeApp = null;
            }
            app = new ActionDisplayApp(token);
            this._actionDisplay.activeApp = app;
        }

        if (targetPage !== null) {
            app.activePage = targetPage;
        }

        if (tabConfig.left || tabConfig.right) {
            app.setTabs(tabConfig, app.activePage);
        }

        if (rawConfig.render !== false) {
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
     * @param {UnverifiedTokenInput|UnverifiedOpenOptions} [tokenOrOptions] Target token or options
     * @param {UnverifiedOpenOptions} [options] Options passed to open() if toggling open
     * @returns {Promise<boolean>} True if opened, false if closed
     */
    async toggle(tokenOrOptions, options = {}) {
        if (this.isOpen()) {
            const currentToken = this._actionDisplay.activeApp?.token;
            const targetToken = tokenOrOptions ? normalizeToken(tokenOrOptions?.token ?? tokenOrOptions) : null;
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
     * @param {UnverifiedPageInput} page Page number
     * @returns {Promise<ActionDisplayApp|null>}
     */
    async setPage(page) {
        const app = this._actionDisplay?.activeApp;
        if (!app) return null;
        const pageNum = normalizePage(page);
        if (pageNum !== null) {
            app.activePage = pageNum;
            await app.render(false);
        }
        return app;
    }

    /**
     * Set tab selections on the currently open HUD.
     * @param {UnverifiedTabSelectionConfig|Object} rawTabs Tab configuration for left and/or right columns
     * @param {UnverifiedPageInput} [page] Optional page to configure (defaults to activePage)
     * @returns {Promise<ActionDisplayApp|null>}
     */
    async setTabs(rawTabs, page) {
        const app = this._actionDisplay?.activeApp;
        if (!app) return null;
        const tabConfig = normalizeTabConfig({ tabs: rawTabs });
        const targetPage = normalizePage(page) ?? app.activePage;
        app.setTabs(tabConfig, targetPage);
        await app.render(false);
        return app;
    }

    /**
     * Get processed actions for a given actor or token via the unified adapter pipeline.
     * @param {UnverifiedActorInput} actorOrToken
     * @returns {Promise<Action[]>}
     */
    async getActions(actorOrToken) {
        const actor = normalizeActor(actorOrToken);
        if (!actor) return [];
        return this._actionDisplay?.getActions(actor) ?? [];
    }
}
