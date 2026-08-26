/**
 * User permission tiers for ownership priority evaluation.
 * Tier 1: Players (least permissions)
 * Tier 2: Trusted Players
 * Tier 3: GM / Co-GM (most permissions)
 * @type {Readonly<{ PLAYER: 1, TRUSTED: 2, GM: 3 }>}
 */
export const USER_PERMISSION_TIERS = Object.freeze({
    PLAYER: 1,
    TRUSTED: 2,
    GM: 3
});

/**
 * Baseline Foundry VTT platform adapter.
 * Abstract interface for versioned Foundry Application, ContextMenu, interaction, and utility operations.
 */
export class BaseFoundryAdapter {
    /**
     * The major generation version of Foundry VTT (e.g. 12, 13, 14).
     * @returns {number}
     */
    get generation() {
        return game.release.generation;
    }

    /**
     * The active ContextMenu constructor (global in v12/v13 baseline).
     */
    get ContextMenu() {
        return ContextMenu;
    }

    /**
     * The active KeyboardManager constructor (global in v12/v13 baseline).
     */
    get KeyboardManager() {
        return KeyboardManager;
    }

    /**
     * The active Token placeable constructor (global in v12/v13 baseline).
     */
    get Token() {
        return Token;
    }

    /**
     * The active ApplicationV2 constructor (introduced in v12 under foundry.applications.api).
     */
    get ApplicationV2() {
        return foundry.applications.api.ApplicationV2;
    }

    /**
     * The active HandlebarsApplicationMixin wrapper (introduced in v12 under foundry.applications.api).
     */
    get HandlebarsApplicationMixin() {
        return foundry.applications.api.HandlebarsApplicationMixin;
    }

    /**
     * The active FilePicker constructor / implementation (global in v12/v13 baseline).
     */
    get FilePicker() {
        return FilePicker.implementation ?? FilePicker;
    }

    /**
     * Browse a directory using the active FilePicker implementation.
     * @param {string} source Storage source (e.g. 'data', 'public', 'client')
     * @param {string} target Directory target path
     * @param {Object} [options={}] Browse options
     * @returns {Promise<{ target: string, files: string[], dirs: string[] }>}
     */
    async browseDirectory(source, target, options = {}) {
        return this.FilePicker.browse(source, target, options);
    }

    /**
     * Safely resolve a document from UUID synchronously.
     * @param {string} uuid Document UUID
     * @param {Object} [options={}] Resolution options
     * @returns {Document|null}
     */
    fromUuidSync(uuid, options = {}) {
        if (!uuid) return null;
        try {
            return foundry.utils.fromUuidSync(uuid, options) ?? null;
        } catch (_) {
            return null;
        }
    }

    /**
     * Safely resolve a document from UUID asynchronously.
     * @param {string} uuid Document UUID
     * @param {Object} [options={}] Resolution options
     * @returns {Promise<Document|null>}
     */
    async fromUuid(uuid, options = {}) {
        if (!uuid) return null;
        try {
            return (await foundry.utils.fromUuid(uuid, options)) ?? null;
        } catch (_) {
            return null;
        }
    }

    /**
     * Merge two objects recursively.
     * @param {Object} original Target object
     * @param {Object} [other={}] Source object
     * @param {Object} [options={}] Merge options
     * @returns {Object}
     */
    mergeObject(original, other = {}, options = {}) {
        return foundry.utils.mergeObject(original, other, options);
    }

    /**
     * Deep duplicate an object.
     * @param {Object} obj Target object
     * @returns {Object}
     */
    duplicate(obj) {
        return foundry.utils.duplicate(obj);
    }

    /**
     * Retrieve a property from an object by dot-separated path.
     * @param {Object} obj Target object
     * @param {string} path Dot path
     * @returns {*}
     */
    getProperty(obj, path) {
        return foundry.utils.getProperty(obj, path);
    }

    /**
     * Set a property on an object by dot-separated path.
     * @param {Object} obj Target object
     * @param {string} path Dot path
     * @param {*} value Property value
     * @returns {boolean}
     */
    setProperty(obj, path, value) {
        return foundry.utils.setProperty(obj, path, value);
    }

