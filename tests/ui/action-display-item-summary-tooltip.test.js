import test from 'node:test';
import assert from 'node:assert/strict';
import '../setup.js';
import { Action } from '../../src/ui/action.js';
import { ActionDisplayApp } from '../../src/ui/action-display-app.js';
import { showActivityDropdown } from '../../src/ui/app/dropdown-manager.js';
import { BaseSystemAdapter } from '../../src/adapters/system/base-system-adapter.js';
import { Dnd5eSystemAdapter } from '../../src/adapters/system/dnd5e-system-adapter.js';
import { Pf1SystemAdapter } from '../../src/adapters/system/pf1-system-adapter.js';
import { Pf2eSystemAdapter } from '../../src/adapters/system/pf2e-system-adapter.js';
import { adapter } from '../../src/adapters/index.js';

test('BaseSystemAdapter.getItemSummary returns basic item summary properties and enriched description', async () => {
    const baseAdapter = new BaseSystemAdapter('generic');
    const mockItem = {
        name: 'Torch',
        type: 'equipment',
        img: 'icons/torch.webp',
        system: {
            range: { value: 20, units: 'ft' },
            damage: { value: '1' },
            description: { value: '<p>A simple [[lookup @name lowercase]]{torch}.</p>' }
        }
    };
    const action = new Action({
        id: 'torch-1',
        name: 'Torch',
        originalItem: mockItem,
        uses: { available: 5, max: 10 }
    });

    const summary = await baseAdapter.getItemSummary(action, mockItem);
    assert.ok(summary);
    assert.equal(summary.title, 'Torch');
    assert.equal(summary.subtitle, 'Equipment');
    assert.equal(summary.img, 'icons/torch.webp');
    assert.ok(summary.properties.some(p => p.label === 'Range' && p.value === '20 ft'));
    assert.ok(summary.properties.some(p => p.label === 'Damage' && p.value === '1'));
    assert.ok(summary.properties.some(p => p.label === 'Uses' && p.value === '5 / 10'));
    assert.equal(summary.description, '<p>A simple torch.</p>');
});

