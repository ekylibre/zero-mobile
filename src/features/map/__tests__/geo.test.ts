import type { CultivableZone } from '@core/db/models';

import { computeBbox, expandBbox, toFeatureCollection } from '../geo';

function makeZone(partial: Partial<CultivableZone> & { id: string }): CultivableZone {
  return {
    id: partial.id,
    serverId: partial.serverId ?? 1,
    name: partial.name ?? 'P',
    kind: partial.kind ?? 'land_parcel',
    geometry: partial.geometry ?? null,
    areaHectares: partial.areaHectares ?? null,
    deadAt: partial.deadAt ?? null,
    shapeSvg: partial.shapeSvg ?? null,
    updatedAtServer: partial.updatedAtServer ?? 0,
  } as unknown as CultivableZone;
}

describe('toFeatureCollection', () => {
  it('exclut les zones sans géométrie', () => {
    const fc = toFeatureCollection(
      [
        makeZone({ id: 'a', geometry: null }),
        makeZone({
          id: 'b',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 0],
              ],
            ],
          },
        }),
      ],
      () => false,
    );
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.properties.id).toBe('b');
  });

  it('exclut les géométries non polygonales (Point, LineString)', () => {
    const fc = toFeatureCollection(
      [makeZone({ id: 'c', geometry: { type: 'Point', coordinates: [0, 0] } as never })],
      () => false,
    );
    expect(fc.features).toHaveLength(0);
  });

  it('marque la zone sélectionnée via la propriété `selected`', () => {
    const geom: GeoJSON.Polygon = {
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
    const fc = toFeatureCollection(
      [makeZone({ id: 'x', geometry: geom }), makeZone({ id: 'y', geometry: geom })],
      (id) => id === 'y',
    );
    expect(fc.features.map((f) => [f.properties.id, f.properties.selected])).toEqual([
      ['x', false],
      ['y', true],
    ]);
  });

  it('propage kind et serverId dans les properties', () => {
    const fc = toFeatureCollection(
      [
        makeZone({
          id: 'z',
          serverId: 42,
          kind: 'plant',
          name: 'Blé',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 0],
              ],
            ],
          },
        }),
      ],
      () => false,
    );
    expect(fc.features[0]!.properties).toMatchObject({
      id: 'z',
      serverId: 42,
      kind: 'plant',
      name: 'Blé',
    });
  });
});

describe('computeBbox', () => {
  it('Polygon simple → [W,S,E,N]', () => {
    const fc: GeoJSON.FeatureCollection<GeoJSON.Polygon> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [2, 48],
                [3, 48],
                [3, 49],
                [2, 49],
                [2, 48],
              ],
            ],
          },
        },
      ],
    };
    expect(computeBbox(fc as never)).toEqual([2, 48, 3, 49]);
  });

  it('MultiPolygon agrège tous les rings', () => {
    const fc: GeoJSON.FeatureCollection<GeoJSON.MultiPolygon> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'MultiPolygon',
            coordinates: [
              [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 0],
                ],
              ],
              [
                [
                  [5, 10],
                  [6, 10],
                  [6, 11],
                  [5, 10],
                ],
              ],
            ],
          },
        },
      ],
    };
    expect(computeBbox(fc as never)).toEqual([0, 0, 6, 11]);
  });

  it('FC vide → null', () => {
    expect(computeBbox({ type: 'FeatureCollection', features: [] } as never)).toBeNull();
  });
});

describe('expandBbox', () => {
  it('élargit en latitude de ~0.045°/5km', () => {
    const out = expandBbox([2, 47, 2.5, 47.5], 5);
    expect(out[1]).toBeCloseTo(47 - 5 / 111, 4);
    expect(out[3]).toBeCloseTo(47.5 + 5 / 111, 4);
  });

  it('élargit en longitude proportionnellement à cos(latitude)', () => {
    const buffer = 5;
    const midLat = 47.25;
    const cosLat = Math.cos((midLat * Math.PI) / 180);
    const expectedDLng = buffer / (111 * cosLat);
    const out = expandBbox([2, 47, 2.5, 47.5], buffer);
    expect(out[0]).toBeCloseTo(2 - expectedDLng, 4);
    expect(out[2]).toBeCloseTo(2.5 + expectedDLng, 4);
  });

  it('clampe aux limites WGS84 (lat ±85, lng ±180)', () => {
    const out = expandBbox([-179.9, 84.9, 179.9, 84.95], 200);
    expect(out[0]).toBeGreaterThanOrEqual(-180);
    expect(out[2]).toBeLessThanOrEqual(180);
    expect(out[3]).toBeLessThanOrEqual(85);
  });
});
