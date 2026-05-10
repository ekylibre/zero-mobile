import { z } from 'zod';

// DTO de lecture des interventions retournées par GET /api/v2/interventions.
// Le payload d'écriture (POST/PUT) sera défini en P6.
export const interventionDtoSchema = z
  .object({
    id: z.number(),
    procedure_name: z.string(),
    started_at: z.string(),
    stopped_at: z.string(),
    whole_duration: z.number().optional(),
    working_duration: z.number().optional(),
    description: z.string().optional().nullable(),
    state: z.string().optional(),
    nature: z.string().optional(),
    provider: z
      .object({
        vendor: z.string().optional(),
        name: z.string().optional(),
        id: z.string().optional(),
      })
      .passthrough()
      .optional()
      .nullable(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export type InterventionDto = z.infer<typeof interventionDtoSchema>;

export const interventionListSchema = z.array(interventionDtoSchema);
