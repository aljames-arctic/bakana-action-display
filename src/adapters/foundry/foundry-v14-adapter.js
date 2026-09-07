import { FoundryV13Adapter } from './foundry-v13-adapter.js';

/**
 * Foundry VTT V14 platform adapter.
 * Extends FoundryV13Adapter and encapsulates modern namespaced constructors and API changes introduced in Foundry V14.
 */
export class FoundryV14Adapter extends FoundryV13Adapter {

    /**
     * The active ContextMenu constructor in v14+.
     */
    get ContextMenu() {
        return foundry.applications.ux.ContextMenu;
    }

    /**
     * The active KeyboardManager constructor in v14+.
     */
    get KeyboardManager() {
        return foundry.helpers.interaction.KeyboardManager;
    }

    /**
     * The active Token placeable constructor in v14+.
     */
    get Token() {
        return foundry.canvas.placeables.Token;
    }

    /**
     * The active FilePicker constructor / implementation in v14+.
     */
    get FilePicker() {
        return foundry.applications.apps.FilePicker.implementation;
    }

    /**
     * The active TextEditor constructor / implementation in v14+.
     */
    get TextEditor() {
        return foundry.applications.ux.TextEditor.implementation;
    }
}
