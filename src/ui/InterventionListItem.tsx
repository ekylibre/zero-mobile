import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Intervention } from '@core/db/models';

import { SyncBadge } from './SyncBadge';

interface InterventionListItemProps {
  intervention: Intervention;
  procedureLabel?: string;
  onPress?: () => void;
  /** Appelé au tap « Supprimer ». Le bouton n'apparaît que si non synchronisée. */
  onDelete?: () => void;
}

export function InterventionListItem({
  intervention,
  procedureLabel,
  onPress,
  onDelete,
}: InterventionListItemProps) {
  const { t, i18n } = useTranslation();
  const dateFormatter = new Intl.DateTimeFormat(i18n.language || 'fr', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const heading = procedureLabel ?? intervention.procedureName;
  // « Non synchronisée » = en attente ou en erreur (modifiable/supprimable
  // localement). Une intervention `synced` existe côté Ekylibre : on ne la
  // supprime pas en local.
  const isModifiable = intervention.syncState === 'pending' || intervention.syncState === 'error';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      testID={`intervention-row-${intervention.id}`}
    >
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {heading}
        </Text>
        <SyncBadge state={intervention.syncState} />
      </View>
      <Text style={styles.date}>{dateFormatter.format(intervention.startedAt)}</Text>
      {intervention.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {intervention.description}
        </Text>
      ) : null}

      {isModifiable && onDelete ? (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={onDelete}
            hitSlop={8}
            style={({ pressed }) => [styles.deleteButton, pressed && styles.deletePressed]}
            testID={`intervention-row-${intervention.id}-delete`}
          >
            <Text style={styles.deleteText}>{t('common.delete')}</Text>
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomColor: '#eee',
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#fff',
  },
  pressed: { backgroundColor: '#fafafa' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  title: { flex: 1, fontSize: 16, fontWeight: '600', color: '#222' },
  date: { fontSize: 13, color: '#666', marginBottom: 2 },
  description: { fontSize: 13, color: '#444' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  deleteButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderColor: '#a3171c',
    borderWidth: 1,
  },
  deletePressed: { backgroundColor: '#fde6e6' },
  deleteText: { fontSize: 13, color: '#a3171c', fontWeight: '600' },
});
