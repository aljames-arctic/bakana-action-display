# CSS Layout & Styling Guide

This document provides a comprehensive guide to the DOM structure, CSS classes, and styling variables used in **Bakana's Action Display**. It serves as a reference for developers wishing to customize the HUD's appearance or write custom themes.

---

## Visual Layout Wireframe

The following diagram represents a visual mockup of the HUD window. It shows how the DOM elements are nested and labels each component with its corresponding CSS class and state modifiers.

```mermaid
graph TD
    subgraph Window [".bakana-action-display-window (ApplicationV2 Window)"]
        subgraph Container [".bakana-action-display-container (Main Glassmorphism Box)"]
            
            %% Top Control Bar
            subgraph ControlBar [".bad-control-bar"]
                DragHandle[".bad-drag-handle (⚓ Grip / Drag Area)"]
                PinBtn[".bad-control-btn (⚓ Anchor / Pin Button)"]
            end
            
            %% Main Middle Area (Left Tabs + List + Right Tabs)
            subgraph MainLayout [".bad-main-layout"]
                
                %% Left-Side Tabs (Slid Out)
                subgraph LeftTabs [".bad-left-tabs (Item Types)"]
                    LeftTab1[".bad-left-tab (Weapons Icon)"]
                    subgraph LeftGroup [".bad-left-tab-group.expanded"]
                        LeftTab2[".bad-left-tab.active-parent (Spells Icon)"]
                        subgraph LeftSubTabs [".bad-left-sub-tabs"]
                            SubTab1[".bad-left-sub-tab (Cantrips)"]
                            SubTab2[".bad-left-sub-tab.active (1st Level)"]
                        end
                    end
                end
                
                %% Central Scrollable Action List
                subgraph ItemList [".bad-tab-content (Scrollable List)"]
                    
                    %% Normal Row
                    subgraph Row1 [".bad-action-item"]
                        Icon1[".bad-action-icon (img: Longsword)"]
                        Name1[".bad-action-name (Longsword)"]
                        Uses1[".bad-action-uses (3 / 3)"]
                    end
                    
                    %% Active Row (e.g. Buff)
                    subgraph Row2 [".bad-action-item.bad-item-active"]
                        Icon2[".bad-action-icon (img: Haste)"]
                        Name2[".bad-action-name (Haste)"]
                        Uses2[".bad-action-uses (Active)"]
                    end
                    
                    %% Hidden Row (Ghostly/Dashed)
                    subgraph Row3 [".bad-action-item.bad-item-hidden"]
                        Icon3[".bad-action-icon (img: Sneak Attack)"]
                        Name3[".bad-action-name (Sneak Attack)"]
                        Uses3[".bad-action-uses (Hidden)"]
                    end
                    
                    %% Unprepared Row (Orange text)
                    subgraph Row4 [".bad-action-item.unprepared"]
                        Icon4[".bad-action-icon (img: Fireball)"]
                        Name4[".bad-action-name (Fireball)"]
                        Uses4[".bad-action-uses (1st)"]
                    end
                end
                
                %% Right-Side Tabs (Slid Out)
                subgraph RightTabs [".bad-right-tabs (Action Economy)"]
                    RightTab1[".bad-right-tab.active (Action Icon)"]
                    RightTab2[".bad-right-tab (Bonus Icon)"]
                    RightTab3[".bad-right-tab (Reaction Icon)"]
                end
            end
            
            %% Bottom Footer
            subgraph Footer [".bad-footer"]
                subgraph FilterLabel [".bad-filter-label"]
                    Checkbox[".bad-filter-checkbox (Checkbox)"]
                    Text["Hide Depleted"]
                end
            end
        end
    end

    %% Style Customizations for Mermaid Mockup
    style Window fill:#1e1e24,stroke:#333,stroke-width:1px,color:#94a3b8
    style Container fill:#16161d,stroke:#a78bfa,stroke-width:2px,color:#f0f0f5
    style ControlBar fill:#121216,stroke:#2d2d39,color:#cbd5e1
    style MainLayout fill:none,stroke:none
    style ItemList fill:#0e0e12,stroke:#2d2d39,color:#cbd5e1
    
    %% Row States
    style Row1 fill:#1c1c24,stroke:#2d2d39,color:#f1f5f9
    style Row2 fill:#1e1b4b,stroke:#8b5cf6,stroke-width:2px,color:#ffffff
    style Row3 fill:#14141a,stroke:#a78bfa,stroke-dasharray: 4 4,color:#64748b
    style Row4 fill:#1c1c24,stroke:#2d2d39,color:#fb923c
    
    %% Tab States
    style LeftTabs fill:none,stroke:none
    style RightTabs fill:none,stroke:none
    style LeftTab1 fill:#16161d,stroke:#2d2d39,color:#cbd5e1
    style LeftTab2 fill:#1a1528,stroke:#7c3aed,color:#a78bfa
    style SubTab1 fill:#16161d,stroke:#2d2d39,color:#cbd5e1
    style SubTab2 fill:#7c3aed,stroke:#8b5cf6,color:#ffffff
    style RightTab1 fill:#7c3aed,stroke:#8b5cf6,color:#ffffff
    style RightTab2 fill:#16161d,stroke:#2d2d39,color:#cbd5e1
    style RightTab3 fill:#16161d,stroke:#2d2d39,color:#cbd5e1
    
    style Footer fill:#121216,stroke:#2d2d39,color:#94a3b8
```

---

## Design Tokens & CSS Variables

The HUD styling is driven by three primary CSS custom properties registered on the document root (`:root`). These variables allow for real-time, reactive adjustments via the module's settings menu:

