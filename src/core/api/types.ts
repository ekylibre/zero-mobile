// Types partagés du client API Ekylibre v2.

export interface Credentials {
  instanceUrl: string;
  email: string;
  token: string;
}

export interface TokenResponse {
  token: string;
}

// ---- Payloads de création/édition d'intervention (P6) ----

/**
 * Tag « provider » obligatoire au POST /api/v2/interventions (ADR-13).
 * `id` doit être l'UUIDv4 client de l'intervention pour permettre
 * l'idempotence côté serveur.
 */
export interface ProviderTag {
  vendor: 'ekylibre-mobile';
  name: 'zero-mobile';
  id: string;
  data: {
    app_version: string;
    os: 'ios' | 'android' | 'web';
    device_model?: string;
    locale: string;
  };
}

export interface WorkingPeriodAttribute {
  started_at: string;
  stopped_at: string;
}

export interface DoerAttribute {
  product_id: number;
  reference_name: string;
}

export interface InputAttribute {
  product_id: number;
  variant_id?: number;
  reference_name: string;
  quantity_value: number;
  quantity_handler: string;
  quantity_unit?: string;
}

export interface TargetAttribute {
  // Côté Ekylibre v2, les cibles sont aussi modélisées comme des « products »
  // (les cultivable_zones partagent l'espace d'IDs des produits) → on envoie
  // bien `product_id` ici, même si en local on stocke `cultivable_zone_id`.
  product_id: number;
  reference_name: string;
}

export interface ToolAttribute {
  product_id: number;
  reference_name: string;
}

export interface CreateInterventionPayload {
  procedure_name: string;
  description?: string;
  // Liste des actions de la procédure (cf. XML procédure Ekylibre).
  // Pour spraying en v1, on envoie une liste vide — l'API accepte le
  // payload tel quel et déduit l'action depuis `procedure_name`. Si une
  // version ultérieure d'Ekylibre rend ce champ obligatoire, on adaptera
  // au moment où on aura accès aux définitions XML (cf. v1.5).
  actions: string[];
  provider: ProviderTag;
  working_periods_attributes: WorkingPeriodAttribute[];
  doers_attributes: DoerAttribute[];
  inputs_attributes: InputAttribute[];
  targets_attributes: TargetAttribute[];
  tools_attributes: ToolAttribute[];
}

/**
 * PUT /api/v2/interventions/{server_id} : on autorise l'omission du
 * `provider` (l'intervention existe déjà serveur-side, le tag a été posé
 * au POST initial). Tous les autres champs sont en remplacement complet.
 */
export type UpdateInterventionPayload = Omit<CreateInterventionPayload, 'provider'> & {
  provider?: ProviderTag;
};
