import { mapProductDto } from '../product';

describe('mapProductDto', () => {
  it('mappe un worker', () => {
    expect(mapProductDto({ id: 42, name: 'Jean Dupont' }, 'workers')).toEqual({
      serverId: 42,
      productType: 'workers',
      name: 'Jean Dupont',
      variantId: null,
      variety: null,
      updatedAtServer: 0,
    });
  });

  it('mappe un equipment avec variant et variety', () => {
    expect(
      mapProductDto(
        {
          id: 7,
          name: 'Tracteur 105ch',
          variant_id: 99,
          variety: 'tractor',
          updated_at: '2025-01-01T00:00:00Z',
        },
        'equipments',
      ),
    ).toEqual({
      serverId: 7,
      productType: 'equipments',
      name: 'Tracteur 105ch',
      variantId: 99,
      variety: 'tractor',
      updatedAtServer: Date.UTC(2025, 0, 1),
    });
  });

  it('null-coalesce variant_id et variety quand explicitement null', () => {
    expect(
      mapProductDto({ id: 1, name: 'X', variant_id: null, variety: null }, 'matters'),
    ).toMatchObject({ variantId: null, variety: null });
  });
});
