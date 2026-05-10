import type { Database } from '@nozbe/watermelondb';

import type { EkylibreApiClient } from '@core/api/client';
import type { CatalogStep } from '@core/db/models';

import {
  getOrCreateSyncState,
  persistCultivableZones,
  persistProcedures,
  persistProductsForType,
  persistVariants,
  updateSyncState,
} from '../persisters';

import { runInitialSync, type InitialSyncProgress } from '../initial-sync';

jest.mock('../persisters', () => ({
  persistProcedures: jest.fn().mockResolvedValue(undefined),
  persistProductsForType: jest.fn().mockResolvedValue(undefined),
  persistCultivableZones: jest.fn().mockResolvedValue(undefined),
  persistVariants: jest.fn().mockResolvedValue(undefined),
  getOrCreateSyncState: jest.fn(),
  updateSyncState: jest.fn().mockResolvedValue(undefined),
  needsInitialSync: jest.fn(),
}));

const mockedPersistProcedures = persistProcedures as jest.MockedFunction<typeof persistProcedures>;
const mockedPersistProducts = persistProductsForType as jest.MockedFunction<
  typeof persistProductsForType
>;
const mockedPersistZones = persistCultivableZones as jest.MockedFunction<
  typeof persistCultivableZones
>;
const mockedPersistVariants = persistVariants as jest.MockedFunction<typeof persistVariants>;
const mockedGetSyncState = getOrCreateSyncState as jest.MockedFunction<typeof getOrCreateSyncState>;
const mockedUpdateSyncState = updateSyncState as jest.MockedFunction<typeof updateSyncState>;

function makeApiMock(): jest.Mocked<
  Pick<
    EkylibreApiClient,
    'listProcedures' | 'listProducts' | 'listCultivableZones' | 'listVariants'
  >
