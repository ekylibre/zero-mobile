import { Q, type Database, type Model } from '@nozbe/watermelondb';

import { generateClientUuid } from '@core/crypto/uuid';
import type {
  Intervention,
  InterventionDoer,
  InterventionInput,
  InterventionTarget,
  InterventionTool,
  InterventionWorkingPeriod,
} from '@core/db/models';
import { Tables } from '@core/db/schema';
import type { SprayingIntervention } from '@domain/procedures/spraying';

export interface PersistOptions {
  /**
   * Surcharge la génération d'UUID. Utilisé par les tests ; en production,
   * le défaut est `expo-crypto.randomUUID()` via `generateClientUuid()`.
   */
  generateUuid?: () => string;
}

export interface PersistedSprayingIntervention {
  interventionId: string;
  clientUuid: string;
}

// Durée travaillée (s) déduite des bornes du formulaire. Jamais négative.
function durationSecondsOf(input: SprayingIntervention): number {
  const ms = input.stopped_at.getTime() - input.started_at.getTime();
  return Math.max(0, Math.round(ms / 1000));
}

/**
 * Construit les `prepareCreate` des relations (doers/inputs/targets/tools/
 * working_period) rattachées à `interventionId`. Partagé entre création et
 * édition (delete-all + recreate). Ne fait aucune écriture : renvoie les
 * modèles préparés à pousser dans le `database.batch` de l'appelant.
 */
function buildRelationWrites(
  database: Database,
  interventionId: string,
  input: SprayingIntervention,
  durationSeconds: number,
): Model[] {
  const doers = database.collections.get<InterventionDoer>(Tables.interventionDoers);
  const inputsCol = database.collections.get<InterventionInput>(Tables.interventionInputs);
  const targets = database.collections.get<InterventionTarget>(Tables.interventionTargets);
  const tools = database.collections.get<InterventionTool>(Tables.interventionTools);
  const workingPeriods = database.collections.get<InterventionWorkingPeriod>(
    Tables.interventionWorkingPeriods,
  );

  const writes: Model[] = [];

  for (const doer of input.doers) {
    writes.push(
      doers.prepareCreate((m: InterventionDoer) => {
        m.interventionId = interventionId;
        m.productId = doer.product_id;
        m.referenceName = doer.reference_name;
      }),
    );
  }

  for (const item of input.inputs) {
    writes.push(
      inputsCol.prepareCreate((m: InterventionInput) => {
        m.interventionId = interventionId;
        m.productId = item.product_id;
        m.variantId = item.variant_id ?? null;
        m.referenceName = item.reference_name;
        m.quantityValue = item.quantity_value;
        m.quantityHandler = item.quantity_handler;
        m.quantityUnit = item.quantity_unit ?? null;
      }),
    );
  }

  for (const target of input.targets) {
    writes.push(
      targets.prepareCreate((m: InterventionTarget) => {
        m.interventionId = interventionId;
        m.cultivableZoneId = target.cultivable_zone_id;
        m.referenceName = target.reference_name;
      }),
    );
  }

  for (const tool of input.tools) {
    writes.push(
      tools.prepareCreate((m: InterventionTool) => {
        m.interventionId = interventionId;
        m.productId = tool.product_id;
        m.referenceName = tool.reference_name;
      }),
    );
  }

  writes.push(
    workingPeriods.prepareCreate((m: InterventionWorkingPeriod) => {
      m.interventionId = interventionId;
      m.startedAt = input.started_at;
      m.stoppedAt = input.stopped_at;
      m.durationSeconds = durationSeconds;
      m.nature = 'intervention';
    }),
  );

  return writes;
}

/**
 * Persiste un formulaire spraying validé en local : 1 intervention +
 * relations (doers, inputs, target, tools, working_period) dans une
 * unique transaction WatermelonDB.
 *
 * Hypothèse : `input` a déjà passé `sprayingInterventionSchema.parse()`.
 * Si ce n'est pas le cas, le sync engine (P6) refusera quand même de
 * pousser l'intervention — mais l'écrire en local serait incohérent.
 *
 * Le `client_uuid` est généré ici et restera figé pour toute la vie de
 * l'intervention (cf. ADR-13). `sync_state` est positionné à `'pending'`
 * pour que le moteur de sync (P6) la prenne en charge.
 */
