import { mapCultivableZoneDto } from '../cultivable-zone';

describe('mapCultivableZoneDto', () => {
  it('mappe un land_parcel : nom complet, surface fractionnaire, dead_at', () => {
    const dto = {
      id: 1112,
      name: 'Bernessard Blé tendre d’hiver 2026',
      net_surface_area: { value: '4743/500', unit: 'hectare' },
      born_at: '2025-10-01T00:00:00.000+02:00',
      dead_at: '2026-08-31T00:00:00.000+02:00',
      shape_svg: "<svg width='180' height='180'></svg>",
      updated_at: '2025-10-01T00:00:00.000+02:00',
    };

    expect(mapCultivableZoneDto(dto)).toEqual({
      serverId: 1112,
      name: 'Bernessard Blé tendre d’hiver 2026',
      geometry: null,
      areaHectares: 4743 / 500,
      deadAt: Date.parse('2026-08-31T00:00:00.000+02:00'),
      shapeSvg: "<svg width='180' height='180'></svg>",
      updatedAtServer: Date.parse('2025-10-01T00:00:00.000+02:00'),
    });
  });

  it('parse le GeoJSON de `shape_to_geojson` quand présent (string)', () => {
    const geometry = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    };
    const result = mapCultivableZoneDto({
      id: 5,
      name: 'Parcelle test',
      shape_to_geojson: JSON.stringify(geometry),
    });
    expect(result.geometry).toEqual(geometry);
  });

  it('lit `shape_geojson` (objet) sur land_parcels/plants', () => {
    const geometry = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [2.35, 48.85],
            [2.36, 48.85],
            [2.36, 48.86],
            [2.35, 48.85],
          ],
        ],
      ],
    };
    const result = mapCultivableZoneDto({
      id: 6,
      name: 'Bernessard 2026',
      shape_geojson: geometry,
    });
    expect(result.geometry).toEqual(geometry);
  });

  it('préfère `shape_geojson` à `shape_to_geojson` quand les deux sont fournis', () => {
    const preferred = { type: 'Point', coordinates: [1, 2] };
    const fallback = { type: 'Point', coordinates: [9, 9] };
    const result = mapCultivableZoneDto({
      id: 7,
      name: 'Conflit',
      shape_geojson: preferred,
      shape_to_geojson: JSON.stringify(fallback),
    });
    expect(result.geometry).toEqual(preferred);
  });

  it('deadAt null et area fallback quand absents', () => {
    expect(mapCultivableZoneDto({ id: 1, name: 'X', area: 3.2 })).toMatchObject({
      geometry: null,
      areaHectares: 3.2,
      deadAt: null,
    });
  });

  it('convertit une surface en square_meter vers hectares', () => {
    expect(
      mapCultivableZoneDto({
        id: 2,
        name: 'Y',
        net_surface_area: { value: 25000, unit: 'square_meter' },
      }),
    ).toMatchObject({ areaHectares: 2.5 });
  });

  it('surface invalide → fallback sur area, sinon null', () => {
    expect(
      mapCultivableZoneDto({
        id: 3,
        name: 'Z',
        net_surface_area: { value: 'n/a', unit: 'hectare' },
      }),
    ).toMatchObject({ areaHectares: null });
  });

  it('renvoie geometry null si `shape_to_geojson` est invalide', () => {
    expect(
      mapCultivableZoneDto({ id: 4, name: 'W', shape_to_geojson: 'pas-du-json' }),
    ).toMatchObject({ geometry: null });
  });
});
