# Workflow — Cibles « cultures » (Plant) + Édition d'intervention

> **Type :** plan d'implémentation (aucun code écrit par ce document).
> **Demande :** (1) pouvoir choisir des **cultures** (`products?product_type=plants`)
> comme cibles d'intervention, en plus des **parcelles** (`land_parcels`) ;
> (2) ajouter la **modification** d'une intervention.
> **Phase repo :** post-refonte UI (branche `feat/intervention-ui-redesign`), fin P6.
> **Prochaine étape :** `/sc:implement` phase par phase.

---

## 0. Constats (vérifiés dans le code)

### Côté serveur Ekylibre (`~/projects/ekylibre`)
- `GET /api/v2/products?product_type=<t>` (`products_controller.rb`) gère
  `land_parcels`, **`plants`**, `workers`, `equipments`, `matters`. ⚠️ Le param
  est **`plants`** (pluriel), pas `Plant`.
- `LandParcel` **et** `Plant` sont des `Product`, **sérialisés à l'identique**
  (`id`, `name`, `net_surface_area`, `shape`, `dead_at`, `born_at`).
- Les cibles d'intervention sont envoyées en `targets_attributes:
  [{ reference_name, product_id }]` — **`product_id` générique** (l'id serveur
  d'un Product, parcelle OU culture). `save!` invalide → 403 `{ errors }`
  (cf. correctif client récent).

### Côté mobile (`zero-mobile`)
- **Table `cultivable_zones`** (WDB) alimentée uniquement par
  `client.listCultivableZones()` → `/products?product_type=land_parcels`.
  Colonnes : `server_id, name, area_hectares, shape_svg, dead_at,
updated_at_server`. **Pas de discriminant de type.**
- **`intervention_targets`** : `intervention_id, cultivable_zone_id,
reference_name`. Une cible = un pointeur vers une ligne `cultivable_zones`.
- **payload-builder** : `targets_attributes` résout `cultivableZoneId →
product_id` via `lookups.zoneById` (server_id de la ligne). **Donc la couche
  payload est déjà « product_id générique » — elle se moque que ce soit une
  parcelle ou une culture.**
- **Zod** (`spraying.ts`) : `targetSchema = { cultivable_zone_id,
reference_name: literal('cultivation') }`, `targets: array.min(1)`.
- **Picker** : `MultiSelectField` sur `useCultivableZones()` (filtre `dead_at`).
- **Persistence** : `persistSprayingIntervention` (création seule, génère
  `client_uuid`), `deleteIntervention`. **Pas d'update.**
- **Push** : `runPushCyclePure` fait déjà **PUT** si `server_id != null`
  (`api.updateIntervention`), sinon POST. L'édition est donc déjà supportée
  côté transport — il manque la couche écriture locale + UI.
- **Schéma WDB = v2** (cf. CLAUDE.md) — toute modif de schéma ⇒ bump `version`
  + entrée `migrations.ts`.

---

## 1. Feature A — Cultures (Plant) comme cibles

### Décision d'architecture (✅ TRANCHÉE §6.1 = unifié)
**Catalogue de cibles unifié.** Comme parcelles et cultures sont des Products
sérialisés à l'identique et que le payload résout déjà un `product_id`
générique, on **ingère les deux dans la même table locale** plutôt que d'ajouter
une table « plants » séparée et un 2ᵉ chemin de résolution.

- **Option retenue (recommandée) : étendre `cultivable_zones`** avec une colonne
  discriminante `kind` (`'land_parcel' | 'plant'`). La table devient « les
  cibles cultivables » (parcelles + cultures). Impact minimal :
  `intervention_targets` et payload-builder **inchangés** (toujours
  `cultivable_zone_id` → `product_id`).
- Alternative (rejetée) : rendre `intervention_targets` polymorphe
  (`target_kind` + `product_id`/`zone_id`) → touche schéma cible, persister,
  payload-builder, détail. Plus invasif pour zéro gain (le serveur veut juste un
  `product_id`).

> ⚠️ Nuance nommage : la table garde le nom `cultivable_zones` (éviter une
> migration de renommage coûteuse) mais représente désormais « targetables ».
> Documenter ce choix dans `architecture.md` (cf. Phase A4).

### A1 — Couche API/DTO
- `client.ts` : ajouter `listPlants()` → `/api/v2/products?product_type=plants`,
  parse via le **`cultivableZoneListSchema` existant** (même forme).
  Garder `listCultivableZones()` pour les parcelles. (Ou un seul
  `listTargetables(type)` paramétré — au choix, cf. style du client.)
- Aucun nouveau DTO (réutilise `cultivableZoneDtoSchema`).

### A2 — Schéma WDB + migration (bump v2 → v3)
- `schema.ts` : ajouter `{ name: 'kind', type: 'string', isIndexed: true }` à
  `cultivable_zones` ; bump `version` à **3**.
- `migrations.ts` : `{ toVersion: 3, steps: [ addColumns({ table:
'cultivable_zones', columns: [{ name: 'kind', type: 'string', isIndexed: true
}] }) ] }`.
- `CultivableZone` model : ajouter `@field('kind') kind`. Défaut
  `'land_parcel'` pour les lignes existantes (les rows migrées n'ont pas de
  kind → traiter `null` comme `'land_parcel'` dans le code de lecture).
- **Rebuild EAS** requis (nouveau champ natif via migration ? non — migration
  WDB est JS ; pas de rebuild natif. Mais re-sync catalogue nécessaire).

### A3 — Ingestion catalogue
- `persisters.ts` : `persistCultivableZones` accepte un `kind` et le stocke ;
  appeler une fois pour `land_parcels` (kind='land_parcel') et une fois pour
  `plants` (kind='plant'). **Garder l'invariant** « 1 `database.write` + 1
  `database.batch` par table » ; attention au **delete-extras** : si on persiste
  les deux types dans la même table, le delete-extras doit se faire **par kind**
  (sinon persister land_parcels supprime les plants et vice-versa).
- `initial-sync.ts` : le step `cultivable_zones` télécharge et persiste **les
  deux** types (parcelles puis cultures). `SYNC_STEPS` inchangé (un seul step
  « cibles »), ou ajouter un sous-compteur.

### A4 — Picker UI (cibles groupées par type)
- `useCultivableZones()` (hook) renvoie déjà toutes les cibles ; ajouter le
  champ `kind`. Garder le filtre `dead_at`.
- `MultiSelectField` dans `SprayingFormView` : afficher un **sous-titre/segment
  par type** (« Parcelles » / « Cultures »), ou un groupage visuel. Le sous-titre
  d'item peut indiquer la surface (parcelles) ou la variété (cultures).
- `ProcedureIcon`/`ParcelShape` : une culture peut ne pas avoir de `shape_svg`
  → `ParcelShape` dégrade déjà (carré vide). OK.

### A5 — Domaine Zod
- ✅ **CONFIRMÉ (§6.2).** `spraying.xml` :
  `<target name="cultivation" filter="(is plant or is land_parcel) and has
