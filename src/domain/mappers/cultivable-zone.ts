import type { CultivableZoneDto, GeoJsonGeometry } from '@core/api/dtos';

export interface CultivableZoneRow {
  serverId: number;
  name: string;
  geometry: GeoJsonGeometry | null;
  areaHectares: number | null;
  updatedAtServer: number;
}

// L'API Ekylibre v2 renvoie le GeoJSON dans `shape_to_geojson`, encodé en
// STRING (le champ `shape`, lui, est du WKT). On parse cette chaîne et on ne
// garde que ce qui ressemble à une géométrie GeoJSON ({ type, ... }).
function parseGeometry(raw?: string | null): GeoJsonGeometry | null {
  if (!raw) return null;
  try {
    const g = JSON.parse(raw);
    return g && typeof g === 'object' && 'type' in g ? (g as GeoJsonGeometry) : null;
  } catch {
    return null;
  }
}

export function mapCultivableZoneDto(dto: CultivableZoneDto): CultivableZoneRow {
  return {
    serverId: dto.id,
    name: dto.name,
    geometry: parseGeometry(dto.shape_to_geojson),
    areaHectares: dto.area ?? null,
    updatedAtServer: dto.updated_at ? Date.parse(dto.updated_at) || 0 : 0,
  };
}
