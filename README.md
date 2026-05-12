# zero-mobile

Application mobile React Native pour Ekylibre. Permet la saisie
d'interventions agricoles hors-ligne avec synchronisation vers
Ekylibre via l'API REST v2.

> **Statut** : fin de **P6 (sync engine)**. Flux complet hors-ligne →
> sync jouable de bout en bout : login → catalogue → saisie spraying
> hors-ligne → tap « Synchroniser » → cycle pull catalogue + push
> interventions → bascule en `synced` ou `error` avec message serveur
> visible dans le détail. Carte des parcelles en P7, polish + pilote
> en P8.
>
> ⚠️ **Rebuild EAS dev client requis** depuis P5 — deux deps natives
> ajoutées en P5 (`expo-crypto`,
> `@react-native-community/datetimepicker`). En complément du
> rebuild déjà nécessaire depuis P3 (WatermelonDB JSI). P6 n'a pas
> ajouté de dep native (Zustand est pure JS).
>
> ⚠️ **Avant le 1er pilote** : confirmer en bac à sable Ekylibre que
> `provider.id` (UUID client) sert bien de clé d'idempotence côté
> serveur — sinon, ajouter un GET défensif avant chaque POST. Cf.
> [CHANGELOG P6.4](docs/CHANGELOG-v1.md#p64--ui-wiring) et
> [arch §11.1](docs/architecture.md#11-limites-et-questions-ouvertes).

## Démarrer

```bash
nvm use            # Node 20 (cf. .nvmrc)
pnpm install       # pnpm 9+ requis
pnpm doctor        # vérifie la cohérence de l'environnement Expo
pnpm build:dev:android   # ou build:dev:ios — premier dev client
pnpm start         # Metro pour le dev client
```

> Expo Go n'est **pas** supporté (WatermelonDB nécessitera du code
> natif en P3). Toujours passer par Expo Dev Client.

## Documentation

- [`docs/brainstorm-requirements.md`](docs/brainstorm-requirements.md) — vision et périmètre v1
- [`docs/architecture.md`](docs/architecture.md) — architecture, ADRs, schémas
- [`docs/workflow.md`](docs/workflow.md) — plan d'implémentation phasé (P0 → P8)
- [`docs/P0-checklist.md`](docs/P0-checklist.md) — préreq externes (comptes, secrets)
- [`docs/CHANGELOG-v1.md`](docs/CHANGELOG-v1.md) — journal de livraison v1
- [`CLAUDE.md`](CLAUDE.md) — guide pour Claude Code (commandes, conventions, pièges)

## Licence

Voir [`LICENSE`](LICENSE).
