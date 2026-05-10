import { Model } from '@nozbe/watermelondb';
import { field, immutableRelation } from '@nozbe/watermelondb/decorators';

import { Tables } from '../schema';

import type { CultivableZone } from './CultivableZone';
import type { Intervention } from './Intervention';

export class InterventionTarget extends Model {
  static override table = Tables.interventionTargets;

  static override associations = {
    [Tables.interventions]: { type: 'belongs_to' as const, key: 'intervention_id' },
    [Tables.cultivableZones]: { type: 'belongs_to' as const, key: 'cultivable_zone_id' },
  };

  @field('intervention_id') interventionId!: string;
  @field('cultivable_zone_id') cultivableZoneId!: string;
  @field('reference_name') referenceName!: string;

  @immutableRelation(Tables.interventions, 'intervention_id') intervention!: Intervention;
  @immutableRelation(Tables.cultivableZones, 'cultivable_zone_id') cultivableZone!: CultivableZone;
}
