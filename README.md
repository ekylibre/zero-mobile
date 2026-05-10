# zero-mobile

Application mobile React Native pour Ekylibre. Permet la saisie
d'interventions agricoles hors-ligne avec synchronisation vers
Ekylibre via l'API REST v2.

> **Statut** : fin de **P4 (liste & détail intervention)**. Login →
> téléchargement du catalogue → liste vide en attendant P5, avec UI
> complète (badges sync, pull-to-refresh placeholder, bandeau pending,
> FAB nouvelle intervention, écran détail observable). Formulaire de
> saisie en P5, moteur de sync interventions en P6, carte en P7.
>
> ⚠️ **Rebuild EAS dev client requis** depuis P3 (WatermelonDB en JSI).

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
