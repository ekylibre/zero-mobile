import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

import { Tables } from '../schema';

export type ProductType = 'workers' | 'equipments' | 'matters' | 'plants' | 'animals';

export class Product extends Model {
  static override table = Tables.products;

  @field('server_id') serverId!: number;
  @field('product_type') productType!: ProductType;
  @field('name') name!: string;
  @field('variant_id') variantId!: number | null;
  @field('variety') variety!: string | null;
  @field('updated_at_server') updatedAtServer!: number;
}
