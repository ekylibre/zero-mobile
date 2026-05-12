import { ApiError, AuthError, NetworkError, ValidationError } from '@core/api/errors';
import type { ProviderTag } from '@core/api/types';
import type {
  Intervention,
  InterventionDoer,
  InterventionInput,
  InterventionTarget,
  InterventionTool,
  InterventionWorkingPeriod,
} from '@core/db/models';

import { runPushCyclePure, type InterventionPushTask, type PushOutcome } from '../push-engine';
import type { ServerIdLookups } from '../payload-builder';

const PROVIDER: ProviderTag = {
  vendor: 'ekylibre-mobile',
  name: 'zero-mobile',
  id: 'placeholder',
  data: { app_version: '0.1.0', os: 'ios', locale: 'fr-FR' },
};

function buildProvider(clientUuid: string): ProviderTag {
  return { ...PROVIDER, id: clientUuid };
}

function makeIntervention(overrides: Partial<Intervention> & { id: string }): Intervention {
  return {
    clientUuid: `uuid-${overrides.id}`,
    serverId: null,
    procedureName: 'spraying',
    startedAt: new Date('2026-04-12T08:00:00Z'),
    stoppedAt: new Date('2026-04-12T10:00:00Z'),
    description: null,
    wholeDurationSeconds: 7200,
    workingDurationSeconds: 7200,
    syncState: 'pending',
    syncErrorMessage: null,
    syncAttemptCount: 0,
    lastSyncedAt: null,
    ...overrides,
  } as unknown as Intervention;
}

function makeTask(overrides: Partial<Intervention> & { id: string }): InterventionPushTask {
  const intervention = makeIntervention(overrides);
  return {
    intervention,
    relations: {
      doers: [
        {
          interventionId: intervention.id,
          productId: 'wdb-driver-1',
          referenceName: 'driver',
        } as unknown as InterventionDoer,
      ],
      inputs: [
        {
          interventionId: intervention.id,
          productId: 'wdb-prod-1',
          variantId: null,
          referenceName: 'plant_medicine',
          quantityValue: 1.5,
          quantityHandler: 'population',
          quantityUnit: null,
        } as unknown as InterventionInput,
      ],
      targets: [
        {
          interventionId: intervention.id,
          cultivableZoneId: 'wdb-zone-1',
          referenceName: 'cultivation',
        } as unknown as InterventionTarget,
      ],
      tools: [
        {
          interventionId: intervention.id,
          productId: 'wdb-sprayer-1',
          referenceName: 'sprayer',
        } as unknown as InterventionTool,
      ],
      workingPeriods: [
        {
          interventionId: intervention.id,
          startedAt: intervention.startedAt,
          stoppedAt: intervention.stoppedAt,
          durationSeconds: 7200,
          nature: 'intervention',
        } as unknown as InterventionWorkingPeriod,
      ],
    },
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
    variantById: new Map(),
  };
}

function setup(
  tasks: InterventionPushTask[],
  apiOverrides: Partial<{
    createIntervention: jest.Mock;
    updateIntervention: jest.Mock;
  }> = {},
) {
  const outcomes: { interventionId: string; outcome: PushOutcome }[] = [];
  const syncing: string[] = [];

  const api = {
    createIntervention:
      apiOverrides.createIntervention ??
      jest.fn().mockResolvedValue({
        id: 999,
        procedure_name: 'spraying',
        started_at: '2026-04-12T08:00:00Z',
        stopped_at: '2026-04-12T10:00:00Z',
      }),
    updateIntervention:
      apiOverrides.updateIntervention ??
      jest.fn().mockResolvedValue({
        id: 42,
        procedure_name: 'spraying',
        started_at: '2026-04-12T08:00:00Z',
        stopped_at: '2026-04-12T10:00:00Z',
      }),
  };

  return {
    api,
    outcomes,
    syncing,
    deps: {
      tasks,
      lookups: makeLookups(),
      api,
      buildProvider,
      applyOutcome: async (intervention: Intervention, outcome: PushOutcome) => {
        outcomes.push({ interventionId: intervention.id, outcome });
      },
      markSyncing: async (intervention: Intervention) => {
        syncing.push(intervention.id);
      },
    },
  };
}

