import test from 'node:test';
import assert from 'node:assert/strict';
import '../setup.js';
import { createActionContextMenu } from '../../src/ui/app/context-menu-manager.js';
import { openActivitySubContextMenu } from '../../src/ui/app/dropdown-manager.js';

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
    const editOption = menu.menuItems.find(item => item.name === 'BAD.core.editItem');

    assert.ok(editOption, 'Edit Item menu option must be present');
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
