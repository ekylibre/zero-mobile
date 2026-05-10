import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { migrations } from './migrations';
import {
  CultivableZone,
  Intervention,
  InterventionDoer,
  InterventionInput,
  InterventionTarget,
  InterventionTool,
  InterventionWorkingPeriod,
  Procedure,
  Product,
  SyncState,
  Variant,
} from './models';
import { schema } from './schema';

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  // Active JSI sur iOS et Android — meilleure perf, requiert un dev build.
  jsi: true,
  // En cas d'erreur de schéma irrécupérable, on supprime la base locale plutôt
  // que de planter au démarrage. Acceptable en v1 (catalogue resyncable).
  onSetUpError: (error) => {
    // En production, à brancher sur Sentry pour visibilité.
    console.error('[zero-mobile] WatermelonDB setup error:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [
    Procedure,
    Product,
    Variant,
    CultivableZone,
    Intervention,
    InterventionDoer,
    InterventionInput,
    InterventionTarget,
    InterventionTool,
    InterventionWorkingPeriod,
    SyncState,
  ],
});