describe('runPushCyclePure — happy path', () => {
  it('renvoie un report vide si aucune tâche', async () => {
    const { deps } = setup([]);
    const report = await runPushCyclePure(deps);

    expect(report).toEqual({
      attempted: 0,
      succeeded: 0,
      validationFailed: 0,
      retried: 0,
      missingReferences: 0,
    });
  });

  it('POST une intervention sans server_id et marque synced avec server_id', async () => {
    const { api, outcomes, deps } = setup([makeTask({ id: 'iv-1', serverId: null })]);

    const report = await runPushCyclePure(deps);

    expect(api.createIntervention).toHaveBeenCalledTimes(1);
    expect(api.updateIntervention).not.toHaveBeenCalled();
    expect(api.createIntervention.mock.calls[0]?.[0]).toMatchObject({
      provider: { id: 'uuid-iv-1' },
    });
    expect(report.succeeded).toBe(1);
    expect(outcomes).toEqual([
      { interventionId: 'iv-1', outcome: { kind: 'synced', serverId: 999 } },
    ]);
  });

  it('PUT une intervention avec server_id existant', async () => {
    const { api, outcomes, deps } = setup([makeTask({ id: 'iv-1', serverId: 42 })]);

    await runPushCyclePure(deps);

    expect(api.createIntervention).not.toHaveBeenCalled();
    expect(api.updateIntervention).toHaveBeenCalledTimes(1);
    expect(api.updateIntervention.mock.calls[0]?.[0]).toBe(42);
    expect(outcomes).toEqual([
      { interventionId: 'iv-1', outcome: { kind: 'synced', serverId: 42 } },
    ]);
  });

  it("marque syncing avant l'appel API (pour spinner UI)", async () => {
    const { syncing, deps } = setup([makeTask({ id: 'iv-1' })]);
    await runPushCyclePure(deps);
    expect(syncing).toEqual(['iv-1']);
  });

  it('ne re-marque pas syncing si déjà dans cet état', async () => {
    const { syncing, deps } = setup([makeTask({ id: 'iv-1', syncState: 'syncing' })]);
    await runPushCyclePure(deps);
    expect(syncing).toEqual([]);
  });

  it('traite N interventions en série, indépendamment', async () => {
    const { api, outcomes, deps } = setup([
      makeTask({ id: 'iv-1' }),
      makeTask({ id: 'iv-2' }),
      makeTask({ id: 'iv-3' }),
    ]);

    const report = await runPushCyclePure(deps);

    expect(api.createIntervention).toHaveBeenCalledTimes(3);
    expect(report.succeeded).toBe(3);
    expect(outcomes).toHaveLength(3);
  });
});