test('Dnd5eSystemAdapter.getItemSummary formats weapons, spells, feats, and Page 2 checks with enriched description', async () => {
    const dnd5eAdapter = new Dnd5eSystemAdapter();

    // 1. Weapon
    const weaponItem = {
        name: 'Longsword',
        type: 'weapon',
        img: 'icons/longsword.webp',
        labels: {
            activation: '1 Action',
            toHit: '+5',
            damage: '1d8+3 Slashing',
            range: '5 ft'
        },
        system: {
            type: { value: 'martialM', label: 'Martial Melee' },
            properties: new Set(['ver']),
            description: { value: '<p>The [[lookup @name lowercase]]{monster} swings a versatile sword.</p>' }
        }
    };
    const weaponAction = new Action({
        id: 'item-weapon-1',
        name: 'Longsword',
        originalItem: weaponItem
    });

    const weaponSummary = await dnd5eAdapter.getItemSummary(weaponAction, weaponItem);
    assert.ok(weaponSummary);
    assert.equal(weaponSummary.title, 'Longsword');
    assert.ok(weaponSummary.subtitle.includes('Martial Melee'));
    assert.ok(weaponSummary.subtitle.includes('1 Action'));
    assert.ok(weaponSummary.properties.some(p => p.label === 'Attack' && p.value === '+5'));
    assert.ok(weaponSummary.properties.some(p => p.label === 'Damage' && p.value === '1d8+3 Slashing'));
    assert.ok(weaponSummary.properties.some(p => p.label === 'Range' && p.value === '5 ft'));
    assert.ok(weaponSummary.properties.some(p => p.value === 'ver'));
    assert.equal(weaponSummary.description, '<p>The longsword swings a versatile sword.</p>');

    // 2. Spell
    const spellItem = {
        name: 'Fireball',
        type: 'spell',
        img: 'icons/fireball.webp',
        labels: {
            activation: '1 Action',
            damage: '8d6 Fire',
            range: '150 ft',
            save: 'DC 15 Dexterity',
            duration: 'Instantaneous',
            components: { vsm: 'V, S, M' }
        },
        system: {
            level: 3,
            school: 'evo',
            properties: new Set(['ritual']),
            description: { value: 'A bright sphere of fire.' }
        }
    };
    const spellAction = new Action({
        id: 'item-spell-1',
        name: 'Fireball',
        originalItem: spellItem
    });

    const spellSummary = await dnd5eAdapter.getItemSummary(spellAction, spellItem);
    assert.ok(spellSummary);
    assert.equal(spellSummary.title, 'Fireball');
    assert.ok(spellSummary.properties.some(p => p.label === 'Damage' && p.value === '8d6 Fire'));
    assert.ok(spellSummary.properties.some(p => p.label === 'Range' && p.value === '150 ft'));
    assert.ok(spellSummary.properties.some(p => p.label === 'Save' && p.value === 'DC 15 Dexterity'));
    assert.ok(spellSummary.properties.some(p => p.label === 'Components' && p.value === 'V, S, M'));
    assert.ok(spellSummary.properties.some(p => p.value === 'Ritual'));

    // 3. Page 2 Ability & Skill Checks
    const mockActor = {
        system: {
            abilities: {
                dex: { mod: 3, save: 5, value: 16, saveProf: { hasProficiency: true } }
            },
            skills: {
                acr: { ability: 'dex', total: 5, mod: 3, prof: { hasProficiency: true } }
            }
        }
    };
    const checkAction = new Action({
        id: 'ability-dex',
        name: 'Dexterity',
        type: 'ability',
        extra: { section: 'core', ability: 'dex' }
    });
    const saveAction = new Action({
        id: 'save-dex',
        name: 'Dexterity Save',
        type: 'save',
        extra: { section: 'core', ability: 'dex' }
    });
    const skillAction = new Action({
        id: 'skill-acr',
        name: 'Acrobatics',
        type: 'skill',
        extra: { section: 'core' }
    });

    const checkSummary = await dnd5eAdapter.getItemSummary(checkAction, null, mockActor);
    assert.equal(checkSummary.title, 'Dexterity');
    assert.equal(checkSummary.subtitle, 'Ability Check');
    assert.ok(checkSummary.properties.some(p => p.label === 'Modifier' && p.value === '+3'));
    assert.ok(checkSummary.properties.some(p => p.label === 'Score' && p.value === '16'));

    const saveSummary = await dnd5eAdapter.getItemSummary(saveAction, null, mockActor);
    assert.equal(saveSummary.subtitle, 'Saving Throw');
    assert.ok(saveSummary.properties.some(p => p.label === 'Modifier' && p.value === '+5'));
    assert.ok(saveSummary.properties.some(p => p.value === 'Proficient'));

    const skillSummary = await dnd5eAdapter.getItemSummary(skillAction, null, mockActor);
    assert.ok(skillSummary.subtitle.includes('Skill Check'));
    assert.ok(skillSummary.properties.some(p => p.label === 'Modifier' && p.value === '+5'));
});

test('Pf1SystemAdapter and Pf2eSystemAdapter getItemSummary extraction', async () => {
    const pf1 = new Pf1SystemAdapter();
    const pf2e = new Pf2eSystemAdapter();

    const pf1Item = {
        name: 'Dagger',
        type: 'weapon',
        labels: { toHit: '+4', damage: '1d4+2', range: '10 ft' },
        system: { description: { value: 'A small dagger.' } }
    };
    const pf1Action = new Action({ id: 'pf1-1', name: 'Dagger', originalItem: pf1Item });
    const pf1Summary = await pf1.getItemSummary(pf1Action, pf1Item);
    assert.equal(pf1Summary.title, 'Dagger');
    assert.ok(pf1Summary.properties.some(p => p.label === 'Attack' && p.value === '+4'));

    const pf2eItem = {
        name: 'Shortsword',
        type: 'weapon',
        system: {
            damage: { dice: 1, die: 'd6', damageType: 'piercing' },
            range: '10 ft',
            traits: { value: ['agile', 'finesse', 'versatile-s'] },
            description: { value: 'A martial shortsword.' }
        }
    };
    const pf2eAction = new Action({ id: 'pf2e-1', name: 'Shortsword', originalItem: pf2eItem });
    const pf2eSummary = await pf2e.getItemSummary(pf2eAction, pf2eItem);
    assert.equal(pf2eSummary.title, 'Shortsword');
    assert.ok(pf2eSummary.properties.some(p => p.label === 'Damage' && p.value === '1d6 piercing'));
    assert.ok(pf2eSummary.properties.some(p => p.value === 'agile'));
});

