import type { CultivableZoneDto, GeoJsonGeometry } from '@core/api/dtos';

export interface CultivableZoneRow {
  serverId: number;
  name: string;
  geometry: GeoJsonGeometry | null;
  areaHectares: number | null;
  /** Fin de culture (ms epoch) — null = active. */
  deadAt: number | null;
  /** Tracé SVG de la parcelle (string), null si non fourni. */
  shapeSvg: string | null;
  updatedAtServer: number;
}

// Le GeoJSON arrive soit en string (JSON-encoded — `cultivable_zones`), soit
// en objet (`products?product_type=land_parcels|plants` depuis 2026-06-13).
// Charta peut renvoyer l'un ou l'autre selon l'appelant côté Rails.
function parseGeometry(raw: unknown): GeoJsonGeometry | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      const g = JSON.parse(raw);
      return g && typeof g === 'object' && 'type' in g ? (g as GeoJsonGeometry) : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object' && raw !== null && 'type' in raw) {
    return raw as GeoJsonGeometry;
  }
  return null;
}

// La valeur de `net_surface_area` peut être une fraction string ("4743/500")
// ou un nombre. Renvoie un décimal, ou null si non parsable.
function parseRational(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (s.includes('/')) {
    const [n, d] = s.split('/');
    const num = Number(n);
    const den = Number(d);
    return den !== 0 && Number.isFinite(num) && Number.isFinite(den) ? num / den : null;
  }
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

function surfaceToHectares(dto: CultivableZoneDto): number | null {
  const nsa = dto.net_surface_area;
  if (nsa) {
    const value = parseRational(nsa.value);
    if (value !== null) {
      if (nsa.unit === 'square_meter') return value / 10_000;
      // hectare (défaut Ekylibre pour cette mesure) ou unité absente.
      return value;
    }
  }
  return dto.area ?? null;
}

function parseTimestamp(input?: string | null): number | null {
  if (!input) return null;
  const t = Date.parse(input);
  return Number.isNaN(t) ? null : t;
}

export function mapCultivableZoneDto(dto: CultivableZoneDto): CultivableZoneRow {
  return {
    serverId: dto.id,
    name: dto.name,
    geometry: parseGeometry(dto.shape_geojson ?? dto.shape_to_geojson),
    areaHectares: surfaceToHectares(dto),
    deadAt: parseTimestamp(dto.dead_at),
    shapeSvg: dto.shape_svg ?? null,
    updatedAtServer: dto.updated_at ? Date.parse(dto.updated_at) || 0 : 0,
  };
}
