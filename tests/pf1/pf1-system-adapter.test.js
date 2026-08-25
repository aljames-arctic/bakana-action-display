import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Pf1SystemAdapter } from '../../src/adapters/system/pf1-system-adapter.js';

test('Pf1SystemAdapter initialization and extractable item types', () => {
    const adapter = new Pf1SystemAdapter();
    assert.equal(adapter.systemId, 'pf1');
    assert.equal(adapter.shouldExtractItem({ type: 'spell' }), true);
    assert.equal(adapter.shouldExtractItem({ type: 'attack' }), true);
    assert.equal(adapter.shouldExtractItem({ type: 'buff' }), true);
    assert.equal(adapter.shouldExtractItem({ type: 'class' }), false);
    const defaultCategories = adapter.getDefaultCategories();
    assert.equal(defaultCategories.length, 6);
    assert.equal(defaultCategories[0].name, 'Favorites');
    assert.equal(defaultCategories[1].name, 'Weapons');
    assert.ok(defaultCategories[1].expression.includes('attack'));
    assert.equal(defaultCategories[2].name, 'Spells');
    assert.equal(defaultCategories[3].name, 'Features');
    assert.ok(defaultCategories[3].expression.includes('buff'));
    assert.equal(defaultCategories[4].name, 'Abilities');
    assert.equal(defaultCategories[5].name, 'Skills');
    assert.equal(defaultCategories[5].subcategories.length, 6);
});

test('Pf1SystemAdapter label lookups and spell sub-tab labels', () => {
    const adapter = new Pf1SystemAdapter();

    assert.equal(adapter.getItemTypeLabel('weapon'), 'PF1.InventoryWeapons');
    assert.equal(adapter.getItemTypeLabel('equipment'), 'PF1.InventoryEquipment');
    assert.equal(adapter.getItemTypeIcon('equipment'), 'fas fa-shield');
    assert.equal(adapter.getItemTypeIcon('buff'), 'fas fa-sparkles');

    assert.equal(adapter.getItemSubTabLabel('spell', 'cantrip'), 'PF1.Cantrip');
    assert.equal(adapter.getItemSubTabLabel('spell', '1'), 'PF1.SpellLevels.1');
    assert.equal(adapter.getItemSubTabLabel('spell', 'sla'), 'PF1.SpellBookSpelllike');

    assert.equal(adapter.getActionSubTabLabel('action'), 'PF1.Activation.action.Plural');
    assert.equal(adapter.getActionSubTabLabel('bonus'), 'PF1.Activation.swift.Single');
    assert.equal(adapter.getActionSubTabLabel('reaction'), 'PF1.Activation.immediate.Single');
});

test('Pf1SystemAdapter sort orders', () => {
    const adapter = new Pf1SystemAdapter();

    assert.equal(adapter.getItemTypeSortOrder('savingThrow'), 1);
    assert.equal(adapter.getItemTypeSortOrder('abilityCheck'), 2);
    assert.equal(adapter.getItemTypeSortOrder('weapon'), 3);
    assert.equal(adapter.getItemTypeSortOrder('equipment'), 4);
    assert.equal(adapter.getItemTypeSortOrder('spell'), 5);
    assert.equal(adapter.getItemSubTabSortOrder('spell', 'cantrip'), 999);
    assert.equal(adapter.getItemSubTabSortOrder('spell', '1'), 2);
    assert.equal(adapter.getItemSubTabSortOrder('spell', 'sla'), 999);
});

