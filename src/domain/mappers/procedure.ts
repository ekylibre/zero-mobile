import type { ProcedureDto } from '@core/api/dtos';

// Forme intermédiaire (camelCase, types JS natifs) consommée par les persisters.
export interface ProcedureRow {
  name: string;
  labelFr: string;
  definition: Record<string, unknown>;
  updatedAtServer: number;
}

export function mapProcedureDto(dto: ProcedureDto): ProcedureRow {
  return {
    name: dto.name,
    labelFr: dto.label_fr ?? dto.label ?? dto.name,
    definition: { parameters: dto.parameters ?? [] },
    updatedAtServer: parseTimestamp(dto.updated_at),
  };
}

function parseTimestamp(input: string | undefined): number {
  if (!input) return 0;
  const parsed = Date.parse(input);
  return Number.isNaN(parsed) ? 0 : parsed;
}
