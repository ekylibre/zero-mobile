import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import type { InterventionSyncState } from '@core/db/models';

interface SyncBadgeProps {
  state: InterventionSyncState;
  style?: ViewStyle;
}

const COLORS: Record<InterventionSyncState, { bg: string; fg: string }> = {
  pending: { bg: '#fff7e6', fg: '#7a4f00' },
  syncing: { bg: '#e6f1ff', fg: '#1d4f9e' },
  synced: { bg: '#e6f9ee', fg: '#0c6b2c' },
  error: { bg: '#fde6e6', fg: '#a3171c' },
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
