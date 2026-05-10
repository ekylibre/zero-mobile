import { Model } from '@nozbe/watermelondb';
import { field, immutableRelation } from '@nozbe/watermelondb/decorators';

import { Tables } from '../schema';

import type { Intervention } from './Intervention';
import type { Product } from './Product';

export class InterventionDoer extends Model {
  static override table = Tables.interventionDoers;

  static override associations = {
    [Tables.interventions]: { type: 'belongs_to' as const, key: 'intervention_id' },
    [Tables.products]: { type: 'belongs_to' as const, key: 'product_id' },
  };

  @field('intervention_id') interventionId!: string;
  @field('product_id') productId!: string;
  @field('reference_name') referenceName!: string;

  @immutableRelation(Tables.interventions, 'intervention_id') intervention!: Intervention;
  @immutableRelation(Tables.products, 'product_id') product!: Product;
}
