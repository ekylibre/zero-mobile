import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';

import { colors, fontSize, radius, spacing } from './theme';

// Section repliable du formulaire d'intervention, calquée sur l'ancienne app :
// titre bleu à gauche, résumé court à droite (visible même replié), chevron
// d'état. Le contenu n'est monté que lorsque la section est dépliée.
//
// Composant *contrôlé* (`expanded` + `onToggle`) — le parent garde la main sur
// l'état d'ouverture (une seule section ouverte à la fois, persistance, etc.)
// et le composant reste testable sans état interne caché.

export interface AccordionSectionProps {
  title: string;
  /** Résumé affiché à droite du titre (ex. « 2 cultures • 4,3 ha »). */
  summary?: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
  testID?: string;
}

export function AccordionSection({
  title,
  summary,
  expanded,
  onToggle,
  children,
  testID,
}: AccordionSectionProps) {
  return (
    <View style={styles.container} testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
        testID={testID ? `${testID}-header` : undefined}
      >
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.right}>
          {summary != null ? (
            typeof summary === 'string' ? (
              <Text style={styles.summary} numberOfLines={1}>
                {summary}
              </Text>
            ) : (
              summary
            )
          ) : null}
          <Text style={styles.chevron}>{expanded ? '⌃' : '⌄'}</Text>
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.body} testID={testID ? `${testID}-body` : undefined}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create<{
  container: ViewStyle;
  header: ViewStyle;
  headerPressed: ViewStyle;
  title: TextStyle;
  right: ViewStyle;
  summary: TextStyle;
  chevron: TextStyle;
  body: ViewStyle;
}>({
  container: {
    borderRadius: radius.lg,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.background,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  headerPressed: { backgroundColor: colors.surface },
  title: { flexShrink: 0, fontSize: fontSize.lg, fontWeight: '600', color: colors.blue },
  right: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  summary: {
    flexShrink: 1,
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  chevron: { fontSize: fontSize.lg, color: colors.textMuted, width: 16, textAlign: 'center' },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.xs,
  },
});
