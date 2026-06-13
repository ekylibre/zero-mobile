# P8 — Checklist release pilote

> État de la configuration release/pilote au 2026-06-14, en complément du
> workflow §9 et de `docs/P0-checklist.md`.

## 1. Configuration code (✓ fait, vérifié)

- `app.config.js` injecte `SENTRY_DSN` depuis l'environnement (lit
  `process.env.SENTRY_DSN`, à défaut le placeholder d'`app.json`). En dev
  local, Expo charge automatiquement `.env.local` au démarrage Metro ; en
  build EAS, lit les secrets du projet.
- `metro.config.js` câblé par le wizard Sentry — wrap `getSentryExpoConfig`
  pour injecter les Debug IDs + uploader les sourcemaps avec
  `SENTRY_AUTH_TOKEN`.
- `app/_layout.tsx` : `export default Sentry.wrap(RootLayout)` (wizard) en
  complément de l'`initSentry()` au boot — compatible, idempotent.
- `app.json` plugin `@sentry/react-native/expo` (path moderne SDK 50+),
  org `osfarm`, project `zero-mobile`.
- `eas.json` profil `pilot` : `distribution: store`, `channel: pilot`,
  `autoIncrement: true` (gère versionCode Android + buildNumber iOS).
- `app.json` : `runtimeVersion.policy = "appVersion"` → l'OTA pilote ne
  s'applique qu'aux builds de même `version` (cf. workflow §9, OTA polish).
- Métriques Sentry câblées (P8.1) : volumétrie sync initiale, durée + erreurs
  par cycle.

## 2. À renseigner par l'équipe Ekylibre (placeholders à remplacer)

| Fichier     | Clé                                          | Valeur attendue                                    |
| ----------- | -------------------------------------------- | -------------------------------------------------- |
| `eas.json`  | `submit.pilot.ios.appleTeamId`               | Apple Team ID de l'org Ekylibre                    |
| `eas.json`  | `submit.pilot.ios.ascAppId`                  | App Store Connect App ID (créé lors du 1er submit) |
| `eas.json`  | `submit.pilot.android.serviceAccountKeyPath` | Chemin vers la clé Service Account Google Play     |
| EAS env var | `SENTRY_DSN`                                 | DSN public du projet Sentry zero-mobile            |
| EAS env var | `SENTRY_AUTH_TOKEN`                          | Token Sentry pour upload des sourcemaps (build)    |
| FS local    | `google-play-key.json`                       | Clé Service Account (déjà dans `.gitignore`)       |

### Commandes EAS associées

Le wizard Sentry a déjà créé `.env.local` avec les deux valeurs. Le plus
simple est de **pousser ce fichier vers EAS** plutôt que de re-saisir les
valeurs à la main :

```bash
# Pousse SENTRY_DSN + SENTRY_AUTH_TOKEN depuis .env.local vers EAS,
# environnement "production" (le profil pilot lit cet environnement).
# Répéter pour 'development' et 'preview' si on veut les avoir aussi
# disponibles en dev build / preview build EAS.
eas env:push production --path .env.local
eas env:push preview --path .env.local
eas env:push development --path .env.local
```

> ⚠️ EAS CLI ≥ v14 utilise le nouveau système `eas env:*` (par environnement).
> L'ancien `eas secret:create` fonctionne encore mais ne permet pas de
> scoper par environnement (`development`/`preview`/`production`).
>
> Mode interactif si tu préfères saisir à la main : lancer `eas env:create`
> sans flags, le CLI prompte chaque champ (valeur en mode caché).

### Dev local — `.env.local`

Auto-créé par le wizard Sentry, contient :

```
SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<id>
SENTRY_AUTH_TOKEN=sntrys_...
```

Gitignored — chaque dev doit relancer `npx @sentry/wizard@latest -i reactNative`
sur sa machine, OU récupérer les valeurs depuis le password manager partagé.

## 3. Workflow de release pilote

```bash
# 1. Bumper la version dans app.json (ex. 0.1.0 → 0.2.0-pilot.1)
#    → policy "appVersion" : un nouveau bundle natif si version change

# 2. Build pilot iOS + Android (cf. package.json)
pnpm build:pilot          # eas build --profile pilot --platform all

# 3. Soumission stores (TestFlight + Internal Testing)
pnpm submit:pilot         # eas submit --profile pilot --platform all

# 4. OTA — mise à jour pilote sans rebuild natif (mêmes version + runtime)
eas update --branch pilot --message "Hotfix X"
```

## 4. Pré-vol avant 1er build pilote

- [ ] Apple Team ID + ASC App ID renseignés dans `eas.json`
- [ ] `google-play-key.json` présent à la racine du projet (pas commit)
- [ ] EAS env vars `SENTRY_DSN` et `SENTRY_AUTH_TOKEN` poussés (au moins
      sur l'environnement `production`)
- [ ] `pnpm doctor` vert (18/18)
- [ ] Suite Jest verte + lint + typecheck (`pnpm test && pnpm lint && pnpm typecheck`)
- [ ] Smoke device : login → sync initiale → saisie spraying offline → sync
- [ ] Validation Sentry : un crash volontaire en dev remonte bien dans le projet

## 5. À ajouter en v1.5 / v2

- A11y : passe profonde avec TalkBack/VoiceOver sur device (pour l'instant
  seuls les Pressable custom de P8.5 ont `accessibilityRole`).
- i18n : revue humaine FR par un agriculteur du panel pilote.
- E2E Maestro/Detox : 1 scénario complet (login → save → sync → vérif).
- Tableau de bord Sentry réservé au pilote (alertes sur taux de crash).
