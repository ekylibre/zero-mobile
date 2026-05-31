import { Pressable, StyleSheet, Text, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fontSize, radius, spacing } from './theme';

// Barre d'action fixe en bas d'écran (formulaire d'intervention), reprenant le
// duo ANNULER / ENREGISTRER de l'ancienne app. Le bouton primaire (vert) est à
// droite, le secondaire (contour) à gauche. On respecte l'inset bas (encoche /
// barre gestuelle) via `SafeAreaView edges={['bottom']}` (même primitive que
// SelectField, qui ne dépend pas d'un SafeAreaProvider monté en test).

export interface BottomActionButton {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}

export interface BottomActionBarProps {
  primary: BottomActionButton;
  secondary?: BottomActionButton;
}

export function BottomActionBar({ primary, secondary }: BottomActionBarProps) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.bar} testID="bottom-action-bar">
      {secondary ? (
        <Pressable
          accessibilityRole="button"
          onPress={secondary.onPress}
          disabled={secondary.disabled}
          style={({ pressed }) => [
            styles.button,
            styles.secondary,
            (pressed || secondary.disabled) && styles.pressed,
          ]}
          testID={secondary.testID}
        >
          <Text style={styles.secondaryLabel}>{secondary.label}</Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={primary.onPress}
        disabled={primary.disabled}
        style={({ pressed }) => [
          styles.button,
          styles.primary,
          (pressed || primary.disabled) && styles.pressed,
        ]}
        testID={primary.testID}
      >
        <Text style={styles.primaryLabel}>{primary.label}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create<{
  bar: ViewStyle;
  button: ViewStyle;
  primary: ViewStyle;
  secondary: ViewStyle;
  pressed: ViewStyle;
  primaryLabel: TextStyle;
  secondaryLabel: TextStyle;
}>({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.background,
  },
  button: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.green },
  secondary: {
    backgroundColor: colors.background,
    borderColor: colors.borderStrong,
    borderWidth: 1,
  },
  pressed: { opacity: 0.7 },
  primaryLabel: { color: colors.textOnBrand, fontSize: fontSize.lg, fontWeight: '600' },
  secondaryLabel: { color: colors.textSecondary, fontSize: fontSize.lg, fontWeight: '600' },
});
