import type { CultivableZoneDto, GeoJsonGeometry } from '@core/api/dtos';

export interface CultivableZoneRow {
  serverId: number;
  name: string;
  geometry: GeoJsonGeometry | null;
  areaHectares: number | null;
  updatedAtServer: number;
}

export function mapCultivableZoneDto(dto: CultivableZoneDto): CultivableZoneRow {
  return {
    serverId: dto.id,
    name: dto.name,
    geometry: dto.shape ?? null,
    areaHectares: dto.area ?? null,
    updatedAtServer: dto.updated_at ? Date.parse(dto.updated_at) || 0 : 0,
  };
}
