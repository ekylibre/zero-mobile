import { z } from 'zod';

// Géométrie GeoJSON Polygon ou MultiPolygon. On reste lâche : si Ekylibre
// renvoie un autre type (Point, LineString…), le mapper le préserve mais
// la couche carte décidera de l'affichage.
export const geoJsonGeometrySchema = z
  .object({
    type: z.string(),
    coordinates: z.unknown(),
  })
  .passthrough();

export type GeoJsonGeometry = z.infer<typeof geoJsonGeometrySchema>;

export const cultivableZoneDtoSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    // `shape` est au format WKT Ekylibre ({ feature, properties }), PAS du
    // GeoJSON — on ne le valide donc pas. Le vrai GeoJSON arrive dans
    // `shape_to_geojson`, encodé en STRING (cf. mapCultivableZoneDto).
    shape: z.unknown().optional().nullable(),
    shape_to_geojson: z.string().optional().nullable(),
    area: z.number().optional().nullable(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export type CultivableZoneDto = z.infer<typeof cultivableZoneDtoSchema>;

export const cultivableZoneListSchema = z.array(cultivableZoneDtoSchema);
