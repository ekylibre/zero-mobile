import { Q, type Database, type Model } from '@nozbe/watermelondb';

import {
  type CultivableZone,
  type Procedure,
  type Product,
  type SyncState,
  type Variant,
  type CatalogStep,
  type LastPullStatus,
} from '@core/db/models';
import { Tables } from '@core/db/schema';
import type { ApiProductType } from '@core/api/dtos';
import type { CultivableZoneRow, ProcedureRow, ProductRow, VariantRow } from '@domain/mappers';

// Upsert idempotent : { create | update } par clé naturelle, suppression
// des entrées disparues côté serveur. Une seule transaction WDB.

export async function persistProcedures(database: Database, rows: ProcedureRow[]): Promise<void> {
  const collection = database.collections.get<Procedure>(Tables.procedures);
  const existing = await collection.query().fetch();
  const byKey = new Map(existing.map((m) => [m.name, m]));
  const incoming = new Set(rows.map((r) => r.name));

  const writes: Model[] = [];
  for (const row of rows) {
    const found = byKey.get(row.name);
    if (found) {
      writes.push(
        found.prepareUpdate((m: Procedure) => {
          m.labelFr = row.labelFr;
          m.definition = row.definition;
          m.updatedAtServer = row.updatedAtServer;
        }),
      );
    } else {
      writes.push(
        collection.prepareCreate((m: Procedure) => {
          m.name = row.name;
          m.labelFr = row.labelFr;
          m.definition = row.definition;
          m.updatedAtServer = row.updatedAtServer;
        }),
      );
    }
  }
  for (const ex of existing) {
    if (!incoming.has(ex.name)) writes.push(ex.prepareDestroyPermanently());
  }

  await database.write(async () => {
    await database.batch(...writes);
  });
}

export async function persistProductsForType(
  database: Database,
  productType: ApiProductType,
  rows: ProductRow[],
): Promise<void> {
  const collection = database.collections.get<Product>(Tables.products);
  const existing = await collection.query(Q.where('product_type', productType)).fetch();
  const byKey = new Map(existing.map((m) => [m.serverId, m]));
  const incoming = new Set(rows.map((r) => r.serverId));

  const writes: Model[] = [];
  for (const row of rows) {
    const found = byKey.get(row.serverId);
    if (found) {
      writes.push(
        found.prepareUpdate((m: Product) => {
          m.name = row.name;
          m.variantId = row.variantId;
          m.variety = row.variety;
          m.abilities = row.abilities;
          m.updatedAtServer = row.updatedAtServer;
        }),
      );
    } else {
      writes.push(
        collection.prepareCreate((m: Product) => {
          m.serverId = row.serverId;
          m.productType = productType;
          m.name = row.name;
          m.variantId = row.variantId;
          m.variety = row.variety;
          m.abilities = row.abilities;
          m.updatedAtServer = row.updatedAtServer;
        }),
      );
    }
  }
  for (const ex of existing) {
    if (!incoming.has(ex.serverId)) writes.push(ex.prepareDestroyPermanently());
  }

  await database.write(async () => {
    await database.batch(...writes);
  });
}

// Type de cible cultivable : parcelle ou culture. Stocké dans la colonne
// `kind` de `cultivable_zones` (table unifiée des cibles, cf. schéma v3).
export type CultivableZoneKind = 'land_parcel' | 'plant';

