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

// ---- Sync metrics (P8) ----
//
// Tous les helpers ci-dessous sont **safe** : si Sentry n'est pas initialisé
// (dev sans DSN), addBreadcrumb/captureMessage sont des no-ops. On peut donc
// les appeler depuis n'importe où dans la sync sans guard.

export interface SyncStepMetric {
  step: string;
  durationMs: number;
  counts?: Record<string, number>;
}

/**
 * Breadcrumb pour une étape de sync initiale (pulled procedures, products…).
 * Pas un event Sentry — juste un fil d'Ariane pour contextualiser un crash.
 */
export function trackSyncStep(metric: SyncStepMetric): void {
  try {
    Sentry.addBreadcrumb({
      category: 'sync.step',
      level: 'info',
      message: metric.step,
      data: { duration_ms: metric.durationMs, ...(metric.counts ?? {}) },
    });
  } catch {
    /* never break the sync because of telemetry */
  }
}

export interface SyncCycleMetric {
  durationMs: number;
  pullOk: boolean;
  pullError: string | null;
  pushAttempted: number;
  pushSucceeded: number;
  pushValidationFailed: number;
  pushRetried: number;
  pushMissingReferences: number;
}

/**
 * Event Sentry de fin de cycle. Garde la PII out — pas de email, pas de
 * `instanceUrl`, pas de noms de parcelles.
 */
export function trackSyncCycle(metric: SyncCycleMetric): void {
  try {
    Sentry.captureMessage('sync.cycle', {
      level: metric.pullOk && metric.pushValidationFailed === 0 ? 'info' : 'warning',
      tags: {
        'sync.pull_ok': String(metric.pullOk),
      },
      extra: {
        duration_ms: metric.durationMs,
        pull_error: metric.pullError,
        push_attempted: metric.pushAttempted,
        push_succeeded: metric.pushSucceeded,
        push_validation_failed: metric.pushValidationFailed,
        push_retried: metric.pushRetried,
        push_missing_references: metric.pushMissingReferences,
      },
    });
  } catch {
    /* idem */
  }
}

export interface InitialSyncMetric {
  durationMs: number;
  counts: Record<string, number>;
}

/**
 * Event Sentry de fin de sync initiale. Sert à confirmer l'hypothèse
 * « petite ferme » (cf. workflow §10.4) — on remonte les comptes par table.
 */
export function trackInitialSync(metric: InitialSyncMetric): void {
  try {
    Sentry.captureMessage('sync.initial', {
      level: 'info',
      extra: { duration_ms: metric.durationMs, ...metric.counts },
    });
  } catch {
    /* idem */
  }
}
