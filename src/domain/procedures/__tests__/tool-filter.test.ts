import {
  getToolFilterFromDefinition,
  parseToolFilterAbilities,
  productHasAllAbilities,
} from '../tool-filter';

describe('parseToolFilterAbilities', () => {
  it('extrait l’ability d’un filter simple « is equipment and can spray »', () => {
    expect(parseToolFilterAbilities('is equipment and can spray')).toEqual(['spray']);
  });

  it('ignore l’argument entre parenthèses (extrait le verbe seul)', () => {
    expect(parseToolFilterAbilities('is equipment and can spread(preparation)')).toEqual([
      'spread',
    ]);
  });

  it('extrait plusieurs `can` distincts', () => {
    const result = parseToolFilterAbilities('is equipment and can spray and can mix');
    expect(result.sort()).toEqual(['mix', 'spray']);
  });

  it('déduplique des `can` identiques', () => {
    const result = parseToolFilterAbilities('can spray and can spray(plant_medicine)');
    expect(result).toEqual(['spray']);
  });

  it('insensible à la casse (CAN, Can, can…)', () => {
    expect(parseToolFilterAbilities('CAN Spray')).toEqual(['spray']);
  });

  it('renvoie [] pour les inputs vides ou nuls', () => {
    expect(parseToolFilterAbilities(null)).toEqual([]);
    expect(parseToolFilterAbilities(undefined)).toEqual([]);
    expect(parseToolFilterAbilities('')).toEqual([]);
  });

  it('renvoie [] quand aucun `can` n’est présent (filter purement `is X`)', () => {
    expect(parseToolFilterAbilities('is equipment')).toEqual([]);
    expect(parseToolFilterAbilities('is tractor')).toEqual([]);
  });
});

describe('productHasAllAbilities', () => {
  it('matche un produit qui a exactement l’ability requise', () => {
    expect(productHasAllAbilities(['spray'], ['spray'])).toBe(true);
  });

  it('matche un produit qui a l’ability requise parmi plusieurs', () => {
    expect(productHasAllAbilities(['sow', 'spray', 'spread(preparation)'], ['spray'])).toBe(true);
  });

  it('matche sur le verbe seul même si l’ability produit est paramétrée', () => {
    expect(productHasAllAbilities(['spread(preparation)'], ['spread'])).toBe(true);
  });

  it('refuse un produit qui n’a pas l’ability requise', () => {
    expect(productHasAllAbilities(['sow'], ['spray'])).toBe(false);
  });

  it('exige toutes les abilities requises (intersection complète)', () => {
    expect(productHasAllAbilities(['spray'], ['spray', 'mix'])).toBe(false);
    expect(productHasAllAbilities(['spray', 'mix'], ['spray', 'mix'])).toBe(true);
  });

  it('matche trivialement quand aucune ability n’est requise', () => {
    expect(productHasAllAbilities([], [])).toBe(true);
    expect(productHasAllAbilities(['spray'], [])).toBe(true);
  });

  it('refuse un produit sans ability si une est requise', () => {
    expect(productHasAllAbilities([], ['spray'])).toBe(false);
  });
});

describe('getToolFilterFromDefinition', () => {
  function defWith(parameters: unknown): unknown {
    return { parameters };
  }

  it('extrait le filter du parameter ciblé', () => {
    const filter = getToolFilterFromDefinition(
      defWith([
        { name: 'doer', filter: 'is worker' },
        { name: 'sprayer', filter: 'is equipment and can spray' },
      ]),
      'sprayer',
    );
    expect(filter).toBe('is equipment and can spray');
  });

  it('renvoie null si le parameter existe mais n’a pas de filter', () => {
    const filter = getToolFilterFromDefinition(
      defWith([{ name: 'sprayer', type: 'tool' }]),
      'sprayer',
    );
    expect(filter).toBeNull();
  });

  it('renvoie null si le parameter ciblé n’existe pas', () => {
    const filter = getToolFilterFromDefinition(
      defWith([{ name: 'doer', filter: 'is worker' }]),
      'sprayer',
    );
    expect(filter).toBeNull();
  });

  it('renvoie null pour une définition mal formée', () => {
    expect(getToolFilterFromDefinition(null, 'sprayer')).toBeNull();
    expect(getToolFilterFromDefinition(undefined, 'sprayer')).toBeNull();
    expect(getToolFilterFromDefinition({}, 'sprayer')).toBeNull();
    expect(getToolFilterFromDefinition({ parameters: 'oops' }, 'sprayer')).toBeNull();
  });
});
