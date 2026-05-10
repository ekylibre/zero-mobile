import { mapVariantDto } from '../variant';

describe('mapVariantDto', () => {
  it('mappe les champs minimaux', () => {
    expect(mapVariantDto({ id: 1, name: 'Glyphosate 360' })).toEqual({
      serverId: 1,
      name: 'Glyphosate 360',
      category: 'unknown',
      unit: null,
      updatedAtServer: 0,
    });
  });

  it("utilise la catégorie et l'unité quand disponibles", () => {
    expect(
      mapVariantDto({
        id: 2,
        name: 'Round-up',
        category: 'plant_medicine',
        unit: 'liter',
      }),
    ).toMatchObject({
      category: 'plant_medicine',
      unit: 'liter',
    });
  });
});