export async function persistCultivableZones(
  database: Database,
  rows: CultivableZoneRow[],
  kind: CultivableZoneKind,
): Promise<void> {
  const collection = database.collections.get<CultivableZone>(Tables.cultivableZones);

  // Upsert + delete-extras **scopés au kind** : persister les parcelles ne doit
  // pas toucher les cultures (et vice-versa). Les rows migrées de v2 ont
  // `kind=null` : ce sont toutes des parcelles → on les rattache au scope
  // 'land_parcel' (sinon elles seraient dupliquées par serverId au 1er re-sync,
  // puis supprimées du scope 'land_parcel' à tort).
  const scopeClause =
    kind === 'land_parcel'
      ? Q.or(Q.where('kind', 'land_parcel'), Q.where('kind', null))
      : Q.where('kind', kind);
  const existing = await collection.query(scopeClause).fetch();
  const byKey = new Map(existing.map((m) => [m.serverId, m]));
  const incoming = new Set(rows.map((r) => r.serverId));

  const writes: Model[] = [];
  for (const row of rows) {
    const found = byKey.get(row.serverId);
    if (found) {
      writes.push(
        found.prepareUpdate((m: CultivableZone) => {
          m.name = row.name;
          m.geometry = row.geometry;
          m.areaHectares = row.areaHectares;
          m.deadAt = row.deadAt;
          m.shapeSvg = row.shapeSvg;
          m.kind = kind;
          m.updatedAtServer = row.updatedAtServer;
        }),
      );
    } else {
      writes.push(
        collection.prepareCreate((m: CultivableZone) => {
          m.serverId = row.serverId;
          m.name = row.name;
          m.geometry = row.geometry;
          m.areaHectares = row.areaHectares;
          m.deadAt = row.deadAt;
          m.shapeSvg = row.shapeSvg;
          m.kind = kind;
          m.updatedAtServer = row.updatedAtServer;
        }),
      );
    }
  }
  for (const ex of existing) {
    if (!incoming.has(ex.serverId)) writes.push(ex.prepareDestroyPermanently());
  }

  await database.write(async () => {
    await database.batch(...writes);
  });
}

export async function persistVariants(database: Database, rows: VariantRow[]): Promise<void> {
  const collection = database.collections.get<Variant>(Tables.variants);
  const existing = await collection.query().fetch();
  const byKey = new Map(existing.map((m) => [m.serverId, m]));
  const incoming = new Set(rows.map((r) => r.serverId));

  const writes: Model[] = [];
  for (const row of rows) {
    const found = byKey.get(row.serverId);
    if (found) {
      writes.push(
        found.prepareUpdate((m: Variant) => {
          m.name = row.name;
          m.category = row.category;
          m.unit = row.unit;
          m.updatedAtServer = row.updatedAtServer;
        }),
      );
    } else {
      writes.push(
        collection.prepareCreate((m: Variant) => {
          m.serverId = row.serverId;
          m.name = row.name;
          m.category = row.category;
          m.unit = row.unit;
          m.updatedAtServer = row.updatedAtServer;
        }),
      );
    }
  }
  for (const ex of existing) {
    if (!incoming.has(ex.serverId)) writes.push(ex.prepareDestroyPermanently());
  }

  await database.write(async () => {
    await database.batch(...writes);
  });
}

// ---- sync_state singleton ----

export async function getOrCreateSyncState(database: Database): Promise<SyncState> {
  const collection = database.collections.get<SyncState>(Tables.syncState);
  const existing = await collection.query().fetch();
  if (existing.length > 0) return existing[0]!;
  let created!: SyncState;
  await database.write(async () => {
    created = await collection.create((m: SyncState) => {
      m.lastPulledAt = null;
      m.lastPullStatus = 'idle';
      m.lastPullError = null;
      m.currentStep = null;
    });
  });
  return created;
}

export async function updateSyncState(
  database: Database,
  patch: {
    lastPulledAt?: number | null;
    lastPullStatus?: LastPullStatus;
    lastPullError?: string | null;
    currentStep?: CatalogStep | null;
  },
): Promise<void> {
  const state = await getOrCreateSyncState(database);
  await database.write(async () => {
    await state.update((m: SyncState) => {
      if (patch.lastPulledAt !== undefined) m.lastPulledAt = patch.lastPulledAt;
      if (patch.lastPullStatus !== undefined) m.lastPullStatus = patch.lastPullStatus;
      if (patch.lastPullError !== undefined) m.lastPullError = patch.lastPullError;
      if (patch.currentStep !== undefined) m.currentStep = patch.currentStep;
    });
  });
}
