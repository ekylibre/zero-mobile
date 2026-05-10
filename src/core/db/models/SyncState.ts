import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

import { Tables } from '../schema';

export type LastPullStatus = 'idle' | 'in_progress' | 'ok' | 'error';
export type CatalogStep = 'procedures' | 'products' | 'cultivable_zones' | 'variants' | 'done';

export class SyncState extends Model {
  static override table = Tables.syncState;

  @field('last_pulled_at') lastPulledAt!: number | null;
  @field('last_pull_status') lastPullStatus!: LastPullStatus;
  @field('last_pull_error') lastPullError!: string | null;
  @field('current_step') currentStep!: CatalogStep | null;
}
