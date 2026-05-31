import type { Database } from '@nozbe/watermelondb';

import type { CultivableZoneRow } from '@domain/mappers';

import { persistCultivableZones } from '../persisters';

// On ne mocke PAS `@nozbe/watermelondb` : un mock de module casse les named
// exports (appSchema/tableSchema) requis par la chaîne d'import schema.ts dans
// ce setup jest-expo. À la place, le mock `database` contrôle directement ce que
// `query().fetch()` renvoie. persistCultivableZones appelle `query(scopeClause)`
// une seule fois par invocation → on fournit « les rows existantes dans le
// scope » sans interpréter la clause Q (l'isolation par kind est vérifiée via
// le fait qu'une seule query scopée est émise, cf. dernier test).

interface PersistMock {
  database: Database;
  created: { serverId: number; kind: string }[];
  updated: { serverId: number; kind: string }[];
  destroyed: number[];
  queryCalls: number;
}

function createMock(existingInScope: number[]): PersistMock {
  const created: { serverId: number; kind: string }[] = [];
  const updated: { serverId: number; kind: string }[] = [];
  const destroyed: number[] = [];
  let queryCalls = 0;

  const collection = {
    query() {
      queryCalls += 1;
      return {
        async fetch() {
          return existingInScope.map((serverId) => ({
            serverId,
            prepareUpdate(setter: (m: Record<string, unknown>) => void) {
              const fields: Record<string, unknown> = { serverId };
              setter(fields);
              updated.push({ serverId, kind: String(fields.kind) });
              return { serverId };
            },
            prepareDestroyPermanently() {
              destroyed.push(serverId);
              return { serverId };
            },
          }));
        },
      };
    },
    prepareCreate(setter: (m: Record<string, unknown>) => void) {
      const fields: Record<string, unknown> = {};
      setter(fields);
      created.push({ serverId: Number(fields.serverId), kind: String(fields.kind) });
      return { serverId: fields.serverId };
    },
  };

  const database = {
    collections: { get: () => collection },
    write: async (cb: () => Promise<void>) => cb(),
    batch: async () => undefined,
  } as unknown as Database;

  return {
    database,
    created,
    updated,
    destroyed,
    get queryCalls() {
      return queryCalls;
    },
  };
}

function row(serverId: number, name = `n${serverId}`): CultivableZoneRow {
  return {
    serverId,
    name,
    geometry: null,
    areaHectares: 1,
    deadAt: null,
    shapeSvg: null,
    updatedAtServer: 0,
  };
}

describe('persistCultivableZones — kind & delete-extras', () => {
  it('crée les nouvelles cibles avec le kind demandé (land_parcel)', async () => {
    const mock = createMock([]); // rien en base
    await persistCultivableZones(mock.database, [row(1), row(2)], 'land_parcel');

    expect(mock.created).toEqual([
      { serverId: 1, kind: 'land_parcel' },
      { serverId: 2, kind: 'land_parcel' },
    ]);
    expect(mock.destroyed).toEqual([]);
  });

  it('crée les cultures avec kind=plant', async () => {
    const mock = createMock([]);
    await persistCultivableZones(mock.database, [row(7)], 'plant');

    expect(mock.created).toEqual([{ serverId: 7, kind: 'plant' }]);
  });

  it('met à jour une cible déjà connue et lui (ré)assigne le kind', async () => {
    const mock = createMock([1]); // serverId 1 déjà dans le scope
    await persistCultivableZones(mock.database, [row(1)], 'land_parcel');

    expect(mock.updated).toEqual([{ serverId: 1, kind: 'land_parcel' }]);
    expect(mock.created).toEqual([]);
    expect(mock.destroyed).toEqual([]);
  });

  it('supprime du scope les cibles disparues côté serveur (delete-extras)', async () => {
    const mock = createMock([1, 2]); // 1 et 2 existent dans le scope
    // incoming = {2, 9} → 1 disparaît, 2 mis à jour, 9 créé.
    await persistCultivableZones(mock.database, [row(2), row(9)], 'land_parcel');

    expect(mock.destroyed).toEqual([1]);
    expect(mock.updated).toEqual([{ serverId: 2, kind: 'land_parcel' }]);
    expect(mock.created).toEqual([{ serverId: 9, kind: 'land_parcel' }]);
  });

  it('ne lit/écrit que dans le scope du kind (une seule query scopée)', async () => {
    const mock = createMock([2]);
    await persistCultivableZones(mock.database, [row(2)], 'plant');

    expect(mock.queryCalls).toBe(1);
    expect(mock.updated).toEqual([{ serverId: 2, kind: 'plant' }]);
  });
});
