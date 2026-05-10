import { z } from 'zod';

export const variantDtoSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    category: z.string().optional().nullable(),
    unit: z.string().optional().nullable(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export type VariantDto = z.infer<typeof variantDtoSchema>;

export const variantListSchema = z.array(variantDtoSchema);