test('ActionDisplayApp triggers rich tooltip on hover + holding ? key, and hides on key release', async () => {
    adapter.system = new Dnd5eSystemAdapter();

    const mockItem = {
        name: 'Greatsword',
        type: 'weapon',
        img: 'icons/greatsword.webp',
        labels: {
            activation: '1 Action',
            toHit: '+6',
            damage: '2d6+4 Slashing',
            range: '5 ft'
        },
        system: {
            description: { value: '<p>A heavy two-handed sword.</p>' }
        }
    };

    const action = new Action({
        id: 'gs-1',
        name: 'Greatsword',
        originalItem: mockItem
    });

    const mockToken = {
        id: 'token-tooltip-1',
        name: 'Hero',
        document: { id: 'token-tooltip-1', isOwner: true },
        actor: {
            id: 'actor-tooltip-1',
            name: 'Hero',
            items: new Map([['gs-1', mockItem]]),
            getFlag: () => ({})
        }
    };

    const app = new ActionDisplayApp(mockToken);
    app.actions = [action];

    // Mock DOM elements
    const itemEl = {
        tagName: 'DIV',
        className: 'bad-action-item',
        dataset: { actionId: 'gs-1' },
        closest: (sel) => (sel === '.bad-action-item' ? itemEl : null),
        getBoundingClientRect: () => ({ left: 200, top: 100, right: 350, bottom: 140 })
    };

    // 1. Hover over item without holding ? -> No tooltip
    app._hoveredActionItem = itemEl;
    assert.equal(globalThis.game.tooltip.active, false);

    // 2. Press '?' while hovering -> Tooltip activates
    await app._onKeyDown({ key: '?', shiftKey: true, target: { tagName: 'DIV' } });
    assert.equal(globalThis.game.tooltip.active, true);
    assert.ok(globalThis.game.tooltip.options.html.includes('Greatsword'));
    assert.ok(globalThis.game.tooltip.options.html.includes('2d6+4 Slashing'));
    assert.equal(globalThis.game.tooltip.options.direction, 'RIGHT');

    // 3. Release '?' -> Tooltip deactivates
    app._onKeyUp({ key: '?', shiftKey: false });
    assert.equal(globalThis.game.tooltip.active, false);

    // 4. Hold '?' first, then hover over item -> Tooltip activates
    await app._onKeyDown({ key: '?', shiftKey: true, target: { tagName: 'DIV' } });
    await app._boundOnPointerOver({ target: itemEl });
    assert.equal(globalThis.game.tooltip.active, true);

    // 5. Pointer leaves item -> Tooltip deactivates
    app._boundOnPointerOut({ target: itemEl, relatedTarget: null });
    assert.equal(globalThis.game.tooltip.active, false);

    // 6. Test window blur clears state
    await app._onKeyDown({ key: '?', shiftKey: true, target: { tagName: 'DIV' } });
    await app._boundOnPointerOver({ target: itemEl });
    assert.equal(globalThis.game.tooltip.active, true);
    app._onWindowBlur();
    assert.equal(globalThis.game.tooltip.active, false);
    assert.equal(app._isQuestionMarkHeld, false);

    // 7. Ignore '?' when typing inside search input
    await app._onKeyDown({ key: '?', shiftKey: true, target: { tagName: 'INPUT' } });
    assert.equal(app._isQuestionMarkHeld, false);
    assert.equal(globalThis.game.tooltip.active, false);

    // 8. Close app cleans up
    await app.close();
    assert.equal(app._hoveredActionItem, null);
    assert.equal(app._isQuestionMarkHeld, false);
});

