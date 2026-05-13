# Project Index : zero-mobile

> Index machine-friendly du repo. Pour la prose : `README.md`,
> `CLAUDE.md`, `docs/`. Pour l'historique de livraison : `docs/CHANGELOG-v1.md`.
> Statut : **fin de P6 (sync engine)**. P7 (carte des parcelles) à venir.

## Contexte

App mobile React Native (Expo SDK 54) pour Ekylibre. Capture une
intervention `spraying` hors-ligne, sync vers `/api/v2/interventions`.
Remplace `zero-android-v3` (Java) et `zero-kotlin`. v1 = procédure unique.

## Project Structure

```
zero-mobile/
├── app/                       # Expo Router (file-based routing)
│   ├── _layout.tsx           # AuthProvider + Sentry + i18n
│   ├── index.tsx             # Redirector (loading → tabs | login)
│   ├── (auth)/               # Login + initial-sync
│   └── (tabs)/               # Bottom tabs : interventions, map, settings
│       └── interventions/    # index, new, spraying, [id], _layout
├── src/
│   ├── core/                 # Cross-cutting infra
│   │   ├── api/              # Ekylibre v2 client + DTO Zod + errors
│   │   ├── auth/             # AuthContext + secure-storage + login schema
│   │   ├── crypto/           # UUID wrapper (expo-crypto)
│   │   ├── db/               # WatermelonDB schema + 11 modèles + migrations
│   │   ├── i18n/             # i18next + expo-localization
│   │   ├── observability/    # Sentry init
│   │   └── sync/             # Push engine + pull cycle + Zustand store (P6)
│   ├── domain/               # Pure TS : Zod schemas + DTO mappers
│   │   ├── mappers/          # DTO ↔ row WDB
│   │   └── procedures/       # spraying.ts (Zod du formulaire)
│   ├── features/             # Modules métier
│   │   ├── catalog/          # hooks WDB + persisters + initial-sync
│   │   └── intervention/     # views + persister + InputsFieldArray
│   └── ui/                   # Composants réutilisables (DateTimeField,
│                             #   SelectField, SyncBadge, EmptyState,
│                             #   InterventionListItem)
├── locales/fr/common.json    # FR seul ship en v1
└── docs/                     # Brainstorm, architecture, workflow, P0
```

## Entry Points

- **App root** : `app/_layout.tsx` — Stack racine, AuthProvider, Sentry
- **Splash redirector** : `app/index.tsx` — route selon `state.status`
- **Auth flow** : `app/(auth)/login.tsx` → `app/(auth)/initial-sync.tsx`
- **Main flow** : `app/(tabs)/interventions/index.tsx` (liste + sync)
- **API client singleton** : `src/core/api/client.ts` (`apiClient`)
- **WDB singleton** : `src/core/db/database.ts` (`database`)
- **Sync entry** : `src/core/sync/use-sync-cycle.ts` (`useSyncCycle()`)

## Core Modules

### `src/core/api`

- `client.ts` — `EkylibreApiClient` : login, logout, list\*, createIntervention, updateIntervention. Singleton `apiClient`.
- `dtos/` — Zod DTO : `procedure`, `product`, `variant`, `cultivable-zone`, `intervention`. `.passthrough()` partout.
- `errors.ts` — `NetworkError`, `ApiError`, `AuthError(401)`, `ValidationError(412/422 + errors[])`.
- `types.ts` — `Credentials`, `TokenResponse`, `ProviderTag`, `CreateInterventionPayload`, `UpdateInterventionPayload`, `*Attribute`.

### `src/core/auth`

- `AuthContext.tsx` — provider + `useAuth()` (`loading | authenticated | unauthenticated`).
- `secure-storage.ts` — wrapper `expo-secure-store` (clé `eky.auth`).
- `login-schema.ts` — Zod URL https + email + password.

### `src/core/crypto`

- `uuid.ts` — `generateClientUuid()` wrappe `Crypto.randomUUID()`.

### `src/core/db`

- `schema.ts` — WDB v1, 11 tables. Constantes `Tables.*`.
- `database.ts` — singleton WDB (adapter SQLite + JSI).
- `provider.tsx` — `DatabaseProvider` (rarement utilisé, hooks importent `database` direct).
- `migrations.ts` — vide en v1 (convention).
- `models/` — 11 modèles décorés (`@field`, `@date`, `@json`, `@relation`, `@children`, `@immutableRelation`).

