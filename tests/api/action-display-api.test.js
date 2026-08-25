import test from 'node:test';
import assert from 'node:assert/strict';
import '../setup.js';
import { ActionDisplay } from '../../src/action-display.js';
import { ActionDisplayAPI, createAPI } from '../../src/api/index.js';
import { ActionDisplayApp } from '../../src/ui/action-display-app.js';
import { adapter } from '../../src/adapters/index.js';

test('ActionDisplayAPI resolveToken resolves tokens across polymorphic inputs', () => {
    const coordinator = new ActionDisplay();
    const api = createAPI(coordinator);

    const mockToken = { id: 'tok1', actor: { id: 'act1' }, document: { id: 'tok1' } };
    const mockTokenDoc = { id: 'tok2', object: { id: 'tok2', actor: { id: 'act2' } }, actor: { id: 'act2' } };
    const mockActor = { id: 'act3', getActiveTokens: () => [{ id: 'tok3', actor: { id: 'act3' } }] };

    globalThis.canvas = {
        tokens: {
            get: (id) => (id === 'tok4' ? { id: 'tok4', actor: { id: 'act4' } } : null),
            placeables: [{ id: 'tok5', actor: { id: 'act5' } }]
        }
    };

    globalThis.fromUuidSync = (uuid) => {
        if (uuid === 'Scene.1.Token.tok6') {
            return { object: { id: 'tok6', actor: { id: 'act6' } } };
        }
        return null;
    };

    // 1. Direct Token
    assert.equal(api.resolveToken(mockToken), mockToken);

    // 2. TokenDocument
    assert.equal(api.resolveToken(mockTokenDoc), mockTokenDoc.object);

    // 3. Actor with getActiveTokens
    assert.deepEqual(api.resolveToken(mockActor), { id: 'tok3', actor: { id: 'act3' } });

    // 4. Token ID string via canvas.tokens.get
    assert.deepEqual(api.resolveToken('tok4'), { id: 'tok4', actor: { id: 'act4' } });

    // 5. Token UUID string via fromUuidSync
    assert.deepEqual(api.resolveToken('Scene.1.Token.tok6'), { id: 'tok6', actor: { id: 'act6' } });

    // 6. Invalid / null inputs
    assert.equal(api.resolveToken(null), null);
    assert.equal(api.resolveToken(undefined), null);
    assert.equal(api.resolveToken('non-existent'), null);
});

test('ActionDisplayAPI open opens HUD for specific token with target page and selected tabs', async () => {
    const coordinator = new ActionDisplay();
    const api = createAPI(coordinator);

    const mockActor = { id: 'act1', uuid: 'Actor.1', system: {} };
    const mockToken = { id: 'tok1', actor: mockActor, document: { id: 'tok1' } };

    // 1. Open with positional arguments: token, { page, tabs }
    const app1 = await api.open(mockToken, {
        page: 2,
        tabs: {
            left: 'spells',
            right: { parent: 'bonus', subTypes: ['level-1'] }
        }
    });

    assert.ok(app1 instanceof ActionDisplayApp);
    assert.equal(api.isOpen(), true);
    assert.equal(api.activeApp, app1);
    assert.equal(app1.activePage, 2);
    assert.ok(app1.leftTabs.activeParents.has('spells'));
    assert.ok(app1.rightTabs.activeParents.has('bonus'));
    assert.ok(app1.rightTabs.activeSubTypes.has('level-1'));

    // 2. Re-opening for same token updates page and tab selections in-place
    const app1Updated = await api.open(mockToken, {
        page: 1,
        tabs: {
            left: 'actions',
            right: 'reactions'
        }
    });

    assert.equal(app1Updated, app1);
    assert.equal(app1.activePage, 1);
    assert.ok(app1.leftTabs.activeParents.has('actions'));
    assert.ok(app1.rightTabs.activeParents.has('reactions'));

    // 3. Open with options object signature: { token, page, leftTabs, rightTabs }
    const mockToken2 = { id: 'tok2', actor: { id: 'act2', uuid: 'Actor.2', system: {} }, document: { id: 'tok2' } };
    const app2 = await api.open({
        token: mockToken2,
        page: 3,
        leftTabs: ['features'],
        rightTabs: 'special'
    });

    assert.ok(app2 instanceof ActionDisplayApp);
    assert.notEqual(app2, app1);
    assert.equal(api.activeApp, app2);
    assert.equal(app2.activePage, 3);
    assert.ok(app2.leftTabs.activeParents.has('features'));
    assert.ok(app2.rightTabs.activeParents.has('special'));

    // Clean up
    await api.close();
    assert.equal(api.isOpen(), false);
    assert.equal(api.activeApp, null);
});

test('ActionDisplayAPI close, toggle, setPage, setTabs, and getActions methods', async () => {
    const coordinator = new ActionDisplay();
    const api = createAPI(coordinator);

    const mockActor = { id: 'act1', uuid: 'Actor.1', system: {} };
    const mockToken = { id: 'tok1', actor: mockActor, document: { id: 'tok1' } };

    // 1. Toggle opens when closed
    const opened = await api.toggle(mockToken, { page: 2 });
    assert.equal(opened, true);
    assert.equal(api.isOpen(), true);
    assert.equal(api.activeApp.activePage, 2);

    // 2. setPage changes page
    await api.setPage(1);
    assert.equal(api.activeApp.activePage, 1);

    // 3. setTabs changes active tabs
    await api.setTabs({ left: 'skills', right: 'bonus' });
    assert.ok(api.activeApp.leftTabs.activeParents.has('skills'));
    assert.ok(api.activeApp.rightTabs.activeParents.has('bonus'));

    // 4. Toggle closes when called for same token
    const toggledClosed = await api.toggle(mockToken);
    assert.equal(toggledClosed, false);
    assert.equal(api.isOpen(), false);

    // 5. getActions extracts actions via coordinator pipeline
    const actions = await api.getActions(mockToken);
    assert.ok(Array.isArray(actions));
});