> {
  return {
    listProcedures: jest.fn().mockResolvedValue([]),
    listProducts: jest.fn().mockResolvedValue([]),
    listCultivableZones: jest.fn().mockResolvedValue([]),
    listVariants: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<EkylibreApiClient>;
}

function syncStateStub(currentStep: CatalogStep | null = null) {
  return { currentStep } as { currentStep: CatalogStep | null };
}

const fakeDb = {} as unknown as Database;

beforeEach(() => {
  mockedPersistProcedures.mockClear();
  mockedPersistProducts.mockClear();
  mockedPersistZones.mockClear();
  mockedPersistVariants.mockClear();
  mockedGetSyncState.mockReset();
  mockedUpdateSyncState.mockReset().mockResolvedValue(undefined);
});

describe('runInitialSync — premier run', () => {
  it("exécute toutes les étapes dans l'ordre canonique", async () => {
    mockedGetSyncState.mockResolvedValue(syncStateStub(null) as never);
    const api = makeApiMock();

    await runInitialSync({ api: api as unknown as EkylibreApiClient, database: fakeDb });

    expect(api.listProcedures).toHaveBeenCalledTimes(1);
    expect(api.listCultivableZones).toHaveBeenCalledTimes(1);
    expect(api.listVariants).toHaveBeenCalledTimes(1);
    expect(api.listProducts).toHaveBeenCalledTimes(3); // workers, equipments, matters
    expect(api.listProducts).toHaveBeenCalledWith('workers');
    expect(api.listProducts).toHaveBeenCalledWith('equipments');
    expect(api.listProducts).toHaveBeenCalledWith('matters');

    expect(mockedPersistProcedures).toHaveBeenCalledTimes(1);
    expect(mockedPersistProducts).toHaveBeenCalledTimes(3);
    expect(mockedPersistZones).toHaveBeenCalledTimes(1);
    expect(mockedPersistVariants).toHaveBeenCalledTimes(1);
  });

  it('marque sync_state ok à la fin', async () => {
    mockedGetSyncState.mockResolvedValue(syncStateStub(null) as never);
    const api = makeApiMock();

    await runInitialSync({ api: api as unknown as EkylibreApiClient, database: fakeDb });

    const finalCall = mockedUpdateSyncState.mock.calls.at(-1);
    expect(finalCall?.[1]).toMatchObject({
      lastPullStatus: 'ok',
      currentStep: 'done',
      lastPullError: null,
    });
    expect(typeof finalCall?.[1].lastPulledAt).toBe('number');
  });

  it('rapporte la progression pour chaque étape et sous-étape', async () => {
    mockedGetSyncState.mockResolvedValue(syncStateStub(null) as never);
    const api = makeApiMock();
    const events: InitialSyncProgress[] = [];

    await runInitialSync(
      { api: api as unknown as EkylibreApiClient, database: fakeDb },
      { onProgress: (p) => events.push(p) },
    );

    const steps = events.map((e) => e.step);
    expect(steps).toContain('procedures');
    expect(steps).toContain('products');
    expect(steps).toContain('cultivable_zones');
    expect(steps).toContain('variants');
    expect(steps[steps.length - 1]).toBe('done');

    const productSubSteps = events.filter((e) => e.step === 'products' && e.substep);
    expect(productSubSteps.map((e) => e.substep!.label)).toEqual([
      'workers',
      'equipments',
      'matters',
    ]);
  });
});

describe('runInitialSync — reprise', () => {
  it('reprend depuis cultivable_zones si interrompu là', async () => {
    mockedGetSyncState.mockResolvedValue(syncStateStub('cultivable_zones') as never);
    const api = makeApiMock();

    await runInitialSync({ api: api as unknown as EkylibreApiClient, database: fakeDb });

    expect(api.listProcedures).not.toHaveBeenCalled();
    expect(api.listProducts).not.toHaveBeenCalled();
    expect(api.listCultivableZones).toHaveBeenCalledTimes(1);
    expect(api.listVariants).toHaveBeenCalledTimes(1);
  });

  it('après "done", repart de procedures (relance manuelle)', async () => {
    mockedGetSyncState.mockResolvedValue(syncStateStub('done') as never);
    const api = makeApiMock();

    await runInitialSync({ api: api as unknown as EkylibreApiClient, database: fakeDb });

    expect(api.listProcedures).toHaveBeenCalledTimes(1);
    expect(api.listVariants).toHaveBeenCalledTimes(1);
  });

  it('repart de procedures si current_step est invalide', async () => {
    mockedGetSyncState.mockResolvedValue(syncStateStub('garbage' as never) as never);
    const api = makeApiMock();

    await runInitialSync({ api: api as unknown as EkylibreApiClient, database: fakeDb });

    expect(api.listProcedures).toHaveBeenCalledTimes(1);
  });
});

describe("runInitialSync — gestion d'erreur", () => {
  it('marque sync_state error et propage si une étape échoue', async () => {
    mockedGetSyncState.mockResolvedValue(syncStateStub(null) as never);
    const api = makeApiMock();
    api.listProducts = jest.fn().mockRejectedValue(new Error('connexion perdue')) as never;

    await expect(
      runInitialSync({ api: api as unknown as EkylibreApiClient, database: fakeDb }),
    ).rejects.toThrow('connexion perdue');

    expect(api.listProcedures).toHaveBeenCalledTimes(1);
    expect(api.listCultivableZones).not.toHaveBeenCalled();
    expect(api.listVariants).not.toHaveBeenCalled();

    const errorCall = mockedUpdateSyncState.mock.calls.find(
      ([, patch]) => patch.lastPullStatus === 'error',
    );
    expect(errorCall).toBeDefined();
    expect(errorCall?.[1].lastPullError).toBe('connexion perdue');
  });

  it("relance après erreur reprend à l'étape qui avait échoué", async () => {
    // 1er run : échec sur products
    mockedGetSyncState.mockResolvedValueOnce(syncStateStub(null) as never);
    const failingApi = makeApiMock();
    failingApi.listProducts = jest.fn().mockRejectedValue(new Error('boom')) as never;
    await expect(
      runInitialSync({ api: failingApi as unknown as EkylibreApiClient, database: fakeDb }),
    ).rejects.toThrow();

    // 2e run : sync_state.currentStep === 'products' (vu qu'on l'avait positionné)
    mockedGetSyncState.mockResolvedValueOnce(syncStateStub('products') as never);
    const recoverApi = makeApiMock();
    await runInitialSync({ api: recoverApi as unknown as EkylibreApiClient, database: fakeDb });

    expect(recoverApi.listProcedures).not.toHaveBeenCalled();
    expect(recoverApi.listProducts).toHaveBeenCalledTimes(3);
    expect(recoverApi.listCultivableZones).toHaveBeenCalledTimes(1);
    expect(recoverApi.listVariants).toHaveBeenCalledTimes(1);
  });
});
