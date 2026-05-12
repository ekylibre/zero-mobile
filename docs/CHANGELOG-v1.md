# Changelog v1

Entrées par phase du workflow (`docs/workflow.md`). Format inspiré de
[Keep a Changelog](https://keepachangelog.com/) — entrées humaines,
non-générées.

## [Unreleased]

### En cours

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
