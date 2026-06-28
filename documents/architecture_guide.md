# Architecture & Lifecycle Guide

This document explains the architecture of **Bakana's Action Display** and provides a visual guide to how the different class layers integrate, culminating in the rendering of the Token HUD.

---

## 1. Architectural Layers

The module is built using a clean **pipes-and-filters / adapter** architecture, divided into four distinct layers:

```
┌────────────────────────────────────────────────────────┐
│                        UI Layer                        │
│                (ActionDisplayApp)                      │
└──────────────────────────┬─────────────────────────────┘
                           │ queries actions & layout
                           ▼
┌────────────────────────────────────────────────────────┐
│                    Coordinator Layer                   │
│                    (ActionDisplay)                     │
└──────────────────────────┬─────────────────────────────┘
                           │ runs pipeline
                           ▼
┌────────────────────────────────────────────────────────┐
│                  System Adapter Layer                  │
│        (BaseSystemAdapter ◄─── Dnd5eSystemAdapter)      │
└──────────────────────────┬─────────────────────────────┘
                           │ modifies & categorizes
                           ▼
┌────────────────────────────────────────────────────────┐
│                  Module Adapter Layer                  │
│      (BaseModuleAdapter ◄─── MidiQolModuleAdapter)     │
└───────────────────────────┬────────────────────────────┘
                            │ filters & augments
                            ▼
                    [ Final HUD Render ]
```

### 1. Core / Coordinator (`ActionDisplay`)
*   **Role**: The central pipeline controller (a singleton instance exported from `src/action-display.js`).
*   **Responsibilities**:
    *   Detects the active game system and registers the appropriate system and module adapters.
    *   Performs the **Core Extraction**: iterates over all items on an actor and extracts a basic, system-agnostic list of actions (name, image, item ID, and roll functions).
    *   Runs the pipeline: `Core Extraction ──► System Adapter ──► Module Adapters ──► Core Post-Processing (User-Hidden Filters)`.

### 2. System Adapter Layer (`BaseSystemAdapter`)
*   **Role**: Handles system-specific rules, resource calculations, and terminology.
*   **Responsibilities**:
    *   Maps raw items into system-specific categories (e.g., separating weapons, spells, and features in D&D 5e).
    *   Extracts and calculates resource uses (e.g., spell slots, item charges, or D&D 5e v4+ Activity uses).
    *   Filters out depleted actions if the "Filter Depleted Actions" setting is enabled, using system-specific rules (e.g., checking D&D 5e activities).
    *   Provides system-specific localization labels and icons for the left-side and right-side tabs (falling back to hardcoded English in the base class if no specific adapter exists).

### 3. Module Adapter Layer (`BaseModuleAdapter`)
*   **Role**: Handles third-party module integrations (like `midi-qol`) without cluttering the core or system layers.
*   **Responsibilities**:
    *   Inspects active module flags on actions and modifies them (e.g., hiding Midi-QOL "automation-only" activities from the player-facing HUD).

### 4. UI Layer (`ActionDisplayApp`)
*   **Role**: The rendering engine, built on Foundry VTT's modern `ApplicationV2` (`HandlebarsApplication`) framework.
*   **Responsibilities**:
    *   Listens to Foundry hooks (like token selection) to position and render the HUD.
    *   Coordinates attachment/detachment states and tracks position coordinates.
    *   In `_prepareContext()`, it requests the processed actions from the Coordinator, queries the active system adapter for the tab layouts, filters the actions to match the active tabs, and renders the Handlebars template (`templates/action-display.html`).

---

## 2. Class Relationships

The following diagram shows how the classes are structured and how they reference one another:

