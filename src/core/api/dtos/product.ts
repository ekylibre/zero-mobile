import { z } from 'zod';

// Type de produit côté API v2 (passé en query string : ?product_type=workers).
export const productTypeSchema = z.enum(['workers', 'equipments', 'matters', 'plants', 'animals']);
export type ApiProductType = z.infer<typeof productTypeSchema>;

export const productDtoSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    variant_id: z.number().optional().nullable(),
    variety: z.string().optional().nullable(),
    // Liste des abilities (`["spray","sow"]`, `["spread(preparation)"]`…) ;
    // utilisée pour filtrer les outils selon le filter de la procedure.
    abilities: z.array(z.string()).optional().nullable(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export type ProductDto = z.infer<typeof productDtoSchema>;

export const productListSchema = z.array(productDtoSchema);
