import test from 'node:test';
import assert from 'node:assert/strict';
import '../setup.js';
import { Action } from '../../src/ui/action.js';
import { ActionDisplayApp } from '../../src/ui/action-display-app.js';
import { BaseSystemAdapter } from '../../src/adapters/system/base-system-adapter.js';
import { Dnd5eSystemAdapter } from '../../src/adapters/system/dnd5e-system-adapter.js';
import { Pf1SystemAdapter } from '../../src/adapters/system/pf1-system-adapter.js';
import { Pf2eSystemAdapter } from '../../src/adapters/system/pf2e-system-adapter.js';
import { adapter } from '../../src/adapters/index.js';

test('BaseSystemAdapter.getItemSummary returns basic item summary properties', () => {
    const baseAdapter = new BaseSystemAdapter('generic');
    const mockItem = {
        name: 'Torch',
        type: 'equipment',
        img: 'icons/torch.webp',
        system: {
            range: { value: 20, units: 'ft' },
            damage: { value: '1' },
            description: { value: '<p>A simple torch.</p>' }
        }
    };
    const action = new Action({
        id: 'torch-1',
        name: 'Torch',
        originalItem: mockItem,
        uses: { available: 5, max: 10 }
    });

    const summary = baseAdapter.getItemSummary(action, mockItem);
    assert.ok(summary);
    assert.equal(summary.title, 'Torch');
    assert.equal(summary.subtitle, 'Equipment');
    assert.equal(summary.img, 'icons/torch.webp');
    assert.ok(summary.properties.some(p => p.label === 'Range' && p.value === '20 ft'));
    assert.ok(summary.properties.some(p => p.label === 'Damage' && p.value === '1'));
    assert.ok(summary.properties.some(p => p.label === 'Uses' && p.value === '5 / 10'));
    assert.equal(summary.description, '<p>A simple torch.</p>');
});

test('Dnd5eSystemAdapter.getItemSummary formats weapons, spells, feats, and Page 2 checks', () => {
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
            description: { value: 'A versatile sword.' }
        }
    };
    const weaponAction = new Action({
        id: 'item-weapon-1',
        name: 'Longsword',
        originalItem: weaponItem
    });

    const weaponSummary = dnd5eAdapter.getItemSummary(weaponAction, weaponItem);
    assert.ok(weaponSummary);
    assert.equal(weaponSummary.title, 'Longsword');
    assert.ok(weaponSummary.subtitle.includes('Martial Melee'));
    assert.ok(weaponSummary.subtitle.includes('1 Action'));
    assert.ok(weaponSummary.properties.some(p => p.label === 'Attack' && p.value === '+5'));
    assert.ok(weaponSummary.properties.some(p => p.label === 'Damage' && p.value === '1d8+3 Slashing'));
    assert.ok(weaponSummary.properties.some(p => p.label === 'Range' && p.value === '5 ft'));
    assert.ok(weaponSummary.properties.some(p => p.value === 'ver'));

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

    const spellSummary = dnd5eAdapter.getItemSummary(spellAction, spellItem);
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

    const checkSummary = dnd5eAdapter.getItemSummary(checkAction, null, mockActor);
    assert.equal(checkSummary.title, 'Dexterity');
    assert.equal(checkSummary.subtitle, 'Ability Check');
    assert.ok(checkSummary.properties.some(p => p.label === 'Modifier' && p.value === '+3'));
    assert.ok(checkSummary.properties.some(p => p.label === 'Score' && p.value === '16'));

    const saveSummary = dnd5eAdapter.getItemSummary(saveAction, null, mockActor);
    assert.equal(saveSummary.subtitle, 'Saving Throw');
    assert.ok(saveSummary.properties.some(p => p.label === 'Modifier' && p.value === '+5'));
    assert.ok(saveSummary.properties.some(p => p.value === 'Proficient'));

    const skillSummary = dnd5eAdapter.getItemSummary(skillAction, null, mockActor);
    assert.ok(skillSummary.subtitle.includes('Skill Check'));
    assert.ok(skillSummary.properties.some(p => p.label === 'Modifier' && p.value === '+5'));
});

test('Pf1SystemAdapter and Pf2eSystemAdapter getItemSummary extraction', () => {
    const pf1 = new Pf1SystemAdapter();
    const pf2e = new Pf2eSystemAdapter();

    const pf1Item = {
        name: 'Dagger',
        type: 'weapon',
        labels: { toHit: '+4', damage: '1d4+2', range: '10 ft' },
        system: { description: { value: 'A small dagger.' } }
    };
    const pf1Action = new Action({ id: 'pf1-1', name: 'Dagger', originalItem: pf1Item });
    const pf1Summary = pf1.getItemSummary(pf1Action, pf1Item);
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
    const pf2eSummary = pf2e.getItemSummary(pf2eAction, pf2eItem);
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
    app._onKeyDown({ key: '?', shiftKey: true, target: { tagName: 'DIV' } });
    assert.equal(globalThis.game.tooltip.active, true);
    assert.ok(globalThis.game.tooltip.options.html.includes('Greatsword'));
    assert.ok(globalThis.game.tooltip.options.html.includes('2d6+4 Slashing'));
    assert.equal(globalThis.game.tooltip.options.direction, 'RIGHT');

    // 3. Release '?' -> Tooltip deactivates
    app._onKeyUp({ key: '?', shiftKey: false });
    assert.equal(globalThis.game.tooltip.active, false);

    // 4. Hold '?' first, then hover over item -> Tooltip activates
    app._onKeyDown({ key: '?', shiftKey: true, target: { tagName: 'DIV' } });
    app._boundOnPointerOver({ target: itemEl });
    assert.equal(globalThis.game.tooltip.active, true);

    // 5. Pointer leaves item -> Tooltip deactivates
    app._boundOnPointerOut({ target: itemEl, relatedTarget: null });
    assert.equal(globalThis.game.tooltip.active, false);

    // 6. Test window blur clears state
    app._onKeyDown({ key: '?', shiftKey: true, target: { tagName: 'DIV' } });
    app._boundOnPointerOver({ target: itemEl });
    assert.equal(globalThis.game.tooltip.active, true);
    app._onWindowBlur();
    assert.equal(globalThis.game.tooltip.active, false);
    assert.equal(app._isQuestionMarkHeld, false);

    // 7. Ignore '?' when typing inside search input
    app._onKeyDown({ key: '?', shiftKey: true, target: { tagName: 'INPUT' } });
    assert.equal(app._isQuestionMarkHeld, false);
    assert.equal(globalThis.game.tooltip.active, false);

    // 8. Close app cleans up
    await app.close();
    assert.equal(app._hoveredActionItem, null);
    assert.equal(app._isQuestionMarkHeld, false);
});
