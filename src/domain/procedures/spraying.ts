import { z } from 'zod';

// Schéma Zod du formulaire « pulvérisation » (cf. docs/architecture.md §7
// et docs/workflow.md P5). Les IDs référencés sont des IDs locaux
// WatermelonDB (string), pas les server_id Ekylibre — la conversion
// vers les server_id se fait au moment du push (P6).
//
// Les messages d'erreur sont en FR, en dur : la v1 ne ship que le FR,
// et la couche domaine n'utilise pas i18n (pas de hook React dispo ici).

const trimmedString = (max = 500) => z.string().trim().max(max, `Maximum ${max} caractères.`);

const doerSchema = z.object({
  product_id: z.string().min(1, 'Conducteur requis.'),
  reference_name: z.literal('driver'),
});

const inputSchema = z.object({
  product_id: z.string().min(1, 'Produit requis.'),
  variant_id: z.string().min(1).optional(),
  reference_name: z.literal('plant_medicine'),
  quantity_value: z
    .number({ invalid_type_error: 'Quantité invalide.' })
    .positive('La quantité doit être supérieure à 0.')
    .finite('Quantité invalide.'),
  quantity_handler: z.string().min(1, 'Unité de mesure requise.'),
  quantity_unit: z.string().min(1).optional(),
});

const targetSchema = z.object({
  cultivable_zone_id: z.string().min(1, 'Parcelle requise.'),
  reference_name: z.literal('cultivation'),
});

const toolSchema = z.object({
  product_id: z.string().min(1, 'Pulvérisateur requis.'),
  reference_name: z.literal('sprayer'),
});

export const sprayingInterventionSchema = z
  .object({
    procedure_name: z.literal('spraying'),
    started_at: z.date({ invalid_type_error: 'Date de début invalide.' }),
    stopped_at: z.date({ invalid_type_error: 'Date de fin invalide.' }),
    description: trimmedString().optional(),
    doers: z.array(doerSchema).min(1, 'Au moins 1 conducteur requis.'),
    inputs: z.array(inputSchema).min(1, 'Au moins 1 produit phytosanitaire requis.'),
    targets: z.array(targetSchema).length(1, 'Exactement 1 parcelle cible.'),
    tools: z.array(toolSchema).min(1, 'Au moins 1 pulvérisateur requis.'),
  })
  .refine((i) => i.stopped_at.getTime() > i.started_at.getTime(), {
    message: 'La fin doit être après le début.',
    path: ['stopped_at'],
  });

export type SprayingIntervention = z.infer<typeof sprayingInterventionSchema>;
export type SprayingDoer = z.infer<typeof doerSchema>;
export type SprayingInput = z.infer<typeof inputSchema>;
export type SprayingTarget = z.infer<typeof targetSchema>;
export type SprayingTool = z.infer<typeof toolSchema>;
