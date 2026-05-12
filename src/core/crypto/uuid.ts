import * as Crypto from 'expo-crypto';

// Wrapper autour d'expo-crypto.randomUUID() : laissé en module dédié pour
// pouvoir le mocker proprement dans les tests sans monkey-patcher tout
// expo-crypto.
export function generateClientUuid(): string {
  return Crypto.randomUUID();
}
