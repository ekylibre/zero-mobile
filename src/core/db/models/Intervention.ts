import { Model, type Query } from '@nozbe/watermelondb';
import { children, date, field, readonly } from '@nozbe/watermelondb/decorators';

import { Tables } from '../schema';

import type { InterventionDoer } from './InterventionDoer';
import type { InterventionInput } from './InterventionInput';
import type { InterventionTarget } from './InterventionTarget';
import type { InterventionTool } from './InterventionTool';
import type { InterventionWorkingPeriod } from './InterventionWorkingPeriod';

export type InterventionSyncState = 'pending' | 'syncing' | 'synced' | 'error';

export class Intervention extends Model {
  static override table = Tables.interventions;

  static override associations = {
    [Tables.interventionDoers]: { type: 'has_many' as const, foreignKey: 'intervention_id' },
    [Tables.interventionInputs]: { type: 'has_many' as const, foreignKey: 'intervention_id' },
    [Tables.interventionTargets]: { type: 'has_many' as const, foreignKey: 'intervention_id' },
    [Tables.interventionTools]: { type: 'has_many' as const, foreignKey: 'intervention_id' },
    [Tables.interventionWorkingPeriods]: {
      type: 'has_many' as const,
      foreignKey: 'intervention_id',
    },
  };

  @field('client_uuid') clientUuid!: string;
  @field('server_id') serverId!: number | null;
  @field('procedure_name') procedureName!: string;
  @date('started_at') startedAt!: Date;
  @date('stopped_at') stoppedAt!: Date;
  @field('whole_duration_seconds') wholeDurationSeconds!: number;
  @field('working_duration_seconds') workingDurationSeconds!: number;
  @field('description') description!: string | null;
  @field('sync_state') syncState!: InterventionSyncState;
  @field('sync_error_message') syncErrorMessage!: string | null;
  @field('sync_attempt_count') syncAttemptCount!: number;
  @date('last_synced_at') lastSyncedAt!: Date | null;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @children(Tables.interventionDoers) doers!: Query<InterventionDoer>;
  @children(Tables.interventionInputs) inputs!: Query<InterventionInput>;
  @children(Tables.interventionTargets) targets!: Query<InterventionTarget>;
  @children(Tables.interventionTools) tools!: Query<InterventionTool>;
  @children(Tables.interventionWorkingPeriods) workingPeriods!: Query<InterventionWorkingPeriod>;
}