    /**
     * Generate a random string identifier.
     * @param {number} [length=16] Length of the identifier
     * @returns {string}
     */
    randomID(length = 16) {
        return foundry.utils.randomID(length);
    }

    /**
     * Test whether an object is empty.
     * @param {Object} obj Target object
     * @returns {boolean}
     */
    isEmpty(obj) {
        return foundry.utils.isEmpty(obj);
    }

    /**
     * Test whether version a is strictly newer than version b.
     * @param {string} a Primary version string
     * @param {string} b Target version string to compare against
     * @returns {boolean}
     */
    isNewerVersion(a, b) {
        return foundry.utils.isNewerVersion(a, b);
    }

    /**
     * The active TextEditor constructor / implementation (global in v12/v13 baseline).
     */
    get TextEditor() {
        return TextEditor.implementation ?? TextEditor;
    }

    /**
     * Enrich an HTML string with Foundry enrichers, roll data, and document links.
     * @param {string} content HTML string to enrich
     * @param {Object} [options={}] Enrichment options (rollData, secrets, relativeTo, etc.)
     * @returns {Promise<string>}
     */
    async enrichHTML(content, options = {}) {
        if (!content) return '';
        return this.TextEditor.enrichHTML(content, { secrets: false, async: true, ...options });
    }

    /**
     * Retrieve all combatants associated with a token in combat for baseline v12/v13.
     * @param {Combat} combat Target combat encounter
     * @param {string|TokenDocument|Token} token Token ID or Document or Placeable
     * @returns {Combatant[]}
     */
    getCombatantsByToken(combat, token) {
        if (!combat) return [];
        const tokenId = typeof token === 'string' ? token : (token?.id ?? token?.document?.id);
        if (!tokenId) return [];

        const single = combat.getCombatantByToken?.(tokenId);
        return single ? [single] : [];
    }

    /**
     * Retrieve the primary combatant associated with a token in combat for baseline v12/v13.
     * @param {Combat} combat Target combat encounter
     * @param {string|TokenDocument|Token} token Token ID or Document or Placeable
     * @returns {Combatant|null}
     */
    getCombatantByToken(combat, token) {
        if (!combat) return null;
        const tokenId = typeof token === 'string' ? token : (token?.id ?? token?.document?.id);
        if (!tokenId) return null;

        return combat.getCombatantByToken?.(tokenId) ?? null;
    }

    /**
     * User permission tiers for ownership priority evaluation.
     * @type {Readonly<{ PLAYER: 1, TRUSTED: 2, GM: 3 }>}
     */
    get USER_PERMISSION_TIERS() {
        return USER_PERMISSION_TIERS;
    }

    /**
     * Classify a Foundry User into a standard permission tier (1: Player, 2: Trusted Player, 3: GM / Co-GM).
     * @param {User} user Concrete User document
     * @returns {number|null} 1 for Player, 2 for Trusted, 3 for GM, or null if invalid/none
     */
    getUserPermissionTier(user) {
        if (!user) return null;
        const isGM = Boolean(user.isGM);
        const userRole = user.role ?? null;
        const assistantRole = CONST?.USER_ROLES?.ASSISTANT ?? 3;
        const trustedRole = CONST?.USER_ROLES?.TRUSTED ?? 2;
        const playerRole = CONST?.USER_ROLES?.PLAYER ?? 1;

        if (isGM || (userRole !== null && userRole >= assistantRole)) {
            return USER_PERMISSION_TIERS.GM;
        }
        if ((userRole !== null && userRole === trustedRole) || (Boolean(user.isTrusted) && !isGM)) {
            return USER_PERMISSION_TIERS.TRUSTED;
        }
        if ((userRole !== null && userRole === playerRole) || (!isGM && !user.isTrusted && userRole !== 0)) {
            return USER_PERMISSION_TIERS.PLAYER;
        }
        return null;
    }

