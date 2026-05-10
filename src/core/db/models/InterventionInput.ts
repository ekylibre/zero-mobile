import { Model } from '@nozbe/watermelondb';
import { field, immutableRelation, relation } from '@nozbe/watermelondb/decorators';

import { Tables } from '../schema';

import type { Intervention } from './Intervention';
import type { Product } from './Product';
import type { Variant } from './Variant';

export class InterventionInput extends Model {
  static override table = Tables.interventionInputs;

  static override associations = {
    [Tables.interventions]: { type: 'belongs_to' as const, key: 'intervention_id' },
    [Tables.products]: { type: 'belongs_to' as const, key: 'product_id' },
    [Tables.variants]: { type: 'belongs_to' as const, key: 'variant_id' },
  };

  @field('intervention_id') interventionId!: string;
  @field('product_id') productId!: string;
  @field('variant_id') variantId!: string | null;
  @field('reference_name') referenceName!: string;
  @field('quantity_value') quantityValue!: number;
  @field('quantity_handler') quantityHandler!: string;
  @field('quantity_unit') quantityUnit!: string | null;

  @immutableRelation(Tables.interventions, 'intervention_id') intervention!: Intervention;
  @immutableRelation(Tables.products, 'product_id') product!: Product;
  @relation(Tables.variants, 'variant_id') variant!: Variant | null;
}
