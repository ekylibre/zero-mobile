// Filtrage des produits éligibles comme outil d'une procédure, à partir
// du `filter` exposé par l'API procedures (`/api/v2/procedures`).
//
// Forme observée côté Ekylibre (2026-06) :
//   parameters: [
//     {
//       name: 'sprayer', type: 'tool',
//       filter: 'is equipment and can spray',  ← grammaire à parser
//       ...
//     },
//   ]
//
// La grammaire complète est riche (is/can/has, AND/OR, parenthèses, négation).
// Pour v1 on couvre le sous-ensemble effectivement utilisé par la procédure
// spraying : extraction des `can <verbe>` (les `is <type>` sont déjà couverts
// en amont — on n'interroge la liste qu'après filtre `product_type=equipments`).
// Si la grammaire évolue (nouvelle procédure, opérateur exotique), le parser
// peut être étendu sans casser l'existant : un filter non reconnu renvoie []
// → aucun produit n'est filtré et l'empty state strict prévient l'utilisateur.

/**
 * Extrait l'ensemble des abilities requises par un filter de procedure.
 * Recherche les motifs `can <verbe>` (case-insensitive) — la portion `is X` est
 * ignorée car le type est déjà filtré par `product_type`. Renvoie un set de
 * verbes (sans argument entre parenthèses), dédupliqué.
 *
 * @example
 *   parseToolFilterAbilities('is equipment and can spray')
 *     → ['spray']
 *   parseToolFilterAbilities('is equipment and can spread(preparation)')
 *     → ['spread']
 *   parseToolFilterAbilities(null) → []
 */
export function parseToolFilterAbilities(filter: string | null | undefined): string[] {
  if (!filter) return [];
  // `can <verbe>` puis verbe = [a-z_] ; on jette tout argument entre parenthèses
  // (« can spread(preparation) » → verbe `spread`, car les abilities produits
  // sont matchées sur le verbe nu — cf. `productHasAllAbilities`).
  const matches = filter.matchAll(/\bcan\s+([a-z_]+)/gi);
  const verbs = Array.from(matches, (m) => m[1]).filter((v): v is string => Boolean(v));
  return Array.from(new Set(verbs.map((v) => v.toLowerCase())));
}

/**
 * Vérifie qu'un produit possède toutes les abilities requises. La comparaison
 * porte sur le **verbe seul** : `spread(preparation)` matche un required
 * `spread`. Un produit sans ability ne matche rien (sauf required vide).
 *
 * @example
 *   productHasAllAbilities(['spray'], ['spray'])               → true
 *   productHasAllAbilities(['sow','spray','spread(prep)'], ['spray'])  → true
 *   productHasAllAbilities(['sow'], ['spray'])                 → false
 *   productHasAllAbilities([], [])                             → true
 */
export function productHasAllAbilities(
  productAbilities: readonly string[],
  requiredVerbs: readonly string[],
): boolean {
  if (requiredVerbs.length === 0) return true;
  const productVerbs = new Set(productAbilities.map((a) => verbOf(a)));
  return requiredVerbs.every((v) => productVerbs.has(v));
}

function verbOf(ability: string): string {
  const paren = ability.indexOf('(');
  return (paren === -1 ? ability : ability.slice(0, paren)).toLowerCase();
}

/**
 * Récupère le `filter` brut d'un parameter `tool` d'une procédure stockée
 * (forme `Procedure.definition = { parameters: [...] }`). Renvoie `null` si la
 * définition est absente, mal formée, ou si le parameter n'a pas de filter.
 */
export function getToolFilterFromDefinition(
  definition: unknown,
  parameterName: string,
): string | null {
  if (!isRecord(definition)) return null;
  const params = definition.parameters;
  if (!Array.isArray(params)) return null;
  const param = params.find(
    (p): p is Record<string, unknown> => isRecord(p) && p.name === parameterName,
  );
  const filter = param?.filter;
  return typeof filter === 'string' && filter.length > 0 ? filter : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
