import { useCallback, useRef } from 'react';

import { apiClient } from '@core/api/client';
import { AuthError } from '@core/api/errors';
import { database } from '@core/db/database';

import { buildProviderTag, getDeviceInfo } from './provider-tag';
import { runSyncCycle, type SyncCycleReport } from './sync-cycle';
import { useSyncStore, type SyncStatus } from './store';

export interface UseSyncCycleResult {
  /**
   * Lance un cycle de sync complet (pull catalogue + push interventions).
   * Idempotent : un appel pendant qu'un cycle tourne déjà retourne `null`
   * sans rien déclencher (évite double-tap accidentel sur la connexion
   * flaky, qui poserait potentiellement un doublon serveur si l'idempotence
   * Ekylibre n'est pas garantie — cf. arch §11.1).
   */
  startSync: () => Promise<SyncCycleReport | null>;
  status: SyncStatus;
  lastError: string | null;
  lastSyncAt: number | null;
  isBusy: boolean;
}

const SYNC_PHASE_STATUSES: SyncStatus[] = ['pulling', 'pushing'];

export function useSyncCycle(): UseSyncCycleResult {
  const status = useSyncStore((s) => s.status);
  const lastError = useSyncStore((s) => s.lastError);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);

  // Lock anti-réentrance. On utilise une ref plutôt que `status` car le
  // reload du status (via subscribe Zustand) est asynchrone — la ref bouge
  // synchroniquement.
  const inFlight = useRef(false);

  const startSync = useCallback(async (): Promise<SyncCycleReport | null> => {
    if (inFlight.current) return null;
    inFlight.current = true;

    const store = useSyncStore.getState();
    store.setError(null);

    try {
      const report = await runSyncCycle({
        database,
        api: apiClient,
        buildProvider: (uuid) => buildProviderTag(uuid, getDeviceInfo()),
        onPhase: (phase) => store.setStatus(phase),
      });

      const errors: string[] = [];
      if (report.pullError) errors.push(`Catalogue : ${report.pullError}`);
      if (report.pushError) errors.push(`Push : ${report.pushError}`);
      store.setError(errors.length > 0 ? errors.join('\n') : null);
      // Si setError(null) a été appelé, le status est resté tel quel
      // (pulling/pushing). On le force à idle ici pour signaler la fin.
      if (errors.length === 0) store.setStatus('idle');

      store.markCompleted();
      return report;
    } catch (error) {
      // AuthError : le client API a déjà notifié AuthContext qui purge la
      // session. On nettoie juste l'état du store et on relaie pour ne pas
      // masquer l'erreur en cas de catch ailleurs.
      store.setStatus('idle');
      if (!(error instanceof AuthError)) {
        store.setError(error instanceof Error ? error.message : String(error));
      }
      store.markCompleted();
      throw error;
    } finally {
      inFlight.current = false;
    }
  }, []);

  return {
    startSync,
    status,
    lastError,
    lastSyncAt,
    isBusy: SYNC_PHASE_STATUSES.includes(status),
  };
}
