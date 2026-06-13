import type { Database } from '@nozbe/watermelondb';

import type { EkylibreApiClient } from '@core/api/client';
import { AuthError } from '@core/api/errors';
import type { ProviderTag } from '@core/api/types';
import { trackSyncCycle } from '@core/observability/sentry';
import { runInitialSync } from '@features/catalog/initial-sync';

import { runPushCycle, type PushReport } from './push-engine';

// ---- Types ----

export type SyncPhase = 'pulling' | 'pushing';

export interface SyncCycleDeps {
  database: Database;
  api: EkylibreApiClient;
  buildProvider: (clientUuid: string) => ProviderTag;
  /**
   * Notification de phase pour la UI (typiquement
   * `(phase) => useSyncStore.getState().setStatus(phase)`). Optionnel pour
   * faciliter les tests qui n'ont pas besoin du store.
   */
  onPhase?: (phase: SyncPhase) => void;
}

export interface SyncCycleReport {
  /** True si le pull catalogue est passé sans exception. */
  pullOk: boolean;
  /** Message d'erreur du pull si échec, sinon null. */
  pullError: string | null;
  /** Rapport du push (null si le push lui-même a planté avant le 1er tour). */
  pushReport: PushReport | null;
  /** Message d'erreur du push si échec global, sinon null. */
  pushError: string | null;
}

// ---- Orchestrateur ----

/**
 * Cycle de sync complet (cf. `docs/architecture.md` §6).
 *
 * Phase 1 — pull catalogue : on réutilise `runInitialSync` (idempotent).
 * Phase 2 — push interventions : `runPushCycle` (boucle dédiée par
 * intervention, ADR-03).
 *
 * Particularités :
 * - **Pull failure ≠ stop** : si le pull échoue (réseau, parse), on tente
 *   quand même le push. Les lookups push viennent de la base locale (pas
 *   du fetch du jour), donc le push est robuste à un catalogue stale.
 * - **AuthError remonte tel quel** : 401 sur pull ou push interrompt le
 *   cycle pour que `AuthContext` purge le token et redirige vers Login.
 * - **Pas d'exception en sortie** (sauf AuthError) : tout est encodé dans
 *   le `SyncCycleReport`. Le caller décide quoi afficher.
 */
export async function runSyncCycle(deps: SyncCycleDeps): Promise<SyncCycleReport> {
  const { database, api, buildProvider, onPhase } = deps;
  const cycleStart = Date.now();

  // ---- Phase 1 : pull ----
  onPhase?.('pulling');
  let pullOk = false;
  let pullError: string | null = null;
  try {
    await runInitialSync({ api, database });
    pullOk = true;
  } catch (error) {
    if (error instanceof AuthError) throw error;
    pullError = formatError(error);
  }

  // ---- Précache des tuiles carto (P7.4 — temporairement désactivé) ----
  //
  // MapLibre Native (Android) ne sait pas charger un styleUri `file://` local
  // via son resource loader → `OfflineManager.createPack` échoue silencieusement
  // avec « Unable to parse resourceUrl ». Le pré-cache par bbox est désactivé
  // jusqu'à ce qu'on héberge `osm-style.json` sur une URL publique stable
  // (cf. docs/CHANGELOG-v1.md, P8 — désactivation P7.4 sur device).
  //
  // En attendant, l'**ambient cache** natif de MapLibre cache automatiquement
  // les tuiles visitées : ça couvre l'usage type « charger la carte en Wi-Fi
  // puis garder la zone vue hors-ligne ».
  //
  // import { triggerOfflineRefresh } from '@features/map/offline-cache';
  // if (pullOk) void triggerOfflineRefresh(database);

  // ---- Phase 2 : push ----
  onPhase?.('pushing');
  let pushReport: PushReport | null = null;
  let pushError: string | null = null;
  try {
    pushReport = await runPushCycle({ database, api, buildProvider });
  } catch (error) {
    if (error instanceof AuthError) throw error;
    pushError = formatError(error);
  }

  trackSyncCycle({
    durationMs: Date.now() - cycleStart,
    pullOk,
    pullError,
    pushAttempted: pushReport?.attempted ?? 0,
    pushSucceeded: pushReport?.succeeded ?? 0,
    pushValidationFailed: pushReport?.validationFailed ?? 0,
    pushRetried: pushReport?.retried ?? 0,
    pushMissingReferences: pushReport?.missingReferences ?? 0,
  });

  return { pullOk, pullError, pushReport, pushError };
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
