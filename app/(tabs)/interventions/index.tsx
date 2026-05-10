import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import type { Intervention, Procedure } from '@core/db/models';
import {
  useInterventions,
  usePendingInterventionCount,
  useProcedures,
} from '@features/catalog/hooks';
import { InterventionsListView } from '@features/intervention/InterventionsListView';

export default function InterventionsListScreen() {
  const router = useRouter();
  const interventions = useInterventions();
  const procedures = useProcedures();
  const pendingCount = usePendingInterventionCount();
  const [refreshing, setRefreshing] = useState(false);

  const procedureLabels = useMemo(
    () => new Map<string, string>(procedures.map((p: Procedure) => [p.name, p.labelFr])),
    [procedures],
  );

  // P4 : pull-to-refresh placeholder. P6 le branchera sur le sync engine.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    setRefreshing(false);
  }, []);

  const onItemPress = useCallback(
    (intervention: Intervention) => {
      router.push({
        pathname: '/(tabs)/interventions/[id]',
        params: { id: intervention.id },
      });
    },
    [router],
  );

  const onNew = useCallback(() => {
    router.push('/(tabs)/interventions/new');
  }, [router]);

  return (
    <InterventionsListView
      interventions={interventions}
      procedureLabels={procedureLabels}
      pendingCount={pendingCount}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onItemPress={onItemPress}
      onNew={onNew}
    />
  );
}