export async function persistSprayingIntervention(
  database: Database,
  input: SprayingIntervention,
  options: PersistOptions = {},
): Promise<PersistedSprayingIntervention> {
  const generate = options.generateUuid ?? generateClientUuid;
  const clientUuid = generate();
  const durationSeconds = durationSecondsOf(input);

  const interventions = database.collections.get<Intervention>(Tables.interventions);

  let createdInterventionId = '';

  await database.write(async () => {
    const intervention = interventions.prepareCreate((m: Intervention) => {
      m.clientUuid = clientUuid;
      m.serverId = null;
      m.procedureName = input.procedure_name;
      m.startedAt = input.started_at;
      m.stoppedAt = input.stopped_at;
      m.wholeDurationSeconds = durationSeconds;
      m.workingDurationSeconds = durationSeconds;
      m.description = input.description?.trim() ? input.description.trim() : null;
      m.syncState = 'pending';
      m.syncErrorMessage = null;
      m.syncAttemptCount = 0;
      m.lastSyncedAt = null;
    });
    createdInterventionId = intervention.id;

    const writes: Model[] = [
      intervention,
      ...buildRelationWrites(database, intervention.id, input, durationSeconds),
    ];

    await database.batch(...writes);
  });

  return { interventionId: createdInterventionId, clientUuid };
}

/**
 * Met à jour une intervention NON synchronisée (pending/error) + remplace
 * toutes ses relations. Stratégie **delete-all + recreate** des enfants (plus
 * sûr qu'un diff). Le tout dans 1 `database.write` + 1 `database.batch`.
 *
 * **Ne touche jamais** `client_uuid` ni `server_id` (ADR-13). Repasse la ligne
 * en `pending` (sync_error_message null, attempt_count 0) pour qu'elle soit
 * re-poussée. À n'appeler que sur une intervention `pending`|`error` :
 * l'édition d'une `synced` est interdite côté UI (cf. workflow §6.3) — la
 * fonction ne ré-vérifie pas l'état (responsabilité de l'appelant).
 */
export async function updateSprayingIntervention(
  database: Database,
  interventionId: string,
  input: SprayingIntervention,
): Promise<void> {
  const durationSeconds = durationSecondsOf(input);
  const interventions = database.collections.get<Intervention>(Tables.interventions);

  await database.write(async () => {
    const intervention = await interventions.find(interventionId);

    const ops: Model[] = [];

    // 1. Met à jour les champs de l'intervention (sans clientUuid / serverId).
    ops.push(
      intervention.prepareUpdate((m: Intervention) => {
        m.procedureName = input.procedure_name;
        m.startedAt = input.started_at;
        m.stoppedAt = input.stopped_at;
        m.wholeDurationSeconds = durationSeconds;
        m.workingDurationSeconds = durationSeconds;
        m.description = input.description?.trim() ? input.description.trim() : null;
        m.syncState = 'pending';
        m.syncErrorMessage = null;
        m.syncAttemptCount = 0;
      }),
    );

    // 2. Supprime les relations existantes (delete-all).
    for (const table of INTERVENTION_CHILD_TABLES) {
      const children = await database.collections
        .get(table)
        .query(Q.where('intervention_id', interventionId))
        .fetch();
      ops.push(...children.map((c) => c.prepareDestroyPermanently()));
    }

    // 3. Recrée les relations depuis l'input (recreate).
    ops.push(...buildRelationWrites(database, interventionId, input, durationSeconds));

    await database.batch(...ops);
  });
}

// Tables enfants à purger avec l'intervention (pas de cascade WDB automatique).
const INTERVENTION_CHILD_TABLES = [
  Tables.interventionDoers,
  Tables.interventionInputs,
  Tables.interventionTargets,
  Tables.interventionTools,
  Tables.interventionWorkingPeriods,
] as const;

/**
 * Supprime définitivement une intervention locale + toutes ses relations
 * enfants, en une transaction. À n'appeler que pour une intervention NON
 * synchronisée (pending/error) : une intervention `synced` existe côté Ekylibre
 * et doit être éditée/supprimée via l'API, pas effacée silencieusement en local.
 */
export async function deleteIntervention(
  database: Database,
  interventionId: string,
): Promise<void> {
  await database.write(async () => {
    const ops: Model[] = [];
    for (const table of INTERVENTION_CHILD_TABLES) {
      const children = await database.collections
        .get(table)
        .query(Q.where('intervention_id', interventionId))
        .fetch();
      ops.push(...children.map((c) => c.prepareDestroyPermanently()));
    }
    const intervention = await database.collections
      .get<Intervention>(Tables.interventions)
      .find(interventionId);
    ops.push(intervention.prepareDestroyPermanently());
    await database.batch(...ops);
  });
}
