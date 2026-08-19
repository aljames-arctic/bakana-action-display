import test from 'node:test';
import assert from 'node:assert/strict';
import '../setup.js';
import { ActionDisplayApp } from '../../src/ui/action-display-app.js';
import { actionDisplay } from '../../src/action-display.js';
import { MODULE_ID } from '../../src/constants.js';
import { evaluateBooleanExpression } from '../../src/categorization/categorization-manager.js';
import { Action } from '../../src/ui/action.js';

test('ActionDisplayApp _toggleActionHidden toggles hiddenItems object map with setFlag and atomic update', async () => {
    let flagState = {};
    let updateState = null;
    let renderCount = 0;

    const mockActor = {
        name: 'Test Actor',
        isOwner: true,
        getFlag: (mod, key) => (mod === MODULE_ID && key === 'hiddenItems' ? flagState : undefined),
        setFlag: async (mod, key, val) => {
            if (mod === MODULE_ID && key === 'hiddenItems') flagState = val;
        },
        update: async (data) => {
            updateState = data;
            const deleteKey = `flags.${MODULE_ID}.hiddenItems.-=item-1`;
            if (deleteKey in data) {
                delete flagState['item-1'];
            }
        }
    };

    const mockItem = { id: 'item-1', name: 'Secret Dagger' };
    const app = new ActionDisplayApp({ actor: mockActor });
    app.actions = [
        new Action({ id: 'item-1', name: 'Secret Dagger', originalItem: mockItem })
    ];
    app.render = () => { renderCount++; };

    // 1. Hide item
    await app._toggleActionHidden('item-1', true);
    assert.deepEqual(flagState, { 'item-1': true });
    assert.equal(renderCount, 1);

    // 2. Unhide item using atomic update
    await app._toggleActionHidden('item-1', false);
    assert.deepEqual(updateState, { [`flags.${MODULE_ID}.hiddenItems.-=item-1`]: null });
    assert.deepEqual(flagState, {});
    assert.equal(renderCount, 2);
});

test('ActionDisplayApp _toggleActionHidden normalizes legacy array format into object map', async () => {
    let flagState = ['legacy-item-1'];

    const mockActor = {
        name: 'Legacy Actor',
        isOwner: true,
        getFlag: (mod, key) => (mod === MODULE_ID && key === 'hiddenItems' ? flagState : undefined),
        setFlag: async (mod, key, val) => {
            if (mod === MODULE_ID && key === 'hiddenItems') flagState = val;
        }
    };

    const mockItem = { id: 'item-2', name: 'New Hidden Item' };
    const app = new ActionDisplayApp({ actor: mockActor });
    app.actions = [
        new Action({ id: 'item-2', name: 'New Hidden Item', originalItem: mockItem })
    ];
    app.render = () => {};

    await app._toggleActionHidden('item-2', true);
    assert.deepEqual(flagState, { 'legacy-item-1': true, 'item-2': true });
});

test('ActionDisplay getActions processes hiddenItems from object map and legacy array', async () => {
    const mockActor = {
        name: 'Hero Actor',
        items: [
            { id: 'item-1', name: 'Visible Sword', type: 'weapon' },
            { id: 'item-2', name: 'Hidden Shield', type: 'equipment' }
        ],
        getFlag: (mod, key) => (mod === MODULE_ID && key === 'hiddenItems' ? { 'item-2': true } : undefined)
    };

    actionDisplay.activeSystemAdapter = {
        systemId: 'generic',
        shouldExtractItem: () => true,
        modifyActions: async (actions) => actions
    };

    const actions = await actionDisplay.getActions(mockActor);
    const visibleSword = actions.find(a => a.id === 'item-1');
    const hiddenShield = actions.find(a => a.id === 'item-2');

    assert.equal(visibleSword.isHidden, false);
    assert.notDeepEqual(visibleSword.left, ['hidden']);

    assert.equal(hiddenShield.isHidden, true);
    assert.deepEqual(hiddenShield.left, ['hidden']);
    assert.equal(hiddenShield.available, true);
});

test('evaluateBooleanExpression queries actor.flags.hiddenItems object map safely', () => {
    const action = new Action({ id: 'item-1', name: 'Dagger', type: 'weapon' });
    const actorWithHidden = {
        name: 'Sneak',
        flags: {
            [MODULE_ID]: {
                hiddenItems: { 'item-1': true }
            }
        },
        getFlag(mod, key) {
            return this.flags?.[mod]?.[key];
        }
    };
    const actorWithoutHidden = {
        name: 'Paladin',
        flags: {},
        getFlag: () => undefined
    };

    assert.equal(
        evaluateBooleanExpression('actor.getFlag("bakana-action-display", "hiddenItems")?.[item.id]', action, { actor: actorWithHidden }),
        true
    );
    assert.equal(
        evaluateBooleanExpression('actor.getFlag("bakana-action-display", "hiddenItems")?.[item.id]', action, { actor: actorWithoutHidden }),
        false
    );
});
