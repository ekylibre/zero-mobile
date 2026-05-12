import type {
  Intervention,
  InterventionDoer,
  InterventionInput,
  InterventionTarget,
  InterventionTool,
  InterventionWorkingPeriod,
} from '@core/db/models';
import type { ProviderTag } from '@core/api/types';

import {
  buildCreateInterventionPayload,
  MissingServerIdError,
  type InterventionWithRelations,
  type ServerIdLookups,
} from '../payload-builder';

const PROVIDER: ProviderTag = {
  vendor: 'ekylibre-mobile',
  name: 'zero-mobile',
  id: 'uuid-1',
  data: {
    app_version: '0.1.0',
    os: 'ios',
    device_model: 'iPhone15,2',
    locale: 'fr-FR',
  },
};

function makeIntervention(overrides: Partial<Intervention> = {}): Intervention {
  return {
    clientUuid: 'uuid-1',
    serverId: null,
    procedureName: 'spraying',
    startedAt: new Date('2026-04-12T08:00:00Z'),
    stoppedAt: new Date('2026-04-12T10:30:00Z'),
    description: null,
    wholeDurationSeconds: 9000,
    workingDurationSeconds: 9000,
    syncState: 'pending',
    syncErrorMessage: null,
    syncAttemptCount: 0,
    lastSyncedAt: null,
    ...overrides,
  } as unknown as Intervention;
}

function makeDoer(overrides: Partial<InterventionDoer> & { productId: string }): InterventionDoer {
  return {
    interventionId: 'iv-1',
    referenceName: 'driver',
    ...overrides,
  } as unknown as InterventionDoer;
}

function makeInput(
  overrides: Partial<InterventionInput> & { productId: string },
): InterventionInput {
  return {
    interventionId: 'iv-1',
    variantId: null,
    referenceName: 'plant_medicine',
    quantityValue: 1.5,
    quantityHandler: 'population',
    quantityUnit: null,
    ...overrides,
  } as unknown as InterventionInput;
}

function makeTarget(
  overrides: Partial<InterventionTarget> & { cultivableZoneId: string },
): InterventionTarget {
  return {
    interventionId: 'iv-1',
    referenceName: 'cultivation',
    ...overrides,
  } as unknown as InterventionTarget;
}

function makeTool(overrides: Partial<InterventionTool> & { productId: string }): InterventionTool {
  return {
    interventionId: 'iv-1',
    referenceName: 'sprayer',
    ...overrides,
  } as unknown as InterventionTool;
}

function makeWorkingPeriod(
  overrides: Partial<InterventionWorkingPeriod> = {},
): InterventionWorkingPeriod {
  return {
    interventionId: 'iv-1',
    startedAt: new Date('2026-04-12T08:00:00Z'),
    stoppedAt: new Date('2026-04-12T10:30:00Z'),
    durationSeconds: 9000,
    nature: 'intervention',
    ...overrides,
  } as unknown as InterventionWorkingPeriod;
}

function makeData(): InterventionWithRelations {
  return {
    intervention: makeIntervention(),
    doers: [makeDoer({ productId: 'wdb-driver-1' })],
    inputs: [makeInput({ productId: 'wdb-prod-1' })],
    targets: [makeTarget({ cultivableZoneId: 'wdb-zone-1' })],
    tools: [makeTool({ productId: 'wdb-sprayer-1' })],
    workingPeriods: [makeWorkingPeriod()],
  };
}

function makeLookups(): ServerIdLookups {
  return {
    productById: new Map([
      ['wdb-driver-1', 100],
      ['wdb-prod-1', 200],
      ['wdb-sprayer-1', 300],
    ]),
    zoneById: new Map([['wdb-zone-1', 4000]]),
    variantById: new Map([['wdb-var-1', 500]]),
  };
}

