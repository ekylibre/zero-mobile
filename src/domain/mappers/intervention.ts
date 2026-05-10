import type { InterventionDto } from '@core/api/dtos';

// Représentation d'une intervention déjà persistée côté serveur, ramenée
// au shape utilisé par notre table locale `interventions`. Le payload
// d'écriture (POST/PUT) est l'inverse et sera construit en P6.
export interface InterventionReadRow {
  clientUuid: string;
  serverId: number;
  procedureName: string;
  startedAt: number;
  stoppedAt: number;
  wholeDurationSeconds: number;
  workingDurationSeconds: number;
  description: string | null;
  syncState: 'synced';
  syncErrorMessage: null;
  syncAttemptCount: number;
  lastSyncedAt: number;
}

export function mapInterventionDto(
  dto: InterventionDto,
  fallbackUuid: string,
): InterventionReadRow {
  const startedAt = Date.parse(dto.started_at) || 0;
  const stoppedAt = Date.parse(dto.stopped_at) || 0;
  const updatedAt = dto.updated_at ? Date.parse(dto.updated_at) || Date.now() : Date.now();

  return {
    // Le serveur peut renvoyer un provider.id (UUID que NOUS avons envoyé au POST)
    // ou pas (intervention créée depuis le web Ekylibre). Dans ce dernier cas, on
    // génère un UUID local pour pouvoir tracker les futures éditions.
    clientUuid: dto.provider?.id ?? fallbackUuid,
    serverId: dto.id,
    procedureName: dto.procedure_name,
    startedAt,
    stoppedAt,
    wholeDurationSeconds:
      dto.whole_duration ?? Math.max(0, Math.round((stoppedAt - startedAt) / 1000)),
    workingDurationSeconds:
      dto.working_duration ?? Math.max(0, Math.round((stoppedAt - startedAt) / 1000)),
    description: dto.description ?? null,
    syncState: 'synced',
    syncErrorMessage: null,
    syncAttemptCount: 0,
    lastSyncedAt: updatedAt,
  };
}
