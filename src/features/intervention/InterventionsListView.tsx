import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import type { Intervention } from '@core/db/models';
import { EmptyState, InterventionListItem } from '@ui/index';

export interface InterventionsListViewProps {
  interventions: Intervention[];
  procedureLabels: Map<string, string>;
  pendingCount: number;
  refreshing: boolean;
  onRefresh: () => void;
  onItemPress: (intervention: Intervention) => void;
  onNew: () => void;
}

// Composant présentation pur : aucune dépendance à expo-router ou WDB.
// Le wiring est fait dans `app/(tabs)/interventions/index.tsx`.
export function InterventionsListView({
  interventions,
  procedureLabels,
  pendingCount,
  refreshing,
  onRefresh,
  onItemPress,
  onNew,
}: InterventionsListViewProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
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
