import { Q, type Database } from '@nozbe/watermelondb';

import type { EkylibreApiClient } from '@core/api/client';
import { ApiError, AuthError, NetworkError, ValidationError } from '@core/api/errors';
import type { ProviderTag } from '@core/api/types';
import {
  type CultivableZone,
  type Intervention,
  type InterventionDoer,
  type InterventionInput,
  type InterventionTarget,
  type InterventionTool,
  type InterventionWorkingPeriod,
  type Product,
  type Variant,
} from '@core/db/models';
import { Tables } from '@core/db/schema';

import {
  buildCreateInterventionPayload,
  MissingServerIdError,
  type InterventionWithRelations,
  type ServerIdLookups,
} from './payload-builder';

// ---- Types publics ----

export interface PushReport {
  attempted: number;
  succeeded: number;
  /** 4xx serveur (validation rejetée) — l'intervention reste en `error`. */
  validationFailed: number;
  /** 5xx ou réseau — l'intervention retombe en `pending`, retry au prochain cycle. */
  retried: number;
  /** Référence locale absente du catalogue serveur (produit/zone retiré). */
  missingReferences: number;
}

export type PushOutcome =
  | { kind: 'synced'; serverId: number }
  | { kind: 'error'; reason: 'missing_server_id' | 'validation'; message: string }
  | { kind: 'retry'; reason: 'network' | 'server'; message: string };

/**
 * Une tâche de push = une intervention déjà résolue avec ses relations.
 * Ce type permet de tester le moteur sans avoir à mocker WatermelonDB.
 */
export interface InterventionPushTask {
  intervention: Intervention;
  relations: Omit<InterventionWithRelations, 'intervention'>;
}

export interface PushCyclePureDeps {
  tasks: InterventionPushTask[];
  lookups: ServerIdLookups;
  api: Pick<EkylibreApiClient, 'createIntervention' | 'updateIntervention'>;
  buildProvider: (clientUuid: string) => ProviderTag;
  /**
   * Side-effect d'application du résultat (typiquement un update WDB en
   * production, un spy en test). Appelé pour chaque intervention traitée
   * sauf en cas d'AuthError (qui interrompt le cycle).
   */
  applyOutcome: (intervention: Intervention, outcome: PushOutcome) => Promise<void>;
  /**
   * Marqueur transitoire « cette intervention est en train d'être poussée ».
   * Permet à l'UI de montrer un spinner par ligne. Optionnel : si non fourni,
   * on ne pose pas de marqueur intermédiaire (utile dans certains tests).
   */
  markSyncing?: (intervention: Intervention) => Promise<void>;
}

const EMPTY_REPORT: PushReport = {
  attempted: 0,
  succeeded: 0,
  validationFailed: 0,
  retried: 0,
  missingReferences: 0,
};

// ---- Cœur testable (pas de dépendance WDB) ----

/**
 * Itère les tâches une par une. Un AuthError interrompt le cycle (laisse
 * remonter pour que le gestionnaire global de 401 prenne la main).
 *
 * Cf. ADR-03 et `docs/architecture.md` §6 : push **par intervention**, pas
 * tout-ou-rien.
 */
export async function runPushCyclePure(deps: PushCyclePureDeps): Promise<PushReport> {
  const { tasks, lookups, api, buildProvider, applyOutcome, markSyncing } = deps;
  if (tasks.length === 0) return EMPTY_REPORT;

  const report: PushReport = { ...EMPTY_REPORT, attempted: tasks.length };

  for (const task of tasks) {
    const { intervention } = task;
    if (markSyncing && intervention.syncState !== 'syncing') {
      await markSyncing(intervention);
    }

    try {
      const provider = buildProvider(intervention.clientUuid);
      const payload = buildCreateInterventionPayload(
        { intervention, ...task.relations },
        lookups,
        provider,
      );

      const dto =
        intervention.serverId == null
          ? await api.createIntervention(payload)
          : await api.updateIntervention(intervention.serverId, payload);

      await applyOutcome(intervention, { kind: 'synced', serverId: dto.id });
      report.succeeded += 1;
    } catch (error) {
      if (error instanceof AuthError) throw error;

      if (error instanceof MissingServerIdError) {
        await applyOutcome(intervention, {
          kind: 'error',
          reason: 'missing_server_id',
          message: formatMissingMessage(error),
        });
        report.missingReferences += 1;
        continue;
      }

      if (error instanceof ValidationError) {
        await applyOutcome(intervention, {
          kind: 'error',
          reason: 'validation',
          message: formatValidationMessage(error),
        });
        report.validationFailed += 1;
        continue;
      }

      const reason = error instanceof NetworkError ? 'network' : 'server';
      await applyOutcome(intervention, {
        kind: 'retry',
        reason,
        message: formatRetryMessage(error),
      });
      report.retried += 1;
    }
  }

  return report;
}

