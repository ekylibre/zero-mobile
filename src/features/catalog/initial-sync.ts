import { type Database } from '@nozbe/watermelondb';

import type { EkylibreApiClient } from '@core/api/client';
import type { ApiProductType } from '@core/api/dtos';
import type { CatalogStep } from '@core/db/models';
import {
  mapCultivableZoneDto,
  mapProcedureDto,
  mapProductDto,
  mapVariantDto,
} from '@domain/mappers';

import {
  getOrCreateSyncState,
  persistCultivableZones,
  persistProcedures,
  persistProductsForType,
  persistVariants,
  updateSyncState,
} from './persisters';

// Ordre canonique des étapes de la sync initiale.
const STEPS: readonly CatalogStep[] = ['procedures', 'products', 'cultivable_zones', 'variants'];

// Types de produits qu'on télécharge (suffisant pour la pulvérisation v1).
// Étendre ici quand on couvrira d'autres procédures.
const PRODUCT_TYPES: readonly ApiProductType[] = ['workers', 'equipments', 'matters'];

export interface InitialSyncProgress {
  step: CatalogStep;
  index: number;
  total: number;
  // Sous-progression optionnelle (utile pour les types de produits).
  substep?: { current: number; total: number; label: string };
}

export interface InitialSyncDeps {
  api: EkylibreApiClient;
  database: Database;
}

export interface InitialSyncOptions {
  onProgress?: (progress: InitialSyncProgress) => void;
}

/**
 * Lance la synchronisation initiale du catalogue. Idempotente : sûre à
 * relancer après une interruption (chaque étape upserte par clé naturelle
 * et supprime les entrées disparues côté serveur).
 *
 * Reprise : si `sync_state.current_step` est positionné, démarre depuis
 * cette étape. Sinon, démarre depuis 'procedures'.
 *
 * En cas d'erreur en cours de route : `sync_state` est marqué `error`
 * avec le message ; un appel ultérieur reprend depuis la même étape.
 */
export async function runInitialSync(
  deps: InitialSyncDeps,
  options: InitialSyncOptions = {},
): Promise<void> {
  const { database } = deps;
  const onProgress = options.onProgress ?? (() => undefined);

  const syncState = await getOrCreateSyncState(database);
  const startStep = resolveStartStep(syncState.currentStep);
  const startIndex = STEPS.indexOf(startStep);

  await updateSyncState(database, {
    lastPullStatus: 'in_progress',
    lastPullError: null,
  });

  for (let i = startIndex; i < STEPS.length; i++) {
    const step = STEPS[i]!;
    await updateSyncState(database, { currentStep: step });

    try {
      await runStep(step, i, deps, onProgress);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur inconnue';
      await updateSyncState(database, {
        lastPullStatus: 'error',
        lastPullError: message,
      });
      throw e;
    }
  }

  await updateSyncState(database, {
    lastPulledAt: Date.now(),
    lastPullStatus: 'ok',
    lastPullError: null,
    currentStep: 'done',
  });
  onProgress({ step: 'done', index: STEPS.length, total: STEPS.length });
}

function resolveStartStep(current: CatalogStep | null): CatalogStep {
  if (!current || current === 'done') return 'procedures';
  return STEPS.includes(current) ? current : 'procedures';
}

async function runStep(
  step: CatalogStep,
  index: number,
  deps: InitialSyncDeps,
  onProgress: (p: InitialSyncProgress) => void,
): Promise<void> {
  const total = STEPS.length;

  switch (step) {
    case 'procedures': {
      onProgress({ step, index, total });
      const dtos = await deps.api.listProcedures();
      await persistProcedures(deps.database, dtos.map(mapProcedureDto));
      return;
    }
    case 'products': {
      onProgress({ step, index, total });
      for (let p = 0; p < PRODUCT_TYPES.length; p++) {
        const productType = PRODUCT_TYPES[p]!;
        onProgress({
          step,
          index,
          total,
          substep: { current: p + 1, total: PRODUCT_TYPES.length, label: productType },
        });
        const dtos = await deps.api.listProducts(productType);
        await persistProductsForType(
          deps.database,
          productType,
          dtos.map((d) => mapProductDto(d, productType)),
        );
      }
      return;
    }
    case 'cultivable_zones': {
      // Cibles unifiées : parcelles (land_parcels) + cultures (plants). Même
      // table `cultivable_zones`, distinguées par `kind`. Persistance scopée
      // par kind (cf. persistCultivableZones) → l'un n'écrase pas l'autre.
      onProgress({ step, index, total, substep: { current: 1, total: 2, label: 'land_parcels' } });
      const parcels = await deps.api.listCultivableZones();
      await persistCultivableZones(deps.database, parcels.map(mapCultivableZoneDto), 'land_parcel');

      onProgress({ step, index, total, substep: { current: 2, total: 2, label: 'plants' } });
      const plants = await deps.api.listPlants();
      await persistCultivableZones(deps.database, plants.map(mapCultivableZoneDto), 'plant');
      return;
    }
    case 'variants': {
      onProgress({ step, index, total });
      const dtos = await deps.api.listVariants();
      await persistVariants(deps.database, dtos.map(mapVariantDto));
      return;
    }
    case 'done':
      return;
  }
}

/**
 * Vrai si l'utilisateur courant n'a jamais terminé une sync initiale —
 * utilisé pour gater l'accès aux tabs et rediriger vers /(auth)/initial-sync.
 */
export async function needsInitialSync(database: Database): Promise<boolean> {
  const state = await getOrCreateSyncState(database);
  return state.lastPulledAt === null;
}
