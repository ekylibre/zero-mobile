import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type FillLayerSpecification,
  type LineLayerSpecification,
  type PressEventWithFeatures,
  type StyleSpecification,
} from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';
import { StyleSheet, View, type NativeSyntheticEvent } from 'react-native';

import type { Bbox, ParcelFeatureProps } from './geo';
import { computeBbox } from './geo';
import { OSM_RASTER_STYLE } from './osm-style';

type ParcelFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  ParcelFeatureProps
>;

export interface MapViewProps {
  /** Style MapLibre (URL ou spec inline). Défaut : OSM raster. */
  style?: string | StyleSpecification;
  /** Centre initial [longitude, latitude]. Utilisé si parcels est vide. */
  initialCenter?: [number, number];
  /** Zoom initial. Utilisé si parcels est vide. */
  initialZoom?: number;
  /** Couche optionnelle de parcelles. Si fournie, la caméra s'adapte à la bbox. */
  parcels?: ParcelFeatureCollection;
  /** Appelé avec l'id local WDB de la parcelle tapée. */
  onParcelPress?: (id: string) => void;
}

const SOURCE_ID = 'parcels';

// Surlignage piloté par la propriété feature `selected` (boolean). Pas besoin
// d'un setFilter / d'une seconde couche : MapLibre évalue l'expression à chaque
// re-render du source. Cast unique sur la spec MapLibre — les expressions
// inline ne se typent pas naturellement face aux tuples discriminés stricts.
const FILL_PAINT: FillLayerSpecification['paint'] = {
  'fill-color': ['case', ['get', 'selected'], '#2563eb', '#22c55e'],
  'fill-opacity': ['case', ['get', 'selected'], 0.55, 0.3],
} as FillLayerSpecification['paint'];

const LINE_PAINT: LineLayerSpecification['paint'] = {
  'line-color': ['case', ['get', 'selected'], '#1d4ed8', '#15803d'],
  'line-width': ['case', ['get', 'selected'], 3, 1.5],
} as LineLayerSpecification['paint'];

export function MapView({
  style = OSM_RASTER_STYLE,
  initialCenter = [2.5, 46.8],
  initialZoom = 5,
  parcels,
  onParcelPress,
}: MapViewProps) {
  const bbox: Bbox | null = useMemo(
    () => (parcels && parcels.features.length > 0 ? computeBbox(parcels) : null),
    [parcels],
  );

  // Bounds → vue cadrée sur l'ensemble. Sinon center/zoom par défaut.
  const initialViewState = bbox
    ? { bounds: bbox, padding: { top: 32, bottom: 32, left: 32, right: 32 } }
    : { center: initialCenter, zoom: initialZoom };

  const handleSourcePress = (event: NativeSyntheticEvent<PressEventWithFeatures>) => {
    const feature = event.nativeEvent.features?.[0];
    const id = feature?.properties?.id;
    if (typeof id === 'string' && onParcelPress) onParcelPress(id);
  };

  return (
    <View style={styles.container}>
      <Map mapStyle={style} style={StyleSheet.absoluteFill}>
        <Camera initialViewState={initialViewState} />
        {parcels && parcels.features.length > 0 ? (
          <GeoJSONSource id={SOURCE_ID} data={parcels} onPress={handleSourcePress}>
            <Layer id="parcels-fill" type="fill" source={SOURCE_ID} paint={FILL_PAINT} />
            <Layer id="parcels-outline" type="line" source={SOURCE_ID} paint={LINE_PAINT} />
          </GeoJSONSource>
        ) : null}
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
