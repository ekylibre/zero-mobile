import { parseSprayingHandlers, unitForHandler } from '../spraying-handlers';

const CANONICAL_COUNT = 7;

function definitionWith(handlers: unknown): unknown {
  return {
    parameters: [
      { name: 'cultivation', type: 'target' },
      { name: 'plant_medicine', type: 'input', handlers },
      { name: 'driver', type: 'doer' },
    ],
  };
}

describe('parseSprayingHandlers', () => {
  it('parse la forme enrichie [{name, indicator, unit}] (API 2026-05)', () => {
    const result = parseSprayingHandlers(
      definitionWith([
        { name: 'population' },
        { name: 'mass_area_density', indicator: 'mass_area_density', unit: 'kilogram_per_hectare' },
        {
          name: 'volume_area_density',
          indicator: 'volume_area_density',
          unit: 'liter_per_hectare',
        },
      ]),
    );

    expect(result).toEqual([
      { name: 'population', unit: 'unity', labelKey: 'interventions.spraying.handlers.population' },
      {
        name: 'mass_area_density',
        unit: 'kilogram_per_hectare',
        labelKey: 'interventions.spraying.handlers.mass_area_density',
      },
      {
        name: 'volume_area_density',
        unit: 'liter_per_hectare',
        labelKey: 'interventions.spraying.handlers.volume_area_density',
      },
    ]);
  });

  it('parse la forme legacy (tableau de strings) en complétant les unités (fallback)', () => {
    const result = parseSprayingHandlers(definitionWith(['net_mass', 'volume_area_density']));

    expect(result).toEqual([
      {
        name: 'net_mass',
        unit: 'kilogram',
        labelKey: 'interventions.spraying.handlers.net_mass',
      },
      {
        name: 'volume_area_density',
        unit: 'liter_per_hectare',
        labelKey: 'interventions.spraying.handlers.volume_area_density',
      },
    ]);
  });

  it('complète l’unité manquante d’un handler objet via la table canonique', () => {
    const [opt] = parseSprayingHandlers(definitionWith([{ name: 'net_volume' }]));
    expect(opt).toMatchObject({ name: 'net_volume', unit: 'liter' });
  });

  it('retombe sur la liste canonique complète si la définition est absente', () => {
    expect(parseSprayingHandlers(undefined)).toHaveLength(CANONICAL_COUNT);
    expect(parseSprayingHandlers({})).toHaveLength(CANONICAL_COUNT);
    expect(parseSprayingHandlers(definitionWith([]))).toHaveLength(CANONICAL_COUNT);
  });

  it('ignore les entrées de handler malformées', () => {
    const result = parseSprayingHandlers(definitionWith([{ name: 'population' }, 42, null]));
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('population');
  });
});

describe('unitForHandler', () => {
  it('renvoie l’unité canonique d’un handler connu', () => {
    expect(unitForHandler('volume_area_density')).toBe('liter_per_hectare');
    expect(unitForHandler('population')).toBe('unity');
  });

  it('renvoie undefined pour un handler inconnu', () => {
    expect(unitForHandler('area_density')).toBeUndefined();
  });
});
