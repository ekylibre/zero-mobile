import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';

import { colors, radius } from './theme';

// Pictogramme de procédure, repris de l'ancienne app (`zero-android-v3`) où
// chaque type d'intervention a son icône dans la liste et le picker.
//
// Choix d'implémentation : on rend un glyphe emoji dans un carré arrondi teinté
// plutôt que des assets SVG. Cela évite une dépendance native supplémentaire,
// reste testable hors device, et dégrade proprement (fallback = initiale) pour
// une procédure inconnue. Si on veut un jeu d'icônes vectoriel plus fidèle plus
// tard, ce composant est le seul point à changer.

interface ProcedureGlyph {
  glyph: string;
  tint: string;
}

// Clés = noms de procédure Ekylibre (champ `Procedure.name`). On gère les
// variantes connues ; tout le reste retombe sur le fallback initiale.
const GLYPHS: Record<string, ProcedureGlyph> = {
  spraying: { glyph: '💦', tint: '#E3F2FD' },
  sowing: { glyph: '🌱', tint: '#E8F5E9' },
  seeding: { glyph: '🌱', tint: '#E8F5E9' },
  implantation: { glyph: '🌱', tint: '#E8F5E9' },
  plowing: { glyph: '🚜', tint: '#EFEBE9' },
  tillage: { glyph: '🚜', tint: '#EFEBE9' },
  cultivation: { glyph: '🚜', tint: '#EFEBE9' },
  irrigation: { glyph: '🚰', tint: '#E1F5FE' },
  watering: { glyph: '🚰', tint: '#E1F5FE' },
  harvest: { glyph: '🌾', tint: '#FFF8E1' },
  harvesting: { glyph: '🌾', tint: '#FFF8E1' },
  maintenance: { glyph: '🧰', tint: '#F3E5F5' },
  care: { glyph: '🧰', tint: '#F3E5F5' },
  fertilization: { glyph: '🌿', tint: '#E8F5E9' },
  mineral_fertilizing: { glyph: '🌿', tint: '#E8F5E9' },
  organic_fertilizing: { glyph: '🌿', tint: '#E8F5E9' },
};

export interface ProcedureIconProps {
  /** Nom Ekylibre de la procédure (`Procedure.name`). */
  procedureName: string;
  /** Côté du carré, en points. Défaut 44 (taille ligne de liste). */
  size?: number;
  testID?: string;
}

export function ProcedureIcon({ procedureName, size = 44, testID }: ProcedureIconProps) {
  const entry = GLYPHS[procedureName];
  const boxStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: radius.md,
    backgroundColor: entry?.tint ?? colors.surfaceAlt,
  };
  const glyphStyle: TextStyle = { fontSize: Math.round(size * 0.5) };

  const fallback = (procedureName.trim()[0] ?? '?').toUpperCase();

  return (
    <View style={[styles.box, boxStyle]} testID={testID}>
      {entry ? (
        <Text style={glyphStyle} accessibilityElementsHidden>
          {entry.glyph}
        </Text>
      ) : (
        <Text style={[styles.fallback, { fontSize: Math.round(size * 0.4) }]}>{fallback}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create<{ box: ViewStyle; fallback: TextStyle }>({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    fontWeight: '700',
    color: colors.textSecondary,
  },
});
