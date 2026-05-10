import type { VariantDto } from '@core/api/dtos';

export interface VariantRow {
  serverId: number;
  name: string;
  category: string;
  unit: string | null;
  updatedAtServer: number;
}

export function mapVariantDto(dto: VariantDto): VariantRow {
  return {
    serverId: dto.id,
    name: dto.name,
    category: dto.category ?? 'unknown',
    unit: dto.unit ?? null,
    updatedAtServer: dto.updated_at ? Date.parse(dto.updated_at) || 0 : 0,
  };
}