    /**
     * Test whether a user possesses an ownership role for a given actor and token document.
     * @param {User} user Concrete User document
     * @param {Actor|null} actor Concrete Actor document
     * @param {Document|null} tokenDoc Concrete TokenDocument
     * @returns {boolean} True if the user has an ownership role
     */
    isUserDocumentOwner(user, actor, tokenDoc) {
        if (!user) return false;

        // GM / Co-GM always has ownership over all documents in Foundry
        if (this.getUserPermissionTier(user) === USER_PERMISSION_TIERS.GM) {
            return true;
        }

        const ownerLevel = CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;

        // Test actor document permissions
        if (actor) {
            if (actor.testUserPermission?.(user, 'OWNER')) return true;
            if (actor.getUserLevel?.(user) >= ownerLevel) return true;
            if (actor.ownership) {
                const level = actor.ownership[user.id] ?? actor.ownership.default ?? 0;
                if (level >= ownerLevel) return true;
            }
            if ((user.id === game.user?.id || user === game.user) && Boolean(actor.isOwner)) {
                return true;
            }
        }

        // Test token document permissions
        if (tokenDoc) {
            if (tokenDoc.testUserPermission?.(user, 'OWNER')) return true;
            if (tokenDoc.getUserLevel?.(user) >= ownerLevel) return true;
            if (tokenDoc.ownership) {
                const level = tokenDoc.ownership[user.id] ?? tokenDoc.ownership.default ?? 0;
                if (level >= ownerLevel) return true;
            }
            if ((user.id === game.user?.id || user === game.user) && Boolean(tokenDoc.isOwner)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Determine if a user is "in-charge" of a token.
     * A user is in-charge of a token if:
     * 1. The user has an ownership role of the token.
     * 2. There is no other currently connected user with fewer permissions (lower tier) who also has an ownership role of that token.
     *
     * Ownership priority tiers (among currently connected users):
     * Players who own -> Trusted Players who own -> GM / Co-GM who own.
     *
     * @param {Token|TokenDocument} token Token placeable or TokenDocument
     * @param {User} [user=game.user] Target user to evaluate (defaults to active client user)
     * @returns {boolean} True if the user is in-charge of the token
     */
    isUserInCharge(token, user = game.user) {
        if (!token || !user) return false;

        const tokenDoc = token.document ?? token;
        const actor = token.actor ?? tokenDoc?.actor ?? null;

        if (!this.isUserDocumentOwner(user, actor, tokenDoc)) {
            return false;
        }

        const userTier = this.getUserPermissionTier(user);
        if (!userTier) return false;

        // Tier 1 (Player) is the lowest permission tier; if they own it, they are in-charge.
        if (userTier === USER_PERMISSION_TIERS.PLAYER) {
            return true;
        }

        const usersCollection = game.users;
        const allUsers = usersCollection?.contents
            ?? (usersCollection?.values ? Array.from(usersCollection.values()) : null)
            ?? (usersCollection ? Array.from(usersCollection) : [user]);

        // Filter to only currently connected (active) other users
        const activeOtherUsers = allUsers.filter(otherUser => {
            if (otherUser.id === user.id || otherUser === user) return false;
            return Boolean(otherUser.active);
        });

        // Tier 2 (Trusted Player): in-charge only if NO connected Tier 1 (Player) owns it
        if (userTier === USER_PERMISSION_TIERS.TRUSTED) {
            const hasConnectedPlayerOwner = activeOtherUsers.some(otherUser => {
                return this.getUserPermissionTier(otherUser) === USER_PERMISSION_TIERS.PLAYER
                    && this.isUserDocumentOwner(otherUser, actor, tokenDoc);
            });
            return !hasConnectedPlayerOwner;
        }

        // Tier 3 (GM / Co-GM): in-charge only if NO connected Tier 1 (Player) and NO connected Tier 2 (Trusted Player) owns it
        if (userTier === USER_PERMISSION_TIERS.GM) {
            const hasConnectedLowerTierOwner = activeOtherUsers.some(otherUser => {
                const otherTier = this.getUserPermissionTier(otherUser);
                return (otherTier === USER_PERMISSION_TIERS.PLAYER || otherTier === USER_PERMISSION_TIERS.TRUSTED)
                    && this.isUserDocumentOwner(otherUser, actor, tokenDoc);
            });
            return !hasConnectedLowerTierOwner;
        }

        return false;
    }
}