| CSS Variable | Description | Default Value | Setting Controller |
| :--- | :--- | :--- | :--- |
| `--bad-hud-opacity` | Controls the transparency of the entire HUD window. | `0.88` | **HUD Opacity** (Slider: `0.1` to `1.0`) |
| `--bad-hud-scale` | Controls the overall physical size of the HUD window (width, max-height, padding, and gaps) proportionally. | `1.0` | **HUD Scale** (Slider: `0.5` to `1.5`) |
| `--bad-hud-font-size` | Controls the base font size of the text and icons *inside* the HUD. The window size remains independent. | `14px` | **Font Size (px)** (Slider: `10` to `24`) |

### How Scale and Font Size Interact
To allow independent control over the window size and text size, the stylesheet uses the following mathematical formulas:

*   **Window Dimensions**: Width, max-height, padding, and gaps are calculated in pixels multiplied *only* by the scale factor:
    ```css
    width: calc(320px * var(--bad-hud-scale, 1.0));
    max-height: calc(500px * var(--bad-hud-scale, 1.0));
    padding: calc(12px * var(--bad-hud-scale, 1.0));
    ```
*   **Content Font Size**: The base font-size of the window inherits the product of both variables. This ensures that when the HUD window scales, the text scales with it, but the text can also be adjusted independently:
    ```css
    font-size: calc(var(--bad-hud-font-size, 14px) * var(--bad-hud-scale, 1.0));
    ```
*   **Fluid Internal Elements**: All internal elements (icons, row padding, row gaps, border-radii) are defined in **`em` units** (relative to the base font-size). If you increase the font size, the icons and rows automatically expand and condense fluidly.

---

## DOM Class Reference

### 1. Window & Outer Container
*   **`.bakana-action-display-window`**
    *   *Role*: The outer window wrapper generated by Foundry's `ApplicationV2`.
    *   *Styling*: Set to `position: fixed` with a customizable opacity. It has no hardcoded `z-index`, allowing Foundry to manage its depth naturally.
*   **`.bakana-action-display-container`**
    *   *Role*: The main visual container of the HUD.
    *   *Styling*: Implements a dark glassmorphism aesthetic (`backdrop-filter: blur(12px)`) with a soft violet border and rounded corners. Constrained by the scaled width and max-height.

### 2. Control Bar
*   **`.bad-control-bar`**
    *   *Role*: The top header bar containing the drag handle and window controls.
    *   *Styling*: Flexbox layout with a dark translucent background.
*   **`.bad-drag-handle`**
    *   *Role*: The middle grab area used to drag and detach the HUD.
    *   *Styling*: Displays a cursor change (`cursor: move`) and transitions color on hover.
*   **`.bad-control-btn`**
    *   *Role*: Small buttons on the control bar (e.g., the anchor pin icon).
    *   *Styling*: Clean icon buttons with no backgrounds, glowing violet on hover.

### 3. Action List (Main Content)
*   **`.bad-main-layout`**
    *   *Role*: The flexbox row housing the left tabs, the central list, and the right tabs.
*   **`.bad-tab-content`**
    *   *Role*: The scrollable container holding the list of action cards. Registered as a `scrollable` selector in ApplicationV2 options (`scrollable: ['.bad-tab-content']`) to preserve scroll position across redraws.
    *   *Styling*: A vertical flexbox with a custom thin, violet scrollbar. Height is fluidly managed by the parent flex container (no hardcoded height).
*   **`.bad-action-item`**
    *   *Role*: An individual action card (row).
    *   *Styling*: Flexbox row containing the icon, name, and resource badge. Features a smooth hover animation that slides the card slightly to the right (`transform: translateX(3px)`) and glows violet.

### 4. Action Card Components
*   **`.bad-action-icon`**
    *   *Role*: The image representing the action.
    *   *Styling*: Set to a compact `1.2em` square with rounded corners and a subtle border. Aligns perfectly with the text height.
*   **`.bad-action-name`**
    *   *Role*: The text label showing the action's name.
    *   *Styling*: Scaled to `0.85em` with `text-overflow: ellipsis` to cleanly truncate long names without wrapping.
*   **`.bad-action-uses`**
    *   *Role*: The resource badge showing remaining charges, spell slots, or ammunition.
    *   *Styling*: A compact badge (`0.75em` font) with a translucent background.

---

## State Modifiers

Additional classes are appended dynamically to elements to represent their active states:

| Class Name | Applied To | Description | Visual Effect |
| :--- | :--- | :--- | :--- |
| **`.bad-item-active`** | `.bad-action-item` | Appended to active toggles, active buffs, or sustained effects. | Glows with a bright violet border and translucent violet background. |
| **`.bad-item-hidden`** | `.bad-action-item` | Appended to actions that the user has manually hidden via the right-click context menu. | Becomes semi-transparent (`0.45` opacity) with a dashed border. Child hover effects are suppressed. |
| **`.unprepared`** | `.bad-action-item` | Appended to spells that are not prepared (in systems like D&D 5e). | The text, border, and badges turn a soft orange. |
| **`.depleted`** | `.bad-action-uses` | Appended to resource badges when they reach `0` uses. | The badge background and text turn a soft red. |
| **`.upcast`** | `.bad-action-uses` | Appended to spell slots that are being upcast. | The badge background and text turn a soft orange. |
| **`.active`** | `.bad-left-tab` / `.bad-right-tab` | Appended to the currently selected tab. | Turns into a vibrant violet gradient with a strong shadow glow. |
| **`.active-parent`** | `.bad-left-tab` | Appended to a parent tab (like "Spells") when one of its sub-tabs (like "1st Level") is active. | Receives a subtle violet highlight indicating the active sub-category. |
| **`.unprepared-active`** | `.bad-left-sub-tab` | Appended to the "All Spells" tab when unprepared spells are toggled on. | Turns orange (if active) or receives a soft orange border (if inactive) to warn the user. |
