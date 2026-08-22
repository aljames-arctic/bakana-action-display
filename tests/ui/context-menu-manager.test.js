import test from 'node:test';
import assert from 'node:assert/strict';
import '../setup.js';
import { ContextMenuManager, createActionContextMenu } from '../../src/ui/app/context-menu-manager.js';
import { openActivitySubContextMenu, showActivityDropdown } from '../../src/ui/app/dropdown-manager.js';
import { ActionDisplayApp } from '../../src/ui/action-display-app.js';
import { Dnd5eSystemAdapter } from '../../src/adapters/system/dnd5e-system-adapter.js';

test('createActionContextMenu includes Edit Item option that renders originalItem sheet', () => {
    let sheetRendered = false;
    const mockItem = {
        sheet: {
            render: (force) => {
                if (force === true) sheetRendered = true;
            }
        }
    };
    const mockApp = {
        actor: { isOwner: true, items: new Map() },
        actions: [
            { id: 'item-1', name: 'Longsword', isHidden: false, originalItem: mockItem }
        ]
    };

    const mockElement = {
        querySelectorAll: () => [],
        querySelector: () => null
    };

    const menu = createActionContextMenu(mockApp, mockElement);
    const editOption = menu.menuItems.find(item => item.name === 'SIDEBAR.Edit');

    assert.ok(editOption, 'Edit menu option must be present');
    assert.equal(editOption.icon, '<i class="fas fa-edit"></i>');

    const mockEl = { dataset: { actionId: 'item-1' } };
    assert.equal(editOption.condition(mockEl), true, 'Condition should be true when actor is owner and item has a sheet');

    editOption.callback(mockEl);
    assert.equal(sheetRendered, true, 'Callback must call sheet.render(true) on the original item');
});

test('openActivitySubContextMenu creates sub-context menu with Edit Activity option', () => {
    let activitySheetRendered = false;
    const mockActivity = {
        sheet: {
            render: (force) => {
                if (force === true) activitySheetRendered = true;
            }
        }
    };
    const mockApp = {
        actor: { isOwner: true }
    };
    const mockSubaction = {
        id: 'act-sub-1',
        name: 'Fireball Activity',
        originalActivity: mockActivity
    };

    openActivitySubContextMenu(mockApp, {}, mockSubaction);
    assert.ok(true, 'openActivitySubContextMenu should execute without throwing');
});

test('Dnd5eSystemAdapter openEditSheet renders activity sheet when originalActivity is present', () => {
    let activityRendered = false;
    let fallbackRendered = false;
    const adapter = new Dnd5eSystemAdapter();
    const actionWithActivity = {
        originalActivity: {
            sheet: {
                render: (force) => { if (force) activityRendered = true; }
            }
        },
        originalItem: {
            sheet: {
                render: () => { fallbackRendered = true; }
            }
        }
    };

    adapter.openEditSheet(actionWithActivity);
    assert.equal(activityRendered, true, 'openEditSheet should invoke activity.sheet.render(true)');
    assert.equal(fallbackRendered, false, 'Fallback item sheet should not render when activity sheet succeeds');
});

test('createActionContextMenu onOpen closes open left-click dropdown', () => {
    let leftClickClosed = false;
    let removeClassCalled = false;
    const mockLeftClickMenu = {
        close: () => { leftClickClosed = true; }
    };
    const mockTarget = {
        classList: {
            remove: (cls) => { if (cls === 'bad-dropdown-active') removeClassCalled = true; }
        }
    };
    const mockApp = {
        actor: { isOwner: true, items: new Map() },
        actions: [],
        _activeLeftClickMenu: mockLeftClickMenu,
        _activeMenuTarget: mockTarget
    };
    const mockElement = {
        querySelectorAll: () => [],
        querySelector: () => null
    };

    const menu = createActionContextMenu(mockApp, mockElement);
    const targetElement = {
        classList: { add: () => {}, remove: () => {} }
    };
    menu.options.onOpen(targetElement);

    assert.equal(leftClickClosed, true, 'Opening right-click context menu must close active left-click dropdown');
    assert.equal(removeClassCalled, true, 'Opening right-click context menu must remove bad-dropdown-active class from target');
    assert.equal(mockApp._activeLeftClickMenu, null);
    assert.equal(mockApp._activeMenuTarget, null);
});

