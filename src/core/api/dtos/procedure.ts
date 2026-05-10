import { z } from 'zod';

// Représentation lâche de la définition de procédure renvoyée par
// GET /api/v2/procedures. La forme exacte sera affinée en P5+ quand
// le moteur de formulaire dynamique sera implémenté.
export const procedureDtoSchema = z
  .object({
    name: z.string(),
    label: z.string().optional(),
    label_fr: z.string().optional(),
    parameters: z.array(z.unknown()).optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export type ProcedureDto = z.infer<typeof procedureDtoSchema>;

export const procedureListSchema = z.array(procedureDtoSchema);
