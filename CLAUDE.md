# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

**zero-mobile** is the new React Native mobile app for Ekylibre,
replacing the legacy `zero-android-v3` (Java) and `zero-kotlin`
(Kotlin native) apps. v1 scope is intentionally narrow: capture a
single procedure (spraying) offline and sync it back to Ekylibre via
the REST API v2.

Read first, in order:

1. `docs/brainstorm-requirements.md` — what we're building and why
2. `docs/architecture.md` — how it's wired (13 ADRs, sync engine, schema)
3. `docs/workflow.md` — phased delivery plan (P0 → P8)
4. `docs/P0-checklist.md` — external prerequisites (accounts, DSNs)

The repo sits **past P6 (sync engine)** with a post-P6 increment on
top: spraying-form redesign, cultures-as-targets, intervention edit,
in-app sync-error messages, and procedure icons (see "Where work
currently stops"). **P7 (parcels map) is the next phase.**

## Stack & non-obvious choices

- **Expo SDK 54** + **Expo Router v6** (file-based routing under `app/`).
- **Expo Development Build only** — Expo Go is _not_ supported because
  WatermelonDB (added in P3) requires native code (JSI). Always use
  `expo start --dev-client` and a build produced by EAS.
- **pnpm** (not npm/yarn). `.npmrc` sets `node-linker=hoisted` because
  RN/Metro doesn't tolerate pnpm's strict symlink layout.
- **Node 24 (locked by `.nvmrc`)**. pnpm 10 requires Node ≥22.13;
  we standardise on Node 24 (the current/active LTS). Older versions
  break both pnpm 10 and Expo CLI.
- **TypeScript strict** (`strict: true`, `noUncheckedIndexedAccess: true`).
  Path aliases: `@core/*`, `@features/*`, `@domain/*`, `@ui/*`, `@/*`.
- **WatermelonDB sync engine** is split: catalogue via
  `synchronize().pullChanges`, intervention push via a custom loop
  (ADR-03 — `synchronize().pushChanges` is all-or-nothing, incompatible
  with per-intervention error states). Don't try to "simplify" this back
  to pure synchronize() — read ADR-03 first.
- **Idempotence by `client_uuid`** sent in `provider.id` on every POST
  to `/api/v2/interventions` (ADR-13). Never POST without provider.
- **i18n from day 1** — no hardcoded UI strings. Add keys to
  `locales/fr/common.json`, use `useTranslation()`.

## Common commands

| Command                             | Purpose                                                               |
| ----------------------------------- | --------------------------------------------------------------------- |
| `pnpm install`                      | Install deps (after Node 20 + pnpm 9 are set up)                      |
| `pnpm start`                        | Start Metro for the dev client                                        |
| `pnpm ios` / `pnpm android`         | Run on a connected device/simulator                                   |
| `pnpm lint` / `pnpm lint:fix`       | ESLint (flat config in `eslint.config.mjs`)                           |
| `pnpm format` / `pnpm format:check` | Prettier                                                              |
| `pnpm typecheck`                    | `tsc --noEmit`                                                        |
| `pnpm test`                         | Jest unit tests                                                       |
| `pnpm test:watch`                   | Jest in watch mode                                                    |
| `pnpm test:ci`                      | Jest with coverage (used in CI)                                       |
| `pnpm doctor`                       | `expo-doctor` — run after dep changes                                 |
| `pnpm prebuild`                     | Regenerate `ios/` and `android/` (mostly used by EAS, rarely locally) |
| `pnpm build:dev:ios`                | EAS dev build for iOS simulator                                       |
| `pnpm build:dev:android`            | EAS dev build for Android emulator (apk)                              |
| `pnpm build:pilot`                  | EAS pilot build for iOS + Android (store distribution)                |
| `pnpm submit:pilot`                 | Submit pilot build to TestFlight + Play Console Internal Testing      |

Single test: `pnpm test path/to/file.test.ts` or `pnpm test --testNamePattern "name"`.

## Project layout

```
app/                          # Expo Router file-based routes
  (auth)/                     # Login + initial sync (auth flow)
  (tabs)/                     # Bottom tabs: interventions, map, settings
src/
  core/                       # Cross-cutting infra
    api/                      # Ekylibre v2 client (P2+)
    auth/                     # Auth context + secure storage (P2)
    db/                       # WatermelonDB schema, models, migrations (P3)
    sync/                     # Sync engine (P6)
    i18n/                     # i18next setup
    observability/            # Sentry wrapper
  features/                   # Use-case modules (intervention, catalog, map)
  domain/                     # Pure TS domain types, Zod validators
  ui/                         # Shared/reusable UI components
locales/fr/common.json        # i18n strings (FR — only locale shipped in v1)
docs/                         # Brainstorm, architecture, workflow, P0 checklist
```

## EAS / release notes

- `eas.json` defines three profiles:
  - `development` — internal distribution, dev client, channel `dev`.
  - `preview` — internal distribution, no dev client, channel `dev`.
  - `pilot` — store distribution (TestFlight + Internal Testing), channel `pilot`.
- Channel `pilot` is what runtime production updates target via
  Expo Updates. Don't push OTA directly to production; the v1 acceptance
  is "build distributed to pilot panel", not "store live".
- `app.json` contains `PLACEHOLDER-EAS-PROJECT-ID` and
  `PLACEHOLDER-EXPO-ORG-SLUG` — these are replaced after `eas init`.
- Sentry DSN is also a placeholder until injected via EAS env vars
  (`SENTRY_DSN`); cf. `docs/P0-checklist.md`.

## Sync model — read before touching `src/core/sync`

The architecture (`docs/architecture.md` §6) splits sync into two halves.
P6 deviates from the original design on the pull side (we reuse
`runInitialSync` instead of writing a `synchronize()` adapter) — the
push side follows ADR-03 verbatim.

- **Pull catalogue** reuses `runInitialSync(api, database)` from
  `src/features/catalog/initial-sync.ts`. The function is idempotent
  and resumable, so calling it on every Sync tap is safe. Each table
  does a full fetch + client-side diff (acceptable while farms stay
  below ~500 parcels / ~1k products — open question #4 in
  architecture.md §11).
- **Push interventions** is a dedicated loop in
  `src/core/sync/push-engine.ts`, iterating over
  `interventions WHERE sync_state IN (pending, error, syncing)`. Each
  intervention is POSTed (or PUT-ed if `server_id` is set) with its
  `client_uuid` echoed in `provider.id`. Per-intervention success marks
  the row `synced`; 4xx marks `error` with the server message;
  5xx/network bumps `sync_attempt_count` and leaves it `pending` for the
  next cycle. AuthError propagates so AuthContext can purge the session.
- **Orchestration** is `runSyncCycle({ database, api, buildProvider,
onPhase? })` in `src/core/sync/sync-cycle.ts`. Pull → push, in that
  order. **Pull failure does not block push** (lookups come from local
  WDB, robust to a stale catalogue).
- **UI entry point** is the `useSyncCycle()` hook in
  `src/core/sync/use-sync-cycle.ts`. The hook owns the anti-réentrance
  lock (a 2nd `startSync` while one is running returns `null`).
  Triggered by the "Synchroniser" button + pull-to-refresh on the
  interventions list, and by "Réessayer" on the detail screen.

If you find yourself routing `pushChanges` through `synchronize()`,
re-read ADR-03 first. If you find yourself reimplementing the catalogue
diff outside `runInitialSync`, ask first — the current reuse is a
conscious choice (P6 entry in CHANGELOG).

## When you change deps

- Run `pnpm doctor` (= `expo-doctor`) — it catches Expo SDK
  incompatibilities that `pnpm install` happily ignores.
- If you bump Expo SDK, follow the official migration guide; don't
  hand-edit version numbers across `expo*` packages.
- Adding a native dep (e.g. WatermelonDB in P3, `expo-crypto` and
  `@react-native-community/datetimepicker` in P5, `react-native-svg`
  for parcel shapes, MapLibre in P7) requires a new EAS dev build
  before `pnpm start` works on device.

## Auth — quick reference (P2)

- Single API entrypoint: `apiClient` singleton in
  `src/core/api/client.ts`. Tests instantiate their own
  `EkylibreApiClient(fetchMock)` — never override the singleton.
- Credentials live in **one** Keychain/Keystore key (`eky.auth`)
  via `expo-secure-store` — single read/write at boot, not
  per-request.
- `useAuth()` exposes `state` (`loading | authenticated | unauthenticated`),
  `login(url, email, password)` and `logout()`. Anything outside
  `<AuthProvider>` throws.
- 401 from any authenticated request triggers the handler set by
  `AuthProvider`: clear storage, set state `unauthenticated` with
  `reason: 'session-expired'`. The Login screen shows a banner
  when that reason is set.
- `AuthError` (subclass of `ApiError`) is what `client.login()`
  throws on 401/403 — distinct from a generic 5xx (`ApiError`)
  and from connectivity loss (`NetworkError`). UI maps each one
  to a distinct user-facing message.

## DB & catalogue — quick reference (P3)

- Single WDB singleton in `src/core/db/database.ts`. Custom hooks
  in `src/features/catalog/hooks.ts` import it directly — they
  don't go through `useDatabase()`. Wrap with `<DatabaseProvider>`
  only if you start using third-party WDB react helpers.
- Schema constants live in `src/core/db/schema.ts` (`Tables.foo` —
  use these, never the raw table-name string).
- Models are in `src/core/db/models/` with `static associations`
  on each side of every relation (required by WDB for `@children`
  and `@relation` to work).
- Decorators require Babel `@babel/plugin-proposal-decorators`
  (legacy mode) and `experimentalDecorators: true` in tsconfig —
  both already wired. Don't try to use stage-3 decorators; WDB
  only supports legacy.
- Persisters (`src/features/catalog/persisters.ts`) implement
  upsert + delete-extras per table. They do `database.batch(...)`
  inside a single `database.write(...)` — keep this invariant when
  adding new persisters.
- `runInitialSync()` is **idempotent and resumable**. Don't add
  state outside `sync_state` — the resume model relies on
  `current_step` being the only progress marker.
- **Schema is v4** (2026-06-14): bump `version` in `schema.ts` **and**
  add a `{ toVersion, steps }` entry in `src/core/db/migrations.ts`
  for every schema change (v2 added `dead_at` + `shape_svg`; v3 added
  `kind` — both on `cultivable_zones`; v4 added `abilities_json` on
  `products`). ⚠️ **Bumping `version` without the matching migration
  entry passes `tsc` + Jest but crashes on a real device** at boot
  (`Missing migration. Database schema is currently at version N, but
migrations only cover range from 1 to N-1`) — neither typecheck nor
  unit tests mount a migrated SQLite DB. The two files must move
  together. (`schemaMigrations` sorts entries by `toVersion` internally
  and only requires the covered range to be contiguous and gap-free —
  declaration order doesn't matter.)
- **`cultivable_zones` is the unified "targetable" table** (parcelles +
  cultures), fed from **two** product endpoints, not
  `/api/v2/cultivable_zones`:
  - `client.listCultivableZones()` → `products?product_type=land_parcels`
    (persisted with `kind='land_parcel'`).
  - `client.listPlants()` → `products?product_type=plants` (plural →
    `Plant` server-side; persisted with `kind='plant'`). Plant and
    LandParcel are both `Product`, serialized identically → same DTO
    (`cultivableZoneListSchema`) and mapper.
    Rows carry the full production `name`
    ("Bernessard Blé tendre d'hiver 2026"), `deadAt`, `shapeSvg`,
    `areaHectares` (parsed from a fractional `net_surface_area`), `kind`.
- **`persistCultivableZones(db, rows, kind)` scopes delete-extras BY
  kind** (`Q.or(kind='land_parcel', kind=null)` for parcelles — the
  `null` includes pre-v3 migrated rows; `Q.where(kind='plant')` for
  cultures) so persisting one type never deletes the other. `kind` is
  injected by the persister, not the mapper.
- **No shape filtering at ingestion** (`spraying.xml` requires `has
indicator shape`): we ingest all targetables and rely on the
  server's 403 message (already displayed) if a shape-less target is
  POSTed. Revisit in P7 if shape-less cultures pollute the picker.
- The target picker (`useCultivableZones`) returns **both kinds**,
  filtered `dead_at IS NULL OR dead_at ≥ today − 1y`, sorted by name;
  the `MultiSelectField` subtitle shows the kind ("Parcelle" /
  "Culture") + area (`targetSubtitle`). Resolve names in the detail
  view via `useCultivableZonesAll` / `useProductsAll` (unfiltered, by
  local id).

## Native rebuild gate

After P3, the dev client is no longer compatible with previous
P1/P2 builds: WatermelonDB adds native code via JSI. Always run
`pnpm build:dev:ios` / `pnpm build:dev:android` after pulling
changes that touch deps or `app.json` plugins.

**`react-native-svg` (added 2026-05-30)** is a native module too — a
plain Metro reload is **not** enough, the dev client must be rebuilt
or `<Svg>`/`ParcelShape` renders blank (symptom seen: parcel name
shows, drawing area stays white). Under Fabric a missing native
component fails silently (no crash). Note: rendering parcel shapes
uses an explicit `<Svg><Path fill stroke>` (`src/ui/ParcelShape.tsx`),
not `SvgXml` — `SvgXml` rendered blank (fill not reliably applied).

## UI layering (P4)

- **Reusable UI primitives** in `src/ui/` (badges, empty states,
  list items, `DateTimeField`, generic `SelectField<T>`). No
  router/DB dependency — these are pure components.
- **Feature views** (`src/features/<feature>/<View>.tsx`) take data
  as props. Connect via hooks in the route file
  (`app/(tabs)/<feature>/<route>.tsx`). This split keeps tests
  hook-free.
- **Date formatting** uses `Intl.DateTimeFormat(i18n.language)` —
  no date-fns/moment. Pluralisation via i18next CLDR rules
  (`*_one` / `*_other` keys).
- **Pull-to-refresh** in the interventions list is a placeholder
  (400 ms timeout) until P6 wires the real sync engine. Don't add
  fake success messages — the user must learn that sync is coming.

## Form patterns — quick reference (P5)

- **RHF + zodResolver** — every form (login, spraying) wires Zod via
  `@hookform/resolvers/zod`. Domain Zod schemas live under
  `src/domain/` with FR error messages **in the schema** (the domain
  layer doesn't have access to i18next, and v1 only ships FR).
- **`Controller` for non-input fields** — `DateTimeField`,
  `SelectField`, and `InputsFieldArray` are integrated via
  `Controller`, not `register()`, because they're controlled
  components with custom value/onChange shape.
- **Single-element arrays** (`doers`, `tools`) are stored as length-0
  or length-1 arrays in form state. The view derives the selected item
  via `find(id)` and `onChange` wraps the item in
  `[{ ..., reference_name: '...' }]`. This keeps the Zod schema
  uniform (always an array) and the persister code simple.
  **`targets` is multi** (multi-cibles) — same array shape, edited via
  `MultiSelectField` (`reference_name: 'cultivation'`).
- **`InputsFieldArray`** is a controlled list editor (no
  `useFieldArray`) — value/onChange propagate from the parent's
  `Controller`. Add/remove rows mutate the array via
  `onChange([...value, newRow])`. Quantity input parses both `,` and
  `.` as decimal separator (FR UX), falls back to 0 on invalid input.
- **Quantity handlers** are a fixed v1 set in
  `src/features/intervention/InputsFieldArray.tsx`
  (`SPRAYING_HANDLERS`). Per-product handler filtering depends on
  procedure XML definitions and lands in P-v1.5+.
- **Handler pre-fill from product** (2026-06-14) — selecting an intrant
  product auto-sets `quantity_handler` + `quantity_unit` from the
  product's default variant unit (`Product.variantId` → `Variant.unit`
  → `*_area_density` handler via `deriveHandlerFromBaseUnit` in
  `spraying-handlers.ts`). Map `productDefaultUnits: Map<productId,
baseUnit>` built in the route, passed through `SprayingFormView` to
  `InputsFieldArray`. **Override is systematic** at every product change
  (no "touched" flag — UX spec: handler should always reflect current
  product). User can still override the handler manually after.
- **Unit display in FR short form** (2026-06-14) — read-only unit text
  under the Mesure picker shows `l/ha`, `kg/ha`… via i18n
  `interventions.spraying.units.*`. The **stored** `quantity_unit` is
  always the Ekylibre canonical form (`liter_per_hectare`) — only the
  display is translated. Fallback to raw value if the i18n key is
  missing.
- **Persistence path** — view collects validated data → route handler
  calls `persistSprayingIntervention(database, input)` → 1
  `database.write` + 1 `database.batch(...)` writes intervention +
  all relations atomically. `client_uuid` is generated **once** at
  creation via `expo-crypto.randomUUID()` and never regenerated (cf.
  ADR-13).
- **Edit path** — `SprayingFormView` takes `initialValues?` (prefills
  RHF `defaultValues`, figé at mount → the edit route remounts via a
  distinct `key`). Route `spraying?id=` calls
  `updateSprayingIntervention(database, id, input)`: 1 `write` + 1
  `batch` that `prepareUpdate`s the intervention (keeps `clientUuid` /
  `serverId`, resets `sync_state='pending'`, clears error/attempt
  count), deletes all children (`INTERVENTION_CHILD_TABLES`) and
  recreates them. Edit is gated on `pending`/`error` (UI hides the
  action otherwise).
- **Stateful test harness** — when testing a controlled component,
  wrap it in a `useState`-backed `Harness` and expose the captured
  value via `Object.assign(utils, { captured })`. **Avoid**
  `{ ...utils, get value() {...} }` — object literal spread captures
  the getter's value at construction time and breaks reactivity on a
  closure-mutated ref.
- **Native picker deps** — `@react-native-community/datetimepicker`
  needs an EAS dev rebuild. iOS gets the inline overlay; Android
  doesn't have a `datetime` mode so `DateTimeField` chains date →
  time pickers automatically.

## Sync engine — quick reference (P6)

- **Single entry point**: `useSyncCycle().startSync()`. Don't call
  `runSyncCycle` / `runPushCycle` directly from a route — the hook
  owns the store updates and the anti-réentrance lock.
- **Two-form push engine**: `runPushCyclePure(deps)` is the
  testable core (no WDB), `runPushCycle({ database, api,
buildProvider })` is the production wrapper. Tests target the pure
  form. Production code uses the wrapper.
- **Server ID lookups** are built per-cycle (one query per catalogue
  table) and reused for all interventions in the cycle. Don't fetch
  per-intervention.
- **`MissingServerIdError`** = local reference whose product/zone
  was deleted server-side. Marks the intervention `error` with a
  user-actionable message; doesn't trigger a network call.
- **Idempotence** — was the open risk; **now resolved server-side
  (2026-05-30)**: Ekylibre v2 dedupes on `(provider.vendor,
provider.id)`, so a duplicate POST (lost ack on flaky network)
  returns `200` with the same `id`, no duplicate. The hook's `useRef`
  lock still guards UI double-tap. ⚠️ Because the write response is
  `{ id }` only, `createIntervention`/`updateIntervention` parse
  `interventionWriteResultSchema` — **not** the full read DTO (parsing
  the read DTO threw a ZodError and left rows stuck "à synchroniser").
- **Error message format**: `intervention.sync_error_message` stores
  raw FR text, displayed verbatim by the detail screen. Engine helpers
  format these in `src/core/sync/push-engine.ts`. Stay consistent
  (no i18n keys here — domain-style raw strings).

## Where work currently stops

End of **P7 (carte des parcelles)** + **P8 polish** livré le 2026-06-14,
1er rebuild EAS pilote en cours côté toi. Concretely:

- **Full offline → sync flow works end-to-end on device.** Login →
  initial-sync → list → "+ Nouvelle intervention" → procedure picker
  → spraying form → save (`pending`). Tap "Synchroniser" (or
  pull-to-refresh) → row flips to `synced` (green) or `error` (red).
- **Two server-side blockers were found AND fixed in Ekylibre core**
  during device validation (separate repo `~/projects/ekylibre`):
  - **P6.5 idempotence** — the v2 API now dedupes on
    `(provider.vendor, provider.id)`: a duplicate POST returns `200`
    with the same `id`. The pre-pilot blocker is **lifted**. ⚠️ The
    write response is `{ id }` only — parse with
    `interventionWriteResultSchema`, not the full read DTO (a wrong
    parse left rows stuck "à synchroniser").
  - **P6.6 spraying Procedo** — `POST /interventions` for spraying
    raised `nil.unit` / `ActorPresenceTest` / `Division`; fixed core
    side. See `docs/p6.6-ekylibre-spraying-procedo-issue.md`.
- **Targets = `land_parcels` + `plants` products** (not
  `/cultivable_zones`): unified `cultivable_zones` table with a `kind`
  column, full production name + `dead_at` + `shape_svg`. The picker
  shows **both kinds** (subtitle "Parcelle"/"Culture" + area), filters
  `dead_at IS NULL OR dead_at ≥ today − 1y`. See DB quick-ref below.
- **Spraying input handlers/units sourced from the API**:
  `/api/v2/procedures` returns enriched handlers `{ name, indicator,
unit }`; the form locks the unit to the chosen handler (no free
  text). Parser: `src/domain/procedures/spraying-handlers.ts`.
- **Intervention detail** shows full details (targets with `shape_svg`
  via `ParcelShape`, doers/inputs/tools resolved names + quantities),
  not just counts. **List** and **detail** have "Supprimer" **and
  "Modifier"** actions on non-synced rows (`deleteIntervention` /
  `updateSprayingIntervention`).
- **Edit ("Modifier") is implemented** (2026-05-31): route
  `spraying?id=<localId>` prefills the form via `initialValues`
  (`toFormValues` from `useInterventionById`) and calls
  `updateSprayingIntervention` (delete-all-children + recreate, resets
  `sync_state='pending'`). Allowed **only** while `pending`/`error`
  (a `synced` row exists server-side — cf. workflow §6.3). ⚠️ The edit
  route waits for the intervention **and all 4 relations** to load
  before mounting the form (RHF `defaultValues` is captured once at
  mount; the children arrive via separate async WDB subscriptions —
  mounting early would freeze empty arrays and drop targets/inputs).
- **WDB schema is v4** (migrations add `dead_at` + `shape_svg` in v2,
  `kind` in v3, all on `cultivable_zones`; `abilities_json` on
  `products` in v4). **`react-native-svg` added** (native dep — see
  rebuild gate). ⚠️ The `kind` (v3) AND `abilities_json` (v4) columns
  both mean **catalogue re-sync is required** after each increment to
  populate the new columns (migration adds the column empty; the
  re-pull fills it). Migration JS-only, no native rebuild needed.
- **Tool filtering by procedure** (v4, 2026-06-14) — the tool selector
  (sprayer) in the spraying form is filtered by the procedure's
  `filter` clause (e.g. `"is equipment and can spray"`). Parser:
  `parseToolFilterAbilities` in `src/domain/procedures/tool-filter.ts`
  extracts the `can <verb>` patterns. Match:
  `productHasAllAbilities(product.abilities, requiredVerbs)` —
  parameter-stripped (`spread(preparation)` matches required `spread`).
  Filter applied in the route file
  (`app/(tabs)/interventions/spraying.tsx`), passing `sprayerEquipments`
  to `SprayingFormView`. If the filter is absent or no equipment
  matches → empty list → the SelectField shows
  `selects.toolEmpty` ("Aucun pulvérisateur dans le catalogue.").
- **P7 carte des parcelles** ✅ — `@maplibre/maplibre-react-native@11.3.4`
  - plugin Expo, fond OSM raster inline (`src/features/map/osm-style.ts`,
    CGU dans le code). Polygones `cultivable_zones.geometry_geojson` rendus
    via `GeoJSONSource + Fill + Line`, surlignage par expression `["case",
["get","selected"], …]`. Auto-fit caméra sur la bbox. **Sélection
    multi-cibles cartographique** depuis le form spraying via
    `TargetMapPickerModal` (Modal RN plein écran, barre d'actions flottante
    en bas, toggle au tap). La liste `MultiSelectField` reste pour les
    parcelles sans géométrie ou recherche texte.
- **API Ekylibre — `shape_geojson`** ajouté sur les jbuilders
  `_land_parcels` + `_plants` (1 ligne chacun, mirror du pattern
  `cultivable_zones`). DTO + mapper acceptent **string OU objet** GeoJSON
  (Charta sérialise différemment selon le contexte). PR à pousser depuis
  `~/projects/ekylibre`.
- **P7.4 pré-cache offline désactivé** (2026-06-14) — `OfflineManager`
  refuse les `file://` locaux. Le code de `offline-cache.ts` reste en
  place (réactivable en 1 ligne), l'appel `triggerOfflineRefresh` est
  commenté dans `runSyncCycle`. L'ambient cache MapLibre prend le relais.
  V1.5+ : héberger `osm-style.json` sur URL publique.
- **P8 polish pré-pilote** ✅ — métriques Sentry (volumétrie sync initiale,
  durée + erreurs par cycle), `app.config.js` qui injecte `SENTRY_DSN`
  depuis env, `docs/P8-release-checklist.md` (placeholders à renseigner :
  Apple Team ID, ASC App ID), `docs/release-notes-v1-pilote.md` +
  `docs/onboarding-pilote.md` (FR pour les agris pilotes), a11y light pass
  (`accessibilityRole` sur Pressables custom restants), README à jour.
- **Sentry wizard** réconcilié — plugin moderne `@sentry/react-native/expo`
  (org `osfarm`, project `zero-mobile`), `metro.config.js` câblé pour
  sourcemaps auto, `Sentry.wrap(RootLayout)` dans `app/_layout.tsx`.
  `.env.local` (gitignored, créé par le wizard) contient `SENTRY_DSN` +
  `SENTRY_AUTH_TOKEN`, lu auto par Expo SDK 55 au start Metro.
- **Icônes** — 3 tab bar icons (`src/ui/icons/TabBarIcons.tsx`, SVG inlinés
  via `react-native-svg`) + icône d'app chouette Ekylibre
  (`assets/icon.png` + `assets/adaptive-icon.png` regénérées depuis
  `uf06c-ekylibre-alt.svg`). **Rebuild EAS obligatoire** pour voir l'icône
  d'app sur device (bundled dans APK/IPA).
- **Dépendances natives ajoutées en P7/P8** : `@maplibre/maplibre-react-native`,
  `expo-file-system`, instrumentation Sentry (via wizard). **Rebuild EAS
  dev/pilot requis** depuis P6.
- **Not yet covered (vers v1.5)** :
  - Re-activation du pré-cache offline P7.4 (besoin d'une URL publique
    pour `osm-style.json`).
  - Per-product handler filtering (procedure `if` conditions).
  - 1 E2E Maestro/Detox scenario (login → save → sync → verify).
  - Re-run device smoke S2 + S5–S12 + post-rebuild pilote (S1/S3/S4
    validated 2026-05-30).
  - Placeholders `eas.json` à renseigner avant `pnpm build:pilot`
    (cf. `docs/P8-release-checklist.md`).