### `src/core/sync` (P6)

- `payload-builder.ts` — `buildCreateInterventionPayload(data, lookups, provider)`. `MissingServerIdError` si ref locale orpheline.
- `provider-tag.ts` — `buildProviderTag(uuid, deviceInfo)` + `getDeviceInfo()`.
- `push-engine.ts` — `runPushCyclePure(deps)` (testable) + `runPushCycle({ database, api, buildProvider })` (wrapper WDB).
- `sync-cycle.ts` — `runSyncCycle(...)` orchestrateur pull → push (pull failure ≠ stop).
- `store.ts` — Zustand `useSyncStore` (`status`, `lastError`, `lastSyncAt`).
- `use-sync-cycle.ts` — hook `useSyncCycle()` avec lock anti-réentrance.

### `src/domain`

- `mappers/` — DTO → row pour les 5 catalogues. Pures, testables.
- `procedures/spraying.ts` — `sprayingInterventionSchema` Zod (FR messages en dur).

### `src/features/catalog`

- `hooks.ts` — observables WDB : `useProcedures`, `useProductsByType`, `useCultivableZones`, `useVariants`, `useInterventions`, `usePendingInterventionCount`, `useErrorInterventionCount`, `useSyncState`, `useInterventionById`, `useProcedureByName`.
- `persisters.ts` — upsert idempotent + delete-extras par table (1 transaction WDB par persister).
- `initial-sync.ts` — `runInitialSync({ api, database }, { onProgress? })`. Idempotent et resumable via `sync_state.current_step`.

### `src/features/intervention`

- `persister.ts` — `persistSprayingIntervention(database, input, opts?)`. 1 `database.write` + 1 `database.batch`.
- `ProcedurePickerView.tsx` — vue pure, filtre `SUPPORTED_PROCEDURES`.
- `SprayingFormView.tsx` — RHF + zodResolver + Controller (dates, target, doer, inputs, tool, notes).
- `InputsFieldArray.tsx` — éditeur multi-lignes contrôlé. `SPRAYING_HANDLERS` fixe en v1.
- `InterventionsListView.tsx` — header sync + 3 bandeaux + FlatList + FAB.

### `src/ui`

- `DateTimeField.tsx` — natif `@react-native-community/datetimepicker` (Android = date→time chaîné).
- `SelectField.tsx` — générique `<T>` avec Modal + recherche filtrée.
- `SyncBadge.tsx` — pastille colorée des 4 sync_state.
- `EmptyState.tsx` — title + subtitle + action.
- `InterventionListItem.tsx` — ligne procédure + date + badge.

## Configuration

| Fichier             | Rôle                                                              |
| ------------------- | ----------------------------------------------------------------- |
| `package.json`      | Deps + scripts. Node ≥22.13, pnpm 10.                             |
| `app.json`          | Expo config + plugins (WatermelonDB). PLACEHOLDER-\* à remplacer. |
| `eas.json`          | 3 profils : development / preview / pilot.                        |
| `tsconfig.json`     | strict + noUncheckedIndexedAccess + path aliases (@core/\* etc.). |
| `babel.config.js`   | preset-expo + decorators legacy (WDB) + worklets plugin.          |
| `metro.config.js`   | Sentry source maps.                                               |
| `jest.config.js`    | preset jest-expo + alias + transformIgnorePatterns.               |
| `eslint.config.mjs` | flat config (eslint-config-expo + Prettier).                      |
| `.npmrc`            | `node-linker=hoisted` (pnpm + RN).                                |
| `.nvmrc`            | Node 24.                                                          |

## Documentation

| Doc                               | Sujet                                                    |
| --------------------------------- | -------------------------------------------------------- |
| `README.md`                       | Statut + démarrage rapide                                |
| `CLAUDE.md`                       | Conventions + pièges + sync model + form patterns        |
| `docs/brainstorm-requirements.md` | Vision et périmètre v1                                   |
| `docs/architecture.md`            | 13 ADRs, sync engine, schéma WDB, §11 questions ouvertes |
| `docs/workflow.md`                | Plan phasé P0 → P8                                       |
| `docs/P0-checklist.md`            | Préreq externes (comptes, secrets)                       |
| `docs/CHANGELOG-v1.md`            | Journal de livraison phase par phase                     |

