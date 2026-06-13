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

// Surface nette telle que renvoyée par `products?product_type=land_parcels` :
// la valeur peut être une fraction string ("4743/500") ou un nombre.
export const measureSchema = z
  .object({
    value: z.union([z.string(), z.number()]),
    unit: z.string().optional(),
  })
  .passthrough();

// Les cibles `cultivation` sont servies par
// `products?product_type=land_parcels|plants` : `name` est le nom complet de
// la production ("Bernessard Blé tendre d'hiver 2026"), `dead_at` la fin de
// culture, `net_surface_area` la surface. `shape_geojson` (P7) est servi par
// ces deux endpoints depuis 2026-06-13 ; `shape_to_geojson` reste accepté pour
// la rétro-compat avec `/api/v2/cultivable_zones`. Charta peut sérialiser en
// string OU en objet selon le contexte → on accepte les deux formes.
export const cultivableZoneDtoSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    shape: z.unknown().optional().nullable(),
    shape_geojson: z.union([z.string(), geoJsonGeometrySchema]).optional().nullable(),
    shape_to_geojson: z.union([z.string(), geoJsonGeometrySchema]).optional().nullable(),
    area: z.number().optional().nullable(),
    net_surface_area: measureSchema.optional().nullable(),
    dead_at: z.string().optional().nullable(),
    born_at: z.string().optional().nullable(),
    shape_svg: z.string().optional().nullable(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export type CultivableZoneDto = z.infer<typeof cultivableZoneDtoSchema>;

export const cultivableZoneListSchema = z.array(cultivableZoneDtoSchema);