describe('runPushCyclePure — erreurs', () => {
  it('422 ValidationError → outcome=error/validation, message = errors joints', async () => {
    const { outcomes, deps } = setup([makeTask({ id: 'iv-1' })], {
      createIntervention: jest
        .fn()
        .mockRejectedValue(new ValidationError(422, 'Bad', ['Driver missing', 'Quantity invalid'])),
    });

    const report = await runPushCyclePure(deps);

    expect(report.validationFailed).toBe(1);
    expect(report.succeeded).toBe(0);
    expect(outcomes[0]?.outcome).toEqual({
      kind: 'error',
      reason: 'validation',
      message: 'Driver missing\nQuantity invalid',
    });
  });

  it('5xx ApiError → outcome=retry/server', async () => {
    const { outcomes, deps } = setup([makeTask({ id: 'iv-1' })], {
      createIntervention: jest.fn().mockRejectedValue(new ApiError(500, 'boom')),
    });

    const report = await runPushCyclePure(deps);

    expect(report.retried).toBe(1);
    expect(outcomes[0]?.outcome).toEqual({
      kind: 'retry',
      reason: 'server',
      message: expect.stringContaining('500'),
    });
  });

  it('NetworkError → outcome=retry/network', async () => {
    const { outcomes, deps } = setup([makeTask({ id: 'iv-1' })], {
      createIntervention: jest.fn().mockRejectedValue(new NetworkError('offline')),
    });

    const report = await runPushCyclePure(deps);

    expect(report.retried).toBe(1);
    expect(outcomes[0]?.outcome).toMatchObject({ kind: 'retry', reason: 'network' });
  });

  it("AuthError → propage l'exception et interrompt le cycle", async () => {
    const { api, outcomes, deps } = setup([makeTask({ id: 'iv-1' }), makeTask({ id: 'iv-2' })], {
      createIntervention: jest.fn().mockRejectedValue(new AuthError('expired')),
    });

    await expect(runPushCyclePure(deps)).rejects.toBeInstanceOf(AuthError);
    // Seule la 1re a été tentée, les suivantes pas atteintes.
    expect(api.createIntervention).toHaveBeenCalledTimes(1);
    expect(outcomes).toEqual([]);
  });

  it("MissingServerIdError → outcome=error/missing_server_id (pas d'appel API)", async () => {
    const task = makeTask({ id: 'iv-1' });
    // Casse le lookup du driver pour provoquer l'erreur côté payload-builder.
    const lookups = makeLookups();
    lookups.productById.delete('wdb-driver-1');

    const api = {
      createIntervention: jest.fn(),
      updateIntervention: jest.fn(),
    };
    const outcomes: { interventionId: string; outcome: PushOutcome }[] = [];

    const report = await runPushCyclePure({
      tasks: [task],
      lookups,
      api,
      buildProvider,
      applyOutcome: async (intervention, outcome) => {
        outcomes.push({ interventionId: intervention.id, outcome });
      },
    });

    expect(api.createIntervention).not.toHaveBeenCalled();
    expect(report.missingReferences).toBe(1);
    expect(outcomes[0]?.outcome).toMatchObject({
      kind: 'error',
      reason: 'missing_server_id',
    });
  });

  it('isole les échecs : une 422 ne bloque pas la suivante', async () => {
    const create = jest
      .fn()
      .mockRejectedValueOnce(new ValidationError(422, 'Bad', ['Bad row']))
      .mockResolvedValueOnce({
        id: 7,
        procedure_name: 'spraying',
        started_at: '2026-04-12T08:00:00Z',
        stopped_at: '2026-04-12T10:00:00Z',
      });
    const { outcomes, deps } = setup([makeTask({ id: 'iv-1' }), makeTask({ id: 'iv-2' })], {
      createIntervention: create,
    });

    const report = await runPushCyclePure(deps);

    expect(report.attempted).toBe(2);
    expect(report.validationFailed).toBe(1);
    expect(report.succeeded).toBe(1);
    expect(outcomes[0]?.outcome.kind).toBe('error');
    expect(outcomes[1]?.outcome.kind).toBe('synced');
  });
});

describe('runPushCyclePure — report agrégé', () => {
  it('compte attempted/succeeded/validationFailed/retried/missingReferences', async () => {
    const create = jest
      .fn()
      .mockResolvedValueOnce({
        id: 1,
        procedure_name: 'spraying',
        started_at: '2026-04-12T08:00:00Z',
        stopped_at: '2026-04-12T10:00:00Z',
      })
      .mockRejectedValueOnce(new ValidationError(422, 'Bad', ['x']))
      .mockRejectedValueOnce(new NetworkError('offline'));

    const { deps } = setup(
      [makeTask({ id: 'iv-1' }), makeTask({ id: 'iv-2' }), makeTask({ id: 'iv-3' })],
      { createIntervention: create },
    );

    const report = await runPushCyclePure(deps);

    expect(report).toEqual({
      attempted: 3,
      succeeded: 1,
      validationFailed: 1,
      retried: 1,
      missingReferences: 0,
    });
  });
});