// ---- Wrapper production : glue WDB ----

export interface PushCycleDeps {
  database: Database;
  api: Pick<EkylibreApiClient, 'createIntervention' | 'updateIntervention'>;
  buildProvider: (clientUuid: string) => ProviderTag;
}

export async function runPushCycle(deps: PushCycleDeps): Promise<PushReport> {
  const { database, api, buildProvider } = deps;

  const interventions = await database.collections
    .get<Intervention>(Tables.interventions)
    .query(Q.where('sync_state', Q.oneOf(['pending', 'error', 'syncing'])))
    .fetch();

  if (interventions.length === 0) return EMPTY_REPORT;

  const lookups = await fetchLookups(database);

  const tasks: InterventionPushTask[] = await Promise.all(
    interventions.map(async (intervention) => ({
      intervention,
      relations: await fetchRelations(database, intervention.id),
    })),
  );

  return runPushCyclePure({
    tasks,
    lookups,
    api,
    buildProvider,
    markSyncing: (intervention) => markSyncing(database, intervention),
    applyOutcome: (intervention, outcome) => applyOutcomeToDb(database, intervention, outcome),
  });
}

// ---- Helpers WDB ----

async function fetchLookups(database: Database): Promise<ServerIdLookups> {
  const [products, zones, variants] = await Promise.all([
    database.collections.get<Product>(Tables.products).query().fetch(),
    database.collections.get<CultivableZone>(Tables.cultivableZones).query().fetch(),
    database.collections.get<Variant>(Tables.variants).query().fetch(),
  ]);
  return {
    productById: new Map(products.map((p) => [p.id, p.serverId])),
    zoneById: new Map(zones.map((z) => [z.id, z.serverId])),
    variantById: new Map(variants.map((v) => [v.id, v.serverId])),
  };
}

async function fetchRelations(
  database: Database,
  interventionId: string,
): Promise<Omit<InterventionWithRelations, 'intervention'>> {
  const [doers, inputs, targets, tools, workingPeriods] = await Promise.all([
    database.collections
      .get<InterventionDoer>(Tables.interventionDoers)
      .query(Q.where('intervention_id', interventionId))
      .fetch(),
    database.collections
      .get<InterventionInput>(Tables.interventionInputs)
      .query(Q.where('intervention_id', interventionId))
      .fetch(),
    database.collections
      .get<InterventionTarget>(Tables.interventionTargets)
      .query(Q.where('intervention_id', interventionId))
      .fetch(),
    database.collections
      .get<InterventionTool>(Tables.interventionTools)
      .query(Q.where('intervention_id', interventionId))
      .fetch(),
    database.collections
      .get<InterventionWorkingPeriod>(Tables.interventionWorkingPeriods)
      .query(Q.where('intervention_id', interventionId))
      .fetch(),
  ]);
  return { doers, inputs, targets, tools, workingPeriods };
}

async function markSyncing(database: Database, intervention: Intervention): Promise<void> {
  await database.write(async () => {
    await intervention.update((m) => {
      m.syncState = 'syncing';
    });
  });
}

async function applyOutcomeToDb(
  database: Database,
  intervention: Intervention,
  outcome: PushOutcome,
): Promise<void> {
  await database.write(async () => {
    await intervention.update((m) => {
      switch (outcome.kind) {
        case 'synced':
          m.serverId = outcome.serverId;
          m.syncState = 'synced';
          m.syncErrorMessage = null;
          m.lastSyncedAt = new Date();
          break;
        case 'error':
          m.syncState = 'error';
          m.syncErrorMessage = outcome.message;
          break;
        case 'retry':
          m.syncState = 'pending';
          m.syncErrorMessage = outcome.message;
          m.syncAttemptCount = (m.syncAttemptCount ?? 0) + 1;
          break;
      }
    });
  });
}

// ---- Formattage messages ----
//
// Stockés dans `intervention.sync_error_message`, lus tels quels par l'écran
// détail (cf. P4). On reste en FR brut, cohérent avec les messages Zod du
// domaine.

function formatMissingMessage(e: MissingServerIdError): string {
  const label = e.entity === 'cultivable_zone' ? 'parcelle' : e.entity;
  return `Référence ${label} introuvable dans le catalogue. Synchronisez le catalogue puis réessayez.`;
}

function formatValidationMessage(e: ValidationError): string {
  if (e.errors.length > 0) return e.errors.join('\n');
  return e.message || `Erreur de validation serveur (${e.status}).`;
}

function formatRetryMessage(error: unknown): string {
  if (error instanceof NetworkError) {
    return 'Connexion perdue. Re-tentative au prochain cycle de synchronisation.';
  }
  if (error instanceof ApiError) {
    return `Erreur serveur (${error.status}). Re-tentative au prochain cycle.`;
  }
  return error instanceof Error ? error.message : String(error);
}
