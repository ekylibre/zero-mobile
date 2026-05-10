import { Model } from '@nozbe/watermelondb';
import { field, json } from '@nozbe/watermelondb/decorators';

import { Tables } from '../schema';

// Type aligné sur l'inférence Zod (.passthrough() rend les champs déclarés
// optionnels). Si on a besoin de la garantie « coordinates présent » côté
// rendu, on testera explicitement.
interface GeoJsonGeometry {
  type: string;
  coordinates?: unknown;
}

const sanitizeGeometry = (raw: unknown): GeoJsonGeometry | null => {
  if (raw && typeof raw === 'object' && 'type' in raw) {
    return raw as GeoJsonGeometry;
  }
  return null;
};

export class CultivableZone extends Model {
  static override table = Tables.cultivableZones;

  @field('server_id') serverId!: number;
  @field('name') name!: string;
  @json('geometry_geojson', sanitizeGeometry) geometry!: GeoJsonGeometry | null;
  @field('area_hectares') areaHectares!: number | null;
  @field('updated_at_server') updatedAtServer!: number;
}
