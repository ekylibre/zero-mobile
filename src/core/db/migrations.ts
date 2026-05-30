import { schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations';

// v1 = schéma initial.
// v2 = cibles servies par products?product_type=land_parcels : ajout `dead_at`
//      (fin de culture) et `shape_svg` (tracé parcelle) sur cultivable_zones.
// À chaque incrément de version dans schema.ts, ajouter ici une entrée
// { toVersion, steps: [...] } pour décrire la migration.
export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'cultivable_zones',
          columns: [
            { name: 'dead_at', type: 'number', isOptional: true },
            { name: 'shape_svg', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
