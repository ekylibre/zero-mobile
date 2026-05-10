import { Model } from '@nozbe/watermelondb';
import { date, field, immutableRelation } from '@nozbe/watermelondb/decorators';

import { Tables } from '../schema';

import type { Intervention } from './Intervention';

export type WorkingPeriodNature = 'preparation' | 'travel' | 'intervention' | 'pause';

export class InterventionWorkingPeriod extends Model {
  static override table = Tables.interventionWorkingPeriods;

  static override associations = {
    [Tables.interventions]: { type: 'belongs_to' as const, key: 'intervention_id' },
  };

  @field('intervention_id') interventionId!: string;
  @date('started_at') startedAt!: Date;
  @date('stopped_at') stoppedAt!: Date;
  @field('duration_seconds') durationSeconds!: number;
  @field('nature') nature!: WorkingPeriodNature;

  @immutableRelation(Tables.interventions, 'intervention_id') intervention!: Intervention;
}