test('Pf1SystemAdapter modifyActions full transformation pipeline', async () => {
    const adapter = new Pf1SystemAdapter();

    const spellItem = {
        id: 'spell-1',
        name: 'Magic Missile',
        type: 'spell',
        system: {
            level: 1,
            spellbook: 'primary',
            actions: [
                {
                    id: 'act-sub-1',
                    name: 'Cast Missile',
                    activation: { type: 'standard' }
                }
            ]
        }
    };

    const buffItem = {
        id: 'buff-1',
        name: 'Haste',
        type: 'buff',
        system: {
            active: true,
            actions: []
        }
    };

    const actor = {
        items: new foundry.utils.Collection([spellItem, buffItem]),
        system: {
            attributes: {
                spells: {
                    spellbooks: {
                        primary: {
                            spells: {
                                spell1: { value: 3, max: 4 }
                            }
                        }
                    }
                }
            }
        }
    };

    const rawActions = [
        { id: 'act-spell', originalItem: spellItem },
        { id: 'act-buff', originalItem: buffItem }
    ];

    const modified = await adapter.modifyActions(rawActions, actor);

    assert.equal(modified.length, 9, 'Should format both spell and buff actions plus 6 ability actions plus Page 3 info action');

    const spellAction = modified.find(a => a.id === 'act-spell');
    assert.equal(spellAction.activationType, 'action');
    assert.deepEqual(spellAction.left, ['spell', '1']);
    assert.deepEqual(spellAction.uses, { available: 3, max: 4 });

    const buffAction = modified.find(a => a.id === 'act-buff');
    assert.deepEqual(buffAction.left, ['buff']);
    assert.equal(buffAction.isActive, true);
});

test('Pf1SystemAdapter filters unequipped items unless showUnequipped or showAll is enabled', async () => {
    const adapter = new Pf1SystemAdapter();

    const equippedWeapon = {
        id: 'wpn-1',
        name: 'Longsword',
        type: 'weapon',
        system: {
            equipped: true,
            actions: [{ id: 'a1', name: 'Slash', activation: { type: 'standard' } }]
        }
    };

    const unequippedWeapon = {
        id: 'wpn-2',
        name: 'Dagger',
        type: 'weapon',
        system: {
            equipped: false,
            actions: [{ id: 'a2', name: 'Stab', activation: { type: 'standard' } }]
        }
    };

    const actor = {
        items: new foundry.utils.Collection([equippedWeapon, unequippedWeapon]),
        flags: {
            'bakana-action-display': {
                showUnequipped_weapon: false,
                showAll: false
            }
        },
        getFlag(module, key) {
            return this.flags?.[module]?.[key] ?? false;
        }
    };

    const rawActions = [
        { id: 'act-w1', originalItem: equippedWeapon },
        { id: 'act-w2', originalItem: unequippedWeapon }
    ];

    // 1. By default, unequipped weapon is filtered out (1 equipped + 6 abilities + 1 Page 3 info = 8)
    const modified1 = await adapter.modifyActions(rawActions, actor);
    assert.equal(modified1.length, 8);
    assert.equal(modified1[0].id, 'act-w1');

    // 2. When showUnequipped_weapon is true, unequipped weapon is included with available: false (2 weapons + 6 abilities + 1 Page 3 info = 9)
    actor.flags['bakana-action-display'].showUnequipped_weapon = true;
    const modified2 = await adapter.modifyActions(rawActions, actor);
    assert.equal(modified2.length, 9);
    const unequippedAction = modified2.find(a => a.id === 'act-w2');
    assert.ok(unequippedAction);
    assert.equal(unequippedAction.available, false);
});

