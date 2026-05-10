import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;

  const dsn = (Constants.expoConfig?.extra as { sentryDsn?: string } | undefined)?.sentryDsn;
  const env = (process.env.APP_ENV as string | undefined) ?? 'development';

  if (!dsn || dsn.startsWith('PLACEHOLDER')) {
    if (__DEV__) {
      // En dev sans DSN réel, on ne pousse rien à Sentry — les console.error suffisent.
      return;
    }
  }

  Sentry.init({
    dsn,
    environment: env,
    tracesSampleRate: env === 'production' ? 0.1 : 1.0,
    debug: __DEV__,
    enableNative: !__DEV__,
    beforeSend(event) {
      // Anonymisation : on ne laisse jamais filer l'email utilisateur (PII).
      if (event.user?.email) {
        delete event.user.email;
      }
      return event;
    },
  });

  initialized = true;
}

export const captureException = Sentry.captureException;
export const captureMessage = Sentry.captureMessage;
export const addBreadcrumb = Sentry.addBreadcrumb;
