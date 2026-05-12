import { act, renderHook } from '@testing-library/react-native';

import { AuthError, NetworkError } from '@core/api/errors';

import { useSyncStore } from '../store';
import { runSyncCycle } from '../sync-cycle';
import { useSyncCycle } from '../use-sync-cycle';

jest.mock('../sync-cycle', () => ({
  runSyncCycle: jest.fn(),
}));
// Empêche `apiClient` de tirer la chaîne d'imports qui touche RN.
jest.mock('@core/api/client', () => ({ apiClient: {} }));
jest.mock('@core/db/database', () => ({ database: {} }));
jest.mock('../provider-tag', () => ({
  buildProviderTag: jest.fn(),
  getDeviceInfo: jest.fn().mockReturnValue({ appVersion: 't', os: 'ios', locale: 'fr-FR' }),
}));

const mockedRunSyncCycle = runSyncCycle as jest.MockedFunction<typeof runSyncCycle>;

beforeEach(() => {
  mockedRunSyncCycle.mockReset();
  useSyncStore.getState().reset();
});

describe('useSyncCycle', () => {
  it('startSync appelle runSyncCycle et met status à idle en sortie', async () => {
    mockedRunSyncCycle.mockResolvedValue({
      pullOk: true,
      pullError: null,
      pushReport: {
        attempted: 1,
        succeeded: 1,
        validationFailed: 0,
        retried: 0,
        missingReferences: 0,
      },
      pushError: null,
    });

    const { result } = renderHook(() => useSyncCycle());

    await act(async () => {
      await result.current.startSync();
    });

    expect(mockedRunSyncCycle).toHaveBeenCalledTimes(1);
    expect(useSyncStore.getState().status).toBe('idle');
    expect(useSyncStore.getState().lastError).toBeNull();
    expect(useSyncStore.getState().lastSyncAt).not.toBeNull();
  });

  it('agrège pull/push errors dans lastError', async () => {
    mockedRunSyncCycle.mockResolvedValue({
      pullOk: false,
      pullError: 'offline',
      pushReport: null,
      pushError: 'boom',
    });

    const { result } = renderHook(() => useSyncCycle());

    await act(async () => {
      await result.current.startSync();
    });

    expect(useSyncStore.getState().lastError).toContain('Catalogue : offline');
    expect(useSyncStore.getState().lastError).toContain('Push : boom');
    expect(useSyncStore.getState().status).toBe('error');
  });

  it('relaie AuthError et nettoie status', async () => {
    mockedRunSyncCycle.mockRejectedValue(new AuthError('expired'));

    const { result } = renderHook(() => useSyncCycle());

    await act(async () => {
      await expect(result.current.startSync()).rejects.toBeInstanceOf(AuthError);
    });

    expect(useSyncStore.getState().status).toBe('idle');
    // AuthError n'est pas encodé dans lastError (l'AuthContext gère le redirect).
    expect(useSyncStore.getState().lastError).toBeNull();
  });

  it('encode les autres erreurs throw dans lastError', async () => {
    mockedRunSyncCycle.mockRejectedValue(new NetworkError('offline'));

    const { result } = renderHook(() => useSyncCycle());

    await act(async () => {
      await expect(result.current.startSync()).rejects.toBeInstanceOf(NetworkError);
    });

    expect(useSyncStore.getState().lastError).toBe('offline');
    expect(useSyncStore.getState().status).toBe('error');
  });

  it("ignore le 2e startSync s'il est appelé pendant le 1er (anti-réentrance)", async () => {
    let resolve: (() => void) | undefined;
    mockedRunSyncCycle.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = () => {
            r({
              pullOk: true,
              pullError: null,
              pushReport: null,
              pushError: null,
            });
          };
        }),
    );

    const { result } = renderHook(() => useSyncCycle());

    let firstPromise: Promise<unknown> | undefined;
    let secondResult: unknown;
    await act(async () => {
      firstPromise = result.current.startSync();
      // Ne pas await le 1er, on enchaîne tout de suite le 2e.
      secondResult = await result.current.startSync();
    });

    expect(secondResult).toBeNull();
    expect(mockedRunSyncCycle).toHaveBeenCalledTimes(1);

    // Cleanup : on libère le 1er pour ne pas leaker la promesse.
    await act(async () => {
      resolve?.();
      await firstPromise;
    });
  });
});