test('Pf1SystemAdapter context menu manager provides equip/unequip options and tab right-click handling', async () => {
    const adapter = new Pf1SystemAdapter();

    let updatedEquipped = null;
    const testItem = {
        id: 'item-1',
        name: 'Shield',
        type: 'equipment',
        system: { equipped: false },
        update: async (data) => { updatedEquipped = data['system.equipped']; }
    };

    const flags = {};
    const app = {
        actor: {
            isOwner: true,
            getFlag: (mod, key) => flags[key] ?? false,
            setFlag: (mod, key, val) => { flags[key] = val; }
        },
        actions: [
            { id: 'act-1', originalItem: testItem }
        ]
    };

    const menuItems = adapter.getContextMenuItems(app);
    const equipItem = menuItems.find(m => m.name === 'BAD.common.equipItem');
    const unequipItem = menuItems.find(m => m.name === 'BAD.common.unequipItem');

    assert.ok(equipItem);
    assert.ok(unequipItem);

    const mockEl = { dataset: { actionId: 'act-1' } };

    // Item is unequipped -> equip condition is true, unequip is false
    assert.equal(equipItem.condition(mockEl), true);
    assert.equal(unequipItem.condition(mockEl), false);

    await equipItem.callback(mockEl);
    assert.equal(updatedEquipped, true);

    // Change to equipped
    testItem.system.equipped = true;
    assert.equal(equipItem.condition(mockEl), false);
    assert.equal(unequipItem.condition(mockEl), true);

    await unequipItem.callback(mockEl);
    assert.equal(updatedEquipped, false);

    // Tab right click handling
    const tabElAll = {
        classList: { contains: (cls) => cls === 'bad-left-tab' },
        dataset: { type: 'all' }
    };
    const tabElWeapon = {
        classList: { contains: (cls) => cls === 'bad-left-tab' },
        dataset: { type: 'weapon' }
    };

    assert.equal(adapter.onTabRightClick(app, tabElAll, {}), true);
    assert.equal(flags.showAll, true);
    assert.equal(flags.showUnequipped_weapon, true);

    assert.equal(adapter.onTabRightClick(app, tabElWeapon, {}), true);
    assert.equal(flags.showUnequipped_weapon, false);

    // Context modifier flags
    const context = {
        itemTypes: [
            { id: 'all', showUnprepared: false },
            { id: 'weapon', showUnprepared: false }
        ]
    };
    adapter.modifyContext(context, app);
    assert.equal(context.itemTypes.find(t => t.id === 'all').showUnprepared, true);
    assert.equal(context.itemTypes.find(t => t.id === 'weapon').showUnprepared, true);
});

test('Pf1SystemAdapter extractCheckActions generates abilities, saves, and skills for Page 2', async () => {
    const adapter = new Pf1SystemAdapter();

    let rolledSave = null;
    let rolledAbility = null;
    let rolledSkill = null;

    const actor = {
        rollSavingThrow: (key) => { rolledSave = key; },
        rollAbilityTest: (abl) => { rolledAbility = abl; },
        rollSkill: (id) => { rolledSkill = id; },
        system: {
            skills: {
                acr: { ability: 'dex', name: 'Acrobatics' },
                crf: {
                    ability: 'int',
                    name: 'Craft',
                    subSkills: {
                        arm: { name: 'Armor' }
                    }
                }
            }
        }
    };

    const checkActions = adapter.extractCheckActions(actor);
    assert.equal(checkActions.length, 9); // 6 abilities + 3 skill actions (Acrobatics + Craft + Craft Armor)

    const strAction = checkActions.find(a => a.id === 'ability-str');
    assert.ok(strAction);
    assert.equal(strAction.page, 2);
    assert.equal(strAction.section, 'core');
    assert.equal(strAction.subactions.length, 1); // Strength has only ability check, no save

    // Save subaction on CON (Fortitude)
    const conAction = checkActions.find(a => a.id === 'ability-con');
    assert.equal(conAction.subactions.length, 2); // Con has both save and check
    const conSave = conAction.subactions.find(s => s.id === 'save-con');
    assert.equal(conSave.type, 'save');
    assert.deepEqual(conSave.left, ['savingThrow']);
    await conSave.roll({});
    assert.equal(rolledSave, 'fort');

    // Ability check subaction
    const strCheck = strAction.subactions.find(s => s.id === 'check-str');
    await strCheck.roll({});
    assert.equal(rolledAbility, 'str');

    // Skill action
    const acrSkill = checkActions.find(a => a.id === 'skill-acr');
    assert.ok(acrSkill);
    assert.equal(acrSkill.page, 2);
    assert.equal(acrSkill.section, 'other');
    await acrSkill.roll({});
    assert.equal(rolledSkill, 'acr');

    // Sub-skill action
    const crfSkill = checkActions.find(a => a.id === 'skill-crf-arm');
    assert.ok(crfSkill);
    await crfSkill.roll({});
    assert.equal(rolledSkill, 'crf.subSkills.arm');

    // Split layout on page 2
    const context = { items: checkActions };
    await adapter.modifyContext(context, { activePage: 2, actor });
    assert.equal(context.layout, 'split');
    assert.equal(context.coreItems.length, 6);
    assert.equal(context.otherItems.length, 3);
});

