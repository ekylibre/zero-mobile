import { Pressable, StyleSheet, Text, type TextStyle, type ViewStyle } from 'react-native';

import { colors, fontSize, radius, spacing } from './theme';

// Action « + AJOUTER » inline, en vert, telle que l'ancienne app la place à
// côté des titres de section tableau (Intrants, Matériaux, Outils). Texte seul
// (pas de fond) pour rester discret à côté du titre.

export interface InlineAddButtonProps {
  label: string;
  onPress: () => void;
  testID?: string;
}

export function InlineAddButton({ label, onPress, testID }: InlineAddButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      testID={testID}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create<{ button: ViewStyle; pressed: ViewStyle; label: TextStyle }>({
  button: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  pressed: { backgroundColor: colors.greenSoft },
  label: { color: colors.green, fontSize: fontSize.base, fontWeight: '700' },
});
