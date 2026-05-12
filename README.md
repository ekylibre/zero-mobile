# zero-mobile

Application mobile React Native pour Ekylibre. Permet la saisie
d'interventions agricoles hors-ligne avec synchronisation vers
Ekylibre via l'API REST v2.

> **Statut** : fin de **P5 (formulaire spraying)**. Flux complet
> jouable hors-ligne : login → téléchargement du catalogue → picker
> de procédure → formulaire spraying (dates, parcelle, conducteur,
> multi-intrants phyto, pulvérisateur, notes) → sauvegarde locale
> en `pending` → apparition dans la liste avec son badge. Moteur
> de sync interventions en P6, carte en P7, polish + pilote en P8.
>
> ⚠️ **Rebuild EAS dev client requis** après P5 — deux nouvelles
> deps natives ajoutées (`expo-crypto`,
> `@react-native-community/datetimepicker`). En complément du
> rebuild déjà nécessaire depuis P3 (WatermelonDB JSI).

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
