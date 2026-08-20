/**
 * Namespace compatibility shims for Foundry VTT API updates across versions.
 */
export const KeyboardManager = globalThis.foundry?.helpers?.interaction?.KeyboardManager ?? globalThis.KeyboardManager;
export const ContextMenu = globalThis.foundry?.applications?.ux?.ContextMenu ?? globalThis.ContextMenu;
export const Token = globalThis.foundry?.canvas?.placeables?.Token ?? globalThis.Token;
