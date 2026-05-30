import type { Database } from '@nozbe/watermelondb';

import { Tables } from '@core/db/schema';
import type { SprayingIntervention } from '@domain/procedures/spraying';

import { persistSprayingIntervention } from '../persister';

interface CapturedOp {
  table: string;
  fields: Record<string, unknown>;
  // L'id local WDB simulé (préfixé par la table pour faciliter les asserts).
  id: string;
}

interface MockDb {
  database: Database;
  ops: CapturedOp[];
  batched: { id: string; table: string }[][];
  writeCalls: number;
}

function createMockDatabase(): MockDb {
  const ops: CapturedOp[] = [];
  const batched: { id: string; table: string }[][] = [];
  let writeCalls = 0;
  let counter = 0;

  function makeCollection(table: string) {
    return {
      prepareCreate(setter: (m: Record<string, unknown>) => void) {
        const fields: Record<string, unknown> = {};
        const id = `${table}-${++counter}`;
        const proxy = new Proxy(
          { id },
          {
            get(target, key) {
              if (key === 'id') return id;
              return (target as Record<string | symbol, unknown>)[key];
            },
            set(target, key, value) {
              if (key === 'id') return false;
              fields[String(key)] = value;
              (target as Record<string | symbol, unknown>)[key] = value;
              return true;
            },
          },
        );
        setter(proxy as unknown as Record<string, unknown>);
        ops.push({ table, fields, id });
        return proxy;
      },
    };
  }

  const database = {
    collections: {
      get: (table: string) => makeCollection(table),
    },
    write: async (cb: () => Promise<void>) => {
      writeCalls += 1;
      await cb();
    },
    batch: async (...models: { id: string }[]) => {
      batched.push(
        models.map((m) => {
          const found = ops.find((op) => op.id === m.id);
          return { id: m.id, table: found?.table ?? 'unknown' };
        }),
      );
    },
  } as unknown as Database;

  return {
    database,
    ops,
    batched,
    get writeCalls() {
      return writeCalls;
    },
  };
}

function makeInput(overrides: Partial<SprayingIntervention> = {}): SprayingIntervention {
  return {
    procedure_name: 'spraying',
    started_at: new Date('2026-04-12T08:00:00Z'),
    stopped_at: new Date('2026-04-12T10:30:00Z'),
    description: 'Traitement T2',
    doers: [{ product_id: 'wdb-driver-1', reference_name: 'driver' }],
    inputs: [
      {
        product_id: 'wdb-prod-1',
        variant_id: 'wdb-var-1',
        reference_name: 'plant_medicine',
        quantity_value: 1.5,
        quantity_handler: 'population',
        quantity_unit: 'l/ha',
      },
    ],
    targets: [{ cultivable_zone_id: 'wdb-zone-1', reference_name: 'cultivation' }],
    tools: [{ product_id: 'wdb-sprayer-1', reference_name: 'sprayer' }],
    ...overrides,
  };
}

