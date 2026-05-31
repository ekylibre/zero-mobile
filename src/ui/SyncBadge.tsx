import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import type { InterventionSyncState } from '@core/db/models';

import { colors } from './theme';

interface SyncBadgeProps {
  state: InterventionSyncState;
  style?: ViewStyle;
}

const COLORS: Record<InterventionSyncState, { bg: string; fg: string }> = {
  pending: { bg: colors.warningBg, fg: colors.warning },
  syncing: { bg: colors.infoBg, fg: colors.info },
  synced: { bg: colors.successBg, fg: colors.success },
  error: { bg: colors.dangerBg, fg: colors.danger },
};

export function SyncBadge({ state, style }: SyncBadgeProps) {
  const { t } = useTranslation();
  const palette = COLORS[state];

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={t(`interventions.syncState.${state}`)}
      style={[styles.badge, { backgroundColor: palette.bg }, style]}
    >
      <Text style={[styles.label, { color: palette.fg }]}>
        {t(`interventions.syncState.${state}`)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
