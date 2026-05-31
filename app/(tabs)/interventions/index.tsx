import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { database } from '@core/db/database';
import type { Intervention, Procedure } from '@core/db/models';
import { captureException } from '@core/observability/sentry';
import { useSyncCycle } from '@core/sync/use-sync-cycle';
import {
  useErrorInterventionCount,
  useInterventions,
  useInterventionTargetCounts,
  usePendingInterventionCount,
  useProcedures,
} from '@features/catalog/hooks';
import { InterventionsListView } from '@features/intervention/InterventionsListView';
import { deleteIntervention } from '@features/intervention/persister';

export default function InterventionsListScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const interventions = useInterventions();
  const procedures = useProcedures();
  const pendingCount = usePendingInterventionCount();
  const errorCount = useErrorInterventionCount();
  const { startSync, status, lastError, lastSyncAt, isBusy } = useSyncCycle();
  const [refreshing, setRefreshing] = useState(false);

  const procedureLabels = useMemo(
    () => new Map<string, string>(procedures.map((p: Procedure) => [p.name, p.labelFr])),
    [procedures],
  );

  // Résumé « N cultures • X ha » par intervention, pour la liste.
  const targetCounts = useInterventionTargetCounts();
  const targetSummaries = useMemo(() => {
    const map = new Map<string, string>();
    for (const [id, { count, areaHectares }] of targetCounts) {
      map.set(
        id,
        t('interventions.spraying.summaries.targets', {
          count,
          area: areaHectares.toLocaleString('fr-FR', { maximumFractionDigits: 2 }),
        }),
      );
    }
    return map;
  }, [targetCounts, t]);

  // Pull-to-refresh = même cycle que le bouton Synchroniser. On garde un
  // état local `refreshing` pour piloter le RefreshControl indépendamment
  // de `status` (qui passe pulling→pushing→idle plus rapidement que le
  // geste utilisateur).
  const onRefresh = useCallback(async () => {
    if (isBusy) return;
    setRefreshing(true);
    try {
      await startSync();
    } catch {
      // Erreur déjà stockée dans le store via setError, rien à faire ici.
    } finally {
      setRefreshing(false);
    }
  }, [isBusy, startSync]);

  const onSync = useCallback(() => {
    if (isBusy) return;
    void startSync().catch(() => {
      // Idem : géré par le store, on évite l'unhandled rejection.
    });
  }, [isBusy, startSync]);

  const onItemPress = useCallback(
    (intervention: Intervention) => {
      router.push({
        pathname: '/(tabs)/interventions/[id]',
        params: { id: intervention.id },
      });
    },
    [router],
  );

  const onDelete = useCallback(
    (intervention: Intervention) => {
      Alert.alert(
        t('interventions.list.deleteConfirmTitle'),
        t('interventions.list.deleteConfirmMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: () => {
              void deleteIntervention(database, intervention.id).catch((error) => {
                captureException(error);
              });
            },
          },
        ],
      );
    },
    [t],
  );

  const onNew = useCallback(() => {
    router.push('/(tabs)/interventions/new');
  }, [router]);

  return (
    <InterventionsListView
      interventions={interventions}
      procedureLabels={procedureLabels}
      targetSummaries={targetSummaries}
      pendingCount={pendingCount}
      errorCount={errorCount}
      syncStatus={status}
      syncError={lastError}
      syncBusy={isBusy}
      lastSyncAt={lastSyncAt}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onSync={onSync}
      onItemPress={onItemPress}
      onDelete={onDelete}
      onNew={onNew}
    />
  );
}
