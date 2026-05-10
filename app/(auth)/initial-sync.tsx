import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { apiClient } from '@core/api/client';
import { ApiError, AuthError, NetworkError } from '@core/api/errors';
import { database } from '@core/db/database';
import {
  needsInitialSync,
  runInitialSync,
  type InitialSyncProgress,
} from '@features/catalog/initial-sync';

type ScreenState =
  | { kind: 'idle' }
  | { kind: 'syncing'; progress: InitialSyncProgress }
  | { kind: 'error'; message: string }
  | { kind: 'done' };

export default function InitialSyncScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [state, setState] = useState<ScreenState>({ kind: 'idle' });

  useEffect(() => {
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    // Court-circuit : si l'utilisateur est déjà sync, on file directement.
    if (!(await needsInitialSync(database))) {
      router.replace('/(tabs)/interventions');
      return;
    }

    setState({ kind: 'syncing', progress: { step: 'procedures', index: 0, total: 4 } });

    try {
      await runInitialSync(
        { api: apiClient, database },
        {
          onProgress: (progress) => {
            setState({ kind: 'syncing', progress });
          },
        },
      );
      setState({ kind: 'done' });
      router.replace('/(tabs)/interventions');
    } catch (e) {
      setState({ kind: 'error', message: messageFor(e, t) });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('initialSync.title')}</Text>
      <Text style={styles.subtitle}>{t('initialSync.subtitle')}</Text>

      {state.kind === 'syncing' || state.kind === 'idle' ? <SyncingView state={state} /> : null}

      {state.kind === 'error' ? <ErrorView message={state.message} onRetry={start} /> : null}
    </View>
  );
}

interface SyncingViewProps {
  state: { kind: 'idle' } | { kind: 'syncing'; progress: InitialSyncProgress };
}

function SyncingView({ state }: SyncingViewProps) {
  const { t } = useTranslation();
  const total = state.kind === 'syncing' ? state.progress.total : 4;
  const index = state.kind === 'syncing' ? state.progress.index : 0;
  const stepKey = state.kind === 'syncing' ? state.progress.step : 'procedures';
  const substep = state.kind === 'syncing' ? state.progress.substep : undefined;
  const ratio = Math.min(1, Math.max(0, index / total));

  return (
    <View style={styles.body}>
      <ActivityIndicator size="large" color="#0066cc" />
      <Text style={styles.stepLabel}>
        {t(`initialSync.steps.${stepKey}`, { defaultValue: stepKey })}
      </Text>
      {substep ? (
        <Text style={styles.substepLabel}>
          {t('initialSync.substep', {
            current: substep.current,
            total: substep.total,
            label: substep.label,
          })}
        </Text>
      ) : null}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
      </View>
      <Text style={styles.counter}>{t('initialSync.counter', { current: index, total })}</Text>
    </View>
  );
}

interface ErrorViewProps {
  message: string;
  onRetry: () => void;
}

function ErrorView({ message, onRetry }: ErrorViewProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.body}>
      <Text style={styles.errorTitle}>{t('initialSync.errorTitle')}</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
        testID="initial-sync-retry"
      >
        <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
      </Pressable>
    </View>
  );
}

function messageFor(error: unknown, t: (key: string) => string): string {
  if (error instanceof AuthError) return t('login.errors.invalidCredentials');
  if (error instanceof NetworkError) return t('login.errors.network');
  if (error instanceof ApiError) return t('login.errors.server');
  return t('initialSync.errorGeneric');
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 64, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 32 },
  body: { alignItems: 'center', gap: 12 },
  stepLabel: { fontSize: 16, color: '#222', marginTop: 16 },
  substepLabel: { fontSize: 13, color: '#666' },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 16,
  },
  progressFill: { height: '100%', backgroundColor: '#0066cc' },
  counter: { fontSize: 12, color: '#999' },
  errorTitle: { fontSize: 18, fontWeight: '600', color: '#c22', marginBottom: 8 },
  errorMessage: { fontSize: 14, color: '#444', textAlign: 'center', marginBottom: 24 },
  retryButton: {
    backgroundColor: '#0066cc',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
  },
  retryButtonPressed: { opacity: 0.85 },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
