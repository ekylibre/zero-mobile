import { DatabaseProvider as WMDatabaseProvider, useDatabase } from '@nozbe/watermelondb/react';
import { type ReactNode } from 'react';

import { database } from './database';

export interface DatabaseProviderProps {
  children: ReactNode;
}

// Wrapper applicatif autour du DatabaseProvider de WatermelonDB.
// Permet aux composants enfants d'utiliser `useDatabase()` du package
// `@nozbe/watermelondb/react`.
export function DatabaseProvider({ children }: DatabaseProviderProps) {
  return <WMDatabaseProvider database={database}>{children}</WMDatabaseProvider>;
}

export { useDatabase };
