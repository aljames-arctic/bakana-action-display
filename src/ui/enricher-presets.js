/**
 * Enricher category definitions, default color values, and palette presets.
 */
export const ENRICHER_TYPES = [
    {
        id: 'damage',
        label: 'BAD.enricherColors.types.damage',
        desc: 'BAD.enricherColors.types.damageDesc',
        defaultColor: '#f87171',
        icon: 'fas fa-dice-d20',
        sampleText: '2d6 Slashing'
    },
    {
        id: 'check',
        label: 'BAD.enricherColors.types.check',
        desc: 'BAD.enricherColors.types.checkDesc',
        defaultColor: '#38bdf8',
        icon: 'fas fa-dice-d20',
        sampleText: 'DC 15 Dexterity'
    },
    {
        id: 'area',
        label: 'BAD.enricherColors.types.area',
        desc: 'BAD.enricherColors.types.areaDesc',
        defaultColor: '#34d399',
        icon: 'fas fa-ruler-combined',
        sampleText: '30 ft / 15 ft Cube'
    },
    {
        id: 'roll',
        label: 'BAD.enricherColors.types.roll',
        desc: 'BAD.enricherColors.types.rollDesc',
        defaultColor: '#a78bfa',
        icon: 'fas fa-dice-d20',
        sampleText: '+5 / 1d20'
    },
    {
        id: 'reference',
        label: 'BAD.enricherColors.types.reference',
        desc: 'BAD.enricherColors.types.referenceDesc',
        defaultColor: '#c5a059',
        icon: 'fas fa-book',
        sampleText: '@UUID / Reference'
    }
];

export const DEFAULT_ENRICHER_COLORS = Object.freeze(
    Object.fromEntries(ENRICHER_TYPES.map(t => [t.id, t.defaultColor]))
);

export const ENRICHER_COLOR_PRESETS = Object.freeze({
    default: {
        id: 'default',
        label: 'BAD.enricherColors.presets.default',
        colors: {
            damage: '#f87171',
            check: '#38bdf8',
            area: '#34d399',
            roll: '#a78bfa',
            reference: '#c5a059'
        }
    },
    vibrant: {
        id: 'vibrant',
        label: 'BAD.enricherColors.presets.vibrant',
        colors: {
            damage: '#ef4444',
            check: '#06b6d4',
            area: '#10b981',
            roll: '#8b5cf6',
            reference: '#d946ef'
        }
    },
    pastel: {
        id: 'pastel',
        label: 'BAD.enricherColors.presets.pastel',
        colors: {
            damage: '#fca5a5',
            check: '#7dd3fc',
            area: '#6ee7b7',
            roll: '#c4b5fd',
            reference: '#f0abfc'
        }
    },
    highContrast: {
        id: 'highContrast',
        label: 'BAD.enricherColors.presets.highContrast',
        colors: {
            damage: '#ff3333',
            check: '#00bfff',
            area: '#00ff88',
            roll: '#bf55ec',
            reference: '#ff77ff'
        }
    },
    monochrome: {
        id: 'monochrome',
        label: 'BAD.enricherColors.presets.monochrome',
        colors: {
            damage: '#e2e8f0',
            check: '#cbd5e1',
            area: '#94a3b8',
            roll: '#f1f5f9',
            reference: '#e2e8f0'
        }
    }
});

/**
 * Apply the enricher color configuration directly to CSS custom properties on :root.
 * @param {Record<string, string>} [colorsConfig={}]
 */
export function applyEnricherCssVariables(colorsConfig = {}) {
    if (typeof document === 'undefined' || !document.documentElement?.style) return;
    const root = document.documentElement;
    for (const type of ENRICHER_TYPES) {
        const color = colorsConfig?.[type.id] ?? type.defaultColor;
        root.style.setProperty(`--bad-enricher-${type.id}-color`, color);
    }
}
