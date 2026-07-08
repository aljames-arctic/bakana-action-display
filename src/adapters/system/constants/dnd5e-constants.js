export const SORT_ORDERS = {
    tabs: {
        'spell': {
            'all': 0, 'level_0': 1, 'level_1': 2, 'level_2': 3, 'level_3': 4,
            'level_4': 5, 'level_5': 6, 'level_6': 7, 'level_7': 8, 'level_8': 9,
            'level_9': 10, 'itemCharges': 99
        },
        'weapon': {
            'all': 0, 'simpleM': 1, 'martialM': 2, 'simpleR': 3, 'martialR': 4,
            'natural': 5, 'improv': 6, 'siege': 7
        },
        'equipment': {
            'all': 0, 'light': 1, 'medium': 2, 'heavy': 3, 'shield': 4,
            'clothing': 5, 'trinket': 6, 'ring': 7, 'rod': 8, 'wand': 9,
            'wondrous': 10, 'vehicle': 11, 'natural': 12
        },
        'economy': {
            'all': 0, 'action': 1, 'bonus': 2, 'reaction': 3, 'other': 4,
            'special': 5, 'legendary': 6, 'mythic': 7, 'crew': 8, 'lair': 9,
            'minute': 10, 'hour': 11, 'day': 12, 'none': 13
        },
        'components': { 'vocal': 0, 'somatic': 1, 'material': 2 }
    },
    item_type: {
        'weapon': 1,
        'equipment': 2,
        'spell': 3,
        'consumable': 4,
        'tool': 5,
        'backpack': 6,
        'loot': 7,
        'feat': 8
    }
};

export const ALLOWED_TYPES = new Set(['weapon', 'equipment', 'consumable', 'tool', 'backpack', 'loot', 'feat', 'spell']);

export const ICONS = {
    item_type: {
        'equipment': 'fas fa-shield',
        'tool': 'fas fa-hammer',
        'backpack': 'fas fa-sack',
        'loot': 'fas fa-gem'
    },
    action_type: {
        'economy': 'fas fa-stopwatch',
        'components': 'fas fa-magic'
    }
};

export const LABEL_KEYS = {
    item_type: {
        'all': ['BAD.core.allItems', 'All Items'],
        'weapon': ['DND5E.ItemTypeWeapon', 'Weapon'],
        'equipment': ['DND5E.ItemTypeEquipment', 'Equipment'],
        'consumable': ['DND5E.ItemTypeConsumable', 'Consumable'],
        'tool': ['DND5E.ItemTypeTool', 'Tool'],
        'backpack': ['DND5E.ItemTypeContainer', 'Container'],
        'loot': ['DND5E.ItemTypeLoot', 'Loot'],
        'feat': ['DND5E.ItemTypeFeat', 'Feature'],
        'spell': ['DND5E.ItemTypeSpell', 'Spell'],
        'other': ['DND5E.ActionOther', 'Other'],
        'hidden': ['BAD.core.hidden', 'Hidden']
    },
    action_type: {
        'economy': ['BAD.common.actionEconomy', 'Action Economy'],
        'components': ['BAD.common.spellComponents', 'Spell Components']
    },
    action_subtab: {
        'all': ['BAD.core.allActions', 'All Actions'],
        'action': ['DND5E.Action', 'Action'],
        'bonus': ['DND5E.BonusAction', 'Bonus Action'],
        'reaction': ['DND5E.Reaction', 'Reaction'],
        'minute': ['DND5E.TimeMinute', 'Minute'],
        'hour': ['DND5E.TimeHour', 'Hour'],
        'day': ['DND5E.TimeDay', 'Day'],
        'legendary': ['DND5E.LegendaryAction', 'Legendary'],
        'mythic': ['DND5E.MythicAction', 'Mythic'],
        'lair': ['DND5E.LairAction', 'Lair'],
        'crew': ['DND5E.CrewAction', 'Crew'],
        'special': ['DND5E.Special', 'Special'],
        'none': ['DND5E.None', 'None'],
        'vocal': ['DND5E.ComponentVerbal', 'Verbal'],
        'somatic': ['DND5E.ComponentSomatic', 'Somatic'],
        'material': ['DND5E.ComponentMaterial', 'Material']
    }
};
