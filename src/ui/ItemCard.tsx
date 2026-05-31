import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';

import { colors, fontSize, radius, spacing } from './theme';

// Carte d'item d'un tableau (intrant, outil, conducteur) reprenant l'ancienne
// app : vignette/icône optionnelle à gauche, titre + sous-titre, croix verte de
// suppression à droite, et un éventuel contenu additionnel (ex. ligne quantité)
// rendu sous l'en-tête.

export interface ItemCardProps {
  title: string;
  subtitle?: string | null;
  /** Élément visuel à gauche (ProcedureIcon, vignette, …). */
  leading?: ReactNode;
  /** Affiche la croix de suppression si fourni. */
  onRemove?: () => void;
  /** Libellé d'accessibilité de la croix (ex. « Retirer »). */
  removeAccessibilityLabel?: string;
  children?: ReactNode;
  testID?: string;
}

export function ItemCard({
  title,
  subtitle,
  leading,
  onRemove,
  removeAccessibilityLabel,
  children,
  testID,
}: ItemCardProps) {
  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.header}>
        {leading != null ? <View style={styles.leading}>{leading}</View> : null}
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {onRemove ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={removeAccessibilityLabel}
            onPress={onRemove}
            hitSlop={8}
            style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
            testID={testID ? `${testID}-remove` : undefined}
          >
            <Text style={styles.removeGlyph}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      {children != null ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create<{
  card: ViewStyle;
  header: ViewStyle;
  leading: ViewStyle;
  textWrap: ViewStyle;
  title: TextStyle;
  subtitle: TextStyle;
  remove: ViewStyle;
  removePressed: ViewStyle;
  removeGlyph: TextStyle;
  body: ViewStyle;
}>({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  leading: { flexShrink: 0 },
  textWrap: { flex: 1 },
  title: { fontSize: fontSize.base, fontWeight: '600', color: colors.textPrimary },
  subtitle: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: 2 },
  remove: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePressed: { backgroundColor: colors.greenSoft },
  removeGlyph: { fontSize: fontSize.lg, color: colors.green, fontWeight: '700' },
  body: { marginTop: spacing.md },
});