test('ActionDisplayApp triggers rich tooltip for activities in dropdown menus when holding ?', async () => {
    adapter.system = new Dnd5eSystemAdapter();

    const parentItem = {
        name: 'Versatile Staff',
        type: 'weapon',
        system: { description: { value: 'A magical staff.' } }
    };

    const sub1 = new Action({
        id: 'sub-staff-1',
        name: 'Staff Strike',
        originalItem: parentItem,
        originalActivity: {
            name: 'Staff Strike',
            labels: {
                activation: '1 Action',
                toHit: '+4',
                damage: '1d6+2 Bludgeoning',
                range: '5 ft'
            }
        }
    });

    const sub2 = new Action({
        id: 'sub-staff-2',
        name: 'Two-Handed Strike',
        originalItem: parentItem,
        originalActivity: {
            name: 'Two-Handed Strike',
            labels: {
                activation: '1 Action',
                toHit: '+4',
                damage: '1d8+2 Bludgeoning',
                range: '5 ft'
            }
        }
    });

    const parentAction = new Action({
        id: 'parent-staff',
        name: 'Versatile Staff',
        originalItem: parentItem,
        subactions: [sub1, sub2]
    });

    const app = new ActionDisplayApp({
        actor: { isOwner: true }
    });
    app.actions = [parentAction];

    // Mock DOM action card and menu elements
    const targetCard = {
        tagName: 'DIV',
        className: 'bad-action-item',
        dataset: { actionId: 'parent-staff' },
        classList: { add() {}, remove() {}, contains: () => false },
        getBoundingClientRect: () => ({ left: 100, top: 100, right: 250, bottom: 140, width: 150, height: 40 })
    };

    const sub1Li = {
        tagName: 'LI',
        className: 'context-item',
        dataset: {},
        _listeners: {},
        addEventListener(evt, fn) { this._listeners[evt] = fn; },
        querySelector: () => null,
        insertAdjacentHTML: () => {},
        getBoundingClientRect: () => ({ left: 100, top: 140, right: 250, bottom: 175, width: 150, height: 35 })
    };

    const sub2Li = {
        tagName: 'LI',
        className: 'context-item',
        dataset: {},
        _listeners: {},
        addEventListener(evt, fn) { this._listeners[evt] = fn; },
        querySelector: () => null,
        insertAdjacentHTML: () => {},
        getBoundingClientRect: () => ({ left: 100, top: 175, right: 250, bottom: 210, width: 150, height: 35 })
    };

    const mockMenuEl = {
        remove: () => {},
        querySelectorAll: (sel) => (sel === '.context-item' ? [sub1Li, sub2Li] : []),
        style: { setProperty() {} },
        children: []
    };

    const originalQuerySelector = document.querySelector;
    document.querySelector = (sel) => {
        if (sel.includes('#context-menu')) return mockMenuEl;
        return null;
    };

    try {
        await showActivityDropdown(app, targetCard, [sub1, sub2], { preventDefault() {}, stopPropagation() {} });

        // Verify subaction attached to LI
        assert.equal(sub1Li._badSubaction, sub1);
        assert.equal(sub2Li._badSubaction, sub2);

        // 1. Hover over first activity while holding '?'
        await app._onKeyDown({ key: '?', shiftKey: true, target: { tagName: 'DIV' } });
        assert.equal(app._isQuestionMarkHeld, true);

        // Trigger pointerover on sub1Li
        await sub1Li._listeners.pointerover();
        assert.equal(globalThis.game.tooltip.active, true);
        assert.ok(globalThis.game.tooltip.options.html.includes('Staff Strike'));
        assert.ok(globalThis.game.tooltip.options.html.includes('1d6+2 Bludgeoning'));

        // 2. Move pointer to second activity sub2Li
        sub1Li._listeners.pointerout({ relatedTarget: sub2Li });
        await sub2Li._listeners.pointerover();
        assert.equal(globalThis.game.tooltip.active, true);
        assert.ok(globalThis.game.tooltip.options.html.includes('Two-Handed Strike'));
        assert.ok(globalThis.game.tooltip.options.html.includes('1d8+2 Bludgeoning'));

        // 3. Release '?'
        app._onKeyUp({ key: '?', shiftKey: false });
        assert.equal(globalThis.game.tooltip.active, false);

        // 4. Close dropdown cleans up
        await app._activeLeftClickMenu.close();
        assert.equal(app._activeLeftClickMenu, null);
    } finally {
        document.querySelector = originalQuerySelector;
    }
});