indicator shape">`. Donc une cible spraying = un Product **plant OU
  land_parcel**, portant `reference_name: 'cultivation'`.
- `targetSchema` **inchangé** : `{ cultivable_zone_id, reference_name:
literal('cultivation') }` pour les deux types. **Aucun changement Zod ni
  payload-builder.**
- ⚠️ **Garde-fou « has indicator shape »** : le filtre serveur exige que la
  cible ait un indicateur `shape`. Un plant/land_parcel **sans shape** sera
  rejeté au push (403). Mitigation : à l'ingestion, **ne lister comme cible que
  les Products ayant une shape** (le DTO porte `shape`/`shape_svg`/
  `shape_to_geojson`), OU laisser passer et compter sur le message d'erreur 403
  (déjà affiché). → Décision §6.6 (recommandé : filtrer à l'ingestion si le
  champ est fiable, sinon s'appuyer sur le 403).

### A6 — Tests
- `client.test` : `listPlants` parse une réponse `plants`.
- `persisters.test` : persistance + delete-extras **par kind** (un type ne
  supprime pas l'autre).
- `migrations` : la migration v3 ajoute `kind`.
- `SprayingFormView.test` : sélection d'une cible « culture » → payload
  `targets` correct.
- payload-builder : déjà couvert (product_id générique), ajouter un cas culture.

**Checkpoint A :** picker affiche parcelles **et** cultures ; sélection mixte
possible ; save → push envoie les bons `product_id` ; tests verts ; re-sync
device peuple les cultures.

---

## 2. Feature B — Modification d'une intervention

### Règles métier
- ✅ **TRANCHÉ (§6.3) : édition INTERDITE si `synced`.** « Modifier » n'est
  visible/possible que sur **`pending` ou `error`** (jamais poussée OU rejetée).
  Une intervention `synced` existe côté Ekylibre → pas d'édition locale en v1.
  ⇒ **toute édition produit donc toujours un POST** (jamais de PUT) ; le chemin
  PUT du push reste là pour le futur mais n'est pas déclenché par cette feature.
- **`client_uuid` jamais régénéré** (ADR-13). `server_id` reste `null` (l'édité
  n'a jamais été poussé avec succès).
- À l'édition, `sync_state → 'pending'`, `sync_error_message → null`,
  `sync_attempt_count → 0`.

### B1 — Persister : `updateSprayingIntervention(database, id, input)`
- 1 `database.write` :
  1. `intervention.update(...)` : champs (dates, durées, description) +
     `syncState='pending'`, `syncErrorMessage=null`. **Ne touche pas**
     `clientUuid` ni `serverId`.
  2. **Remplace les relations** (doers/inputs/targets/tools/workingPeriods) :
     stratégie **delete-all + recreate** (plus simple et sûr que le diff), dans
     le **même batch** (réutiliser la logique de `deleteIntervention` pour les
     enfants, sans détruire l'intervention).
- Réutilise les helpers de création de relations de
  `persistSprayingIntervention` (factoriser une fonction interne
  `buildRelationWrites(intervention, input)` partagée create/update).

### B2 — Formulaire : mode édition
- `SprayingFormView` : ajouter une prop `initialValues?: SprayingIntervention`
  (et `submitLabel`/`mode`). `defaultValues` = `initialValues ?? <création>`.
  RHF `reset(initialValues)` si fourni. **Conserver** la forme `[{...}]` des
  tableaux et le `Controller`.
- Pré-remplissage : convertir les relations WDB (ids locaux) → forme du form.
  Réutiliser les hooks de résolution (`useInterventionById`).

### B3 — Routing
- Option simple : route `app/(tabs)/interventions/spraying.tsx` accepte un param
  optionnel `id`. Si présent → charge l'intervention + relations, passe
  `initialValues`, appelle `updateSprayingIntervention` au submit ; sinon →
  création (comportement actuel).
- Le titre de l'écran s'adapte (« Modifier » vs « Pulvérisation »).

### B4 — Entrées « Modifier »
- **Liste** (`InterventionListItem`) : action **Modifier** à côté de Supprimer,
  visible **uniquement si `pending`|`error`** (même condition que Supprimer,
  via le `isModifiable` existant). Jamais sur `synced`.
- **Détail** (`[id].tsx`) : bouton **Modifier** affiché sous la même condition
  (i18n `common.edit`).
- Navigation → `spraying?id=<id>`.

### B5 — i18n
- Clés : `interventions.edit.title`, action « Modifier » (réutiliser
  `common.edit`), `interventions.edit.saved`. **Pas** de message « synced »
  (édition interdite dans ce cas — §6.3).

### B6 — Tests
- `persister.test` : `updateSprayingIntervention` met à jour + remplace
  relations + conserve `client_uuid`/`server_id` + repasse `pending`.
- `SprayingFormView.test` : rend les `initialValues`, submit appelle le bon
  handler.
- Route `spraying` (si testée) : branche id présent → update.
- push-engine : déjà couvert (PUT si server_id). Ajouter un cas « édition d'une
  synced → PUT ».

**Checkpoint B :** depuis liste/détail, « Modifier » ouvre le form pré-rempli ;
save met à jour en local (`pending`) ; push renvoie (POST idempotent si jamais
poussée, PUT si `server_id`) ; `client_uuid` inchangé ; tests verts ; smoke
device.

---

## 3. Graphe de dépendances

```
A2 (schéma+migration v3) ─► A3 (ingestion) ─► A4 (picker) ─► A6 (tests A)
A1 (API plants) ──────────►
                                A5 (Zod, quasi no-op)
B1 (persister update) ─► B2 (form édition) ─► B3 (route) ─► B4 (entrées) ─► B6
```
A et B sont **indépendants** → parallélisables. A2 (migration) est le seul point
« bloquant rebuild/re-sync » — le faire tôt.

---

## 4. Fichiers impactés (estimation)

**Feature A :** `src/core/api/client.ts`, `src/core/db/schema.ts`,
`src/core/db/migrations.ts`, `src/core/db/models/CultivableZone.ts`,
`src/features/catalog/persisters.ts`, `src/features/catalog/initial-sync.ts`,
`src/features/catalog/hooks.ts`, `src/features/intervention/SprayingFormView.tsx`
(+ tests). `payload-builder.ts` / `intervention_targets` / `spraying.ts` :
**inchangés** (sauf confirmation reference_name §6.2).

**Feature B :** `src/features/intervention/persister.ts`,
`src/features/intervention/SprayingFormView.tsx`,
`app/(tabs)/interventions/spraying.tsx`, `src/ui/InterventionListItem.tsx`,
`app/(tabs)/interventions/[id].tsx`, `app/(tabs)/interventions/index.tsx`
(wiring), `locales/fr/common.json` (+ tests).

---

## 5. Mise à jour documentation (Phase finale — à exécuter en implémentation)

> Le présent fichier est le **plan**. Les docs ci-dessous seront mises à jour
> *pendant* `/sc:implement`, pas par ce workflow.

- `CLAUDE.md` §« DB & catalogue » : `cultivable_zones` contient désormais
  parcelles **et** cultures (`kind`), alimentées par `land_parcels` + `plants` ;
  schéma **v3** (migration `kind`).
- `CLAUDE.md` §« Où le travail s'arrête » : ajouter « Modifier » comme **fait**.
- `docs/architecture.md` : cibles = Products génériques (parcelle|culture),
  payload `product_id` ; flux d'édition (PUT si server_id).
- `docs/workflow.md` : nouvelle entrée de phase (P-v1.x : cibles cultures +
  édition).
- `CHANGELOG.md` (si présent).

---

## 6. Décisions (tranchées 2026-05-31)

1. ✅ **Stockage cibles = UNIFIÉ.** `cultivable_zones` + colonne `kind`
   (`land_parcel|plant`). Pas de table séparée. `intervention_targets` +
   payload-builder inchangés.
2. ✅ **`reference_name` = `'cultivation'`** pour les deux types. Confirmé par
   `spraying.xml` : `<target name="cultivation" filter="(is plant or is
land_parcel) and has indicator shape">`. → Zod/payload inchangés. **Corollaire
   §6.6** : la cible doit « has indicator shape ».
3. ✅ **Édition INTERDITE si `synced`.** « Modifier » seulement sur
   `pending`/`error`. Conséquence : pas de PUT déclenché (toujours POST,
   `server_id` reste null).
4. **`listPlants` vs `listTargetables(type)`** (cosmétique, non bloquant) →
   choix au moment de l'implémentation (préférence : `listTargetables(type)`
   paramétré pour éviter la duplication).
5. **Filtre `dead_at` cultures** = même fenêtre 1 an que les parcelles
   (cohérent, non bloquant).
6. ⚠️ **NOUVEAU — « has indicator shape » (issu de §6.2).** Une cible doit
   posséder un indicateur `shape`. À décider à l'implémentation : filtrer les
   Products sans shape **à l'ingestion** (si le champ est fiable depuis
   `products?product_type=plants`) ou s'appuyer sur le message 403 déjà affiché.
   Recommandé : filtrer à l'ingestion si possible, fallback 403 sinon.

---

## 7. Quality gates par phase

- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`.
- `pnpm test` (unitaires) ; `pnpm test:ci` en clôture.
- **Migration** : tester montée v2→v3 (pas de perte de données).
- **Non-régression sync** : ne pas toucher `client_uuid`, ADR-13 ; payload
  cibles inchangé ; push create/PUT identique.
- **Device** : re-sync catalogue (cultures apparaissent) ; saisie cible mixte →
  sync `synced` ; édition → re-sync `synced` ; `client_uuid` constant.

---

## 8. Risques & mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| delete-extras supprime l'autre type lors de la persistance | catalogue cible incomplet | delete-extras **par `kind`** ; test dédié |
| Migration v3 mal formée | crash au boot / perte data | entrée `migrations.ts` testée ; défaut `kind` pour rows existantes |
| ~~`reference_name` culture ≠ 'cultivation'~~ | ✅ levé | confirmé `'cultivation'` pour plant+land_parcel (§6.2) |
| **Cible sans `shape` rejetée (filter « has indicator shape »)** | 403 au push | filtrer à l'ingestion (§6.6) ou s'appuyer sur le 403 affiché |
| Update : diff partiel des relations | incohérence enfants | stratégie **delete-all + recreate** (pas de diff) |
| Édition régénère `client_uuid` | doublon serveur | update **ne touche jamais** `clientUuid`/`serverId` ; test |
| Form édition casse la forme RHF | save échoue | `reset(initialValues)`, forme `[{...}]` conservée, tests avant/après |

---

## 9. Prochaine étape

✅ Décisions bloquantes §6.1/§6.2/§6.3 **tranchées** (unifié / 'cultivation' /
édition interdite si synced). Reste 1 point non bloquant à régler à
l'implémentation : §6.6 (« has indicator shape »).

`/sc:implement` — commencer par **A2** (schéma+migration v3, débloque re-sync) et
**B1** (persister update) en parallèle.
