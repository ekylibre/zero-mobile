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

The repo currently sits at the end of **P5 (spraying form)**.
P6 (sync engine) is the next phase.

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

The architecture (`docs/architecture.md` §6) splits sync into two halves:

- **Pull catalogue** uses `WatermelonDB.synchronize({ pullChanges })`
  with `pushChanges` neutralised. The adapter does a full fetch of
  `/procedures`, `/products`, `/cultivable_zones`, `/variants`,
  `/interventions` and computes the diff client-side (acceptable while
  farms stay below ~500 parcels / ~1k products — see open question #4
  in architecture.md §11).
- **Push interventions** is a dedicated loop _outside_ `synchronize()`,
  iterating over `interventions WHERE sync_state IN (pending, error)`.
  Each intervention is POSTed (or PUT-ed if `server_id` is set) with
  its `client_uuid` echoed in `provider.id`. Per-intervention success
  marks the row `synced`; 4xx marks `error` with the server message;
  5xx/network bumps `sync_attempt_count` and leaves it `pending` for
  the next cycle.

If you find yourself routing `pushChanges` through `synchronize()`,
re-read ADR-03 first.

## When you change deps

- Run `pnpm doctor` (= `expo-doctor`) — it catches Expo SDK
  incompatibilities that `pnpm install` happily ignores.
- If you bump Expo SDK, follow the official migration guide; don't
  hand-edit version numbers across `expo*` packages.
- Adding a native dep (e.g. WatermelonDB in P3, `expo-crypto` and
  `@react-native-community/datetimepicker` in P5, MapLibre in P7)
  requires a new EAS dev build before `pnpm start` works on device.

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

## Native rebuild gate

After P3, the dev client is no longer compatible with previous
P1/P2 builds: WatermelonDB adds native code via JSI. Always run
`pnpm build:dev:ios` / `pnpm build:dev:android` after pulling
changes that touch deps or `app.json` plugins.

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
- **Single-element arrays** (`targets`, `doers`, `tools`) are stored
  as length-0 or length-1 arrays in form state. The view derives the
  selected item via `find(id)` and `onChange` wraps the item in
  `[{ ..., reference_name: '...' }]`. This keeps the Zod schema
  uniform (always an array) and the persister code simple.
- **`InputsFieldArray`** is a controlled list editor (no
  `useFieldArray`) — value/onChange propagate from the parent's
  `Controller`. Add/remove rows mutate the array via
  `onChange([...value, newRow])`. Quantity input parses both `,` and
  `.` as decimal separator (FR UX), falls back to 0 on invalid input.
- **Quantity handlers** are a fixed v1 set in
  `src/features/intervention/InputsFieldArray.tsx`
  (`SPRAYING_HANDLERS`). Per-product handler filtering depends on
  procedure XML definitions and lands in P-v1.5+.
- **Persistence path** — view collects validated data → route handler
  calls `persistSprayingIntervention(database, input)` → 1
  `database.write` + 1 `database.batch(...)` writes intervention +
  all relations atomically. `client_uuid` is generated **once** at
  creation via `expo-crypto.randomUUID()` and never regenerated (cf.
  ADR-13).
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

## Where work currently stops

End of P5. Concretely:

- Login → initial-sync → tabs.
- **Procedure picker** (`new.tsx`) — lists supported v1 procedures
  (only `spraying`). Other procedures from the catalogue are
  invisible by design.
- **Spraying form** — fully usable: dates (native picker), parcel,
  driver, sprayer, multi-row plant medicine inputs (product +
  optional variant + quantity + handler + optional unit), free-text
  notes. Save validates via Zod, persists locally as `pending`,
  alerts success, returns to the list.
- **Interventions list** : the just-saved spraying appears with a
  `pending` badge and bumps the tab counter.
- **Detail screen** : full layout (sections + retry button) — counts
  on relations are now non-zero after a save.
- Intervention sync engine, map — not yet implemented. They land in
  P6–P8 (see `docs/workflow.md`).
- **Not yet covered**: 1 E2E Maestro/Detox scenario (workflow §6
  quality gate, transverse §10.1) and a device demo with a panel
  farmer for UX feedback on the multi-input row.
