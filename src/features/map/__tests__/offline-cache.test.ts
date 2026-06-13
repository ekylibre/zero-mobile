import { OfflineManager } from '@maplibre/maplibre-react-native';

import type { CultivableZone } from '@core/db/models';

import { refreshOfflinePack } from '../offline-cache';

const polygon: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [2.35, 48.85],
      [2.36, 48.85],
      [2.36, 48.86],
      [2.35, 48.86],
      [2.35, 48.85],
    ],
  ],
};

function zone(id: string, geometry: GeoJSON.Geometry | null): CultivableZone {
  return {
    id,
    serverId: 1,
    name: `Zone ${id}`,
    kind: 'land_parcel',
    geometry,
    areaHectares: 1,
    deadAt: null,
    shapeSvg: null,
    updatedAtServer: 0,
  } as unknown as CultivableZone;
}

const mockedOfflineManager = OfflineManager as unknown as {
  getPacks: jest.Mock;
  createPack: jest.Mock;
  invalidatePack: jest.Mock;
  deletePack: jest.Mock;
};

describe('refreshOfflinePack', () => {
  beforeEach(() => {
    mockedOfflineManager.getPacks.mockReset();
    mockedOfflineManager.createPack.mockReset();
    mockedOfflineManager.invalidatePack.mockReset();
    mockedOfflineManager.deletePack.mockReset();
    mockedOfflineManager.getPacks.mockResolvedValue([]);
    mockedOfflineManager.createPack.mockResolvedValue({ id: 'pack-1' });
    mockedOfflineManager.invalidatePack.mockResolvedValue(undefined);
    mockedOfflineManager.deletePack.mockResolvedValue(undefined);
  });

  it('skip si aucune zone avec géométrie', async () => {
    const result = await refreshOfflinePack([zone('a', null)]);
    expect(result).toEqual({ action: 'skipped', bbox: null });
    expect(mockedOfflineManager.createPack).not.toHaveBeenCalled();
  });

  it('crée un pack si aucun existant', async () => {
    const result = await refreshOfflinePack([zone('a', polygon)]);
    expect(result.action).toBe('created');
    expect(mockedOfflineManager.createPack).toHaveBeenCalledTimes(1);
    const opts = mockedOfflineManager.createPack.mock.calls[0]![0];
    expect(opts.minZoom).toBe(8);
    expect(opts.maxZoom).toBe(14);
    expect(opts.metadata.name).toBe('zero-mobile-parcels');
    expect(Array.isArray(opts.metadata.bbox)).toBe(true);
    expect(typeof opts.mapStyle).toBe('string');
  });

  it('réutilise (invalidate) si la bbox n’a pas changé', async () => {
    // Premier appel : crée
    await refreshOfflinePack([zone('a', polygon)]);
    const createdMetadata = mockedOfflineManager.createPack.mock.calls[0]![0].metadata;
    // Deuxième appel : pack déjà présent avec la même bbox
    mockedOfflineManager.getPacks.mockResolvedValue([{ id: 'pack-1', metadata: createdMetadata }]);
    mockedOfflineManager.createPack.mockClear();

    const result = await refreshOfflinePack([zone('a', polygon)]);
    expect(result.action).toBe('unchanged');
    expect(mockedOfflineManager.invalidatePack).toHaveBeenCalledWith('pack-1');
    expect(mockedOfflineManager.createPack).not.toHaveBeenCalled();
    expect(mockedOfflineManager.deletePack).not.toHaveBeenCalled();
  });

  it('replace si la bbox a beaucoup changé', async () => {
    mockedOfflineManager.getPacks.mockResolvedValue([
      {
        id: 'pack-old',
        metadata: { name: 'zero-mobile-parcels', bbox: [10, 10, 11, 11] },
      },
    ]);

    const result = await refreshOfflinePack([zone('a', polygon)]);
    expect(result.action).toBe('replaced');
    expect(mockedOfflineManager.deletePack).toHaveBeenCalledWith('pack-old');
    expect(mockedOfflineManager.createPack).toHaveBeenCalledTimes(1);
  });
});
