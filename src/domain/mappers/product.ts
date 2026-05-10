import type { ApiProductType, ProductDto } from '@core/api/dtos';

export interface ProductRow {
  serverId: number;
  productType: ApiProductType;
  name: string;
  variantId: number | null;
  variety: string | null;
  updatedAtServer: number;
}

export function mapProductDto(dto: ProductDto, productType: ApiProductType): ProductRow {
  return {
    serverId: dto.id,
    productType,
    name: dto.name,
    variantId: dto.variant_id ?? null,
    variety: dto.variety ?? null,
    updatedAtServer: dto.updated_at ? Date.parse(dto.updated_at) || 0 : 0,
  };
}
