// Handlers de quantité pour l'input `plant_medicine` de la procédure spraying.
//
// Source de vérité au runtime : la définition de procédure renvoyée par
// GET /api/v2/procedures, où chaque handler est un objet
// `{ name, indicator?, unit? }` (enrichissement API Ekylibre, 2026-05). L'app
// lit cette définition depuis la base locale (Procedure.definition) et
// construit le sélecteur handler → unité.
//
// `SPRAYING_HANDLER_UNITS` est un miroir de config/procedures/spraying.xml,
// utilisé comme :
//   - fallback (D3) si l'API renvoie encore l'ancienne forme (tableau de
//     strings) ou omet l'unité (catalogue synchronisé avant l'enrichissement) ;
//   - base de validation du couple (handler, unit) côté schéma Zod.

export interface SprayingHandlerOption {
  /** Nom du handler, envoyé tel quel comme `quantity_handler`. */
  name: string;
  /** Unité Ekylibre canonique, envoyée comme `quantity_unit`. */
  unit: string;
  /** Clé i18n du libellé affiché dans le sélecteur. */
  labelKey: string;
}

// Miroir de spraying.xml (<input name="plant_medicine">). `population` n'a pas
// d'unité dans l'XML : Ekylibre attend `unity`.
export const SPRAYING_HANDLER_UNITS: Readonly<Record<string, string>> = {
  population: 'unity',
  net_mass: 'kilogram',
  net_volume: 'liter',
  mass_area_density: 'kilogram_per_hectare',
  volume_area_density: 'liter_per_hectare',
  specific_weight: 'kilogram_per_hectoliter',
  volume_density: 'liter_per_hectoliter',
};

// Pré-remplissage du handler à partir de l'unité de base de la variante du
// produit. La pulvérisation est toujours exprimée à l'hectare, donc on
// sélectionne systématiquement le handler `*_area_density` correspondant.
const SURFACE_HANDLER_BY_BASE_UNIT: Readonly<Record<string, string>> = {
  liter: 'volume_area_density',
  kilogram: 'mass_area_density',
  unity: 'population',
};

const FALLBACK_HANDLER_NAMES = Object.keys(SPRAYING_HANDLER_UNITS);

const labelKeyFor = (name: string): string => `interventions.spraying.handlers.${name}`;

/** Unité canonique d'un handler connu (sinon `undefined`). */
export function unitForHandler(name: string): string | undefined {
  return SPRAYING_HANDLER_UNITS[name];
}

/**
 * Déduit le handler à pré-remplir à partir de l'unité de base de la variante
 * d'un produit phyto (ex. `liter` → `volume_area_density`). Retourne le handler
 * correspondant trouvé dans `handlers` (donc avec la bonne unité Ekylibre), ou
 * `null` si l'unité n'est pas mappée ou si le handler n'est pas dans la liste.
 */
export function deriveHandlerFromBaseUnit(
  baseUnit: string | null | undefined,
  handlers: SprayingHandlerOption[],
): SprayingHandlerOption | null {
  if (!baseUnit) return null;
  const handlerName = SURFACE_HANDLER_BY_BASE_UNIT[baseUnit];
  if (!handlerName) return null;
  return handlers.find((h) => h.name === handlerName) ?? null;
}

function toOption(name: string, unit?: string | null): SprayingHandlerOption {
  return {
    name,
    unit: unit && unit.length > 0 ? unit : (SPRAYING_HANDLER_UNITS[name] ?? ''),
    labelKey: labelKeyFor(name),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function extractParameters(definition: unknown): unknown[] {
  if (!isRecord(definition)) return [];
  const params = definition.parameters;
  return Array.isArray(params) ? params : [];
}

/**
 * Extrait les handlers de l'input `plant_medicine` d'une définition de
 * procédure (forme `{ parameters: [...] }`). Accepte les deux formes de
 * handler : string (ancienne API) ou objet `{ name, indicator?, unit? }` (API
 * enrichie). Retombe sur la liste canonique complète si la définition est
 * absente ou inexploitable (D3).
 */
export function parseSprayingHandlers(definition: unknown): SprayingHandlerOption[] {
  const input = extractParameters(definition).find(
    (p): p is Record<string, unknown> => isRecord(p) && p.name === 'plant_medicine',
  );
  const rawHandlers = input?.handlers;

  if (Array.isArray(rawHandlers) && rawHandlers.length > 0) {
    const options = rawHandlers
      .map((h): SprayingHandlerOption | null => {
        if (typeof h === 'string') return toOption(h);
        if (isRecord(h) && typeof h.name === 'string') {
          return toOption(h.name, typeof h.unit === 'string' ? h.unit : undefined);
        }
        return null;
      })
      .filter((o): o is SprayingHandlerOption => o !== null);
    if (options.length > 0) return options;
  }

  return FALLBACK_HANDLER_NAMES.map((name) => toOption(name));
}
