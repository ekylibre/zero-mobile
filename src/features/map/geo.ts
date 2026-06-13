import type { CultivableZone } from '@core/db/models';

export type ParcelKind = 'land_parcel' | 'plant';

export interface ParcelFeatureProps {
  /** Id local WDB de la cultivable_zone (clé pour la sélection). */
  id: string;
  /** Server id Ekylibre (pour debug / logs). */
  serverId: number;
  name: string;
  kind: ParcelKind | null;
  /** Sélectionnée → permet aux paint expressions de surligner. */
  selected: boolean;
}

export type ParcelFeature = GeoJSON.Feature<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  ParcelFeatureProps
>;

// Couple [west, south, east, north]. Compatible Camera bounds.
export type Bbox = [number, number, number, number];

function normalizeKind(raw: string | null): ParcelKind | null {
  return raw === 'land_parcel' || raw === 'plant' ? raw : null;
}

// La géométrie est typée loose côté DTO Zod (coordinates: unknown). On fait
// confiance au mapper en aval et on cast vers le type GeoJSON strict une fois
// le type discriminant validé.
function asPolygonish(
  geom: { type: string } | null,
): GeoJSON.Polygon | GeoJSON.MultiPolygon | null {
  if (!geom) return null;
  if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') return null;
  return geom as unknown as GeoJSON.Polygon | GeoJSON.MultiPolygon;
}

// Le prédicat permet single (id === x) ou multi (set.has(id)). Compatible avec
// l'ancienne signature en passant `id => id === selectedId`.
export type IsSelected = (zoneId: string) => boolean;

export function toFeatureCollection(
  zones: CultivableZone[],
  isSelected: IsSelected,
): GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, ParcelFeatureProps> {
  const features: ParcelFeature[] = [];
  for (const z of zones) {
    const geometry = asPolygonish(z.geometry as { type: string } | null);
    if (!geometry) continue;
    features.push({
      type: 'Feature',
      id: z.id,
      properties: {
        id: z.id,
        serverId: z.serverId,
        name: z.name,
        kind: normalizeKind(z.kind),
        selected: isSelected(z.id),
      },
      geometry,
    });
  }
  return { type: 'FeatureCollection', features };
}

// Approximation : 1° de latitude ≈ 111 km. Pour la longitude, on divise par
// cos(latitude) à mi-bbox. Suffisant pour dimensionner un précache de tuiles ;
// pas pour de la mesure géodésique précise.
const KM_PER_DEG_LAT = 111;

export function expandBbox(bbox: Bbox, bufferKm: number): Bbox {
  const [w, s, e, n] = bbox;
  const midLat = (s + n) / 2;
  const dLat = bufferKm / KM_PER_DEG_LAT;
  const cosLat = Math.cos((midLat * Math.PI) / 180);
  const dLng = cosLat > 1e-6 ? bufferKm / (KM_PER_DEG_LAT * cosLat) : dLat;
  return [
    Math.max(-180, w - dLng),
    Math.max(-85, s - dLat),
    Math.min(180, e + dLng),
    Math.min(85, n + dLat),
  ];
}

// Parcours toutes les coordonnées pour récupérer l'enveloppe [W,S,E,N].
// Retourne null si aucune position trouvée (FC vide ou géométries invalides).
export function computeBbox(
  fc: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
): Bbox | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  let touched = false;

  const visit = (lon: number, lat: number) => {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    touched = true;
    if (lon < west) west = lon;
    if (lon > east) east = lon;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  };

  for (const feat of fc.features) {
    const g = feat.geometry;
    if (g.type === 'Polygon') {
      for (const ring of g.coordinates) {
        for (const pos of ring) visit(pos[0]!, pos[1]!);
      }
    } else {
      for (const poly of g.coordinates) {
        for (const ring of poly) {
          for (const pos of ring) visit(pos[0]!, pos[1]!);
        }
      }
    }
  }

  return touched ? [west, south, east, north] : null;
}
