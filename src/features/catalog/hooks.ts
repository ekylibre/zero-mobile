import { Q, type Model } from '@nozbe/watermelondb';
import { useEffect, useState } from 'react';

import { database } from '@core/db/database';
import {
  type CultivableZone,
  type Intervention,
  type InterventionDoer,
  type InterventionInput,
  type InterventionTarget,
  type InterventionTool,
  type InterventionWorkingPeriod,
  type Procedure,
  type Product,
  type SyncState,
  type Variant,
  type InterventionSyncState,
} from '@core/db/models';
import { Tables, type TableName } from '@core/db/schema';
import type { ApiProductType } from '@core/api/dtos';

function useCollectionQuery<T extends Model>(
  table: TableName,
  clauses: Q.Clause[],
  deps: unknown[],
): T[] {
  const [items, setItems] = useState<T[]>([]);

  useEffect(() => {
    const collection = database.collections.get<T>(table);
    const subscription = collection
      .query(...clauses)
      .observe()
      .subscribe((next) => {
        setItems(next);
      });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return items;
}

export function useProcedures(): Procedure[] {
  return useCollectionQuery<Procedure>(Tables.procedures, [Q.sortBy('name', Q.asc)], []);
}

export function useProductsByType(productType: ApiProductType): Product[] {
  return useCollectionQuery<Product>(
    Tables.products,
    [Q.where('product_type', productType), Q.sortBy('name', Q.asc)],
    [productType],
  );
}

export function useCultivableZones(): CultivableZone[] {
  return useCollectionQuery<CultivableZone>(Tables.cultivableZones, [Q.sortBy('name', Q.asc)], []);
}

export function useVariants(): Variant[] {
  return useCollectionQuery<Variant>(Tables.variants, [Q.sortBy('name', Q.asc)], []);
}

export function useInterventions(filter?: { syncState?: InterventionSyncState }): Intervention[] {
  const clauses: Q.Clause[] = [Q.sortBy('started_at', Q.desc)];
  if (filter?.syncState) clauses.unshift(Q.where('sync_state', filter.syncState));
  return useCollectionQuery<Intervention>(Tables.interventions, clauses, [
    filter?.syncState ?? 'all',
  ]);
}

/**
 * Hook utilitaire : compte les interventions à synchroniser
 * (i.e. sync_state ∈ {pending, error}). Utilisé pour le badge de l'onglet
 * Interventions et l'avertissement avant logout (P6).
 */
export function usePendingInterventionCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const collection = database.collections.get<Intervention>(Tables.interventions);
    const subscription = collection
      .query(Q.where('sync_state', Q.oneOf(['pending', 'error'])))
      .observeCount()
      .subscribe(setCount);
    return () => subscription.unsubscribe();
  }, []);

  return count;
}

/**
 * Récupère une procédure par son nom (clé naturelle, immuable).
 * Permet d'afficher le label FR à partir de `intervention.procedureName`.
 */
export function useProcedureByName(name: string | null | undefined): Procedure | null {
  const [procedure, setProcedure] = useState<Procedure | null>(null);

  useEffect(() => {
    if (!name) {
      setProcedure(null);
      return undefined;
    }
    const collection = database.collections.get<Procedure>(Tables.procedures);
    const subscription = collection
      .query(Q.where('name', name))
      .observe()
      .subscribe((rows) => {
        setProcedure(rows[0] ?? null);
      });
    return () => subscription.unsubscribe();
  }, [name]);

  return procedure;
}

/**
 * Récupère une intervention par son id local WDB et toutes ses relations
 * enfants. Réactif : le composant se rerender dès qu'une relation change.
 */
export interface InterventionDetail {
  intervention: Intervention | null;
  doers: InterventionDoer[];
  inputs: InterventionInput[];
  targets: InterventionTarget[];
  tools: InterventionTool[];
  workingPeriods: InterventionWorkingPeriod[];
}

export function useInterventionById(id: string | null | undefined): InterventionDetail {
  const [intervention, setIntervention] = useState<Intervention | null>(null);
  const doers = useChildren<InterventionDoer>(Tables.interventionDoers, id);
  const inputs = useChildren<InterventionInput>(Tables.interventionInputs, id);
  const targets = useChildren<InterventionTarget>(Tables.interventionTargets, id);
  const tools = useChildren<InterventionTool>(Tables.interventionTools, id);
  const workingPeriods = useChildren<InterventionWorkingPeriod>(
    Tables.interventionWorkingPeriods,
    id,
  );

  useEffect(() => {
    if (!id) {
      setIntervention(null);
      return undefined;
    }
    const collection = database.collections.get<Intervention>(Tables.interventions);
    const subscription = collection.findAndObserve(id).subscribe({
      next: (row) => setIntervention(row),
      error: () => setIntervention(null),
    });
    return () => subscription.unsubscribe();
  }, [id]);

  return { intervention, doers, inputs, targets, tools, workingPeriods };
}

function useChildren<T extends Model>(table: TableName, parentId: string | null | undefined): T[] {
  const [items, setItems] = useState<T[]>([]);

  useEffect(() => {
    if (!parentId) {
      setItems([]);
      return undefined;
    }
    const collection = database.collections.get<T>(table);
    const subscription = collection
      .query(Q.where('intervention_id', parentId))
      .observe()
      .subscribe(setItems);
    return () => subscription.unsubscribe();
  }, [table, parentId]);

  return items;
}

/**
 * Observable singleton sync_state : utilisé par l'écran Settings et la
 * navigation pour décider si l'utilisateur doit voir l'écran initial-sync.
 */
export function useSyncState(): SyncState | null {
  const [state, setState] = useState<SyncState | null>(null);

  useEffect(() => {
    const collection = database.collections.get<SyncState>(Tables.syncState);
    const subscription = collection
      .query()
      .observe()
      .subscribe((rows) => {
        setState(rows[0] ?? null);
      });
    return () => subscription.unsubscribe();
  }, []);

  return state;
}
