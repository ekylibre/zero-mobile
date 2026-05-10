import { mapCultivableZoneDto } from '../cultivable-zone';

describe('mapCultivableZoneDto', () => {
  it('mappe une parcelle complète avec géométrie', () => {
    const dto = {
      id: 12,
      name: 'Parcelle Sud',
      shape: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0],
          ],
        ],
      },
      area: 5.2,
      updated_at: '2025-03-01T08:00:00Z',
    };

    expect(mapCultivableZoneDto(dto)).toEqual({
      serverId: 12,
      name: 'Parcelle Sud',
      geometry: dto.shape,
      areaHectares: 5.2,
      updatedAtServer: Date.UTC(2025, 2, 1, 8, 0, 0),
    });
  });

  it('null-coalesce geometry et area quand absents', () => {
    expect(mapCultivableZoneDto({ id: 1, name: 'X' })).toMatchObject({
      geometry: null,
      areaHectares: null,
    });
  });
});