test('ActionDisplayApp triggers rich tooltip on hover when showItemSummaries toggle is active without holding ?', async () => {
    adapter.system = new Dnd5eSystemAdapter();

    const mockItem = {
        name: 'Dagger of Venom',
        type: 'weapon',
        img: 'icons/dagger.webp',
        labels: {
            activation: '1 Action',
            toHit: '+5',
            damage: '1d4+3 Piercing',
            range: '20/60 ft'
        },
        system: {
            description: { value: '<p>A poisoned dagger.</p>' }
        }
    };

    const action = new Action({
        id: 'dagger-1',
        name: 'Dagger of Venom',
        originalItem: mockItem
    });

    const app = new ActionDisplayApp({
        actor: { isOwner: true }
    });
    app.actions = [action];

    const itemEl = {
        tagName: 'DIV',
        className: 'bad-action-item',
        dataset: { actionId: 'dagger-1' },
        closest: (sel) => (sel === '.bad-action-item' ? itemEl : null),
        getBoundingClientRect: () => ({ left: 200, top: 100, right: 350, bottom: 140 })
    };

    // 1. Initial state: showItemSummaries is false -> hover does not activate tooltip
    await game.settings.set('bakana-action-display', 'showItemSummaries', false);
    await app._boundOnPointerOver({ target: itemEl });
    assert.equal(globalThis.game.tooltip.active, false);

    // 2. Enable showItemSummaries via toggle button while hovered -> tooltip activates immediately
    await app._onToggleItemSummaries({}, {});
    assert.equal(game.settings.get('bakana-action-display', 'showItemSummaries'), true);
    assert.equal(globalThis.game.tooltip.active, true);
    assert.ok(globalThis.game.tooltip.options.html.includes('Dagger of Venom'));
    assert.ok(globalThis.game.tooltip.options.html.includes('1d4+3 Piercing'));

    // 3. Pointer moves out -> tooltip deactivates
    app._boundOnPointerOut({ target: itemEl, relatedTarget: null });
    assert.equal(globalThis.game.tooltip.active, false);

    // 4. Hover again with showItemSummaries still true -> tooltip activates without key press
    await app._boundOnPointerOver({ target: itemEl });
    assert.equal(globalThis.game.tooltip.active, true);

    // 5. Keyup does not dismiss tooltip when showItemSummaries is active
    app._onKeyUp({ key: '?', shiftKey: false });
    assert.equal(globalThis.game.tooltip.active, true);

    // 6. Window blur does not dismiss tooltip when showItemSummaries is active
    app._onWindowBlur();
    assert.equal(globalThis.game.tooltip.active, true);

    // 7. Toggle off showItemSummaries -> tooltip deactivates
    await app._onToggleItemSummaries({}, {});
    assert.equal(game.settings.get('bakana-action-display', 'showItemSummaries'), false);
    assert.equal(globalThis.game.tooltip.active, false);

    // 8. Hovering over the ? button itself or other control buttons does NOT activate a tooltip
    const buttonEl = {
        tagName: 'BUTTON',
        className: 'bad-control-btn bad-summary-toggle-btn',
        closest: (sel) => null
    };
    await app._boundOnPointerOver({ target: buttonEl });
    assert.equal(globalThis.game.tooltip.active, false);
    assert.equal(app._hoveredActionItem, null);

    await app.close();
});

