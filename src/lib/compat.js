/**
 * Namespace compatibility shims for Foundry VTT API updates across versions.
 */
export const KeyboardManager = foundry?.helpers?.interaction?.KeyboardManager ?? (typeof KeyboardManager !== 'undefined' ? KeyboardManager : undefined);
export const ContextMenu = foundry?.applications?.ux?.ContextMenu ?? (typeof ContextMenu !== 'undefined' ? ContextMenu : undefined);
export const Token = foundry?.canvas?.placeables?.Token ?? (typeof Token !== 'undefined' ? Token : undefined);
