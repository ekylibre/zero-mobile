# zero-mobile

Application mobile React Native pour Ekylibre. Permet la saisie
d'interventions agricoles hors-ligne avec synchronisation vers
Ekylibre via l'API REST v2.

> **Statut** : fin de **P7 (carte des parcelles)** + P8 polish en cours.
> Flux complet hors-ligne → sync jouable de bout en bout : login →
> catalogue (parcelles + cultures) → saisie spraying hors-ligne →
> sync (pull + push avec idempotence côté serveur) → bascule en
> `synced` ou `error` avec message serveur dans le détail.
> Carte interactive avec sélection multi-cibles, précache offline
> par bbox + 5 km.
>
> ⚠️ **Rebuild EAS dev client requis** depuis P7 — deux deps natives
> ajoutées : `@maplibre/maplibre-react-native` (carte) et
> `expo-file-system` (style cache offline). En complément des rebuilds
> antérieurs (WatermelonDB en P3, `react-native-svg` 2026-05-30,
> `expo-crypto` + `@react-native-community/datetimepicker` en P5).

## Stack

- **Expo SDK 55** + **Expo Router v6** (file-based routing)
- **Expo Development Build only** — Expo Go n'est pas supporté (deps natives)
- **TypeScript strict** (`strict: true`, `noUncheckedIndexedAccess: true`)
- **pnpm 10** + **Node 24** (cf. `.nvmrc`)
- **WatermelonDB** (offline-first, SQLite + JSI)
- **MapLibre Native** + tuiles OSM raster (cache offline natif)
- **React Hook Form** + **Zod** pour les formulaires
- **i18next** (FR seul en v1)
- **Sentry** (crashes + métriques de sync)

## Démarrer

```bash
nvm use                  # Node 24 (cf. .nvmrc)
pnpm install             # pnpm 10+ requis
pnpm doctor              # 18/18 — vérifie la cohérence Expo SDK
pnpm build:dev:android   # ou build:dev:ios — premier dev client
pnpm start               # Metro pour le dev client
```

## Commandes utiles

| Commande                 | Action                                           |
| ------------------------ | ------------------------------------------------ |
| `pnpm start`             | Metro pour le dev client                         |
| `pnpm typecheck`         | `tsc --noEmit`                                   |
| `pnpm test`              | Suite Jest (279 tests à ce jour)                 |
| `pnpm lint` / `lint:fix` | ESLint (flat config)                             |
| `pnpm format`            | Prettier                                         |
| `pnpm doctor`            | `expo-doctor` — santé de la config               |
| `pnpm build:dev:ios`     | EAS dev build iOS simulator                      |
| `pnpm build:dev:android` | EAS dev build Android APK                        |
| `pnpm build:pilot`       | EAS pilot build iOS+Android (store distribution) |
| `pnpm submit:pilot`      | TestFlight + Play Internal Testing               |

## Documentation

- [`docs/brainstorm-requirements.md`](docs/brainstorm-requirements.md) — vision et périmètre v1
- [`docs/architecture.md`](docs/architecture.md) — architecture, 13 ADRs, schémas
- [`docs/workflow.md`](docs/workflow.md) — plan d'implémentation phasé (P0 → P8)
- [`docs/P0-checklist.md`](docs/P0-checklist.md) — préreq externes (comptes, secrets)
- [`docs/P8-release-checklist.md`](docs/P8-release-checklist.md) — config release pilote (placeholders à remplir)
- [`docs/CHANGELOG-v1.md`](docs/CHANGELOG-v1.md) — journal de livraison v1
- [`docs/testing-guide.md`](docs/testing-guide.md) — scénarios smoke sur device
- [`CLAUDE.md`](CLAUDE.md) — guide pour Claude Code (commandes, conventions, pièges)

## Licence

Voir [`LICENSE`](LICENSE).
