import { Model } from '@nozbe/watermelondb';
import { field, json } from '@nozbe/watermelondb/decorators';

import { Tables } from '../schema';

interface ProcedureDefinition {
  parameters?: Record<string, unknown>;
  [k: string]: unknown;
}

const sanitizeDefinition = (raw: unknown): ProcedureDefinition => {
  return raw && typeof raw === 'object' ? (raw as ProcedureDefinition) : {};
};

export class Procedure extends Model {
  static override table = Tables.procedures;

  @field('name') name!: string;
  @field('label_fr') labelFr!: string;
  @json('definition_json', sanitizeDefinition) definition!: ProcedureDefinition;
  @field('updated_at_server') updatedAtServer!: number;
}
