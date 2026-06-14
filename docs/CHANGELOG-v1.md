# Changelog v1

Entrées par phase du workflow (`docs/workflow.md`). Format inspiré de
[Keep a Changelog](https://keepachangelog.com/) — entrées humaines,
non-générées.

## [Unreleased]

### Filtrage des équipements par procedure (sprayer = `can spray`) — 2026-06-14

Résout le 2ᵉ follow-up identifié au smoke 2026-06-14 (initialement renvoyé en
v1.5+ puis ramené dans la même session). Le sélecteur Pulvérisateur n'affiche
plus que les équipements compatibles avec le `filter` de la procédure spraying.

- **Source de vérité serveur** : `/api/v2/procedures` expose déjà
  `parameters[].filter` (string brute, ex. `"is equipment and can spray"`) et
  `/api/v2/products` expose `abilities` (array de strings,
  ex. `["spray","spread(preparation)"]`, format `verbe` ou `verbe(noun)`).
  Aucune modif côté Ekylibre nécessaire — les deux champs sont déjà là.
- **Schema WDB v4** : ajout `products.abilities_json` (JSON array sérialisé,
  optional), migration JS-only (pas de rebuild EAS). ⚠️ **Re-sync catalogue
  requise** après pull pour peupler la nouvelle colonne (sinon la liste
  d'équipements filtrée sera vide → empty state strict s'affiche).
- **Stack app** : `productDtoSchema.abilities`, `ProductRow.abilities`,
  `Product.abilities` (modèle WDB via `@json` + sanitizer), persister étendu.
- **Parser de filter** : nouveau `src/domain/procedures/tool-filter.ts` —
  `parseToolFilterAbilities(filter)` extrait les `can <verbe>` (case-insensitive,
  ignore les arguments entre parenthèses), `productHasAllAbilities(abilities,
required)` match sur le verbe seul (intersection). `getToolFilterFromDefinition
(def, paramName)` extrait le filter brut depuis la `Procedure.definition` WDB.
  Sous-ensemble de la grammaire Ekylibre (is/can/and/or, parenthèses) suffisant
  pour spraying v1 ; un filter non reconnu renvoie `[]` → fallback non filtré.
- **Branchement route** : `app/(tabs)/interventions/spraying.tsx` calcule
  `sprayerEquipments` via `useMemo` puis le passe à `SprayingFormView` à la
  place de la liste `equipments` brute. Si le filter est absent ou inconnu, on
  passe la liste complète (sécurité : ne jamais bloquer l'utilisateur sur un
  parsing à enrichir plus tard).
- **Empty state strict** : si aucun équipement ne matche, le SelectField
  affiche la clé existante `selects.toolEmpty` (« Aucun pulvérisateur dans le
  catalogue. ») — l'agri sait qu'il doit configurer son matériel côté Ekylibre.
- **Tests** : +18 (`parseToolFilterAbilities`, `productHasAllAbilities`,
  `getToolFilterFromDefinition`) + ajustement du test mapper Product
  (`abilities` propagée). Suite verte 307/307, typecheck + lint OK.
  **Pas de rebuild EAS** (JS pur). **Re-sync catalogue requise sur device**
  pour récupérer les abilities.

### Polish UX form spraying — pré-remplissage handler + libellé FR de l'unité — 2026-06-14

Suite du smoke device 2026-06-14 — résout le 1er des 2 follow-ups identifiés
(le 2ᵉ, filtrage des équipements par procedure, a aussi été livré dans la
foulée — voir entrée Unreleased au-dessus).

- **Pré-remplissage du handler depuis l'unité par défaut du produit** :
  au choix d'un intrant phyto, le handler `*_area_density` correspondant à
  l'unité de la variante du produit est pré-sélectionné automatiquement
  (`liter` → `volume_area_density`, `kilogram` → `mass_area_density`,
  `unity` → `population`). Override systématique au changement de produit
  — un handler choisi manuellement précédemment est réécrit (spec UX :
  l'agri attend que le handler reflète le produit courant). Helper
  `deriveHandlerFromBaseUnit(baseUnit, handlers)` dans
  `spraying-handlers.ts`. Mapping construit côté route
  (`app/(tabs)/interventions/spraying.tsx`) à partir de `Product.variantId`
  - `Variant.unit`, passé via prop `productDefaultUnits` jusqu'à
    `InputsFieldArray`.
- **Affichage FR de l'unité** : `liter_per_hectare` → `l/ha`,
  `kilogram_per_hectoliter` → `kg/hl`, etc. Les libellés vivent dans
  `locales/fr/common.json` sous `interventions.spraying.units.*`. La
  **valeur stockée** dans `quantity_unit` (et envoyée au serveur) **reste
  l'unité Ekylibre canonique** brute — c'est uniquement l'affichage
  read-only sous le sélecteur de Mesure qui change. Fallback sur la
  valeur brute si la clé i18n manque (pas de crash).
- **Tests** : +10 (5 sur `deriveHandlerFromBaseUnit`, 5 sur
  `InputsFieldArray` couvrant l'affichage FR, le pré-remplissage,
  l'override au changement de produit, le no-op sans mapping). Suite
  verte 289/289, typecheck + lint OK. **Pas de rebuild EAS requis**
  (changements 100 % JS/TS, Metro reload suffit).

### Smoke device complet sur build pilote — 2026-06-14

Tous les scénarios `docs/testing-guide.md` §1–§4 repassés sur device après le
rebuild EAS pilote (post-icônes, post-MapLibre, post-PR Ekylibre `shape_geojson`,
post-re-sync catalogue). **10/10 verts** :

- S2 (saisie spraying offline), S5 (422), S6 (5xx, observé en pratique : 404
  quand l'API Rails est down → traité comme transient, retry OK quand l'API
  remonte), S7 (network down), S8 (catalogue stale, 0 POST tenté), S9 (logout
  warning + purge locales), S10 (401 sans purge, interventions retrouvées au
  re-login), S11 (double-tap → 1 POST), S12 (pull-to-refresh + bouton → 1 POST),
  vérif payload `provider` (`vendor='ekylibre-mobile'` + UUID v4 + data).
- **Green light côté code** pour distribuer au panel pilote. iOS/TestFlight
  prêt à soumettre une fois les placeholders `eas.json` renseignés. Android
  attend l'approbation du compte developer Ekylibre côté Google.

**2 follow-ups non bloquants identifiés** (à traiter post-distribution iOS ou
en v1.5+) :

1. **Handler ne lock pas l'unité auto** sur le form spraying (régression suspectée
   vs P5 + fix 2026-05-30, ou catalogue `procedures` pas correctement enrichi
   par l'API). À investiguer : forme renvoyée par `/api/v2/procedures`
   (`handlers` enrichis `{ name, indicator, unit }` ou ancienne `[string]` ?),
   puis `spraying-handlers.ts` parser + `InputsFieldArray`.
2. **Filtrage des équipements par procedure** : le sélecteur Pulvérisateur liste
   tous les équipements du catalogue (devrait être restreint au type attendu par
   `spraying.xml` → `tool: sprayer`). Différent de la limitation connue
   « per-product handler filtering » — sera traité avec elle en v1.5+.

### P7.1–P7.3 — Carte MapLibre + sélection multi-cibles cartographique — 2026-06-14

Phase 7 livrée (`docs/workflow.md` §8) :

- **P7.1 — MapLibre + fond OSM** : `@maplibre/maplibre-react-native@11.3.4`
  (plugin Expo SDK 55 OK), `src/features/map/osm-style.ts` (style raster OSM
  inline avec CGU dans le code), `src/features/map/MapView.tsx` (wrapper
  `Map + Camera`, centre France par défaut). Tab `Carte` plein écran +
  attribution. Mock Jest pour éviter le crash JSI.
- **P7.2 — Couche polygones + sélection** : `src/features/map/geo.ts`
  (`toFeatureCollection` accepte un prédicat `isSelected`, `computeBbox`,
  `expandBbox` avec buffer cos(lat)). `GeoJSONSource` + `FillLayer` + `LineLayer`,
  surlignage via expression `["case", ["get", "selected"], …]` (pas de
  setFilter ni de seconde couche). Auto-fit sur la bbox des `cultivable_zones`.
- **P7.3 — Sélection cartographique dans le form** :
  `src/features/intervention/TargetMapPickerModal.tsx` (Modal RN plein écran,
  toggle au tap, barre d'actions flottante en bas — pas dans un header).
  Bouton « Choisir sur la carte » au-dessus du `MultiSelectField` existant —
  la liste reste pour les parcelles sans géométrie ou recherche texte.
- **API Ekylibre** : `_land_parcels.json.jbuilder` + `_plants.json.jbuilder`
  exposent désormais `shape_geojson` (1 ligne ajoutée par jbuilder côté
  `~/projects/ekylibre`). DTO + mapper côté app acceptent `string | objet`
  (Charta sérialise différemment selon le contexte). 8 tests géo + 4 tests
  modal picker.

Pour fonctionner sur device : déployer la PR Ekylibre P7.0 puis re-sync
catalogue.

### P7.4 — Pré-cache offline désactivé (fix smoke device) — 2026-06-14

Découvert sur device Android au 1er smoke post-rebuild du pilote :

- **Symptôme** : log MapLibre Native `[Mbgl-HttpRequest] [HTTP] Unable to parse
resourceUrl file:///data/user/0/com.ekylibre.zeromobile/cache/map/osm-style.json`.
- **Cause** : `OfflineManager.createPack({ mapStyle: styleUri })` exige une URL
  `http(s)://` ou `asset://` — le resource loader natif **ne supporte pas
  `file://`** local sur Android (limitation MapLibre Native, non documentée
  côté `@maplibre/maplibre-react-native@11.3.4`). Notre code écrivait
  `osm-style.json` dans `Paths.cache/map/` et passait son `file://` URI.
- **Impact** : pas de crash, log non-fatal. Mais le pack offline n'est jamais
  créé → pas de pré-cache par bbox. Le rendu de la carte continue de marcher
  (on passe l'objet `StyleSpecification` inline au composant `<Map>`).
- **Fix** : `triggerOfflineRefresh` neutralisé dans `runSyncCycle`. Le code
  d'`offline-cache.ts` reste en place (réactivable en 1 ligne dès qu'on
  hébergera `osm-style.json` sur une URL publique stable).
- **Mitigation** : l'**ambient cache** natif de MapLibre cache automatiquement
  les tuiles consultées. Couvre l'usage type « charger la carte en Wi-Fi puis
  garder la zone vue hors-ligne » pour le panel pilote v1.
- **À faire en v1.5+** : héberger `osm-style.json` (GitHub raw du repo, S3, ou
  endpoint Ekylibre stable), puis hardcoder l'URL HTTPS dans
  `refreshOfflinePack`.

### P8 — Polish pré-pilote (Sentry metrics, config release, a11y, docs) — 2026-06-14

Phase 8 livrée — phase préparatoire au build pilote (`docs/workflow.md` §9) :

- **P8.1 — Métriques Sentry sur la sync** : 3 helpers typés dans
  `src/core/observability/sentry.ts` (`trackSyncStep`, `trackSyncCycle`,
  `trackInitialSync`), no-op safe si Sentry non initialisé. `runInitialSync`
  → breadcrumb par étape + event de fin avec **volumétrie par table** (éclaire
  l'hypothèse « petite ferme » du workflow §10.4). `runSyncCycle` → event de
  fin avec durée + counts push (succeeded/validation/retried/missing).
- **P8.2 — Config release pilot** : `app.config.js` créé pour injecter
  `SENTRY_DSN` depuis `process.env` (placeholder d'`app.json` en fallback).
  `docs/P8-release-checklist.md` — placeholders à renseigner
  (Apple Team ID, ASC App ID, Google Play key), workflow `build:pilot` →
  `submit:pilot` → OTA, commandes `eas env:push production --path .env.local`
  pour les secrets (préféré à `eas secret:create` legacy).
- **P8.3 — README.md** : statut post-P7, stack listée (Expo SDK 55, MapLibre,
  Node 24, pnpm 10), table commandes, pointer `docs/P8-release-checklist.md`.
- **P8.4 — Docs pilote (FR)** : `docs/release-notes-v1-pilote.md` (à
  transmettre aux agris du panel) et `docs/onboarding-pilote.md` (install
  TestFlight + Internal Testing, scénario type, mises à jour OTA, signalement
  bugs).
- **P8.5 — A11y light pass** : `accessibilityRole="button"` +
  `accessibilityLabel` ajoutés sur les 3 `Pressable` custom manquants
  (`TargetMapPickerModal` Annuler/Valider avec hint compteur, bouton
  « Choisir sur la carte »). Audit du reste : déjà couvert.

### Sentry wizard — réconciliation + plugin moderne — 2026-06-14

Le wizard `@sentry/wizard@latest -i reactNative` a tourné, réconciliation faite :

- **Doublon supprimé** : ancien plugin `@sentry/react-native` (P1, slugs faux
  `ekylibre/zero-mobile`) viré d'`app.json` au profit du moderne
  `@sentry/react-native/expo` (path SDK 50+) avec slugs corrigés
  (org `osfarm`, project `zero-mobile`).
- **`metro.config.js`** (wizard) : `getSentryExpoConfig` câblé pour injecter
  les Debug IDs + uploader les sourcemaps avec `SENTRY_AUTH_TOKEN`.
- **`app/_layout.tsx`** : `export default Sentry.wrap(RootLayout)` (wizard) —
  compatible avec notre `initSentry()` au boot (idempotent).
- **`.env.local`** (wizard, gitignored) : `SENTRY_DSN` + `SENTRY_AUTH_TOKEN`.
  Expo SDK 55 charge ce fichier automatiquement au start Metro → notre
  `app.config.js` lit `process.env.SENTRY_DSN` → injecté dans
  `Constants.expoConfig.extra.sentryDsn` → `initSentry()` boot.

### Icônes tab bar + icône d'app (chouette Ekylibre) — 2026-06-14

- **3 icônes tab bar** : `src/ui/icons/TabBarIcons.tsx` — `TractorIcon`
  (Interventions, `uf937-tractor-alt`), `LandParcelIcon` (Carte,
  `uf179-land-parcels`), `CogIcon` (Paramètres, `uf04e-cog`). SVG inlinés
  via `react-native-svg` (pas d'asset), `fill={color}` piloté par le tab
  bar theme.
- **Icône d'app** : `assets/icon.png` + `assets/adaptive-icon.png` regénérées
  depuis `uf06c-ekylibre-alt.svg` (la chouette emblématique) via ImageMagick.
  ⚠️ Rebuild EAS dev **obligatoire** pour qu'elle apparaisse sur device
  (les icônes sont bundlées dans l'APK/IPA, pas OTA-able).
- **Limitation à connaître** : ImageMagick rastérise les SVG avec fond blanc
  opaque (faute de `librsvg`). Tant que `adaptiveIcon.backgroundColor` reste
  `#ffffff`, invisible. Si on bascule vers un fond coloré plus tard, regénérer
  avec `rsvg-convert` pour une vraie transparence.

### Vue intervention + liste : détails, tracé parcelle, suppression, fix statut — 2026-05-30

- **Fix statut sync (bug)** : le push parsait la réponse POST/PUT contre le DTO
  de lecture complet, mais Ekylibre ne renvoie que `{ id }` (idem 200
  idempotent) → `ZodError` → la ligne restait « À synchroniser » alors qu'elle
  était créée serveur-side. `createIntervention`/`updateIntervention` parsent
  désormais `interventionWriteResultSchema` (`{ id }`).
- **Détail enrichi** : la vue détail affiche le **détail** des cibles
  (nom de parcelle + **tracé `shape_svg`**), conducteurs, intrants (produit +
  quantité + unité + variante) et outils — au lieu de simples compteurs. Le
  tracé est rendu par un composant `ParcelShape` qui extrait `viewBox` + le `d`
  du path et rend un `<Svg><Path>` **explicite** (fill + stroke garantis) —
  plus robuste que `SvgXml` (rendait blanc : pas de fill appliqué de façon
  fiable selon le build).
- **`shape_svg` stocké** : ajout colonne `shape_svg` sur `cultivable_zones`
  (migration v2, avec `dead_at`), DTO/mapper/persister.
- **Liste — action Supprimer** : bouton « Supprimer » sur les interventions
  non synchronisées (pending/error), avec confirmation ; `deleteIntervention()`
  purge l'intervention + ses relations en une transaction. (« Modifier » :
  tâche dédiée à venir.)
- **Dépendance native** : `react-native-svg` 15.15.3 → **rebuild EAS dev requis**
  avant test device.
- **Tests** : +3 (parsing `{ id }`, visibilité/clic Supprimer). Suite verte
  (216/216), typecheck + lint OK.

### Picker de cibles : land_parcels (nom complet de production + filtre dead_at) — 2026-05-30

Le sélecteur de parcelle de l'écran de saisie affichait le nom de **zone**
(« LES ESSARDS #01 ») et listait toutes les zones, sans tenir compte de la fin
de culture.

- **Source repointée** : `listCultivableZones()` interroge désormais
  `GET /api/v2/products?product_type=land_parcels` (au lieu de
  `/api/v2/cultivable_zones`). Ces produits portent le **nom complet de
  production** (« Bernessard Blé tendre d'hiver 2026 »), `dead_at`, et
  `net_surface_area` (valeur fractionnaire type `"4743/500"` parsée en ha).
- **Filtre** : `useCultivableZones()` n'affiche que les cibles avec
  `dead_at` null **ou** `dead_at ≥ aujourd'hui − 1 an` (cultures actives ou
  terminées récemment).
- **WDB** : schéma **v2** + migration `addColumns(dead_at)` sur
  `cultivable_zones` ; mapper/persister propagent `deadAt`.
- ⚠️ **Carte P7** : cette source ne fournit pas de GeoJSON (`shape_svg`
  uniquement) — la géométrie carte devra venir d'une autre source ; le parsing
  `shape_to_geojson` est conservé mais dormant.
- **Tests** : mapper réécrit (nom complet, surface fractionnaire, dead_at,
  conversion m²→ha). Suite verte (213/213), typecheck + lint OK.

### Handlers/units spraying : sourcés depuis l'API + saisie conforme — 2026-05-30

La saisie d'un intrant produisait des couples `(quantity_handler, quantity_unit)`
non conformes à la procédure (`area_density` / `l` au lieu de
`volume_area_density` / `liter_per_hectare`). Cause : liste de handlers
hardcodée + unité saisie en **texte libre**.

- **Serveur (Track A, repo `ekylibre`)** : `/api/v2/procedures` enrichi —
  `handlers` passe de `[string]` à `[{ name, indicator?, unit? }]`
  (`_parameter.json.jbuilder`). Vérifié live sur la démo.
- **App (Track B)** : nouveau `spraying-handlers.ts` qui lit les handlers
  depuis la définition de procédure stockée (`Procedure.definition`), avec
  fallback canonique (miroir `spraying.xml`) si l'API renvoie encore l'ancienne
  forme ou si le catalogue n'a pas été resynchronisé. Le sélecteur de mesure
  fixe désormais **automatiquement** l'unité Ekylibre ; l'unité n'est plus
  saisissable (affichage lecture seule). Schéma Zod : `quantity_unit` requis +
  cohérent avec le handler (garde-fou anti-régression).
- **Tests** : +`spraying-handlers` (parser : formes objet/string/fallback) ;
  schéma et `InputsFieldArray` mis à jour. Suite verte (211/211), typecheck OK.
- ⚠️ **Pré-requis device** : re-synchroniser le catalogue pour récupérer les
  unités enrichies (sinon fallback canonique). Le push spraying reste par
  ailleurs bloqué par le bug core P6.6 (`nil.unit` sur le tool `sprayer`).

### Fix — gestion des `400` au push + ticket core spraying (P6.6) — 2026-05-30

Découvert pendant la validation dev local S3 (push interventions sur device).
Le `POST /api/v2/interventions` spraying renvoie `400` dès qu'il y a une cible
ou un intrant : `{"errors":["Dont known how to manage node:
Procedo::Formula::Nodes::ActorPresenceTest"]}` (idem `…::Division` pour l'input).
Isolé par dichotomie : payload minimal (proc + wp + doer) → `201` ; +target →
400 `ActorPresenceTest` ; +input → 400 `Division`.

- **Cause** : l'interpréteur de formules Procedo de l'**API v2 d'Ekylibre** ne
  sait pas évaluer ces nœuds → erreur 500-like renvoyée en 400. **Bug serveur**,
  pas l'app : le `reference_name` du tool (sprayer/tractor/absent) n'a aucun
  impact. ⚠️ Régression probable : le même POST renvoyait `201` plus tôt le
  2026-05-30 (cf. ids 46/47 dans `p6.5`). Ticket core →
  `docs/p6.6-ekylibre-spraying-procedo-issue.md`.
- **Fix app (robustesse, A+B)** : un `400` est désormais converti en
  `ValidationError` (`client.ts`), donc traité comme une **erreur définitive**
  (plus de retry en boucle au cycle suivant) **et** son `errors[]` est extrait
  et affiché verbatim dans l'écran détail (au lieu d'un générique « Erreur
  serveur (400) »). Avant : 400 classé `retry` → restait `pending` + re-POST à
  chaque cycle (risque de doublon vu la non-idempotence P6.5).
- **Tests** : +1 cas client (`400 → ValidationError` avec errors parsés). Suite
  complète verte (202/202), typecheck OK.

### Fix — sync `cultivable_zones` (géométrie WKT vs GeoJSON) — 2026-05-30

Découvert pendant la validation dev local S1 sur device Android (instance
locale exposée via ngrok). La sync initiale échouait systématiquement à
l'étape **« Parcelles cultivables »** dès qu'une ferme a des parcelles.

- **Constat** : `GET /api/v2/cultivable_zones` renvoie `200`, mais le
  champ `shape` est du **WKT** (`{ feature: "SRID=4326;MULTIPOLYGON(…)" }`,
  sans `type`), pas du GeoJSON. Le vrai GeoJSON est dans un champ séparé
  **`shape_to_geojson`**, encodé en **string**. Le schéma Zod
  `cultivableZoneDtoSchema` exigeait `shape.type` → `ZodError` →
  sync cassée. Masqué jusqu'ici (jamais synchronisé bout-en-bout sur
  device contre une instance avec géométries).
- **Fix** : `shape` n'est plus validé comme GeoJSON ; ajout de
  `shape_to_geojson: z.string()` au DTO ; `mapCultivableZoneDto` parse
  cette string (avec fallback `null` si invalide) pour alimenter
  `geometry`. Couvre aussi correctement l'entrée carte de P7.
- **Tests** : `mapCultivableZoneDto` réécrit (4 cas : GeoJSON parsé, WKT
  ignoré, string invalide → null, champs absents). Suite complète verte
  (201/201), typecheck + lint OK.

### Validation dev local P6 — 2026-05-30

Flux scriptable (login → catalogue → POST interventions) exercé contre
une instance Ekylibre live via `scripts/s4-idempotence.sh`. Focus :
trancher l'idempotence `provider.id` (P6.4 _Action requise_).

- ✅ **`actions: []` accepté** par `POST /api/v2/interventions` (201) —
  lève le point de vigilance « champ non documenté » de P6.1/P6.4.
- ✅ Forme du payload (`*_attributes` imbriqués + bloc `provider`)
  acceptée par le serveur : POST minimal (proc + working_period +
  doer) → 201.
- ❌ **S4 idempotence : RÉSULTAT B — Ekylibre ne dédoublonne PAS sur
  `provider.id`.** Deux POST identiques (même `provider.id`) →
  **deux interventions distinctes** (ids 44≠45, 46≠47 sur la démo).
  Voir ticket **P6.5** ci-dessous.

### P6.5 — Idempotence sync (BLOCKER pilote, ouvert)

> Issu de la validation dev local du 2026-05-30. Bloque la distribution
> au panel pilote (cf. `docs/testing-guide.md` §2, signoff §5).

- **Constat** : le serveur ne déduplique pas sur `provider.id`. Un ack
  perdu après un POST réussi → doublon garanti au cycle suivant.
- **Aggravant** : `provider` n'est **pas sérialisé** dans
  `GET /api/v2/interventions`, et l'endpoint n'expose aucun filtre
  `provider_id`. ⇒ Le **GET défensif** envisagé en P6.4 _n'est pas
  faisable_ côté client avec l'API v2 actuelle. La piste
  `GET /interventions?provider_id=<uuid>` de P6.4 est donc **caduque
  en l'état**.
- **Options** (à trancher avec l'équipe Ekylibre core) :
  1. **Serveur** : dédup sur `provider.id` au POST (upsert) +
     sérialiser `provider` dans la réponse list/show. _Préféré_ —
     règle la cause racine et débloque aussi tout futur pull-merge.
  2. **Client** : protocole d'ack durable (ne re-POSTer que si le
     précédent n'a pas confirmé un `server_id`), sans GET défensif.
     Atténue sans garantir (course réseau résiduelle).
- **D'ici le fix** : le lock `useRef` de `useSyncCycle` couvre le
  double-tap UI mais **pas** l'ack perdu. Ne pas distribuer au pilote
  avant arbitrage.

### Risques d'intégration découverts (à exercer en S3/S5)

- ⚠️ **Tool `reference_name: 'sprayer'`** (cf. `spraying.ts`) →
  `400 { errors: ["undefined method 'unit' for nil"] }` quand le
  produit `equipments` choisi n'est pas réellement un pulvérisateur
  (testé avec un tracteur). L'app laisse l'utilisateur choisir
  n'importe quel équipement comme `sprayer` → risque de crash serveur
  en prod. À cadrer : filtrer les équipements par variété, ou aligner
  le `reference_name` sur la définition de procédure.
- ⚠️ **Target `cultivation`** : une culture clôturée (démo : fin
  31/08/2017) refuse un POST daté hors de sa fenêtre
  (`403 « La parcelle/culture n'existe pas après… »`). À valider que
  l'app n'autorise pas une saisie hors période de validité parcelle.

### En cours

- P6.5 — Idempotence sync (blocker pilote, ci-dessus)
- P7 — Carte des parcelles (à venir)

## P6 — Sync engine

Livré en 4 sous-tranches (P6.1 → P6.4). Le moteur de sync push interventions
suit ADR-03 (boucle dédiée par intervention, pas `synchronize().pushChanges`)
et le pull catalogue réutilise `runInitialSync` (idempotent, choix tranché
au démarrage de la phase).

### P6.1 — Payload-builder + extension API client

**Fait** :

- Types payload (`src/core/api/types.ts`) — `ProviderTag`,
  `WorkingPeriodAttribute`, `DoerAttribute`, `InputAttribute`,
  `TargetAttribute`, `ToolAttribute`, `CreateInterventionPayload`,
  `UpdateInterventionPayload`. Conformes à l'architecture §4.
- Nouvelle classe `ValidationError extends ApiError`
  (`src/core/api/errors.ts`) qui porte `errors: string[]` parsés du body,
  pour stockage dans `intervention.sync_error_message` (cf. matrice §4).
- `src/core/sync/payload-builder.ts` —
  `buildCreateInterventionPayload(data, lookups, provider)` pur. Mappe
  les IDs locaux WDB vers les `server_id` Ekylibre via `ServerIdLookups`
  (productById / zoneById / variantById). `MissingServerIdError` clean
  si une référence est introuvable (cas catalogue serveur modifié après
  la saisie — produit retiré, parcelle supprimée). Synthétise une
  working_period depuis les dates si la liste est vide. **Targets sortent
  en `product_id`** (les cultivable_zones partagent l'espace d'IDs des
  produits côté Ekylibre v2 — cf. arch §4).
- `EkylibreApiClient.createIntervention(payload)` (POST) +
  `updateIntervention(serverId, payload)` (PUT). Wrapper privé
  `requestWithValidation` qui transforme `ApiError(412|422)` en
  `ValidationError`. Helper `extractErrors(body)` qui supporte le format
  `errors: string[]` ET `errors: { field: string[] }`.
- Tests : 33 nouveaux (11 payload-builder + 22 API client extension).

### P6.2 — Push loop + Zustand store + provider tag

**Fait** :

- `src/core/sync/store.ts` — Zustand store du cycle : `status`
  (idle/pulling/pushing/error), `lastError`, `lastSyncAt`. Actions :
  `setStatus`, `setError`, `markCompleted`, `reset`. **`pendingCount`
  reste observable via `usePendingInterventionCount()` existant** —
  pas dupliqué dans le store (la source de vérité = WDB).
- `src/core/sync/provider-tag.ts` — `buildProviderTag(uuid, deviceInfo)`
  pur + `getDeviceInfo()` qui lit `Constants.expoConfig.version` +
  `Platform.OS` + `i18n.language`. `device_model` laissé `undefined`
  en v1 (pas de `expo-device` ; à ajouter si Sentry/Ekylibre en a
  besoin pour le triage pilote).
- `src/core/sync/push-engine.ts` — exposé sous **deux formes** :
  - **`runPushCyclePure(deps)`** — testable sans WDB. Itère les
    `tasks: InterventionPushTask[]` (intervention + relations
    pré-fetchées), produit un `PushOutcome` (`synced` / `error` /
    `retry`) via le callback `applyOutcome`. AuthError remonte (laisse
    l'auth handler purger). Optionally calls `markSyncing` avant
    chaque push.
  - **`runPushCycle({ database, api, buildProvider })`** — wrapper
    production qui glue WDB : query
    `sync_state IN (pending, error, syncing)` (le `syncing` capture
    les cycles crashés), fetch lookups, fetch relations par
    intervention, applique les outcomes via `database.write` +
    `intervention.update(...)`.
- **Matrice de gestion d'erreurs (alignée arch §4)** :
  | Erreur | sync_state | sync_error_message | sync_attempt_count |
  | --- | --- | --- | --- |
  | 200/201 | synced | `null` | inchangé |
  | 422/412 ValidationError | error | errors joints `\n` | inchangé |
  | MissingServerIdError | error | « Référence X introuvable… » | inchangé |
  | 5xx ApiError | pending | « Erreur serveur (N)… » | +1 |
  | NetworkError | pending | « Connexion perdue… » | +1 |
  | 401 AuthError | — | — | (cycle interrompu, auth purge) |
- Tests : 24 nouveaux (13 push-engine + 7 store + 4 provider-tag).

### P6.3 — Orchestrateur cycle complet

**Fait** :

- `src/core/sync/sync-cycle.ts` — `runSyncCycle({ database, api,
buildProvider, onPhase? })`. Pull (réutilise `runInitialSync` —
  idempotent, resumable) puis push (`runPushCycle`). Renvoie un
  `SyncCycleReport` complet (`pullOk`, `pullError`, `pushReport`,
  `pushError`).
- **Pull failure ≠ stop push** : si la sync catalogue échoue (réseau
  down après que des interventions ont été saisies), on tente quand
  même le push. Les lookups push viennent de la base locale, pas du
  fetch du jour — donc robuste à un catalogue stale.
- AuthError remonte tel quel depuis pull comme depuis push. Le reste
  est encodé dans le report : pas d'exception en sortie, le caller
  décide de l'affichage.
- `onPhase` callback au lieu d'un coupling direct au store : la route
  fait `(phase) => useSyncStore.getState().setStatus(phase)`. Garde
  le moteur testable sans Zustand.
- Tests : 10 nouveaux.

### P6.4 — UI wiring

**Fait** :

- `useSyncCycle()` hook (`src/core/sync/use-sync-cycle.ts`) — wrap
  `runSyncCycle` + store. Expose `{ startSync, status, lastError,
lastSyncAt, isBusy }`. **Lock anti-réentrance** via `useRef`
  (un 2e tap pendant le 1er cycle retourne `null` sans rien
  déclencher — protection critique vu que l'idempotence Ekylibre n'est
  pas encore vérifiée bac à sable, cf. risques majeurs ci-dessous).
- `useErrorInterventionCount()` hook — observable count des
  interventions en `sync_state='error'` pour le bandeau persistant.
- `InterventionsListView` étendu :
  - Header sync (status, dernière sync, bouton « Synchroniser »).
  - Bandeau d'erreur persistant (errorCount > 0).
  - Bandeau syncError (échec global de cycle).
  - Bandeau pending (existant P4).
  - Pull-to-refresh **wired sur le vrai cycle** (le placeholder
    400 ms de P4 est supprimé).
- `app/(tabs)/interventions/[id].tsx` — bouton « Réessayer » marque
  `pending` puis déclenche `startSync()` immédiatement (au lieu
  d'attendre le prochain tap manuel comme en P4 placeholder).
  Disabled pendant `syncBusy`.
- `app/(tabs)/settings.tsx` — Alert de logout inclut « N
  intervention(s) non synchronisée(s) seront perdues » quand
  `pendingCount > 0` (cf. brainstorm §6 — la déconnexion purge les
  tables WDB locales).
- i18n : bloc `interventions.list.{syncAction,syncStatus.*,
errorBanner_*,lastSyncAt,lastSyncNever}` + `settings.logoutPendingWarning_*`.
- Tests : 13 nouveaux (10 list view P6.4 + 5 use-sync-cycle).

**Action requise après cette phase** :

- ✅ **TRANCHÉ le 2026-05-30 — RÉSULTAT B (non idempotent).** Voir
  _Validation dev local P6_ + ticket _P6.5_ en tête de fichier. Le
  GET défensif proposé ci-dessous s'est révélé **non faisable**
  (provider non sérialisé / pas de filtre `provider_id`).
- ⚠️ **Test bac à sable Ekylibre pour confirmer l'idempotence sur
  `provider.id`** — décision « trust + warn » prise au démarrage de
  P6 (cf. risques majeurs workflow §6). Le lock anti-réentrance dans
  `useSyncCycle` protège du double-tap UI mais **pas** du cas
  « POST réussi côté serveur, ack perdu côté client » : si le serveur
  ne dédoublonne pas sur `provider.id`, un retry au prochain cycle
  créera un doublon. À tester sur instance de test avant le 1er
  pilote ; si KO, ajouter un `GET /interventions?provider_id=<uuid>`
  défensif avant chaque POST (latence x2 mais sûreté garantie).

**Points de vigilance** :

- Le champ `actions: []` envoyé dans le payload est **non documenté**
  côté Ekylibre v2. Les premiers POSTs en bac à sable diront si
  l'API exige une valeur précise (probablement liée à la définition
  XML de la procédure spraying). À enrichir en v1.5+ quand on aura
  accès aux définitions.
- Le push-engine n'est pas exercé en intégration WDB en test (c'est
  la 3e itération du même point — cf. P3, P5). On teste la logique
  via `runPushCyclePure` et le glue WDB est validé manuellement +
  via démo. À convertir en E2E Maestro/Detox dès qu'un device CI
  est dispo (workstream §10.1).
- Le pull catalogue réutilise `runInitialSync` (full fetch + diff
  client-side) à chaque cycle. **Hypothèse « petite ferme »** —
  si on dépasse les 1k produits / 500 parcelles, cette stratégie
  devient coûteuse. À mesurer en pilote (cf. arch §11.3) ; bascule
  vers `?modified_since=` côté Ekylibre si saturé.
- Le format des erreurs Ekylibre v2 (422 body) est **présumé** :
  on supporte `{ errors: [...] }` ET `{ errors: { field: [...] } }`.
  Si la réponse réelle a une 3e forme, `extractErrors` retombe sur
  le body brut (déjà accessible via `ApiError.body`). À vérifier
  sur les premiers 422 pilote.
- Le Zustand store v5 utilisé sans middleware (pas de devtools, pas
  de persist). Si on veut survivre au reload de l'app pour
  `lastSyncAt`/`lastError`, ajouter le middleware `persist` —
  reporté à v1.5 si jugé utile.
- Pas encore de UI sur l'écran de détail pour distinguer un sync
  retryable (`pending` avec attempt > 0 + message) d'un brand-new
  pending (attempt = 0). Le bandeau actuel suppose que l'utilisateur
  reconnaît le contexte. À itérer si retour pilote négatif.

## P5 — Formulaire spraying

Livré en 4 sous-tranches (P5.1 → P5.3b) pour garder des PRs reviewables.

### P5.1 — Domaine + UUID + persister

**Fait** :

- Wrapper UUID (`src/core/crypto/uuid.ts`) — `generateClientUuid()`
  enrobe `expo-crypto.randomUUID()` dans un module dédié pour pouvoir
  le mocker proprement dans les tests sans monkey-patcher la lib.
- Schéma Zod du formulaire (`src/domain/procedures/spraying.ts`) —
  conforme à l'architecture §7 : `procedure_name === 'spraying'`,
  `started_at < stopped_at` (refine), doers ≥1 (`driver`), inputs ≥1
  (`plant_medicine` avec `quantity_value > 0` finite + `quantity_handler`
  non vide), targets length === 1 (`cultivation`), tools ≥1 (`sprayer`).
  Messages FR en dur dans le domaine (la couche domaine n'a pas accès
  à i18next ; v1 ne ship que le FR).
- Persister (`src/features/intervention/persister.ts`) —
  `persistSprayingIntervention(database, input, opts?)` : génère
  `client_uuid` (figé pour la vie de l'intervention, cf. ADR-13),
  calcule `whole/working_duration_seconds` depuis les dates, écrit
  intervention + 1 working_period (`nature: 'intervention'`) + N doers
  - N inputs + 1 target + N tools dans **une seule** `database.write` +
    `database.batch(...)` (pattern aligné avec les catalog persisters).
    Sortie : `{ interventionId, clientUuid }`. Description trim + null si
    vide. `opts.generateUuid` permet l'injection de stub en test.
- Tests : 21 cas Zod (happy path × 4 + invalidations × 17, couvre tous
  les chemins du schéma) + 12 cas persister (1 transaction + 1 batch,
  bon nombre d'opérations par table, FK `intervention_id` propagée,
  champs métier persistés, défauts `sync_state='pending'` /
  `syncAttemptCount=0`, `variantId`/`quantityUnit` à `null` si absents,
  description trim/null, multi-rows). Le persister est testé via un
  mock WDB qui capture les opérations (proxy sur `prepareCreate`).

### P5.2 — Picker procédure + squelette formulaire

**Fait** :

- `ProcedurePickerView` (`src/features/intervention/`) — vue pure qui
  reçoit la liste des procédures et filtre sur le set v1-supportées
  (uniquement `spraying` à ce jour ; étendre quand on ouvrira d'autres
  procédures). Tap d'un item → callback `onSelect(name)`. État vide.
- Route `app/(tabs)/interventions/new.tsx` — `useProcedures()` +
  `router.replace('/(tabs)/interventions/spraying')` au tap.
  **`replace` plutôt que `push`** pour que le bouton retour ramène
  directement à la liste, pas au picker (sinon back→picker→back =
  app qui « patine »).
- `SprayingFormView` (squelette) — RHF + `zodResolver`, structure des 6
  sections (dates / target / doer / inputs / tool / description),
  champ Notes pleinement utilisable, bouton « Enregistrer » qui
  exécute la validation Zod (échoue donc avec un bandeau « formulaire
  incomplet » en P5.2 puisque les sélecteurs ne sont pas encore là).
- Route `app/(tabs)/interventions/spraying.tsx` — câblée sur le
  persister de P5.1, `Alert` succès, `router.replace` retour liste,
  `captureException` (Sentry) sur erreur.
- `_layout.tsx` interventions — Stack.Screen `spraying` enregistré.
- i18n — clés `interventions.new.{subtitle,empty,unsupported}` et bloc
  `interventions.spraying.*` (sections, fields, save, errors).
- Tests : 11 nouveaux (5 picker + 6 form skeleton).

### P5.3a — Date pickers + 3 selects (parcelle, conducteur, pulvérisateur)

**Fait** :

- Dépendance ajoutée : `@react-native-community/datetimepicker@^9.1.0`
  (compatible Expo SDK 54 via plugin officiel — native code,
  ⚠️ rebuild EAS dev client requis ; cumulé avec celui d'`expo-crypto`
  de P5.1).
- Composants UI réutilisables (`src/ui/`) :
  - `DateTimeField` — déclencheur affichant la valeur formatée +
    picker natif au tap. iOS = overlay inline ; Android = pas de mode
    `datetime` natif → on enchaîne `date` puis `time` automatiquement
    pour rester cohérent avec l'API utilisateur.
  - `SelectField<T>` — générique : label + valeur courante (ou
    placeholder), tap ouvre une `Modal` avec `TextInput` de recherche
    et `FlatList` filtrée case-insensitive. Checkmark sur l'item
    sélectionné, état vide / no-results dédiés. **`SafeAreaView`
    importé depuis `react-native-safe-area-context`**, pas de RN
    (l'export RN est déprécié).
- `SprayingFormView` mis à jour — `Controller` branche dates /
  parcelle / conducteur / pulvérisateur. Pour les arrays mono-élément
  (`targets`, `doers`, `tools`), la valeur sélectionnée est dérivée
  via `find(id)` et `onChange` enveloppe l'item dans
  `[{ ..., reference_name: '...' }]`. Subtitles : surface en ha pour
  les parcelles, `variety` pour les pulvérisateurs.
- Route `spraying.tsx` étendue — `useCultivableZones()`,
  `useProductsByType('workers' | 'equipments')` injectés dans la vue.
- i18n — bloc `select.*` (search hint, no-results, empty générique) +
  `interventions.spraying.{fields,selects}.*` + `areaHectares`.
- Tests : +13 (10 SelectField + 3 form steps wired). Existant adapté
  pour passer les nouvelles props.

### P5.3b — Multi-intrants phytosanitaires

**Fait** :

- `InputsFieldArray` (`src/features/intervention/`) — éditeur de liste
  contrôlé (value/onChange depuis `Controller name="inputs"`). Une
  ligne = `SelectField<Product>` produit + `SelectField<Variant>`
  variante (optionnelle) + `TextInput` numérique quantité +
  `SelectField<HandlerOption>` mesure + `TextInput` libre unité.
  Boutons « Retirer » par ligne, « + Ajouter un intrant » global.
  État vide propre quand `value.length === 0`.
- Liste fixe v1 des handlers (`SPRAYING_HANDLERS`) :
  `population` / `net_volume` / `net_mass` / `area_density`. Le
  mapping handler-par-produit (cf. architecture §11) dépendra de la
  définition XML des procédures (P-v1.5+) — en v1 on propose les 4
  handlers les plus courants pour permettre la saisie.
- Quantité — `keyboardType="decimal-pad"`, parsing tolérant
  virgule/point (UX FR), fallback à 0 si saisie non numérique.
- `SprayingFormView` — accepte `matters: Product[]` et
  `variants: Variant[]`, branche `InputsFieldArray` via Controller.
  Suppression du composant `Placeholder` interne devenu inutile.
- Route `spraying.tsx` — `useProductsByType('matters')` +
  `useVariants()` filtré sur `category === 'plant_medicine'`.
- i18n — bloc `interventions.spraying.inputs.*` (titre ligne,
  add/remove, labels et placeholders des 5 champs, états vide
  produit/variante) + bloc `handlers.*` (4 labels FR).
- Tests : +12 (11 InputsFieldArray + 1 form complet). Couvre add /
  remove / multi-row / parsing décimal `,`/`.` / fallback non-numérique
  / sélection produit-variant-handler / unit `undefined` quand vide.

**Action requise après cette phase** :

- ⚠️ **Rebuild EAS dev client requis** — deux nouvelles deps natives
  ajoutées (`expo-crypto` en P5.1, `@react-native-community/datetimepicker`
  en P5.3a). Lancer `pnpm build:dev:ios` / `pnpm build:dev:android`
  avant le premier `pnpm start`.

**Points de vigilance** :

- WatermelonDB n'est toujours pas exercé en intégration : le persister
  est testé via mock (capture des `prepareCreate` + `batch`). Une
  validation device est nécessaire pour confirmer que le batch passe
  bien (relations bien créées, FK respectées). Prévoir une démo P5
  sur device avant d'attaquer P6.
- La validation Zod est invoquée au submit uniquement
  (`mode: 'onSubmit'`). Les erreurs par champ apparaissent après le
  premier tap Save. Si l'UX devient brouillonne avec plusieurs
  intrants, basculer sur `mode: 'onTouched'` côté `useForm`.
- Les handlers de quantité sont une liste **fixe**. Si un produit
  Ekylibre attend un handler hors set, l'utilisateur ne pourra pas
  saisir et le push 422 côté serveur (P6) sera la première
  manifestation. À surveiller en pilote.
- Le picker de procédure est filtré sur `spraying` uniquement
  (`SUPPORTED_PROCEDURES` dans `ProcedurePickerView`). Les autres
  procédures du catalogue sont **invisibles** côté mobile en v1 ;
  c'est volontaire (cf. brainstorm §3).
- 1 scénario E2E Maestro/Detox (cf. workflow.md §6 quality gate)
  **non encore livré** — chantier transverse §10.1, à attaquer dès
  qu'un device permanent est disponible en CI.
- Test harness pour composants contrôlés stateful : utiliser
  `Object.assign(utils, { captured })` plutôt que
  `{ ...utils, get value() {...} }` — le spread d'object literal
  capture les valeurs au moment de la construction et casse la
  réactivité du getter sur la closure mutable.

## P4 — Liste & détail intervention

**Fait** :

- Composants UI réutilisables (`src/ui/`) :
  - `SyncBadge` — pastille colorée (pending = ambre, syncing = bleu,
    synced = vert, error = rouge), label i18n.
  - `EmptyState` — composant générique titre + sous-titre + action.
  - `InterventionListItem` — ligne procédure + date + badge sync,
    description en queue si présente.
- Hooks de détail (`src/features/catalog/hooks.ts` étendu) :
  - `useProcedureByName(name)` — résolution de label_fr depuis le
    nom de procédure (clé naturelle).
  - `useInterventionById(id)` — intervention + 5 collections enfants
    (doers, inputs, targets, tools, working_periods), tout
    observable. Utilise `findAndObserve` pour le record principal.
  - Helper `useChildren` partagé pour les 5 sous-collections.
- Liste interventions (`app/(tabs)/interventions/index.tsx`) :
  - Vue présentation pure dans `src/features/intervention/InterventionsListView.tsx`
    (testable sans router/DB), connectée par la route via hooks.
  - `FlatList` triée par `started_at` desc.
  - Pull-to-refresh (`RefreshControl`) — placeholder en P4 (timeout
    400ms), branché sur le sync engine en P6.
  - Bandeau "N intervention(s) à synchroniser" (plurals i18next FR)
    quand `pendingCount > 0`.
  - `EmptyState` avec CTA "+ Nouvelle intervention" si liste vide.
  - FAB "+" en bas-droite quand la liste contient au moins une ligne.
- Détail intervention (`app/(tabs)/interventions/[id].tsx`) :
  - Header (procédure résolue + badge sync).
  - Bandeau d'erreur avec message serveur + bouton "Réessayer" (qui
    repasse `sync_state=pending` ; le vrai cycle de retry arrive en P6).
  - Section dates (début, fin, durée travaillée formatée FR avec
    pluralisation des heures/minutes).
  - Section description si présente.
  - 5 sections de comptage (cibles, conducteurs, intrants, outils,
    périodes de travail) — seul le count est affiché en v1, le détail
    complet de chaque relation viendra avec l'édition (v1.5).
  - État "non trouvée" si l'id est invalide.
- Badge "à synchroniser" sur l'onglet Interventions
  (`app/(tabs)/_layout.tsx`) — `tabBarBadge` câblé sur
  `usePendingInterventionCount()`, masqué quand 0.
- Locales étendues : labels de syncState, plurals FR pour
  `pendingBanner` et `durationHours`, sections du détail, placeholders.
- Tests Jest UI : `InterventionsListView.test.tsx` — 7 cas couvrant :
  - 3 interventions rendues avec les bons badges
  - bandeau pending visible/caché
  - pluralisation correcte (1 vs N)
  - empty state + CTA
  - tap ligne → onItemPress(intervention)
  - tap FAB → onNew()
  - i18n initialisé directement dans le fichier de test (pas besoin
    de wrapper).

**Points de vigilance** :

- Pull-to-refresh est un **placeholder de 400 ms** ; la vraie
  synchronisation arrive en P6. Volontairement pas de "fake message
  de succès" pour éviter la confusion.
- Le bouton "Réessayer" du détail repasse bien l'intervention en
  `pending` mais aucune sync automatique ne suit (P6).
- Les sections du détail (cibles/intrants/outils/etc.) n'affichent
  que le **count** en v1. Le détail richesse (ex: nom du produit,
  quantité, parcelle…) viendra en P5 (formulaire) puis v1.5 (édition).
- WatermelonDB n'est toujours pas exercé en test : tous les hooks
  ont été contournés via une vue présentation pure prenant les
  données en props.

## P3 — DB locale + sync catalogue

**Fait** :

- WatermelonDB intégrée :
  - Deps : `@nozbe/watermelondb`, `@morrowdigital/watermelondb-expo-plugin`,
    `@babel/plugin-proposal-decorators`.
  - `babel.config.js` — plugin decorators legacy ajouté.
  - `tsconfig.json` — `experimentalDecorators: true`,
    `useDefineForClassFields: false`.
  - `app.json` — plugin `@morrowdigital/watermelondb-expo-plugin`
    (active la liaison native iOS/Android).
  - `.npmrc` — hoist pattern pour `@nozbe/*`.
- Schéma WDB v1 (`src/core/db/schema.ts`) — 11 tables : `procedures`,
  `products`, `variants`, `cultivable_zones`, `interventions` +
  5 tables d'enfants intervention + `sync_state` singleton.
  Constantes `Tables` exposées pour éviter les chaînes magiques.
- 11 modèles WDB (`src/core/db/models/`) avec décorateurs
  (`@field`, `@date`, `@json`, `@readonly`, `@relation`,
  `@immutableRelation`, `@children`). Associations déclarées
  pour Intervention ↔ enfants.
- `database.ts` (singleton avec adapter SQLite + JSI) et
  `provider.tsx` (DatabaseProvider applicatif).
- `migrations.ts` — convention posée, vide en v1.
- DTOs Zod (`src/core/api/dtos/`) — `procedure`, `product`,
  `variant`, `cultivable-zone`, `intervention` ; tous lâches
  (`.passthrough()`) pour absorber les variations API.
- Mappers DTO ↔ row (`src/domain/mappers/`) — fonctions pures
  qui produisent des objets « row » consommés par les persisters.
- API client étendu (`src/core/api/client.ts`) :
  `listProcedures()`, `listProducts(type)`, `listCultivableZones()`,
  `listVariants()`, `listInterventions(opts)`. Parsing Zod systématique.
- Persisters (`src/features/catalog/persisters.ts`) — un par table
  catalogue, pattern upsert idempotent (create/update/destroy)
  par clé naturelle (`name` pour procédures, `server_id` pour le
  reste), une seule transaction par appel via `database.batch(...)`.
  Suppression des entrées disparues côté serveur.
- `getOrCreateSyncState`, `updateSyncState` — accès singleton
  `sync_state` (avec création paresseuse si absent).
- Moteur de sync initiale (`src/features/catalog/initial-sync.ts`) :
  - Étapes canoniques : `procedures` → `products` (× 3 sous-types :
    workers, equipments, matters) → `cultivable_zones` → `variants`.
  - **Reprise** : démarre depuis `sync_state.current_step` ; après
    `done`, repart de `procedures` au prochain appel.
  - **Idempotence** : chaque étape est ré-exécutable sans effet
    de bord (upserts + suppression).
  - **Erreur** : marque `sync_state` `error` + message, propage
    l'exception ; le prochain run reprend depuis l'étape qui avait
    échoué.
  - **Progression** : `onProgress(step, index, total, substep?)`.
  - `needsInitialSync(database)` — utilisé pour gater le flow.
- Hooks observables (`src/features/catalog/hooks.ts`) :
  `useProcedures()`, `useProductsByType(type)`, `useCultivableZones()`,
  `useVariants()`, `useInterventions(filter?)`,
  `usePendingInterventionCount()`, `useSyncState()`. Tous basés
  sur les observables WDB (subscribe au montage, unsubscribe au
  démontage).
- Écran InitialSync (`app/(auth)/initial-sync.tsx`) — barre de
  progression, sous-step pour les types de produits, retry après
  erreur. Court-circuit si `needsInitialSync` retourne false.
- Routage mis à jour : `app/index.tsx` redirige les authentifiés
  vers `/(auth)/initial-sync` (qui décide ensuite). `login.tsx`
  redirige aussi vers initial-sync après succès.
- Locales étendues (`initialSync.*` : steps en FR, sous-step,
  erreurs).
- Tests Jest : 6 fichiers, ~28 cas
  - 5 tests mappers (procedure, product, variant, cultivable-zone,
    intervention) : edge cases (champs manquants, dates invalides,
    fallbacks).
  - 1 test orchestration `runInitialSync` : ordre des étapes,
    reprise depuis cultivable_zones / done / step invalide,
    propagation d'erreur, marquage sync_state, sub-progression
    products. Persisters mockés (testés en P5+ avec un adapter
    LokiJS).
- `jest.config.js` — `@nozbe/watermelondb` ajouté au
  `transformIgnorePatterns` pour les tests futurs.

**Action requise après cette phase** :

- ⚠️ **Rebuild EAS dev client obligatoire**. Première dépendance
  native (JSI) ajoutée au projet : Expo Go ne marchera pas et un
  ancien dev build (P1/P2) plantera au démarrage. Lancer
  `pnpm build:dev:ios` et/ou `pnpm build:dev:android` avant le
  premier `pnpm start`.

**Points de vigilance** :

- Le diff client-side (full-fetch + comparaison) tient sous
  l'hypothèse « petite ferme » (< 1k produits, < 500 parcelles).
  À instrumenter en pilote pour détecter un dépassement (cf.
  question ouverte §11.3 de l'architecture).
- Pas encore de pull / push d'interventions : ces flux arrivent
  en P6 (sync engine).
- Pas de bouton "Resync" en UI : on s'appuie sur l'auto-relance
  via initial-sync à chaque login. La sync incrémentale en cycle
  est l'objet de P6.

## P2 — Auth + API client

**Fait** :

- Couche API (`src/core/api/`) :
  - `client.ts` — `EkylibreApiClient` singleton avec `login` (POST
    `/api/v2/tokens`), `logout` (DELETE `/api/v2/tokens/{token}`,
    best-effort), `request<T>` générique avec injection auto du
    header `Authorization: simple-token <email> <token>`, gestion
    centralisée du 401 via `setUnauthorizedHandler`.
  - `errors.ts` — hiérarchie typée `NetworkError`, `ApiError`,
    `AuthError` (subclass de `ApiError` à status 401).
  - `types.ts` — `Credentials`, `TokenResponse`. Étendu en P3.
- Stockage sécurisé (`src/core/auth/secure-storage.ts`) — wrapper
  `expo-secure-store` avec parsing défensif (JSON corrompu ou shape
  incomplet → `null`). Clé unique `eky.auth` qui contient
  `{ instanceUrl, email, token }`.
- `src/core/auth/login-schema.ts` — schéma Zod validant URL https,
  email, mot de passe ; messages = clés i18n.
- `src/core/auth/AuthContext.tsx` — provider + hook `useAuth()`,
  états `loading | authenticated | unauthenticated`. Hydratation
  au montage, login/logout, câblage du handler 401 qui force le
  retour à `unauthenticated` avec `reason: 'session-expired'`.
- Écrans :
  - `app/(auth)/login.tsx` — formulaire RHF + zodResolver, gestion
    explicite des erreurs `AuthError` / `NetworkError` /
    `ApiError`, bandeau "session expirée" si l'utilisateur revient
    sur Login après un 401.
  - `app/(tabs)/settings.tsx` — affiche email connecté + URL
    d'instance + version, bouton "Déconnexion" avec `Alert` de
    confirmation. (L'avertissement "interventions non-syncées
    seront perdues" sera ajouté en P6.)
  - `app/index.tsx` — redirige selon `state.status`
    (`loading` → splash, `authenticated` → tabs, sinon login).
  - `app/_layout.tsx` — `AuthProvider` au-dessus du `Stack`,
    splash hidé seulement après hydratation.
- Tests Jest : 4 fichiers, ~28 cas
  - `client.test.ts` : login OK/401/403/500/network/payload
    invalide ; `request` injecte le bon header, déclenche le
    handler 401, refuse sans credentials ; logout DELETE bien
    formé + best-effort sur erreur.
  - `secure-storage.test.ts` : round-trip, JSON corrompu, shape
    incomplet, clear.
  - `login-schema.test.ts` : URL vide / sans schéma / http /
    email vide / mal formé / mot de passe vide ; trim sur
    espaces.
  - `AuthContext.test.tsx` : transitions loading → unauth /
    authenticated, hydratation, login OK/échec, logout, 401 →
    unauthenticated + reason.
- Locales étendues (`locales/fr/common.json`) : login (titre,
  champs, erreurs, bouton, bannière session expirée), settings
  (compte, déconnexion + confirmation).
- Dépendances ajoutées : `react-hook-form`, `@hookform/resolvers`,
  `zod`, `@testing-library/react-native`, `@testing-library/jest-native`,
  `react-test-renderer`.

**Points de vigilance** :

- Le bouton Déconnexion **ne tient pas encore compte** des
  interventions non-syncées (table interventions arrivera en P3).
  À enrichir en P6 avec l'avertissement de perte de données.
- Le handler 401 est volontairement **silencieux côté UI** au
  moment où il déclenche (pas d'alerte). L'utilisateur voit le
  bandeau "session expirée" sur le LoginScreen une fois redirigé.
- Sentry capture le 401 en `warning` mais l'email est filtré par
  `beforeSend` (cf. `src/core/observability/sentry.ts`).

## P1 — Bootstrap projet

**Fait** :

- Configuration racine : `package.json` (Expo SDK 54), `tsconfig.json`
  (strict + noUncheckedIndexedAccess), `app.json`, `eas.json`
  (3 profils : development / preview / pilot), `babel.config.js`,
  `metro.config.js` (Sentry source maps).
- `.npmrc` (`node-linker=hoisted` requis pour pnpm + RN), `.nvmrc`
  (Node 20), `.env.example`, `.gitignore` complet (ios/, android/,
  secrets, .env).
- Chaîne qualité : ESLint flat config (eslint-config-expo + Prettier),
  Prettier, lint-staged, Husky pre-commit (lint-staged + typecheck),
  Jest (preset jest-expo) avec moduleNameMapper pour les alias.
- Squelette Expo Router : `app/_layout.tsx` (root + Sentry wrap +
  i18n init + GestureHandlerRootView), `app/index.tsx` (redirector
  vers login), `app/(auth)/{_layout, login, initial-sync}.tsx`,
  `app/(tabs)/_layout.tsx` (3 tabs : interventions, map, settings),
  `app/(tabs)/interventions/{_layout, index, new, [id]}.tsx`,
  `app/(tabs)/{map, settings}.tsx`. Tous les écrans sont des
  placeholders i18n-ready.
- Modules core : `src/core/i18n/index.ts` (i18next + expo-localization,
  FR + fallback FR), `src/core/observability/sentry.ts` (init avec
  filtre PII sur l'email).
- Locales : `locales/fr/common.json` avec toutes les clés des
  placeholders P1.
- Path aliases TS configurés : `@core/*`, `@features/*`, `@domain/*`,
  `@ui/*`, `@/*`. Mappage parallèle dans Jest.
- CI GitHub Actions : workflow `quality` (lint + format check +
  typecheck + test:ci) et `doctor` (expo-doctor) sur PR/push main.
- Documentation : `CLAUDE.md` (commandes, conventions, points de
  vigilance ADR-03 et ADR-13), ce CHANGELOG, README mis à jour avec
  statut et pointeurs vers `docs/`.

**À retenir / pièges** :

- Expo Go _non supporté_ — uniquement Expo Dev Client (à cause de
  WatermelonDB en P3).
- Plusieurs `PLACEHOLDER-*` dans `app.json` et `eas.json` à remplacer
  après `eas init` et après récupération des IDs Apple/Google
  (cf. `docs/P0-checklist.md`).
- Le DSN Sentry est placeholder ; en dev sans DSN réel, Sentry est
  désactivé (cf. `src/core/observability/sentry.ts`).

## P0 — Préreq externes

**Fait** :

- Rédaction de `docs/P0-checklist.md` listant toutes les actions
  humaines/admin (comptes Apple Developer, Google Play, Expo, Sentry,
  instance Ekylibre de test, fournisseur de tuiles), les secrets
  attendus en retour, et l'ordre d'exécution recommandé.

**À faire (humain)** :

- Cocher les items de la checklist au fil de leur exécution. Les
  items « DSN Sentry » et « EAS Project ID » sont les plus tôt requis
  (avant la première CI verte sur main).
