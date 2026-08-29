import { MODULE_ID, MODULE_TLA } from "../constants.js";

const VERBOSITY_LEVELS = {
    'error': 1,
    'warn': 2,
    'info': 3,
    'debug': 4
};

export const GROUP_STYLES = {
    'error': 'color: #ef4444; font-weight: bold;',
    'warn': 'color: #f59e0b; font-weight: bold;',
    'info': 'color: #ffffff; font-weight: bold;',
    'debug': 'color: #38bdf8; font-weight: bold;'
};

/**
 * Get the current log verbosity level from the game settings.
 * Defaults to 'warn' if the setting is not yet registered or unavailable.
 */
// Cached verbosity level to prevent repeated game.settings.get calls (extremely cheap lookups)
let cachedVerbosity = null;

function getVerbosityLevel() {
    if (cachedVerbosity !== null) return cachedVerbosity;

    try {
        if (game?.settings) {
            const setting = game.settings.get(MODULE_ID, 'logVerbosity');
            cachedVerbosity = VERBOSITY_LEVELS[setting] ?? VERBOSITY_LEVELS['warn'];
            return cachedVerbosity;
        }
    } catch (e) {
        // Settings not yet registered or game not fully initialized
    }
    return VERBOSITY_LEVELS['warn'];
}

const groupStack = [];

/**
 * Ensure any pending (unstarted) groups on the stack are opened in the console
 * before writing log messages, preventing empty groups when no log messages execute.
 */
function _ensureGroupsStarted() {
    for (const entry of groupStack) {
        if (entry.enabled && !entry.started) {
            const style = GROUP_STYLES[entry.level] ?? GROUP_STYLES['info'];
            const shouldCollapse = entry.forceCollapse ?? (entry.level === 'debug' || entry.level === 'info');
            const consoleFn = (shouldCollapse && console.groupCollapsed) ? console.groupCollapsed : console.group;
            consoleFn(`%c${MODULE_TLA} | ${entry.message}`, style, ...entry.groupArgs);
            entry.started = true;
        }
    }
}

/**
 * Internal helper to create a styled console group (or collapsed group)
 * respecting the log verbosity level and highlighting with level-specific colors.
 * Groups default to collapsed for 'info' and 'debug', and expanded for 'warn' and 'error'.
 * Groups are lazy and only start in the console when a log message executes while open.
 * @param {boolean|null} forceCollapse Explicit collapse override, or null to default (info & debug collapsed, warn & error expanded)
 * @param {string} message Group label/message
 * @param {...*} args Optional verbosity level as first argument, followed by group payload
 */
function _createGroup(forceCollapse, message, ...args) {
    let level = 'info';
    let groupArgs = args;
    if (args.length > 0 && VERBOSITY_LEVELS[args[0]] !== undefined) {
        level = args[0];
        groupArgs = args.slice(1);
    }
    const enabled = getVerbosityLevel() >= VERBOSITY_LEVELS[level];
    groupStack.push({
        message,
        level,
        groupArgs,
        forceCollapse,
        started: false,
        enabled
    });
}

/**
 * Premium logging utility for Bakana's Action Display.
 * Supports levels: error, warn, info, debug, and console grouping.
 */
export const log = {
    error(message, ...args) {
        if (getVerbosityLevel() >= VERBOSITY_LEVELS['error']) {
            _ensureGroupsStarted();
            console.error(`${MODULE_TLA} | ${message}`, ...args);
        }
    },
    warn(message, ...args) {
        if (getVerbosityLevel() >= VERBOSITY_LEVELS['warn']) {
            _ensureGroupsStarted();
            console.warn(`${MODULE_TLA} | ${message}`, ...args);
        }
    },
    info(message, ...args) {
        if (getVerbosityLevel() >= VERBOSITY_LEVELS['info']) {
            _ensureGroupsStarted();
            console.log(`${MODULE_TLA} | ${message}`, ...args);
        }
    },
    debug(message, ...args) {
        if (getVerbosityLevel() >= VERBOSITY_LEVELS['debug']) {
            _ensureGroupsStarted();
            const timestamp = game?.time?.serverTime ?? 'Unknown';
            console.log(`%c[${MODULE_TLA} Debug (${timestamp})]`, "color: #38bdf8; font-weight: bold;", message, ...args);
        }
    },
    group(message, ...args) {
        _createGroup(null, message, ...args);
    },
    groupCollapsed(message, ...args) {
        _createGroup(true, message, ...args);
    },
    groupExpanded(message, ...args) {
        _createGroup(false, message, ...args);
    },
    groupEnd() {
        const group = groupStack.pop();
        if (group?.started) {
            console.groupEnd();
        }
    },
    /**
     * Dynamically update the cached verbosity level.
     * Called by the settings onChange callback.
     * @param {string} level The new verbosity level key
     */
    setVerbosity(level) {
        cachedVerbosity = VERBOSITY_LEVELS[level] ?? VERBOSITY_LEVELS['warn'];
    }
};
