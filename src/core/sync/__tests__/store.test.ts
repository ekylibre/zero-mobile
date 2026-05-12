import { useSyncStore } from '../store';

describe('useSyncStore', () => {
  beforeEach(() => {
    useSyncStore.getState().reset();
  });

  it("démarre à l'état idle", () => {
    expect(useSyncStore.getState()).toMatchObject({
      status: 'idle',
      lastError: null,
      lastSyncAt: null,
    });
  });

  it('setStatus transitions vers pulling/pushing/error', () => {
    useSyncStore.getState().setStatus('pulling');
    expect(useSyncStore.getState().status).toBe('pulling');

    useSyncStore.getState().setStatus('pushing');
    expect(useSyncStore.getState().status).toBe('pushing');

    useSyncStore.getState().setStatus('idle');
    expect(useSyncStore.getState().status).toBe('idle');
  });

  it('setError(msg) bascule status à error et stocke le message', () => {
    useSyncStore.getState().setError('boom');
    expect(useSyncStore.getState()).toMatchObject({
      status: 'error',
      lastError: 'boom',
    });
  });

  it("setError(null) sort de l'état error vers idle", () => {
    useSyncStore.getState().setError('boom');
    useSyncStore.getState().setError(null);
    expect(useSyncStore.getState()).toMatchObject({
      status: 'idle',
      lastError: null,
    });
  });

  it('setError(null) ne touche pas à un status non-error en cours', () => {
    useSyncStore.getState().setStatus('pushing');
    useSyncStore.getState().setError(null);
    expect(useSyncStore.getState().status).toBe('pushing');
  });

  it('markCompleted pose un timestamp ms récent', () => {
    const before = Date.now();
    useSyncStore.getState().markCompleted();
    const after = Date.now();

    const { lastSyncAt } = useSyncStore.getState();
    expect(lastSyncAt).not.toBeNull();
    expect(lastSyncAt!).toBeGreaterThanOrEqual(before);
    expect(lastSyncAt!).toBeLessThanOrEqual(after);
  });

  it("reset remet l'état initial (status, lastError, lastSyncAt)", () => {
    useSyncStore.getState().setStatus('pulling');
    useSyncStore.getState().setError('err');
    useSyncStore.getState().markCompleted();

    useSyncStore.getState().reset();

    expect(useSyncStore.getState()).toMatchObject({
      status: 'idle',
      lastError: null,
      lastSyncAt: null,
    });
  });
});