test('ActionDisplayApp formats descriptions with roll tables and adds bad-summary-has-table class', async () => {
    const tableHtml = `
        <table>
            <thead>
                <tr>
                    <th>d100</th>
                    <th>Familiarity</th>
                    <th>Mishap</th>
                    <th>Similar Area</th>
                    <th>Off Target</th>
                    <th>On Target</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>01–05</td>
                    <td>Permanent circle</td>
                    <td>—</td>
                    <td>—</td>
                    <td>—</td>
                    <td>01–100</td>
                </tr>
            </tbody>
        </table>
    `;

    const mockItem = {
        id: 'teleport-1',
        name: 'Teleport',
        type: 'spell',
        system: {
            description: { value: tableHtml },
            level: 7,
            school: 'con'
        }
    };

    const action = new Action({
        id: 'teleport-1',
        name: 'Teleport',
        originalItem: mockItem
    });

    const app = new ActionDisplayApp({
        actor: { isOwner: true }
    });
    app.actions = [action];

    // 1. Format HTML and verify table class is attached
    const summary = await adapter.getItemSummary(action, mockItem, app.actor);
    const html = app._formatItemSummaryHtml(summary);
    assert.ok(html.includes('bad-summary-has-table'), 'Tooltip should have bad-summary-has-table class');
    assert.ok(html.includes('<table>'), 'Tooltip should contain table element');
    assert.ok(html.includes('Permanent circle'));

    // 2. Verify _showItemSummaryTooltip passes bad-summary-has-table-wrapper
    await game.settings.set('bakana-action-display', 'showItemSummaries', true);
    const itemEl = {
        tagName: 'DIV',
        className: 'bad-action-item',
        dataset: { actionId: 'teleport-1' },
        closest: (sel) => (sel === '.bad-action-item' ? itemEl : null),
        getBoundingClientRect: () => ({ left: 200, top: 100, right: 350, bottom: 140 })
    };

    await app._boundOnPointerOver({ target: itemEl });
    assert.equal(globalThis.game.tooltip.active, true);
    assert.ok(globalThis.game.tooltip.options.cssClass.includes('bad-summary-has-table-wrapper'));
    assert.ok(globalThis.game.tooltip.options.html.includes('bad-summary-has-table'));

    // 3. Verify _chooseTooltipDirection handles wide table tooltips intelligently
    // Screen width 1920, element at left 1500 (spaceRight = 1920 - 1650 = 270 < 500) -> Should choose LEFT
    const rightSideEl = {
        getBoundingClientRect: () => ({ left: 1500, top: 100, right: 1650, bottom: 140 })
    };
    assert.equal(app._chooseTooltipDirection(rightSideEl, true), 'LEFT');

    // Element at left 100 (spaceRight = 1920 - 250 = 1670 >= 500) -> Should choose RIGHT
    const leftSideEl = {
        getBoundingClientRect: () => ({ left: 100, top: 100, right: 250, bottom: 140 })
    };
    assert.equal(app._chooseTooltipDirection(leftSideEl, true), 'RIGHT');

    // 4. Verify _calculateTableTooltipWidth and _applyTooltipWidth dynamic sizing
    const mockTooltipEl = {
        style: {
            properties: {},
            setProperty(k, v) { this.properties[k] = v; },
            removeProperty(k) { delete this.properties[k]; }
        }
    };

    const origQuerySelector = document.querySelector;
    document.querySelector = (sel) => {
        if (sel.includes('#tooltip')) return mockTooltipEl;
        return null;
    };

    try {
        const calculatedWidth = app._calculateTableTooltipWidth(tableHtml);
        assert.ok(calculatedWidth >= 340 && calculatedWidth <= 680, 'Calculated width should be bounded between 340px and 680px');

        app._applyTooltipWidth(504);
        assert.equal(mockTooltipEl.style.properties['width'], '504px');
        assert.equal(mockTooltipEl.style.properties['max-width'], '504px');
        assert.equal(mockTooltipEl.style.properties['min-width'], '340px');
        assert.equal(mockTooltipEl.style.properties['--bad-tooltip-width'], '504px');
        assert.equal(mockTooltipEl.style.properties['--bad-tooltip-max-width'], '504px');

        // Hide tooltip cleans up style properties
        app._hideItemSummaryTooltip();
        assert.equal(mockTooltipEl.style.properties['width'], undefined);
        assert.equal(mockTooltipEl.style.properties['--bad-tooltip-width'], undefined);
    } finally {
        document.querySelector = origQuerySelector;
    }

    await game.settings.set('bakana-action-display', 'showItemSummaries', false);
    await app.close();
});


