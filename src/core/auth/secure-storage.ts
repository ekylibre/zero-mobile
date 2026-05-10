import * as SecureStore from 'expo-secure-store';

import type { Credentials } from '@core/api/types';

const STORAGE_KEY = 'eky.auth';

function isCredentials(value: unknown): value is Credentials {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<Credentials>;
  return (
    typeof v.instanceUrl === 'string' &&
    v.instanceUrl.length > 0 &&
    typeof v.email === 'string' &&
    v.email.length > 0 &&
    typeof v.token === 'string' &&
    v.token.length > 0
  );
}

export async function loadCredentials(): Promise<Credentials | null> {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isCredentials(parsed) ? parsed : null;
  } catch {
    // Valeur stockée corrompue : on la traite comme absente.
    return null;
  }
}

export async function saveCredentials(credentials: Credentials): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(credentials));
}

export async function clearCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}
