import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import frCommon from '../../../locales/fr/common.json';

const SUPPORTED_LOCALES = ['fr'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function resolveLocale(): SupportedLocale {
  const deviceLocale = Localization.getLocales()[0]?.languageCode;
  if (deviceLocale && (SUPPORTED_LOCALES as readonly string[]).includes(deviceLocale)) {
    return deviceLocale as SupportedLocale;
  }
  return 'fr';
}

let initialized = false;

export function initI18n(): void {
  if (initialized) return;

  // eslint-disable-next-line import/no-named-as-default-member
  void i18n.use(initReactI18next).init({
    resources: {
      fr: { common: frCommon },
    },
    lng: resolveLocale(),
    fallbackLng: 'fr',
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    returnNull: false,
  });

  initialized = true;
}

export { i18n };
