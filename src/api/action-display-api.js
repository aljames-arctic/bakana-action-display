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
     * Resolve a token from external input.
     * @param {UnverifiedTokenInput} target The target token, document, actor, ID, or UUID
     * @returns {Token|null} Concrete Token instance or null if target was omitted
     * @throws {TypeError|Error} If target is provided but invalid or unresolvable
     */
    resolveToken(target) {
        return normalizeToken(target);
    }

    /**
     * Resolve an actor from external input.
     * @param {UnverifiedActorInput} target The target actor, token, document, ID, or UUID
     * @returns {Actor|null} Concrete Actor instance or null if target was omitted
     * @throws {TypeError|Error} If target is provided but invalid or unresolvable
     */
    resolveActor(target) {
        return normalizeActor(target);
    }

    /**
     * Open Bakana's Action Display for a specific token, optionally navigating to a specific page and selecting tabs.
     * Supports single tab, multi-tab selection (arrays), and sub-type filtering.
     *
     * Supported calling signatures & examples:
     * - Single tab: `api.open(token, { page: 2, tabs: { left: 'spells', right: 'bonus' } })`
     * - Multi-tab selection: `api.open(token, { page: 1, tabs: { left: ['weapons', 'spells'], right: ['actions', 'bonus'] } })`
     * - Multi-tab via shortcuts: `api.open(token, { leftTabs: ['actions', 'bonus'], rightTabs: ['reactions', 'free'] })`
     * - Multi-tab with sub-types: `api.open(token, { tabs: { left: { parents: ['spells', 'features'], focusedParent: 'spells', subTypes: ['level-1', 'level-2'] } } })`
     * - Options object only: `api.open({ token, page: 2, tabs: { left: ['spells', 'features'] } })`
     *
     * @param {UnverifiedTokenInput|UnverifiedOpenOptions} [tokenOrOptions] Token instance/identifier or options object
     * @param {UnverifiedOpenOptions} [options={}] Additional configuration options
     * @returns {Promise<ActionDisplayApp>} The opened ActionDisplayApp instance
     * @throws {TypeError|Error} If token cannot be resolved, or page/tabs configuration is invalid
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
            throw new Error("Cannot open Action Display: no token provided and no controlled or character token is active on canvas.");
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
     * @throws {TypeError|Error} If token cannot be resolved, or page/tabs configuration is invalid
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
     * @param {UnverifiedPageInput} page Positive integer page number
     * @returns {Promise<ActionDisplayApp>}
     * @throws {TypeError|Error} If HUD is not open or page number is invalid
     */
    async setPage(page) {
        if (page === undefined || page === null) {
            throw new TypeError("Page number is required.");
        }
        const app = this._actionDisplay?.activeApp;
        if (!app) {
            throw new Error("Cannot set page: Action Display HUD is not open.");
        }
        const pageNum = normalizePage(page);
        app.activePage = pageNum;
        await app.render(false);
        return app;
    }

    /**
     * Set tab selections on the currently open HUD.
     * @param {UnverifiedTabSelectionConfig|Object} rawTabs Tab configuration for left and/or right columns
     * @param {UnverifiedPageInput} [page] Optional page to configure (defaults to activePage)
     * @returns {Promise<ActionDisplayApp>}
     * @throws {TypeError|Error} If HUD is not open or tab configuration is invalid
     */
    async setTabs(rawTabs, page) {
        if (rawTabs === undefined || rawTabs === null) {
            throw new TypeError("Tab configuration is required.");
        }
        const app = this._actionDisplay?.activeApp;
        if (!app) {
            throw new Error("Cannot set tabs: Action Display HUD is not open.");
        }
        const tabConfig = normalizeTabConfig({ tabs: rawTabs });
        const targetPage = page !== undefined ? normalizePage(page) : app.activePage;
        app.setTabs(tabConfig, targetPage);
        await app.render(false);
        return app;
    }

    /**
     * Get processed actions for a given actor or token via the unified adapter pipeline.
     * @param {UnverifiedActorInput} actorOrToken
     * @returns {Promise<Action[]>}
     * @throws {TypeError|Error} If actorOrToken is missing or unresolvable
     */
    async getActions(actorOrToken) {
        if (actorOrToken === undefined || actorOrToken === null) {
            throw new TypeError("Actor or token target is required.");
        }
        const actor = normalizeActor(actorOrToken);
        return this._actionDisplay?.getActions(actor) ?? [];
    }
}
