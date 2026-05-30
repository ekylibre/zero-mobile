import {
  cultivableZoneListSchema,
  interventionListSchema,
  interventionWriteResultSchema,
  procedureListSchema,
  productListSchema,
  variantListSchema,
  type ApiProductType,
  type CultivableZoneDto,
  type InterventionDto,
  type InterventionWriteResult,
  type ProcedureDto,
  type ProductDto,
  type VariantDto,
} from './dtos';
import { ApiError, AuthError, NetworkError, ValidationError } from './errors';
import type {
  CreateInterventionPayload,
  Credentials,
  TokenResponse,
  UpdateInterventionPayload,
} from './types';

type FetchImpl = typeof fetch;
type UnauthorizedHandler = () => void;

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function authHeader({ email, token }: Pick<Credentials, 'email' | 'token'>): string {
  return `simple-token ${email} ${token}`;
}

export class EkylibreApiClient {
  private credentials: Credentials | null = null;
  private onUnauthorized: UnauthorizedHandler | null = null;
  private readonly fetchImpl: FetchImpl;

  constructor(fetchImpl: FetchImpl = globalThis.fetch.bind(globalThis)) {
    this.fetchImpl = fetchImpl;
  }

  setCredentials(credentials: Credentials | null): void {
    this.credentials = credentials;
  }

  getCredentials(): Credentials | null {
    return this.credentials;
  }

  setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
    this.onUnauthorized = handler;
  }

  /**
   * Authentifie via POST /api/v2/tokens.
   * Endpoint non-authentifié : ne dépend pas des credentials stockées.
   */
  async login(instanceUrl: string, email: string, password: string): Promise<TokenResponse> {
    const url = `${normalizeBaseUrl(instanceUrl)}/api/v2/tokens`;
    const response = await this.safeFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (response.status === 401 || response.status === 403) {
      throw new AuthError('Identifiants invalides');
    }
    if (!response.ok) {
      throw new ApiError(
        response.status,
        `Erreur serveur (${response.status})`,
        await safeText(response),
      );
    }

    const data = (await response.json()) as TokenResponse;
    if (typeof data?.token !== 'string' || data.token.length === 0) {
      throw new ApiError(response.status, 'Réponse serveur invalide (token manquant)');
    }
    return data;
  }

  /**
   * Révoque la session courante via DELETE /api/v2/tokens/{token}.
   * Best-effort : une erreur réseau ou serveur n'empêche pas la déconnexion locale.
   */
  async logout(): Promise<void> {
    if (!this.credentials) return;
    const { instanceUrl, email, token } = this.credentials;
    try {
      await this.safeFetch(`${normalizeBaseUrl(instanceUrl)}/api/v2/tokens/${token}`, {
        method: 'DELETE',
        headers: { Authorization: authHeader({ email, token }) },
      });
    } catch {
      // pas de remontée : la purge locale prime sur l'aller-retour serveur.
    }
  }

  /**
   * Requête authentifiée vers l'API. Utilisée par les couches catalogue/sync (P3+).
   * Gère le 401 en notifiant l'AuthContext via onUnauthorized.
   */
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.credentials) {
      throw new AuthError('Aucune session active');
    }
    const { instanceUrl, email, token } = this.credentials;
    const url = `${normalizeBaseUrl(instanceUrl)}${path.startsWith('/') ? path : `/${path}`}`;

    const headers = new Headers(init.headers);
    headers.set('Authorization', authHeader({ email, token }));
    headers.set('Accept', 'application/json');
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await this.safeFetch(url, { ...init, headers });

    if (response.status === 401) {
      this.onUnauthorized?.();
      throw new AuthError('Session expirée');
    }
    if (!response.ok) {
      throw new ApiError(
        response.status,
        `Erreur serveur (${response.status})`,
        await safeText(response),
      );
    }
    return (await response.json()) as T;
  }

  private async safeFetch(url: string, init: RequestInit): Promise<Response> {
    try {
      return await this.fetchImpl(url, init);
    } catch (e) {
      throw new NetworkError(e instanceof Error ? e.message : 'Erreur réseau');
    }
  }

  // ---- Endpoints catalogue (P3) ----

  async listProcedures(): Promise<ProcedureDto[]> {
    const raw = await this.request<unknown>('/api/v2/procedures');
    return procedureListSchema.parse(raw);
  }

  async listProducts(productType: ApiProductType): Promise<ProductDto[]> {
    const raw = await this.request<unknown>(
      `/api/v2/products?product_type=${encodeURIComponent(productType)}`,
    );
    return productListSchema.parse(raw);
  }

  // Cibles `cultivation` = produits `land_parcels` (nom complet de production
  // + `dead_at` + surface), et non l'endpoint `cultivable_zones` (qui ne donne
  // que le nom de zone, sans fin de culture). Cf. ADR cibles / picker.
  async listCultivableZones(): Promise<CultivableZoneDto[]> {
    const raw = await this.request<unknown>('/api/v2/products?product_type=land_parcels');
    return cultivableZoneListSchema.parse(raw);
  }

  async listVariants(): Promise<VariantDto[]> {
    const raw = await this.request<unknown>('/api/v2/variants');
    return variantListSchema.parse(raw);
  }

  async listInterventions(
    opts: { modifiedSince?: Date; userEmail?: string } = {},
  ): Promise<InterventionDto[]> {
    const params = new URLSearchParams();
    if (opts.modifiedSince) {
      params.set('modified_since', opts.modifiedSince.toISOString());
    }
    if (opts.userEmail) {
      params.set('user_email', opts.userEmail);
    }
    const query = params.toString();
    const path = query ? `/api/v2/interventions?${query}` : '/api/v2/interventions';
    const raw = await this.request<unknown>(path);
    return interventionListSchema.parse(raw);
  }

  // ---- Endpoints intervention write (P6) ----

  /**
   * POST /api/v2/interventions. Le `provider.id` (UUIDv4 client) doit être
   * présent dans le payload pour permettre l'idempotence (ADR-13).
   * 422/412 → ValidationError avec `errors` (parsés du body) pour stockage
   * dans `intervention.sync_error_message`.
   */
  async createIntervention(payload: CreateInterventionPayload): Promise<InterventionWriteResult> {
    const raw = await this.requestWithValidation('/api/v2/interventions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    // POST renvoie uniquement `{ id }` (idem 200 idempotent) — on ne valide
    // donc PAS contre le DTO de lecture complet (cf. interventionWriteResultSchema).
    return interventionWriteResultSchema.parse(raw);
  }

  /**
   * PUT /api/v2/interventions/{server_id}. Utilisé pour les éditions
   * d'interventions déjà connues serveur-side. Le `provider` peut être
   * omis (il a été posé au POST initial).
   */
  async updateIntervention(
    serverId: number,
    payload: UpdateInterventionPayload,
  ): Promise<InterventionWriteResult> {
    const raw = await this.requestWithValidation(`/api/v2/interventions/${serverId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return interventionWriteResultSchema.parse(raw);
  }

  /**
   * Wrapper autour de `request<T>` qui transforme les 400/412/422 en
   * ValidationError dédiée. Garde tout le reste du flux (401, 5xx, réseau)
   * inchangé.
   *
   * Le 400 est inclus car Ekylibre v2 l'utilise pour des rejets définitifs
   * du payload (ex. moteur de procédure Procedo : `Dont known how to manage
   * node: ActorPresenceTest`). Le classer en ValidationError garantit que le
   * push-engine le traite comme une erreur **définitive** (pas de retry en
   * boucle, cf. push-engine) et remonte le message serveur à l'écran détail.
   */
  private async requestWithValidation(path: string, init: RequestInit): Promise<unknown> {
    try {
      return await this.request<unknown>(path, init);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 400 || e.status === 422 || e.status === 412)) {
        throw new ValidationError(e.status, e.message, extractErrors(e.body), e.body);
      }
      throw e;
    }
  }
}

function extractErrors(body: string | undefined): string[] {
  if (!body) return [];
  try {
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== 'object') return [];
    const errors = (parsed as { errors?: unknown }).errors;
    if (Array.isArray(errors)) {
      return errors.filter((x): x is string => typeof x === 'string');
    }
    if (errors && typeof errors === 'object') {
      return Object.values(errors as Record<string, unknown>)
        .flat()
        .filter((x): x is string => typeof x === 'string');
    }
  } catch {
    // body pas JSON → on retombe sur la chaîne brute (déjà dans ApiError.body).
  }
  return [];
}

async function safeText(response: Response): Promise<string | undefined> {
  try {
    return await response.text();
  } catch {
    return undefined;
  }
}

// Singleton de l'app. Les tests instancient leur propre client avec un fetch mocké.
export const apiClient = new EkylibreApiClient();
