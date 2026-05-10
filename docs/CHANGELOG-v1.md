# Changelog v1

Entrées par phase du workflow (`docs/workflow.md`). Format inspiré de
[Keep a Changelog](https://keepachangelog.com/) — entrées humaines,
non-générées.

## [Unreleased]

### En cours

- P5 — Formulaire spraying (à venir)

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