## Test Coverage

- **23 fichiers de tests**, **199 tests** passent (`pnpm test`).
- Couvre : domain (mappers + Zod), API client, auth, sync (payload/push/cycle/store/hook), persisters, vues UI.
- **Jamais testé en intégration WDB** : persisters (catalog + intervention), push wrapper. Logique testée via mocks ; intégration validée manuellement + démo device.
- Pas de E2E (workflow §10.1, à attaquer dès qu'un device CI est dispo).

## Key Dependencies

| Dep                                     | Version           | Rôle                            |
| --------------------------------------- | ----------------- | ------------------------------- |
| expo                                    | ~55.0.0           | SDK                             |
| expo-router                             | ~55.0.0           | File-based routing              |
| @nozbe/watermelondb                     | ^0.28.0           | DB locale (JSI, native)         |
| @morrowdigital/watermelondb-expo-plugin | ^2.3.3            | Plugin Expo pour WDB            |
| @sentry/react-native                    | ^7.11.0           | Crash reporting                 |
| react-hook-form + @hookform/resolvers   | ^7.54.0 / ^3.9.0  | Formulaires                     |
| zod                                     | ^3.23.0           | Validation domaine + DTO        |
| zustand                                 | ^5.0.0            | État éphémère sync              |
| i18next + react-i18next                 | ^24.0.0 / ^15.0.0 | i18n FR (CLDR plurals)          |
| expo-secure-store                       | ~55.0.0           | Keychain/Keystore (auth tokens) |
| expo-crypto                             | ^55.0.14          | UUID v4 (P5, native)            |
| @react-native-community/datetimepicker  | ^9.1.0            | Pickers natifs (P5, native)     |
| react-native-safe-area-context          | ~5.6.2            | SafeAreaView (RN-côté déprécié) |

## Quick Start

```bash
nvm use                  # Node 24
pnpm install
pnpm doctor              # expo-doctor — cohérence Expo SDK
pnpm build:dev:android   # ou build:dev:ios — premier dev client (rebuild requis depuis P3 + P5)
pnpm start               # Metro dev client
```

Tests/qualité :

```bash
pnpm test                # 199 tests
pnpm typecheck
pnpm lint
```

Build pilote :

```bash
pnpm build:pilot         # iOS + Android
pnpm submit:pilot        # TestFlight + Play Internal Testing
```

## ADRs critiques (cf. arch §0)

- **ADR-03** : pull catalogue via `synchronize()` ; push interventions via boucle dédiée (per-intervention error states).
- **ADR-13** : `client_uuid` (UUIDv4) figé à la création, envoyé en `provider.id` au POST. Idempotence côté serveur **non vérifiée** (cf. arch §11.1, à confirmer en bac à sable avant pilote).

## Risques / dette technique

- **Idempotence Ekylibre** : à confirmer bac à sable avant pilote. Lock anti-réentrance UI ne couvre pas le cas « ack perdu sur réseau flaky ».
- **Hypothèse petite ferme** : full fetch + diff client-side OK pour < 1k produits / 500 parcelles. À mesurer en pilote.
- **Champ `actions: []`** envoyé tel quel — non documenté côté Ekylibre v2.
- **Format 422** : on supporte 2 formes (`errors: []` / `errors: { field: [] }`) ; vérifier sur premiers 422 pilote.
- **E2E manquant** (workflow §10.1).
- **Démo device pilote manquante** sur instance Ekylibre de test.

## Phases livrées

| Phase                                   | Statut                 |
| --------------------------------------- | ---------------------- |
| P0 — Préreq externes                    | ✅ (checklist humaine) |
| P1 — Bootstrap projet                   | ✅                     |
| P2 — Auth + API client                  | ✅                     |
| P3 — DB locale + catalogue              | ✅                     |
| P4 — Liste & détail intervention        | ✅                     |
| P5 — Formulaire spraying (P5.1 → P5.3b) | ✅                     |
| P6 — Sync engine (P6.1 → P6.4)          | ✅                     |
| P7 — Carte des parcelles                | ⏳                     |
| P8 — Polish + pilote                    | ⏳                     |
