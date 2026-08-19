/**
 * Namespace compatibility shims for Foundry VTT API updates across versions.
 */

export const KeyboardManager = foundry.helpers?.interaction?.KeyboardManager ?? globalThis.KeyboardManager;
export const ContextMenu = foundry.applications?.ux?.ContextMenu ?? globalThis.ContextMenu;
export const Token = foundry.canvas?.placeables?.Token ?? globalThis.Token;

