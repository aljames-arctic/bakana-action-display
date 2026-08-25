import test from 'node:test';
import assert from 'node:assert/strict';
import '../setup.js';
import { ActionDisplay } from '../../src/action-display.js';
import {
    ActionDisplayAPI,
    createAPI,
    normalizePage,
    normalizeTabColumnState,
    normalizeTabConfig
} from '../../src/api/index.js';
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

    // 6. Omitted inputs return null
    assert.equal(api.resolveToken(null), null);
    assert.equal(api.resolveToken(undefined), null);

    // 7. Invalid explicit inputs throw errors
    assert.throws(() => api.resolveToken('non-existent'), /Cannot resolve Token from identifier "non-existent"/);
    assert.throws(() => api.resolveToken(12345), /Invalid token target/);
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

    // 3. Open with options object signature: { token, page, leftTabs, rightTabs } with multi-tab selection
    const mockToken2 = { id: 'tok2', actor: { id: 'act2', uuid: 'Actor.2', system: {} }, document: { id: 'tok2' } };
    const app2 = await api.open({
        token: mockToken2,
        page: 3,
        leftTabs: ['features', 'spells'],
        rightTabs: ['special', 'bonus']
    });

    assert.ok(app2 instanceof ActionDisplayApp);
    assert.notEqual(app2, app1);
    assert.equal(api.activeApp, app2);
    assert.equal(app2.activePage, 3);
    assert.ok(app2.leftTabs.activeParents.has('features'));
    assert.ok(app2.leftTabs.activeParents.has('spells'));
    assert.ok(app2.rightTabs.activeParents.has('special'));
    assert.ok(app2.rightTabs.activeParents.has('bonus'));

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

test('API normalizers strictly convert valid parameters and throw on invalid inputs', () => {
    // Page normalizer
    assert.equal(normalizePage(undefined), null);
    assert.equal(normalizePage(null), null);
    assert.equal(normalizePage(2), 2);
    assert.equal(normalizePage('2'), 2);
    assert.throws(() => normalizePage(3.7), /expected a positive integer/);
    assert.throws(() => normalizePage(-1), /expected a positive integer/);
    assert.throws(() => normalizePage(0), /expected a positive integer/);
    assert.throws(() => normalizePage('abc'), /expected a positive integer/);
    assert.throws(() => normalizePage({}), /expected a positive integer/);

    // Tab column state normalizer
    assert.equal(normalizeTabColumnState(undefined), null);
    assert.equal(normalizeTabColumnState(null), null);
    assert.deepEqual(normalizeTabColumnState('spells'), {
        parents: ['spells'],
        focusedParent: 'spells',
        subTypes: []
    });
    assert.deepEqual(normalizeTabColumnState('all'), {
        parents: ['all'],
        focusedParent: 'all',
        subTypes: []
    });
    assert.deepEqual(normalizeTabColumnState(['actions', 'bonus']), {
        parents: ['actions', 'bonus'],
        focusedParent: 'actions',
        subTypes: []
    });
    assert.deepEqual(normalizeTabColumnState({ parent: 'spells', subTypes: ['level-1', 'level-2'] }), {
        parents: ['spells'],
        focusedParent: 'spells',
        subTypes: ['level-1', 'level-2']
    });

    // Tab column validation errors
    assert.throws(() => normalizeTabColumnState(''), /cannot be empty/);
    assert.throws(() => normalizeTabColumnState([]), /cannot be empty/);
    assert.throws(() => normalizeTabColumnState([123]), /expected non-empty string identifier/);
    assert.throws(() => normalizeTabColumnState(123), /Invalid tab column input type/);
    assert.throws(() => normalizeTabColumnState({ unrelated: true }), /must specify parent tab or sub-type identifiers/);

    // Tab config normalizer
    const config = normalizeTabConfig({
        leftTabs: 'spells',
        rightTabs: { parent: 'bonus', subTypes: ['level-1'] }
    });
    assert.deepEqual(config.left, {
        parents: ['spells'],
        focusedParent: 'spells',
        subTypes: []
    });
    assert.deepEqual(config.right, {
        parents: ['bonus'],
        focusedParent: 'bonus',
        subTypes: ['level-1']
    });

    // Tab config validation errors
    assert.throws(() => normalizeTabConfig('invalid'), /expected an options object/);
    assert.throws(() => normalizeTabConfig({ tabs: 'invalid' }), /expected an object/);
});

test('ActionDisplayAPI methods throw errors when invalid inputs or prerequisites are unmet', async () => {
    const coordinator = new ActionDisplay();
    const api = createAPI(coordinator);

    // 1. setPage throws when closed or when invalid page provided
    await assert.rejects(async () => await api.setPage(), /Page number is required/);
    await assert.rejects(async () => await api.setPage(1), /Action Display HUD is not open/);

    // 2. setTabs throws when closed or when invalid tabs provided
    await assert.rejects(async () => await api.setTabs(), /Tab configuration is required/);
    await assert.rejects(async () => await api.setTabs({ left: 'spells' }), /Action Display HUD is not open/);

    // 3. getActions throws when target is missing or invalid
    await assert.rejects(async () => await api.getActions(), /Actor or token target is required/);
    await assert.rejects(async () => await api.getActions('non-existent-actor'), /Cannot resolve/);

    // 4. open throws when token is invalid
    await assert.rejects(async () => await api.open('non-existent-token'), /Cannot resolve/);
});


