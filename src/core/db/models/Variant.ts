import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

import { Tables } from '../schema';

export class Variant extends Model {
  static override table = Tables.variants;

  @field('server_id') serverId!: number;
  @field('name') name!: string;
  @field('category') category!: string;
  @field('unit') unit!: string | null;
  @field('updated_at_server') updatedAtServer!: number;
}