describe('persistSprayingIntervention', () => {
  it('crée 1 intervention + 1 doer + 1 input + 1 target + 1 tool + 1 working_period', async () => {
    const mock = createMockDatabase();
    const input = makeInput();

    await persistSprayingIntervention(mock.database, input, {
      generateUuid: () => 'fixed-uuid',
    });

    const byTable = (table: string) => mock.ops.filter((op) => op.table === table);
    expect(byTable(Tables.interventions)).toHaveLength(1);
    expect(byTable(Tables.interventionDoers)).toHaveLength(1);
    expect(byTable(Tables.interventionInputs)).toHaveLength(1);
    expect(byTable(Tables.interventionTargets)).toHaveLength(1);
    expect(byTable(Tables.interventionTools)).toHaveLength(1);
    expect(byTable(Tables.interventionWorkingPeriods)).toHaveLength(1);
  });

  it('écrit tout dans une seule transaction database.write + 1 batch', async () => {
    const mock = createMockDatabase();
    await persistSprayingIntervention(mock.database, makeInput(), {
      generateUuid: () => 'fixed-uuid',
    });

    expect(mock.writeCalls).toBe(1);
    expect(mock.batched).toHaveLength(1);
    expect(mock.batched[0]).toHaveLength(6);
  });

  it('renvoie un client_uuid stable issu du générateur fourni', async () => {
    const mock = createMockDatabase();
    const result = await persistSprayingIntervention(mock.database, makeInput(), {
      generateUuid: () => 'my-stable-uuid',
    });

    expect(result.clientUuid).toBe('my-stable-uuid');
    const intervention = mock.ops.find((op) => op.table === Tables.interventions);
    expect(intervention?.fields.clientUuid).toBe('my-stable-uuid');
  });

  it("renvoie l'id local WDB de l'intervention créée", async () => {
    const mock = createMockDatabase();
    const result = await persistSprayingIntervention(mock.database, makeInput(), {
      generateUuid: () => 'uuid',
    });

    const intervention = mock.ops.find((op) => op.table === Tables.interventions);
    expect(result.interventionId).toBe(intervention?.id);
  });

  it("positionne sync_state='pending' et compteur de tentatives à 0", async () => {
    const mock = createMockDatabase();
    await persistSprayingIntervention(mock.database, makeInput(), {
      generateUuid: () => 'uuid',
    });

    const intervention = mock.ops.find((op) => op.table === Tables.interventions);
    expect(intervention?.fields).toMatchObject({
      syncState: 'pending',
      syncAttemptCount: 0,
      syncErrorMessage: null,
      lastSyncedAt: null,
      serverId: null,
    });
  });

  it('calcule whole_duration_seconds et working_duration_seconds depuis les dates', async () => {
    const mock = createMockDatabase();
    await persistSprayingIntervention(mock.database, makeInput(), {
      generateUuid: () => 'uuid',
    });

    const intervention = mock.ops.find((op) => op.table === Tables.interventions);
    // 08:00 → 10:30 = 9000 secondes
    expect(intervention?.fields.wholeDurationSeconds).toBe(9000);
    expect(intervention?.fields.workingDurationSeconds).toBe(9000);

    const period = mock.ops.find((op) => op.table === Tables.interventionWorkingPeriods);
    expect(period?.fields.durationSeconds).toBe(9000);
    expect(period?.fields.nature).toBe('intervention');
  });

  it("rattache toutes les relations à l'intervention créée via intervention_id", async () => {
    const mock = createMockDatabase();
    await persistSprayingIntervention(mock.database, makeInput(), {
      generateUuid: () => 'uuid',
    });

    const intervention = mock.ops.find((op) => op.table === Tables.interventions);
    const interventionId = intervention?.id;
    expect(interventionId).toBeTruthy();

    const childTables = [
      Tables.interventionDoers,
      Tables.interventionInputs,
      Tables.interventionTargets,
      Tables.interventionTools,
      Tables.interventionWorkingPeriods,
    ];
    for (const table of childTables) {
      const op = mock.ops.find((o) => o.table === table);
      expect(op?.fields.interventionId).toBe(interventionId);
    }
  });

  it('persiste les champs métier des inputs (quantity, handler, variant, unit)', async () => {
    const mock = createMockDatabase();
    await persistSprayingIntervention(mock.database, makeInput(), {
      generateUuid: () => 'uuid',
    });

    const inputOp = mock.ops.find((op) => op.table === Tables.interventionInputs);
    expect(inputOp?.fields).toMatchObject({
      productId: 'wdb-prod-1',
      variantId: 'wdb-var-1',
      referenceName: 'plant_medicine',
      quantityValue: 1.5,
      quantityHandler: 'population',
      quantityUnit: 'l/ha',
    });
  });

  it('met variantId à null si absent (variant_id reste optionnel)', async () => {
    const mock = createMockDatabase();
    await persistSprayingIntervention(
      mock.database,
      makeInput({
        inputs: [
          {
            product_id: 'wdb-prod-1',
            reference_name: 'plant_medicine',
            quantity_value: 2,
            quantity_handler: 'net_volume',
            quantity_unit: 'liter',
          },
        ],
      }),
      { generateUuid: () => 'uuid' },
    );

    const inputOp = mock.ops.find((op) => op.table === Tables.interventionInputs);
    expect(inputOp?.fields.variantId).toBeNull();
    expect(inputOp?.fields.quantityUnit).toBe('liter');
  });

  it('persiste plusieurs doers/inputs/tools quand fournis', async () => {
    const mock = createMockDatabase();
    await persistSprayingIntervention(
      mock.database,
      makeInput({
        doers: [
          { product_id: 'd1', reference_name: 'driver' },
          { product_id: 'd2', reference_name: 'driver' },
        ],
        inputs: [
          {
            product_id: 'p1',
            reference_name: 'plant_medicine',
            quantity_value: 1,
            quantity_handler: 'population',
            quantity_unit: 'unity',
          },
          {
            product_id: 'p2',
            reference_name: 'plant_medicine',
            quantity_value: 2,
            quantity_handler: 'net_volume',
            quantity_unit: 'liter',
          },
        ],
        tools: [
          { product_id: 's1', reference_name: 'sprayer' },
          { product_id: 's2', reference_name: 'sprayer' },
        ],
      }),
      { generateUuid: () => 'uuid' },
    );

    const byTable = (table: string) => mock.ops.filter((op) => op.table === table);
    expect(byTable(Tables.interventionDoers)).toHaveLength(2);
    expect(byTable(Tables.interventionInputs)).toHaveLength(2);
    expect(byTable(Tables.interventionTools)).toHaveLength(2);
  });

  it('description trim + null si vide', async () => {
    const mock = createMockDatabase();
    await persistSprayingIntervention(mock.database, makeInput({ description: '   ' }), {
      generateUuid: () => 'uuid',
    });

    const intervention = mock.ops.find((op) => op.table === Tables.interventions);
    expect(intervention?.fields.description).toBeNull();
  });

  it('description null si non fournie', async () => {
    const mock = createMockDatabase();
    const { description: _omit, ...rest } = makeInput();
    await persistSprayingIntervention(mock.database, rest as SprayingIntervention, {
      generateUuid: () => 'uuid',
    });

    const intervention = mock.ops.find((op) => op.table === Tables.interventions);
    expect(intervention?.fields.description).toBeNull();
  });
});
