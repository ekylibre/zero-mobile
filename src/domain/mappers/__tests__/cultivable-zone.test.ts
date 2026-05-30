import { mapCultivableZoneDto } from '../cultivable-zone';

describe('mapCultivableZoneDto', () => {
  it('mappe une parcelle complète en parsant le GeoJSON de `shape_to_geojson`', () => {
    const geometry = {
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
    };
    const dto = {
      id: 12,
      name: 'Parcelle Sud',
      // L'API renvoie le WKT ici — il doit être ignoré.
      shape: { feature: 'SRID=4326;POLYGON ((0 0, 1 0, 1 1, 0 1, 0 0))' },
      // …et le vrai GeoJSON ici, encodé en STRING.
      shape_to_geojson: JSON.stringify(geometry),
      area: 5.2,
      updated_at: '2025-03-01T08:00:00Z',
    };

    expect(mapCultivableZoneDto(dto)).toEqual({
      serverId: 12,
      name: 'Parcelle Sud',
      geometry,
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

  it('renvoie geometry null si `shape_to_geojson` est une string invalide', () => {
    expect(
      mapCultivableZoneDto({ id: 2, name: 'Y', shape_to_geojson: 'pas-du-json' }),
    ).toMatchObject({ geometry: null });
  });

  it('ignore `shape` (WKT) même si `shape_to_geojson` est absent', () => {
    expect(
      mapCultivableZoneDto({ id: 3, name: 'Z', shape: { feature: 'SRID=4326;POINT (0 0)' } }),
    ).toMatchObject({ geometry: null });
  });
});
