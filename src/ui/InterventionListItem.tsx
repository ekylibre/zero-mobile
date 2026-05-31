import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';

import type { Intervention } from '@core/db/models';

import { ProcedureIcon } from './ProcedureIcon';
import { SyncBadge } from './SyncBadge';
import { colors, fontSize, radius, spacing } from './theme';

interface InterventionListItemProps {
  intervention: Intervention;
  procedureLabel?: string;
  /** Résumé « N cultures • X ha » calculé côté route (relations). Optionnel. */
  targetSummary?: string;
  onPress?: () => void;
  /** Appelé au tap « Supprimer ». Le bouton n'apparaît que si non synchronisée. */
  onDelete?: () => void;
  /** Appelé au tap « Modifier ». Le bouton n'apparaît que si non synchronisée. */
  onEdit?: () => void;
}

export function InterventionListItem({
  intervention,
  procedureLabel,
  targetSummary,
  onPress,
  onDelete,
  onEdit,
}: InterventionListItemProps) {
  const { t, i18n } = useTranslation();
  const dateLabel = relativeDateLabel(intervention.startedAt, new Date(), i18n.language || 'fr', t);

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
      <ProcedureIcon procedureName={intervention.procedureName} size={44} />

      <View style={styles.body}>
        <View style={styles.headerLine}>
          <Text style={styles.title} numberOfLines={1}>
            {heading}
          </Text>
          <Text style={styles.date}>{dateLabel}</Text>
        </View>

        {targetSummary ? (
          <Text style={styles.summary} numberOfLines={1}>
            {targetSummary}
          </Text>
        ) : null}

        {intervention.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {intervention.description}
          </Text>
        ) : null}

        {intervention.syncState === 'error' && intervention.syncErrorMessage ? (
          <Text
            style={styles.errorText}
            numberOfLines={4}
            testID={`intervention-row-${intervention.id}-error`}
          >
            {intervention.syncErrorMessage}
          </Text>
        ) : null}

        <View style={styles.footerLine}>
          <SyncBadge state={intervention.syncState} />
          {isModifiable ? (
            <View style={styles.actions} testID={`intervention-row-${intervention.id}-actions`}>
              {onEdit ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={onEdit}
                  hitSlop={8}
                  style={({ pressed }) => [styles.editButton, pressed && styles.editPressed]}
                  testID={`intervention-row-${intervention.id}-edit`}
                >
                  <Text style={styles.editText}>{t('common.edit')}</Text>
                </Pressable>
              ) : null}
              {onDelete ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={onDelete}
                  hitSlop={8}
                  style={({ pressed }) => [styles.deleteButton, pressed && styles.deletePressed]}
                  testID={`intervention-row-${intervention.id}-delete`}
                >
                  <Text style={styles.deleteText}>{t('common.delete')}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

// Libellé de date relatif (« aujourd'hui », « hier », sinon date courte), repris
// de l'ancienne app. `now` est injectable pour des tests déterministes.
export function relativeDateLabel(
  date: Date,
  now: Date,
  locale: string,
  t: (key: string) => string,
): string {
  if (isSameDay(date, now)) return t('interventions.list.today');
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return t('interventions.list.yesterday');
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const styles = StyleSheet.create<{
  container: ViewStyle;
  pressed: ViewStyle;
  body: ViewStyle;
  headerLine: ViewStyle;
  title: TextStyle;
  date: TextStyle;
  summary: TextStyle;
  description: TextStyle;
  errorText: TextStyle;
  footerLine: ViewStyle;
  actions: ViewStyle;
  editButton: ViewStyle;
  editPressed: ViewStyle;
  editText: TextStyle;
  deleteButton: ViewStyle;
  deletePressed: ViewStyle;
  deleteText: TextStyle;
}>({
  container: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.background,
  },
  pressed: { backgroundColor: colors.surface },
  body: { flex: 1 },
  headerLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: { flex: 1, fontSize: fontSize.lg, fontWeight: '600', color: colors.blue },
  date: { fontSize: fontSize.md, color: colors.greenDark, fontWeight: '600' },
  summary: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: 2 },
  description: { fontSize: fontSize.md, color: colors.textPrimary, marginTop: 2 },
  errorText: { fontSize: fontSize.md, color: colors.danger, marginTop: spacing.xs },
  footerLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  editButton: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderColor: colors.blue,
    borderWidth: 1,
  },
  editPressed: { backgroundColor: colors.blueSoft },
  editText: { fontSize: fontSize.md, color: colors.blue, fontWeight: '600' },
  deleteButton: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderColor: colors.danger,
    borderWidth: 1,
  },
  deletePressed: { backgroundColor: colors.dangerBg },
  deleteText: { fontSize: fontSize.md, color: colors.danger, fontWeight: '600' },
});
