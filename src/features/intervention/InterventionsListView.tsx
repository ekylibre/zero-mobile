import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import type { Intervention } from '@core/db/models';
import type { SyncStatus } from '@core/sync/store';
import { EmptyState, InterventionListItem } from '@ui/index';

export interface InterventionsListViewProps {
  interventions: Intervention[];
  procedureLabels: Map<string, string>;
  pendingCount: number;
  errorCount: number;
  syncStatus: SyncStatus;
  syncError: string | null;
  syncBusy: boolean;
  lastSyncAt: number | null;
  refreshing: boolean;
  onRefresh: () => void;
  onSync: () => void;
  onItemPress: (intervention: Intervention) => void;
  onDelete: (intervention: Intervention) => void;
  onNew: () => void;
}

// Composant présentation pur : aucune dépendance à expo-router ou WDB.
// Le wiring est fait dans `app/(tabs)/interventions/index.tsx`.
export function InterventionsListView({
  interventions,
  procedureLabels,
  pendingCount,
  errorCount,
  syncStatus,
  syncError,
  syncBusy,
  lastSyncAt,
  refreshing,
  onRefresh,
  onSync,
  onItemPress,
  onDelete,
  onNew,
}: InterventionsListViewProps) {
  const { t, i18n } = useTranslation();

  const lastSyncLabel = useMemo(() => {
    if (lastSyncAt == null) return t('interventions.list.lastSyncNever');
    const formatter = new Intl.DateTimeFormat(i18n.language || 'fr', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return t('interventions.list.lastSyncAt', { time: formatter.format(new Date(lastSyncAt)) });
  }, [lastSyncAt, t, i18n.language]);

  return (
    <View style={styles.container}>
      <View style={styles.syncHeader} testID="sync-header">
        <View style={styles.syncHeaderLeft}>
          <Text style={styles.syncStatus}>{t(`interventions.list.syncStatus.${syncStatus}`)}</Text>
          <Text style={styles.lastSync}>{lastSyncLabel}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onSync}
          disabled={syncBusy}
          style={({ pressed }) => [
            styles.syncButton,
            (pressed || syncBusy) && styles.syncButtonPressed,
          ]}
          testID="sync-button"
        >
          <Text style={styles.syncButtonText}>{t('interventions.list.syncAction')}</Text>
        </Pressable>
      </View>

      {errorCount > 0 ? (
        <View style={styles.errorBanner} accessibilityRole="alert" testID="error-banner">
          <Text style={styles.errorBannerText}>
            {t('interventions.list.errorBanner', { count: errorCount })}
          </Text>
        </View>
      ) : null}

      {syncError ? (
        <View style={styles.syncErrorBanner} accessibilityRole="alert" testID="sync-error-banner">
          <Text style={styles.syncErrorText}>{syncError}</Text>
        </View>
      ) : null}

      {pendingCount > 0 ? (
        <View style={styles.pendingBanner} accessibilityRole="alert" testID="pending-banner">
          <Text style={styles.pendingBannerText}>
            {t('interventions.list.pendingBanner', { count: pendingCount })}
          </Text>
        </View>
      ) : null}

      <FlatList
        data={interventions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <InterventionListItem
            intervention={item}
            procedureLabel={procedureLabels.get(item.procedureName)}
            onPress={() => onItemPress(item)}
            onDelete={() => onDelete(item)}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={interventions.length === 0 ? styles.emptyContent : undefined}
        ListEmptyComponent={
          <EmptyState
            title={t('interventions.list.empty')}
            subtitle={t('interventions.list.emptySubtitle')}
            action={
              <Pressable
                onPress={onNew}
                style={styles.emptyCta}
                accessibilityRole="button"
                testID="empty-new-action"
              >
                <Text style={styles.emptyCtaText}>{t('interventions.list.newAction')}</Text>
              </Pressable>
            }
          />
        }
        testID="interventions-list"
      />

      {interventions.length > 0 ? (
        <Pressable
          style={styles.fab}
          accessibilityRole="button"
          accessibilityLabel={t('interventions.list.newAction')}
          onPress={onNew}
          testID="interventions-new-fab"
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  syncHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: '#eee',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  syncHeaderLeft: { flex: 1 },
  syncStatus: { fontSize: 13, color: '#444', fontWeight: '500' },
  lastSync: { fontSize: 11, color: '#888', marginTop: 2 },
  syncButton: {
    backgroundColor: '#0066cc',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  syncButtonPressed: { opacity: 0.6 },
  syncButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  errorBanner: {
    backgroundColor: '#fde6e6',
    borderBottomColor: '#a3171c',
    borderBottomWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  errorBannerText: { color: '#5a0c10', fontSize: 13, fontWeight: '500' },
  syncErrorBanner: {
    backgroundColor: '#fff0f0',
    borderBottomColor: '#a3171c',
    borderBottomWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  syncErrorText: { color: '#5a0c10', fontSize: 12 },
  pendingBanner: {
    backgroundColor: '#fff7e6',
    borderBottomColor: '#f0c36d',
    borderBottomWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  pendingBannerText: { color: '#7a4f00', fontSize: 13, fontWeight: '500' },
  emptyContent: { flexGrow: 1 },
  emptyCta: {
    backgroundColor: '#0066cc',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
  },
  emptyCtaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0066cc',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '600', lineHeight: 30 },
});