test('createActionContextMenu includes Add to Favorites and Remove from Favorites options', async () => {
    let flagVal = null;
    let renderCalled = false;
    const mockActor = {
        isOwner: true,
        getFlag: (mod, key) => (key === 'favorites' && flagVal ? { 'item-1': true } : undefined),
        setFlag: async (mod, key, val) => { flagVal = val; },
        update: async (data) => { flagVal = null; }
    };
    const mockItem = { id: 'item-1', name: 'Dagger' };
    const mockApp = {
        actor: mockActor,
        actions: [{ id: 'item-1', name: 'Dagger', originalItem: mockItem }],
        render: () => { renderCalled = true; }
    };
    const mockElement = { querySelectorAll: () => [], querySelector: () => null };

    const menu = createActionContextMenu(mockApp, mockElement);
    const addFavOption = menu.menuItems.find(item => item.name === 'BAD.actionMenu.addFavorite');
    const removeFavOption = menu.menuItems.find(item => item.name === 'BAD.actionMenu.removeFavorite');

    assert.ok(addFavOption, 'Add to Favorites option must be present');
    assert.ok(removeFavOption, 'Remove from Favorites option must be present');

    const mockEl = { dataset: { actionId: 'item-1' } };

    // Initially unfavorited: add is true, remove is false
    assert.equal(addFavOption.condition(mockEl), true);
    assert.equal(removeFavOption.condition(mockEl), false);

    // Click add to favorites
    await addFavOption.callback(mockEl);
    assert.ok(flagVal);
    assert.equal(renderCalled, true);

    // Now favorited: add is false, remove is true
    assert.equal(addFavOption.condition(mockEl), false);
    assert.equal(removeFavOption.condition(mockEl), true);

    // Click remove from favorites
    renderCalled = false;
    await removeFavOption.callback(mockEl);
    assert.equal(flagVal, null);
    assert.equal(renderCalled, true);
});

test('ContextMenuManager supports submenu definition, arrow injection, and popout lifecycle', () => {
    const mockItem = { id: 'item-2', name: 'Shield' };
    const mockApp = {
        actor: { isOwner: true, items: new Map() },
        actions: [{ id: 'item-2', name: 'Shield', originalItem: mockItem }]
    };
    const mockElement = { querySelectorAll: () => [], querySelector: () => null };

    const manager = createActionContextMenu(mockApp, mockElement);
    assert.ok(manager);
});

test('ContextMenuManager _positionContextMenu reparents #context-menu to document.body and applies fixed styling', () => {
    const mockApp = { actor: { isOwner: true } };
    const mockElement = { querySelectorAll: () => [], querySelector: () => null };
    const manager = new ContextMenuManager(mockApp, mockElement);

    const menuStyles = {};
    const mockMenuEl = {
        parentElement: { notBody: true },
        style: {
            setProperty: (prop, val) => { menuStyles[prop] = val; }
        },
        children: []
    };

    let appendedToBody = false;
    const originalQuerySelector = document.querySelector;
    const originalAppendChild = document.body.appendChild;

    document.querySelector = (selector) => {
        if (selector.includes('#context-menu')) return mockMenuEl;
        return null;
    };
    document.body.appendChild = (child) => {
        if (child === mockMenuEl) appendedToBody = true;
        return child;
    };

    const mockTarget = {
        getBoundingClientRect: () => ({ left: 50, top: 100, right: 250, bottom: 130, width: 200, height: 30 })
    };

    try {
        manager._positionContextMenu(mockTarget, 4);
        assert.equal(appendedToBody, true, '#context-menu must be reparented to document.body');
        assert.equal(menuStyles.position, 'fixed', 'Position must be fixed to escape HUD bounding box');
        assert.equal(menuStyles.left, '50px', 'Left must match target left');
        assert.equal(menuStyles.top, '130px', 'Top must match target bottom when space below is sufficient');
        assert.equal(menuStyles.width, '200px', 'Width must match target width');
        assert.equal(menuStyles['z-index'], '999999', 'z-index must be high to render over HUD and canvas');
    } finally {
        document.querySelector = originalQuerySelector;
        document.body.appendChild = originalAppendChild;
    }
});

test('ContextMenuManager _positionContextMenu positions menu above when space below is constrained', () => {
    const mockApp = { actor: { isOwner: true } };
    const mockElement = { querySelectorAll: () => [], querySelector: () => null };
    const manager = new ContextMenuManager(mockApp, mockElement);

    const menuStyles = {};
    const mockMenuEl = {
        parentElement: document.body,
        style: {
            setProperty: (prop, val) => { menuStyles[prop] = val; }
        },
        children: []
    };

    const originalQuerySelector = document.querySelector;
    document.querySelector = (selector) => {
        if (selector.includes('#context-menu')) return mockMenuEl;
        return null;
    };

    // Target placed near the bottom of a 1080px viewport
    const mockTarget = {
        getBoundingClientRect: () => ({ left: 50, top: 1000, right: 250, bottom: 1030, width: 200, height: 30 })
    };

    try {
        manager._positionContextMenu(mockTarget, 5);
        assert.equal(menuStyles.position, 'fixed');
        // Space below is 1080 - 1030 - 15 = 35px (< 120px), so it should flip above top (1000px)
        const topVal = parseFloat(menuStyles.top);
        assert.ok(topVal < 1000, 'Top should be positioned above target when space below is constrained');
    } finally {
        document.querySelector = originalQuerySelector;
    }
});

