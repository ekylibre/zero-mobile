import type { Database } from '@nozbe/watermelondb';

import type { EkylibreApiClient } from '@core/api/client';
import { ApiError, AuthError, NetworkError } from '@core/api/errors';
import type { ProviderTag } from '@core/api/types';
import { runInitialSync } from '@features/catalog/initial-sync';

import { runPushCycle, type PushReport } from '../push-engine';
import { runSyncCycle, type SyncPhase } from '../sync-cycle';

jest.mock('@features/catalog/initial-sync', () => ({
  runInitialSync: jest.fn(),
}));
jest.mock('../push-engine', () => ({
  runPushCycle: jest.fn(),
}));

const mockedInitialSync = runInitialSync as jest.MockedFunction<typeof runInitialSync>;
const mockedPushCycle = runPushCycle as jest.MockedFunction<typeof runPushCycle>;

const PROVIDER: ProviderTag = {
  vendor: 'ekylibre-mobile',
  name: 'zero-mobile',
  id: 'placeholder',
  data: { app_version: '0.1.0', os: 'ios', locale: 'fr-FR' },
};

const baseDeps = {
  database: {} as Database,
  api: {} as EkylibreApiClient,
  buildProvider: () => PROVIDER,
};

const successPushReport: PushReport = {
  attempted: 2,
  succeeded: 2,
  validationFailed: 0,
  retried: 0,
  missingReferences: 0,
};

beforeEach(() => {
  mockedInitialSync.mockReset();
  mockedPushCycle.mockReset();
});

describe('runSyncCycle — happy path', () => {
  it('exécute pull puis push, renvoie pullOk + pushReport', async () => {
    mockedInitialSync.mockResolvedValue(undefined);
    mockedPushCycle.mockResolvedValue(successPushReport);

    const report = await runSyncCycle(baseDeps);

    expect(mockedInitialSync).toHaveBeenCalledTimes(1);
    expect(mockedPushCycle).toHaveBeenCalledTimes(1);
    expect(report).toEqual({
      pullOk: true,
      pullError: null,
      pushReport: successPushReport,
      pushError: null,
    });
  });

  it("appelle onPhase dans l'ordre pulling → pushing", async () => {
    mockedInitialSync.mockResolvedValue(undefined);
    mockedPushCycle.mockResolvedValue(successPushReport);

    const phases: SyncPhase[] = [];
    await runSyncCycle({ ...baseDeps, onPhase: (p) => phases.push(p) });

    expect(phases).toEqual(['pulling', 'pushing']);
  });

  it('appelle initial-sync avec api+database, et push-engine avec les 3 deps', async () => {
    mockedInitialSync.mockResolvedValue(undefined);
    mockedPushCycle.mockResolvedValue(successPushReport);

    await runSyncCycle(baseDeps);

    expect(mockedInitialSync).toHaveBeenCalledWith({
      api: baseDeps.api,
      database: baseDeps.database,
    });
    expect(mockedPushCycle).toHaveBeenCalledWith({
      database: baseDeps.database,
      api: baseDeps.api,
      buildProvider: baseDeps.buildProvider,
    });
  });
});

describe("runSyncCycle — pull en échec n'empêche pas le push", () => {
  it('marque pullOk=false + pullError, mais lance quand même le push', async () => {
    mockedInitialSync.mockRejectedValue(new NetworkError('offline'));
    mockedPushCycle.mockResolvedValue(successPushReport);

    const report = await runSyncCycle(baseDeps);

    expect(mockedPushCycle).toHaveBeenCalledTimes(1);
    expect(report.pullOk).toBe(false);
    expect(report.pullError).toBe('offline');
    expect(report.pushReport).toEqual(successPushReport);
    expect(report.pushError).toBeNull();
  });

  it("passe quand même les phases pulling puis pushing dans l'ordre", async () => {
    mockedInitialSync.mockRejectedValue(new ApiError(500, 'boom'));
    mockedPushCycle.mockResolvedValue(successPushReport);

    const phases: SyncPhase[] = [];
    await runSyncCycle({ ...baseDeps, onPhase: (p) => phases.push(p) });

    expect(phases).toEqual(['pulling', 'pushing']);
  });

  it('formate les erreurs non-Error en string', async () => {
    mockedInitialSync.mockRejectedValue('string error');
    mockedPushCycle.mockResolvedValue(successPushReport);

    const report = await runSyncCycle(baseDeps);
    expect(report.pullError).toBe('string error');
  });
});

describe('runSyncCycle — push en échec', () => {
  it('marque pushError + pushReport=null si runPushCycle throw', async () => {
    mockedInitialSync.mockResolvedValue(undefined);
    mockedPushCycle.mockRejectedValue(new NetworkError('offline'));

    const report = await runSyncCycle(baseDeps);

    expect(report.pullOk).toBe(true);
    expect(report.pushReport).toBeNull();
    expect(report.pushError).toBe('offline');
  });

  it('renvoie le pushReport (avec ses échecs internes) si runPushCycle a fini', async () => {
    mockedInitialSync.mockResolvedValue(undefined);
    const partial: PushReport = {
      attempted: 3,
      succeeded: 1,
      validationFailed: 1,
      retried: 1,
      missingReferences: 0,
    };
    mockedPushCycle.mockResolvedValue(partial);

    const report = await runSyncCycle(baseDeps);

    expect(report.pushError).toBeNull();
    expect(report.pushReport).toEqual(partial);
  });
});

describe('runSyncCycle — AuthError propagation', () => {
  it('relaie AuthError du pull (sans tenter le push)', async () => {
    mockedInitialSync.mockRejectedValue(new AuthError('expired'));

    await expect(runSyncCycle(baseDeps)).rejects.toBeInstanceOf(AuthError);
    expect(mockedPushCycle).not.toHaveBeenCalled();
  });

  it('relaie AuthError du push', async () => {
    mockedInitialSync.mockResolvedValue(undefined);
    mockedPushCycle.mockRejectedValue(new AuthError('expired'));

    await expect(runSyncCycle(baseDeps)).rejects.toBeInstanceOf(AuthError);
  });
});
