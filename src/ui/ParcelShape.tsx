import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface ParcelShapeProps {
  /** Chaîne `shape_svg` renvoyée par Ekylibre (land_parcels). Null = vide. */
  svg: string | null;
  size?: number;
}

/**
 * Extrait le `viewBox` et le `d` du premier `<path>` d'un `shape_svg` Ekylibre.
 * On rend ensuite un `<Svg>/<Path>` explicite (fill + stroke garantis) plutôt
 * que `SvgXml` : pas de parsing XML complet, et un tracé toujours visible.
 */
export function parseParcelSvg(svg: string): { viewBox: string; d: string } | null {
  const viewBox = /viewBox=['"]([^'"]+)['"]/.exec(svg)?.[1];
  const d = /<path[^>]*\sd=['"]([^'"]+)['"]/i.exec(svg)?.[1];
  if (!viewBox || !d) return null;
  return { viewBox, d };
}

export function ParcelShape({ svg, size = 56 }: ParcelShapeProps) {
  const parsed = svg ? parseParcelSvg(svg) : null;
  return (
    <View style={[styles.box, { width: size, height: size }]} testID="parcel-shape">
      {parsed ? (
        <Svg width={size} height={size} viewBox={parsed.viewBox}>
          {/* fill + stroke explicites : visible quel que soit le défaut natif.
              vectorEffect garde un trait d'1px malgré l'échelle du viewBox. */}
          <Path
            d={parsed.d}
            fill="#cfe3cf"
            stroke="#3a7d3a"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    backgroundColor: '#fafafa',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