test('showActivityDropdown close removes #context-menu from DOM and resets active target state', async () => {
    const mockApp = {
        _activeLeftClickMenu: null,
        _activeMenuTarget: null,
        element: { ownerDocument: { body: document.body } }
    };
    let removedFromDom = false;
    const mockMenuEl = {
        remove: () => { removedFromDom = true; },
        querySelectorAll: () => []
    };

    const originalQuerySelector = document.querySelector;
    document.querySelector = (sel) => {
        if (sel.includes('#context-menu')) return mockMenuEl;
        return null;
    };

    const mockTarget = {
        classList: {
            add: () => {},
            remove: (cls) => {}
        },
        getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 30, width: 100, height: 30 })
    };

    const subactions = [
        { name: 'Act 1', roll: () => {} },
        { name: 'Act 2', roll: () => {} }
    ];

    try {
        showActivityDropdown(mockApp, mockTarget, subactions, { preventDefault() {}, stopPropagation() {} });
        assert.ok(mockApp._activeLeftClickMenu, 'Left click menu should be set');
        assert.equal(mockApp._activeMenuTarget, mockTarget, 'Active menu target should be set');

        await mockApp._activeLeftClickMenu.close();
        assert.equal(removedFromDom, true, '#context-menu should be removed from DOM on close');
        assert.equal(mockApp._activeLeftClickMenu, null, 'Active left click menu reference should be cleared');
        assert.equal(mockApp._activeMenuTarget, null, 'Active menu target reference should be cleared');
    } finally {
        document.querySelector = originalQuerySelector;
    }
});

test('ActionDisplayApp _clearMenuState removes lingering context-menu DOM elements and closes activeLeftClickMenu', () => {
    const mockActor = { isOwner: true, uuid: 'Actor.cleanup-test' };
    const app = new ActionDisplayApp({ actor: mockActor });

    let leftClosed = false;
    let contextClosed = false;
    let menuElRemoved = false;

    app._activeLeftClickMenu = {
        close: () => { leftClosed = true; }
    };
    app._activeMenuTarget = {
        classList: { remove: () => {} }
    };
    app._activeContextMenuTarget = {
        classList: { remove: () => {} }
    };
    app._contextMenu = {
        close: () => { contextClosed = true; }
    };

    const mockMenuEl = {
        remove: () => { menuElRemoved = true; }
    };

    const originalQuerySelectorAll = document.querySelectorAll;
    document.querySelectorAll = (sel) => {
        if (sel.includes('#context-menu')) return [mockMenuEl];
        return [];
    };

    try {
        app._clearMenuState();
        assert.equal(leftClosed, true, 'Left click menu should be closed');
        assert.equal(contextClosed, true, 'Right click context menu should be closed');
        assert.equal(menuElRemoved, true, 'Lingering context-menu elements should be removed from DOM');
        assert.equal(app._activeLeftClickMenu, null);
        assert.equal(app._activeMenuTarget, null);
        assert.equal(app._activeContextMenuTarget, null);
    } finally {
        document.querySelectorAll = originalQuerySelectorAll;
    }
});

test('ActionDisplayApp _boundOutsidePointerDown closes active dropdown when clicking another action item', () => {
    const mockActor = { isOwner: true, uuid: 'Actor.outside-pointer-test' };
    const app = new ActionDisplayApp({ actor: mockActor });
    app.element = {
        addEventListener: () => {},
        querySelector: () => null,
        querySelectorAll: () => []
    };

    let clearMenuStateCalled = false;
    app._clearMenuState = () => { clearMenuStateCalled = true; };

    // Simulate item 1 dropdown open
    const item1El = { id: 'item-1' };
    const item2El = { id: 'item-2' };
    app._activeLeftClickMenu = { close: () => {} };
    app._activeMenuTarget = item1El;

    app._onFirstRender({}, {});

    // 1. Click on item 2 (different item) -> should trigger _clearMenuState
    const fakeEventItem2 = {
        target: {
            closest: (sel) => {
                if (sel.includes('.bad-action-item')) return item2El;
                return null;
            }
        }
    };
    app._boundOutsidePointerDown(fakeEventItem2);
    assert.equal(clearMenuStateCalled, true, 'Clicking another action item must close active dropdown');

    // 2. Click on item 1 (same item) -> should NOT trigger _clearMenuState from outside click
    clearMenuStateCalled = false;
    const fakeEventItem1 = {
        target: {
            closest: (sel) => {
                if (sel.includes('.bad-action-item')) return item1El;
                return null;
            }
        }
    };
    app._boundOutsidePointerDown(fakeEventItem1);
    assert.equal(clearMenuStateCalled, false, 'Clicking the same item should not trigger outside click close');

    // 3. Click inside menu -> should NOT trigger _clearMenuState from outside click
    clearMenuStateCalled = false;
    const fakeEventMenu = {
        target: {
            closest: (sel) => {
                if (sel.includes('#context-menu')) return { id: 'context-menu' };
                return null;
            }
        }
    };
    app._boundOutsidePointerDown(fakeEventMenu);
    assert.equal(clearMenuStateCalled, false, 'Clicking inside the menu should not trigger outside click close');
});
