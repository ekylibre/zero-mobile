import { Model } from '@nozbe/watermelondb';
import { field, json } from '@nozbe/watermelondb/decorators';

import { Tables } from '../schema';

export type ProductType = 'workers' | 'equipments' | 'matters' | 'plants' | 'animals';

// Sanitiser : on accepte uniquement un array de strings ; tout autre input
// (null, objet, string non-array) est ramené à [] pour rester safe à la lecture.
const sanitizeAbilities = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string');
};

export class Product extends Model {
  static override table = Tables.products;

  @field('server_id') serverId!: number;
  @field('product_type') productType!: ProductType;
  @field('name') name!: string;
  @field('variant_id') variantId!: number | null;
  @field('variety') variety!: string | null;
  // Liste d'abilities sérialisée JSON (`["spray","sow(plant)"]`). Source de
  // vérité pour filtrer un produit comme outil compatible d'une procédure
  // (cf. `tool-filter.ts`). Vide ou absent = produit sans ability connue.
  @json('abilities_json', sanitizeAbilities) abilities!: string[];
  @field('updated_at_server') updatedAtServer!: number;
}
