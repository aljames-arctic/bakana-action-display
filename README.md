# Bakana's Action Display

[![Foundry VTT Version](https://img.shields.io/badge/Foundry%20VTT-v12+-orange.svg)](https://foundryvtt.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Latest Module Downloads](https://img.shields.io/github/downloads/aljames-arctic/bakana-action-display/latest/module.zip?style=flat-square&label=latest%20downloads&color=blue)](https://github.com/aljames-arctic/bakana-action-display/releases)
[![Total Module Downloads](https://img.shields.io/github/downloads-pre/aljames-arctic/bakana-action-display/module.zip?style=flat-square&label=total%20downloads&color=success)](https://github.com/aljames-arctic/bakana-action-display/releases)

A sleek, high-performance, and highly customizable **Action HUD** for **Foundry VTT (V12+)**.

**Bakana's Action Display** dynamically tracks your selected token on the canvas, instantly presenting their available attacks, spells, features, checks, and consumables. Designed with a modern aesthetic, responsive animations, and deep system integrations, it keeps tactical options right at your fingertips to drastically accelerate gameplay.

---

## Key Features

* **Dynamic Token Tracking & Canvas Centering**: Automatically follows the active or selected token, updating instantly on selection change. Includes a quick **Center on Token** button to focus your canvas view.
* **Dual-Column & Multi-Level Filtering**:
  * **Left-Side Tabs**: Filter actions by item type (Weapons, Spells, Feats, Consumables, Equipment, Favorites, etc.).
  * **Right-Side Tabs**: Filter actions by activation cost (Actions, Bonus Actions, Reactions, Time, Rest, Legendary/Lair, etc.) with nested subcategory hierarchies.
  * **Multi-Select & Isolation**: Right-click any tab or subcategory to combine filters (e.g. view Weapons + Spells, or Actions + Bonus Actions simultaneously). Left-click any active sub-tab to isolate it.
* **Visual Action Economy Indicators**: Dynamic, colored indicator bars on every action card instantly show activation cost requirements. Includes a dedicated **Economy Colors Configuration** menu to customize color palettes, toggle specific indicator types, or apply presets.
* **Custom Categorization & Rules Engine**: Build custom categories and nested subcategories using boolean expressions (e.g. `item.type === 'weapon'`, `item.system.level < 3`). Supports **Fallthrough** (allowing matched actions to continue cascading down) and **Dividing Bars** (empty category names rendering as horizontal section dividers).
* **Multi-Page Navigation (Checks & Saves)**: Easily flip between **Page 1** (Combat Actions, Spells, Equipment) and **Page 2** (Core Ability Checks, Saving Throws, and Skills with split section layouts).
* **Favorites Integration**: Star favorite items with one click or right-click context menu. Automatically synchronizes with system-level favorites (e.g. D&D 5e favorites).
* **Smart Dropdown Activations**: Items with multiple activities, formulas, or spellcasting modes open an inline single-line dropdown showing remaining uses and icons for rapid selection.
* **Instant Search & Depleted Filter**: Instant full-text filtering across all actions with one-click clear, plus a toggle button to hide actions with depleted uses, slots, or ammunition.
* **Flexible HUD Positioning**:
  * **Attached**: Dynamically follows the token.
  * **Pinned**: Anchors to the token at a fixed offset.
  * **Detached**: Freely floating anywhere on screen with silky smooth 60fps dragging and position memory.

---

## Supported Systems

| System | Highlights |
| :--- | :--- |
| **D&D 5th Edition (v3.x / v4.x+)** | Full Activity 4.0 architecture support, spell slot calculations, unprepared spells right-click toggle, negative spell component filters (Verbal, Somatic, Material), and Midi-QOL automation filtering. |
| **Pathfinder 2e** | Derived Strikes & unarmed attacks resolution, ammunition counters, carry-type context menus (Hold 1H/2H, Wear, Stow, Drop), equip toggles, and Page 2 Checks/Saves/Perception. |
| **Pathfinder 1e** | Linked attack merging, multi-action dropdowns, buff tracking, equipment management, and Page 2 Ability Checks/Saves. |
| **Universal / Core Fallback** | Automatic fallback adapter for unsupported systems, providing standard item extraction, roll triggers, and customization. |

---

## Recommended Media & Demonstrations

To best showcase the module in the README or release notes, the following short clips and screenshots are recommended:

1. **Main HUD Showcase (`hud_demo.png` / `.gif`)**
   * *Description*: High-resolution screenshot or GIF showing the HUD open beside a character token, highlighting the dual left/right tab columns, action economy indicator bars, and active spell/attack cards.
2. **Multi-Level Action Economy & Multi-Select (`tab_multi_select.gif`)**
   * *Description*: Quick 5-second GIF demonstrating right-clicking multiple parent tabs (Weapons + Spells) and expanding nested Action Economy subcategories (Standard -> Bonus Actions, Reactions).
3. **Custom Categorization & Dividing Bars (`categorization_config.png` / `.gif`)**
   * *Description*: Showing the Categorization Configuration UI with a custom rule list, fallthrough chevrons enabled, and an empty dividing bar separating sections on the HUD.
4. **Action Economy Color Palette Customizer (`economy_colors_config.png`)**
   * *Description*: Showing the Economy Colors Configuration app previewing custom indicator colors, enabled checkboxes, and color pickers.
5. **Page 2: Ability Checks & Saving Throws (`page_navigation_checks.gif`)**
   * *Description*: Showing the user clicking the page arrow to transition from Page 1 combat actions to Page 2 split-layout Ability Checks, Saves, and Skills.
6. **Activity Dropdown & Right-Click Context Menu (`activity_dropdown_context.gif`)**
   * *Description*: Left-clicking a multi-activity spell or weapon to show the inline dropdown, followed by right-clicking an item card to show the Edit / Favorite / Carry State context menu.

---

## Configuration & Settings

Configure these options in Foundry VTT **Configure Settings > Module Settings**:

* **HUD Position Mode**: Default positioning mode (`Attached`, `Pinned`, or `Detached`).
* **Categorization Configuration**: Open the interactive category builder to craft custom HUD sections and filters.
* **Action Economy Colors**: Customize individual indicator colors, enable/disable specific economy types, and choose presets.
* **Module Integrations**: Configure external module hooks (e.g. Midi-QOL automation-only filtering).
* **Persist Tab Selections**: Preserves your active tab combinations across reloads and actor switches.
* **Toggle Tab Selection**: Enables right-click multi-select behavior on left-click.

---

## Installation

Install directly via the Foundry VTT Module Browser or copy the Manifest URL into **Install Module**:

```text
https://github.com/aljames-arctic/bakana-action-display/releases/latest/download/module.json
```

---

## License

This project is open source and available under the [MIT License](LICENSE).
