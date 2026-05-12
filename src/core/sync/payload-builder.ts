import type {
  Intervention,
  InterventionDoer,
  InterventionInput,
  InterventionTarget,
  InterventionTool,
  InterventionWorkingPeriod,
} from '@core/db/models';
import type {
  CreateInterventionPayload,
  DoerAttribute,
  InputAttribute,
  ProviderTag,
  TargetAttribute,
  ToolAttribute,
  WorkingPeriodAttribute,
} from '@core/api/types';

export interface InterventionWithRelations {
  intervention: Intervention;
  doers: InterventionDoer[];
  inputs: InterventionInput[];
  targets: InterventionTarget[];
  tools: InterventionTool[];
  workingPeriods: InterventionWorkingPeriod[];
}

/**
 * Tables de correspondance locale → serveur. Construites côté sync engine en
 * fetchant les `server_id` depuis la base WDB juste avant le push.
 */
export interface ServerIdLookups {
  /** Map<Product.id (local WDB), Product.server_id>. */
  productById: Map<string, number>;
  /** Map<CultivableZone.id (local WDB), CultivableZone.server_id>. */
  zoneById: Map<string, number>;
  /** Map<Variant.id (local WDB), Variant.server_id>. */
  variantById: Map<string, number>;
}

/**
 * Erreur levée quand une relation référence un local id absent des lookups
 * (typiquement : produit/parcelle supprimé du catalogue serveur après la
 * saisie). Le sync engine traduit ça en `sync_error_message` lisible.
 */
export class MissingServerIdError extends Error {
  constructor(
    public readonly entity: 'product' | 'cultivable_zone' | 'variant',
    public readonly localId: string,
  ) {
    super(`Pas de server_id connu pour ${entity}=${localId}`);
    this.name = 'MissingServerIdError';
  }
}

export function buildCreateInterventionPayload(
  data: InterventionWithRelations,
  lookups: ServerIdLookups,
  provider: ProviderTag,
): CreateInterventionPayload {
  const { intervention, doers, inputs, targets, tools, workingPeriods } = data;

  // Si aucune working_period n'a été persistée (cas hypothétique : on en
  // crée toujours 1 dans le persister P5.1), on synthétise depuis les
  // dates de l'intervention pour ne jamais envoyer un tableau vide à l'API.
  const workingPeriodsAttrs: WorkingPeriodAttribute[] =
    workingPeriods.length > 0
      ? workingPeriods.map((wp) => ({
          started_at: wp.startedAt.toISOString(),
          stopped_at: wp.stoppedAt.toISOString(),
        }))
      : [
          {
            started_at: intervention.startedAt.toISOString(),
            stopped_at: intervention.stoppedAt.toISOString(),
          },
        ];

  const doersAttrs: DoerAttribute[] = doers.map((d) => ({
    product_id: requireProductServerId(lookups, d.productId),
    reference_name: d.referenceName,
  }));

  const inputsAttrs: InputAttribute[] = inputs.map((i) => {
    const attr: InputAttribute = {
      product_id: requireProductServerId(lookups, i.productId),
      reference_name: i.referenceName,
      quantity_value: i.quantityValue,
      quantity_handler: i.quantityHandler,
    };
    if (i.variantId) {
      attr.variant_id = requireVariantServerId(lookups, i.variantId);
    }
    if (i.quantityUnit) {
      attr.quantity_unit = i.quantityUnit;
    }
    return attr;
  });

  // Côté Ekylibre v2, les targets sont émises avec `product_id` (la
  // cultivable_zone partage l'espace d'IDs des produits). Cf. arch §4.
  const targetsAttrs: TargetAttribute[] = targets.map((t) => ({
    product_id: requireZoneServerId(lookups, t.cultivableZoneId),
    reference_name: t.referenceName,
  }));

  const toolsAttrs: ToolAttribute[] = tools.map((to) => ({
    product_id: requireProductServerId(lookups, to.productId),
    reference_name: to.referenceName,
  }));

  const payload: CreateInterventionPayload = {
    procedure_name: intervention.procedureName,
    actions: [],
    provider,
    working_periods_attributes: workingPeriodsAttrs,
    doers_attributes: doersAttrs,
    inputs_attributes: inputsAttrs,
    targets_attributes: targetsAttrs,
    tools_attributes: toolsAttrs,
  };

  if (intervention.description) {
    payload.description = intervention.description;
  }

  return payload;
}

function requireProductServerId(lookups: ServerIdLookups, localId: string): number {
  const id = lookups.productById.get(localId);
  if (id === undefined) throw new MissingServerIdError('product', localId);
  return id;
}

function requireZoneServerId(lookups: ServerIdLookups, localId: string): number {
  const id = lookups.zoneById.get(localId);
  if (id === undefined) throw new MissingServerIdError('cultivable_zone', localId);
  return id;
}

function requireVariantServerId(lookups: ServerIdLookups, localId: string): number {
  const id = lookups.variantById.get(localId);
  if (id === undefined) throw new MissingServerIdError('variant', localId);
  return id;
}
