import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import type { Intervention } from '@core/db/models';
import type { SyncStatus } from '@core/sync/store';
import {
  BottomActionBar,
  EmptyState,
  InterventionListItem,
  colors,
  fontSize,
  spacing,
} from '@ui/index';

export interface InterventionsListViewProps {
  interventions: Intervention[];
  procedureLabels: Map<string, string>;
  /** Résumé « N cultures • X ha » par id d'intervention (calculé côté route). */
  targetSummaries?: Map<string, string>;
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
  onEdit: (intervention: Intervention) => void;
  onNew: () => void;
}

// Composant présentation pur : aucune dépendance à expo-router ou WDB.
// Le wiring est fait dans `app/(tabs)/interventions/index.tsx`.
export function InterventionsListView({
  interventions,
  procedureLabels,
  targetSummaries,
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
  onEdit,
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
        style={styles.list}
        data={interventions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <InterventionListItem
            intervention={item}
            procedureLabel={procedureLabels.get(item.procedureName)}
            targetSummary={targetSummaries?.get(item.id)}
            onPress={() => onItemPress(item)}
            onDelete={() => onDelete(item)}
            onEdit={() => onEdit(item)}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={interventions.length === 0 ? styles.emptyContent : undefined}
        ListEmptyComponent={
          <EmptyState
            title={t('interventions.list.empty')}
            subtitle={t('interventions.list.emptySubtitle')}
          />
        }
        testID="interventions-list"
      />

      <BottomActionBar
        primary={{
          label: t('interventions.list.newAction'),
          onPress: onNew,
          testID: 'interventions-new-action',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { flex: 1 },
  syncHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  syncHeaderLeft: { flex: 1 },
  syncStatus: { fontSize: fontSize.md, color: colors.textPrimary, fontWeight: '500' },
  lastSync: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  syncButton: {
    backgroundColor: colors.blue,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 6,
  },
  syncButtonPressed: { opacity: 0.6 },
  syncButtonText: { color: colors.textOnBrand, fontSize: fontSize.base, fontWeight: '600' },
  errorBanner: {
    backgroundColor: colors.dangerBg,
    borderBottomColor: colors.danger,
    borderBottomWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  errorBannerText: { color: colors.dangerText, fontSize: fontSize.md, fontWeight: '500' },
  syncErrorBanner: {
    backgroundColor: colors.dangerSoft,
    borderBottomColor: colors.danger,
    borderBottomWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  syncErrorText: { color: colors.dangerText, fontSize: fontSize.sm },
  pendingBanner: {
    backgroundColor: colors.warningBg,
    borderBottomColor: colors.warningBorder,
    borderBottomWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  pendingBannerText: { color: colors.warning, fontSize: fontSize.md, fontWeight: '500' },
  emptyContent: { flexGrow: 1 },
});
