import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import type { Procedure } from '@core/db/models';
import { EmptyState, ProcedureIcon, colors, fontSize, radius, spacing } from '@ui/index';

// V1 ne sait remplir qu'une seule procédure : `spraying`. Contrairement à
// l'écran d'origine (qui masquait les autres), on reprend la grille complète de
// l'ancienne app `zero-android-v3` : toutes les procédures du catalogue sont
// affichées, mais celles non encore prises en charge sont grisées + non
// cliquables avec une mention « Bientôt » — l'utilisateur voit la cible sans
// pouvoir taper dans le vide. On étend ce set au fil des procédures livrées.
const SUPPORTED_PROCEDURES = new Set<string>(['spraying']);

export interface ProcedurePickerViewProps {
  procedures: Procedure[];
  onSelect: (procedureName: string) => void;
}

export function ProcedurePickerView({ procedures, onSelect }: ProcedurePickerViewProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>{t('interventions.new.subtitle')}</Text>

      {procedures.length === 0 ? (
        <EmptyState title={t('interventions.new.empty')} />
      ) : (
        <ScrollView contentContainerStyle={styles.grid} testID="procedure-picker-grid">
          {procedures.map((item) => (
            <ProcedureTile
              key={item.name}
              procedureName={item.name}
              label={item.labelFr || item.name}
              supported={SUPPORTED_PROCEDURES.has(item.name)}
              comingSoonLabel={t('interventions.new.comingSoon')}
              onPress={() => onSelect(item.name)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

interface ProcedureTileProps {
  procedureName: string;
  label: string;
  supported: boolean;
  comingSoonLabel: string;
  onPress: () => void;
}

function ProcedureTile({
  procedureName,
  label,
  supported,
  comingSoonLabel,
  onPress,
}: ProcedureTileProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !supported }}
      disabled={!supported}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        !supported && styles.tileDisabled,
        pressed && supported && styles.tilePressed,
      ]}
      testID={`procedure-tile-${procedureName}`}
    >
      <ProcedureIcon procedureName={procedureName} size={56} />
      <Text style={styles.tileLabel} numberOfLines={2}>
        {label}
      </Text>
      {!supported ? <Text style={styles.comingSoon}>{comingSoonLabel}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create<{
  container: ViewStyle;
  subtitle: TextStyle;
  grid: ViewStyle;
  tile: ViewStyle;
  tileDisabled: ViewStyle;
  tilePressed: ViewStyle;
  tileLabel: TextStyle;
  comingSoon: TextStyle;
}>({
  container: { flex: 1, backgroundColor: colors.background },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  tile: {
    width: '33.33%',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
  },
  tileDisabled: { opacity: 0.4 },
  tilePressed: { backgroundColor: colors.surface },
  tileLabel: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  comingSoon: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
});
