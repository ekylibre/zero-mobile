import type { StyleSpecification } from '@maplibre/maplibre-react-native';

// Style MapLibre minimal — fond OpenStreetMap raster.
//
// ⚠️ CGU OSM (https://operations.osmfoundation.org/policies/tiles/) :
//   - usage modéré uniquement (panel pilote OK, montée en charge à revoir)
//   - User-Agent identifiable côté client
//   - cache local recommandé (P7.4 : MBTiles offline par bbox)
//
// La décision de fournisseur (OSM direct / MapTiler / Stadia / Geoportail)
// est documentée dans docs/workflow.md §10.6. Si on change, ne toucher que ce
// fichier — la `MapView` lit `style` en prop.
export const OSM_RASTER_STYLE = {
  version: 8,
  name: 'osm-raster',
  sources: {
    osm: {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#f2efe9' } },
    { id: 'osm', type: 'raster', source: 'osm' },
  ],
} satisfies StyleSpecification;