```mermaid
classDiagram
    class ActionDisplay {
        +Map systemAdapters
        +Map moduleAdapters
        +BaseSystemAdapter activeSystemAdapter
        +init()
        +registerSystemAdapter(adapter)
        +registerModuleAdapter(adapter)
        +getActions(actor)
        -_extractBaseActions(actor)
    }

    class BaseSystemAdapter {
        +string systemId
        +isCompatible()
        +modifyActions(actions, actor)
        +getItemTypeLabel(parentId)
        +getItemTypeIcon(parentId)
        +getSpellLevelLabel(level)
        +getActionTypeLabel(parentId)
        +getActionTypeIcon(parentId)
        +getActionSubTabLabel(subId)
    }

    class Dnd5eSystemAdapter {
        +modifyActions(actions, actor)
        +getItemTypeLabel(parentId)
        +getSpellLevelLabel(level)
        +getActionSubTabLabel(subId)
        -_calculateUses(item)
        -_calculateActivityUses(activity, actor)
    }

    class BaseModuleAdapter {
        +string moduleId
        +isActive()
        +modifyActions(actions, actor)
    }

    class MidiQolModuleAdapter {
        +modifyActions(actions, actor)
    }

    class ActionDisplayApp {
        +Actor actor
        +string positionMode
        +boolean isAttached
        +render(force, options)
        #_prepareContext(options)
        #_onRender(context, options)
        +setPosition(positionMode, options)
        -_onRollAction(event)
    }

    ActionDisplayApp --> ActionDisplay : queries actions
    ActionDisplayApp --> BaseSystemAdapter : queries tab labels/icons
    ActionDisplay *-- BaseSystemAdapter : owns
    ActionDisplay *-- BaseModuleAdapter : owns
    BaseSystemAdapter <|-- Dnd5eSystemAdapter : extends
    BaseModuleAdapter <|-- MidiQolModuleAdapter : extends
```

---

## 3. The HUD Render Pipeline

This sequence diagram traces the exact lifecycle of how the HUD is created and rendered when a user selects a token in Foundry VTT:

```mermaid
sequenceDiagram
    autonumber
    actor User as Player / GM
    participant Hook as Foundry VTT Hook
    participant UI as ActionDisplayApp (UI)
    participant Core as ActionDisplay (Coordinator)
    participant Sys as Dnd5eSystemAdapter (System)
    participant Mod as MidiQolModuleAdapter (Module)

    User->>Hook: Selects Token (or right-clicks)
    Hook->>UI: Trigger Hook (controlToken / renderTokenHUD)
    Note over UI: UI detects active token & actor
    UI->>UI: render(force: true)
    
    Note over UI: UI starts preparing data
    UI->>UI: _prepareContext()
    
    %% Core Pipeline Start
    UI->>Core: getActions(actor)
    Note over Core: 1. Core Extraction
    Core->>Core: _extractBaseActions(actor)
    Note over Core: Creates system-agnostic baseActions[]
    
    Note over Core: 2. System Adapter Layer
    Core->>Sys: modifyActions(baseActions, actor)
    Note over Sys: Calculates uses/spell slots<br/>Categorizes items into tabs<br/>Filters out non-combat & depleted items (if enabled)
    Sys-->>Core: returns systemActions[]
    
    Note over Core: 3. Module Adapter Layer
    Core->>Mod: modifyActions(systemActions, actor)
    Note over Mod: Filters out Midi-QOL<br/>"automation-only" activities
    Mod-->>Core: returns moduleActions[]
    
    Note over Core: 4. Core Post-Processing
    Note over Core: Applies user-hidden flags ([hidden] tab)
    Core-->>UI: returns finalActions[]
    %% Core Pipeline End

    Note over UI: UI builds Left & Right Tab structures
    UI->>Sys: getItemTypeLabel(parentId) / getItemTypeIcon(parentId)
    Sys-->>UI: returns localized labels & CSS icons
    UI->>Sys: getActionTypeLabel(parentId) / getActionSubTabLabel(subId)
    Sys-->>UI: returns localized labels & CSS icons
    
    Note over UI: UI filters finalActions[] down to<br/>currently selected Left & Right tabs
    
    UI->>UI: Renders HTML (templates/action-display.html)
    UI->>User: Displays HUD on screen!
```