test('Pf1SystemAdapter getTokenInfo extracts complete token statistics and details for Page 3 showcase', async () => {
    const adapter = new Pf1SystemAdapter();

    const pf1Actor = {
        id: 'actor-pf1-paladin',
        name: 'Seelah',
        type: 'character',
        img: 'icons/svg/paladin.svg',
        system: {
            details: {
                race: 'Human',
                alignment: 'lg',
                level: { value: 5 },
                biography: { value: '<p>A valiant paladin of Iomedae.</p>' }
            },
            traits: {
                size: 'med',
                languages: {
                    value: ['common', 'celestial'],
                    custom: 'Osiriani'
                },
                senses: {
                    darkvision: 60,
                    lowLight: true,
                    custom: 'Scent'
                },
                dr: { value: '5/evil' },
                eres: { value: 'fire 10, cold 5' },
                di: { value: 'poison, disease' },
                ci: { value: 'fear' },
                dv: { value: 'unholy' }
            },
            attributes: {
                ac: {
                    normal: { total: 21 },
                    touch: { total: 11 },
                    flatFooted: { total: 20 }
                },
                speed: {
                    land: { total: 30 },
                    fly: { total: 60, maneuverability: 'good' },
                    swim: { total: 20 }
                }
            }
        },
        getRollData: () => ({})
    };

    const token = {
        name: 'Seelah (Token)',
        texture: { src: 'tokens/seelah.png' }
    };

    const info = await adapter.getTokenInfo(pf1Actor, token);
    assert.ok(info);
    assert.equal(info.name, 'Seelah (Token)');
    assert.equal(info.img, 'tokens/seelah.png');
    assert.equal(info.size, 'Medium');
    assert.equal(info.crLabel, 'Level 5');
    assert.equal(info.ac.value, 21);
    assert.ok(info.ac.label.includes('Touch: 11'));
    assert.ok(info.ac.label.includes('Flat-Footed: 20'));
    assert.equal(info.movement.primary, '30 ft');
    assert.ok(info.movement.secondaries.some(s => s.includes('Fly 60 ft')));
    assert.ok(info.movement.secondaries.some(s => s.includes('Swim 20 ft')));
    assert.ok(info.resistances.includes('DR 5/evil'));
    assert.ok(info.resistances.includes('fire 10, cold 5'));
    assert.ok(info.damageImmunities.includes('poison, disease'));
    assert.ok(info.conditionImmunities.includes('fear'));
    assert.ok(info.vulnerabilities.includes('unholy'));
    assert.ok(info.languages.includes('Common'));
    assert.ok(info.languages.includes('Celestial'));
    assert.ok(info.languages.includes('Osiriani'));
    assert.ok(info.senses.some(s => s.includes('Darkvision 60 ft')));
    assert.ok(info.senses.some(s => s.includes('Low-Light Vision')));
    assert.ok(info.senses.some(s => s.includes('Scent')));
    assert.equal(info.biography, '<p>A valiant paladin of Iomedae.</p>');
    assert.equal(info.biographyHTML, '<p>A valiant paladin of Iomedae.</p>');

    // Modify context on page 3
    const context = {};
    await adapter.modifyContext(context, { activePage: 3, actor: pf1Actor, token });
    assert.equal(context.layout, 'tokenInfo');
    assert.ok(context.tokenInfo);
    assert.equal(context.tokenInfo.name, 'Seelah (Token)');
});


