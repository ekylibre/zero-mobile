import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { PROCEDURE_VECTORS } from './procedure-icons';
import { colors, radius } from './theme';

// Pictogramme de procédure, repris de l'ancienne app (`zero-android-v3`,
// res/drawable/procedure_*.xml) : les vector drawables Android sont convertis en
// données SVG (cf. `procedure-icons.ts`) et rendus via react-native-svg dans un
// carré arrondi teinté. Fallback : carré neutre + initiale (procédure inconnue).
//
// react-native-svg est déjà une dépendance native (ParcelShape) — pas de
// nouveau rebuild requis.

interface IconEntry {
  /** Clé dans PROCEDURE_VECTORS. */
  vector: string;
  /** Teinte de fond du carré. */
  tint: string;
}

// Noms de procédure Ekylibre → icône + teinte. Les variantes connues pointent
// vers le même vecteur ; tout le reste retombe sur le fallback initiale.
const ICONS: Record<string, IconEntry> = {
  spraying: { vector: 'crop_protection', tint: '#E3F2FD' },
  sowing: { vector: 'implantation', tint: '#E8F5E9' },
  seeding: { vector: 'implantation', tint: '#E8F5E9' },
  implantation: { vector: 'implantation', tint: '#E8F5E9' },
  plowing: { vector: 'ground_work', tint: '#EFEBE9' },
  tillage: { vector: 'ground_work', tint: '#EFEBE9' },
  cultivation: { vector: 'ground_work', tint: '#EFEBE9' },
  irrigation: { vector: 'irrigation', tint: '#E1F5FE' },
  watering: { vector: 'irrigation', tint: '#E1F5FE' },
  harvest: { vector: 'harvest', tint: '#FFF8E1' },
  harvesting: { vector: 'harvest', tint: '#FFF8E1' },
  maintenance: { vector: 'care', tint: '#F3E5F5' },
  care: { vector: 'care', tint: '#F3E5F5' },
  fertilization: { vector: 'fertilization', tint: '#E8F5E9' },
  mineral_fertilizing: { vector: 'fertilization', tint: '#E8F5E9' },
  organic_fertilizing: { vector: 'fertilization', tint: '#E8F5E9' },
};

// Couleur de tracé par défaut (silhouette sombre, façon ancienne app) pour les
// chemins dont le vecteur source ne fixe pas de couleur (références @color/...).
const GLYPH_COLOR = '#3A3A3A';

export interface ProcedureIconProps {
  /** Nom Ekylibre de la procédure (`Procedure.name`). */
  procedureName: string;
  /** Côté du carré, en points. Défaut 44 (taille ligne de liste). */
  size?: number;
  testID?: string;
}

export function ProcedureIcon({ procedureName, size = 44, testID }: ProcedureIconProps) {
  const entry = ICONS[procedureName];
  const vector = entry ? PROCEDURE_VECTORS[entry.vector] : undefined;
  const boxStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: radius.md,
    backgroundColor: entry?.tint ?? colors.surfaceAlt,
  };
  const glyphSize = Math.round(size * 0.62);
  const fallback = (procedureName.trim()[0] ?? '?').toUpperCase();

  return (
    <View style={[styles.box, boxStyle]} testID={testID}>
      {vector ? (
        <Svg width={glyphSize} height={glyphSize} viewBox={vector.viewBox}>
          {vector.paths.map((p, i) => (
            <Path key={i} d={p.d} fill={p.fill ?? GLYPH_COLOR} fillRule={p.fillRule ?? 'nonzero'} />
          ))}
        </Svg>
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
    overflow: 'hidden',
  },
  fallback: {
    fontWeight: '700',
    color: colors.textSecondary,
  },
});
