import { Camera, Map, type StyleSpecification } from '@maplibre/maplibre-react-native';
import { StyleSheet, View } from 'react-native';

import { OSM_RASTER_STYLE } from './osm-style';

export interface MapViewProps {
  /** Style MapLibre (URL ou spec inline). Défaut : OSM raster. */
  style?: string | StyleSpecification;
  /** Centre initial [longitude, latitude]. Défaut : centre France. */
  initialCenter?: [number, number];
  /** Zoom initial. Défaut : 5 (échelle pays). */
  initialZoom?: number;
}

// Wrapper minimal P7.1 — affiche le fond carto.
// P7.2 ajoutera la couche polygones depuis cultivable_zones.geometry_geojson.
export function MapView({
  style = OSM_RASTER_STYLE,
  initialCenter = [2.5, 46.8],
  initialZoom = 5,
}: MapViewProps) {
  return (
    <View style={styles.container}>
      <Map mapStyle={style} style={StyleSheet.absoluteFill}>
        <Camera initialViewState={{ center: initialCenter, zoom: initialZoom }} />
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