describe('buildCreateInterventionPayload — happy path', () => {
  it('produit un payload v2 complet et bien formé', () => {
    const payload = buildCreateInterventionPayload(makeData(), makeLookups(), PROVIDER);

    expect(payload).toMatchObject({
      procedure_name: 'spraying',
      actions: [],
      provider: PROVIDER,
      working_periods_attributes: [
        {
          started_at: '2026-04-12T08:00:00.000Z',
          stopped_at: '2026-04-12T10:30:00.000Z',
        },
      ],
      doers_attributes: [{ product_id: 100, reference_name: 'driver' }],
      inputs_attributes: [
        {
          product_id: 200,
          reference_name: 'plant_medicine',
          quantity_value: 1.5,
          quantity_handler: 'population',
        },
      ],
      targets_attributes: [{ product_id: 4000, reference_name: 'cultivation' }],
      tools_attributes: [{ product_id: 300, reference_name: 'sprayer' }],
    });
    // Pas de description si null en local.
    expect(payload).not.toHaveProperty('description');
  });

  it('sérialise plusieurs doers / inputs / tools', () => {
    const data: InterventionWithRelations = {
      ...makeData(),
      doers: [makeDoer({ productId: 'wdb-driver-1' }), makeDoer({ productId: 'wdb-driver-2' })],
      inputs: [
        makeInput({ productId: 'wdb-prod-1' }),
        makeInput({ productId: 'wdb-prod-2', quantityValue: 3, quantityHandler: 'net_volume' }),
      ],
      tools: [makeTool({ productId: 'wdb-sprayer-1' }), makeTool({ productId: 'wdb-sprayer-2' })],
    };
    const lookups = makeLookups();
    lookups.productById.set('wdb-driver-2', 101);
    lookups.productById.set('wdb-prod-2', 201);
    lookups.productById.set('wdb-sprayer-2', 301);

    const payload = buildCreateInterventionPayload(data, lookups, PROVIDER);

    expect(payload.doers_attributes).toEqual([
      { product_id: 100, reference_name: 'driver' },
      { product_id: 101, reference_name: 'driver' },
    ]);
    expect(payload.inputs_attributes).toHaveLength(2);
    expect(payload.inputs_attributes[1]).toMatchObject({
      product_id: 201,
      quantity_value: 3,
      quantity_handler: 'net_volume',
    });
    expect(payload.tools_attributes).toHaveLength(2);
  });

  it("inclut variant_id quand l'input en référence un", () => {
    const data: InterventionWithRelations = {
      ...makeData(),
      inputs: [makeInput({ productId: 'wdb-prod-1', variantId: 'wdb-var-1' })],
    };
    const payload = buildCreateInterventionPayload(data, makeLookups(), PROVIDER);

    expect(payload.inputs_attributes[0]).toMatchObject({ variant_id: 500 });
  });

  it('inclut quantity_unit quand renseigné', () => {
    const data: InterventionWithRelations = {
      ...makeData(),
      inputs: [makeInput({ productId: 'wdb-prod-1', quantityUnit: 'l/ha' })],
    };
    const payload = buildCreateInterventionPayload(data, makeLookups(), PROVIDER);

    expect(payload.inputs_attributes[0]).toMatchObject({ quantity_unit: 'l/ha' });
  });

  it('inclut description quand non vide', () => {
    const data: InterventionWithRelations = {
      ...makeData(),
      intervention: makeIntervention({ description: 'Traitement T2' }),
    };
    const payload = buildCreateInterventionPayload(data, makeLookups(), PROVIDER);

    expect(payload.description).toBe('Traitement T2');
  });

  it('synthétise une working_period depuis les dates si la liste est vide', () => {
    const data: InterventionWithRelations = {
      ...makeData(),
      workingPeriods: [],
    };
    const payload = buildCreateInterventionPayload(data, makeLookups(), PROVIDER);

    expect(payload.working_periods_attributes).toEqual([
      {
        started_at: '2026-04-12T08:00:00.000Z',
        stopped_at: '2026-04-12T10:30:00.000Z',
      },
    ]);
  });

  it('sérialise plusieurs working_periods telles quelles', () => {
    const data: InterventionWithRelations = {
      ...makeData(),
      workingPeriods: [
        makeWorkingPeriod({
          startedAt: new Date('2026-04-12T08:00:00Z'),
          stoppedAt: new Date('2026-04-12T09:00:00Z'),
        }),
        makeWorkingPeriod({
          startedAt: new Date('2026-04-12T09:30:00Z'),
          stoppedAt: new Date('2026-04-12T10:30:00Z'),
        }),
      ],
    };
    const payload = buildCreateInterventionPayload(data, makeLookups(), PROVIDER);

    expect(payload.working_periods_attributes).toHaveLength(2);
  });
});

describe('buildCreateInterventionPayload — erreurs server_id manquants', () => {
  it('throws MissingServerIdError pour un produit absent du lookup', () => {
    const data = makeData();
    const lookups = makeLookups();
    lookups.productById.delete('wdb-driver-1');

    expect(() => buildCreateInterventionPayload(data, lookups, PROVIDER)).toThrow(
      MissingServerIdError,
    );
  });

  it('throws pour un cultivable_zone absent du lookup', () => {
    const data = makeData();
    const lookups = makeLookups();
    lookups.zoneById.delete('wdb-zone-1');

    try {
      buildCreateInterventionPayload(data, lookups, PROVIDER);
      fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(MissingServerIdError);
      expect((e as MissingServerIdError).entity).toBe('cultivable_zone');
      expect((e as MissingServerIdError).localId).toBe('wdb-zone-1');
    }
  });

  it('throws pour un variant absent du lookup quand il est référencé', () => {
    const data: InterventionWithRelations = {
      ...makeData(),
      inputs: [makeInput({ productId: 'wdb-prod-1', variantId: 'wdb-var-missing' })],
    };

    expect(() => buildCreateInterventionPayload(data, makeLookups(), PROVIDER)).toThrow(
      MissingServerIdError,
    );
  });

  it("ignore l'absence de variant si l'input n'en référence pas", () => {
    const data = makeData();
    const lookups = makeLookups();
    lookups.variantById.clear();

    expect(() => buildCreateInterventionPayload(data, lookups, PROVIDER)).not.toThrow();
  });
});
