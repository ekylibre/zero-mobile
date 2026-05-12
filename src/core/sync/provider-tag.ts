import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { i18n } from '@core/i18n';
import type { ProviderTag } from '@core/api/types';

/**
 * Données d'environnement embarquées dans `ProviderTag.data`. Ekylibre s'en
 * sert côté serveur pour debug / analytics. Pas de PII (email/identifiant
 * utilisateur explicitement absents — la PII passe par l'authentification).
 */
export interface DeviceInfo {
  appVersion: string;
  os: 'ios' | 'android' | 'web';
  deviceModel?: string;
  locale: string;
}

const FALLBACK_VERSION = '0.0.0-dev';
const FALLBACK_LOCALE = 'fr-FR';

/**
 * Construit le tag provider envoyé au POST /api/v2/interventions (cf. ADR-13).
 * `clientUuid` doit être l'UUIDv4 figé de l'intervention pour permettre la
 * détection de doublon côté serveur.
 *
 * `deviceInfo` est injectable pour les tests ; en production on utilise
 * `getDeviceInfo()` qui lit Expo Constants + Platform + i18n.
 */
export function buildProviderTag(clientUuid: string, deviceInfo: DeviceInfo): ProviderTag {
  const tag: ProviderTag = {
    vendor: 'ekylibre-mobile',
    name: 'zero-mobile',
    id: clientUuid,
    data: {
      app_version: deviceInfo.appVersion,
      os: deviceInfo.os,
      locale: deviceInfo.locale,
    },
  };
  if (deviceInfo.deviceModel) {
    tag.data.device_model = deviceInfo.deviceModel;
  }
  return tag;
}

/**
 * Récupère l'environnement device courant. À appeler une fois au démarrage
 * du cycle de sync, pas par intervention (les valeurs ne bougent pas).
 *
 * `deviceModel` est laissé `undefined` en v1 — on n'a pas tiré
 * `expo-device` (rebuild EAS supplémentaire). À ajouter si Sentry/Ekylibre
 * en a besoin pour le triage des bugs pilote.
 */
export function getDeviceInfo(): DeviceInfo {
  const os: DeviceInfo['os'] =
    Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web'
      ? Platform.OS
      : 'web';
  return {
    appVersion: Constants.expoConfig?.version ?? FALLBACK_VERSION,
    os,
    locale: i18n.language || FALLBACK_LOCALE,
  };
}
