import { mapProductDto } from '../product';

describe('mapProductDto', () => {
  it('mappe un worker', () => {
    expect(mapProductDto({ id: 42, name: 'Jean Dupont' }, 'workers')).toEqual({
      serverId: 42,
      productType: 'workers',
      name: 'Jean Dupont',
      variantId: null,
      variety: null,
      abilities: [],
      updatedAtServer: 0,
    });
  });

  it('mappe un equipment avec variant, variety et abilities', () => {
    expect(
      mapProductDto(
        {
          id: 7,
          name: 'Pulvérisateur',
          variant_id: 99,
          variety: 'sprayer',
          abilities: ['spray', 'spread(preparation)'],
          updated_at: '2025-01-01T00:00:00Z',
        },
        'equipments',
      ),
    ).toEqual({
      serverId: 7,
      productType: 'equipments',
      name: 'Pulvérisateur',
      variantId: 99,
      variety: 'sprayer',
      abilities: ['spray', 'spread(preparation)'],
      updatedAtServer: Date.UTC(2025, 0, 1),
    });
  });

  it('null-coalesce variant_id, variety et abilities quand absents/null', () => {
    expect(
      mapProductDto(
        { id: 1, name: 'X', variant_id: null, variety: null, abilities: null },
        'matters',
      ),
    ).toMatchObject({ variantId: null, variety: null, abilities: [] });
  });
});
