import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

// v1 = schéma initial. Aucune migration nécessaire.
// À chaque incrément de version dans schema.ts, ajouter ici une entrée
// { toVersion, steps: [...] } pour décrire la migration.
export const migrations = schemaMigrations({
  migrations: [],
});
