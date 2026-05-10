# P0 — Checklist d'actions externes

> Tâches **humaines/admin** à débloquer avant que le code de P1 ne
> puisse être pleinement opérationnel (pipelines CI verts, builds
> EAS distribuables, Sentry réel). Le code de P1 est livré **sans
> dépendance bloquante sur P0** : il fonctionne avec des DSN
> placeholder en dev, mais ces valeurs doivent être remplacées
> avant la première release pilote.

## ⚠️ Pré-requis poste de développement

À faire **immédiatement** sur tout poste de dev qui touchera ce repo :

- [ ] **Node 24** installé (pnpm 10 exige Node ≥ 22.13 ; on
      standardise sur Node 24)
  - `nvm install 24 && nvm use 24`
  - Le `.nvmrc` du repo verrouille la version. Dans le dossier du
    repo : `nvm use` lit ce fichier automatiquement.
- [ ] **pnpm** installé
  - `npm install -g pnpm@latest` ou via Corepack : `corepack enable && corepack prepare pnpm@latest --activate`
- [ ] **EAS CLI** installé
  - `pnpm add -g eas-cli`
- [ ] **Xcode** (macOS uniquement, pour builds iOS locaux ou simulateur)
- [ ] **Android Studio** + SDK Android (pour émulateur Android)

> Le poste actuellement utilisé pour Claude Code a Node 14.17.4 et
> pas de pnpm — à mettre à jour avant `pnpm install`.

## 1. Comptes externes à créer/activer

### 1.1. Apple Developer (organisation Ekylibre)

- [ ] Compte Apple Developer Program sous le nom **Ekylibre**
      (pas un compte personnel).
      ⚠️ **Démarrer dès maintenant** : la validation peut prendre
      plusieurs jours à plusieurs semaines.
- [ ] Récupérer :
  - **Apple Team ID** (10 caractères) → à fournir pour `eas.json`
  - **App Store Connect API Key** (`.p8` + Key ID + Issuer ID) →
    pour `eas submit` automatisé
- [ ] Créer l'**App ID** (bundle identifier) :
      `com.ekylibre.zeromobile` (à confirmer avec l'équipe)
- [ ] Créer le **distribution profile** TestFlight (Internal +
      External Testing).

### 1.2. Google Play Console

- [ ] Compte Google Play Console sous l'organisation Ekylibre.
- [ ] Récupérer :
  - **Service Account JSON** (`google-play.json`) → pour
    `eas submit` Android
- [ ] Créer l'app avec **package name** `com.ekylibre.zeromobile`
      (cohérent avec iOS).
- [ ] Activer le **canal Internal Testing**.

### 1.3. Expo / EAS

- [ ] Compte Expo **organisationnel** Ekylibre (pas personnel).
- [ ] Créer le projet via `eas init` (à faire en P1).
- [ ] Récupérer :
  - **EAS Project ID** (UUID) → injecté dans `app.json`
  - **Owner** (handle de l'org Expo) → injecté dans `app.json`

### 1.4. Sentry

- [ ] Projet Sentry **`zero-mobile`** dans l'org Ekylibre.
- [ ] Créer 2 (ou 3) environnements :
  - `dev` (DSN distinct)
  - `pilot` (DSN distinct)
  - `prod` (créé maintenant, utilisé après v1)
- [ ] Récupérer :
  - **DSN dev** → variable EAS `SENTRY_DSN_DEV`
  - **DSN pilot** → variable EAS `SENTRY_DSN_PILOT`
  - **Sentry Auth Token** (org-level, scope `project:write`) →
    pour upload de source maps depuis EAS
  - **Org slug** (`ekylibre`) et **Project slug** (`zero-mobile`)

### 1.5. Tuiles cartographiques

**Décision à prendre maintenant** : choisir le fournisseur de
tuiles avant P7. Options :

| Fournisseur                | Avantage                                       | Inconvénient                                          | Effort intégration |
| -------------------------- | ---------------------------------------------- | ----------------------------------------------------- | ------------------ |
| OSM tile.openstreetmap.org | Gratuit, sans token                            | Rate limits stricts, **interdit en prod** par les CGU | Faible             |
| MapTiler                   | Bon rapport qualité/prix, vues satellite       | Quota gratuit limité (100k tiles/mois)                | Moyen (token)      |
| Stadia Maps                | Crédit gratuit confortable, design soigné      | Couverture aérienne moindre                           | Moyen (token)      |
| Geoportail (IGN)           | Couverture France excellente, photos aériennes | Authentification IGN, conditions d'usage spécifiques  | Élevé              |

**Recommandation** : pour le pilote France, **MapTiler ou
Geoportail** (vues aériennes utiles pour reconnaître les parcelles).

- [ ] Décision prise : ********\_\_\_\_********
- [ ] Compte créé / token obtenu → variable EAS `MAP_TILE_TOKEN`

### 1.6. Instance Ekylibre de test

- [ ] Instance Ekylibre dédiée pour les tests mobile, accessible
      en HTTPS depuis l'extérieur (ou tunnel ngrok pour dev local).
- [ ] **API v2 activée** sur cette instance.
- [ ] Compte utilisateur de test créé avec :
  - Mot de passe partagé dans le password manager.
  - Permissions de créer des interventions.
- [ ] **Catalogue minimal** seedé sur l'instance :
  - ≥ 1 procédure `spraying` disponible
  - ≥ 1 parcelle (`cultivable_zone`) avec géométrie
  - ≥ 1 produit phytosanitaire (`plant_medicine`) avec variant
  - ≥ 1 pulvérisateur (équipement)
  - ≥ 1 ouvrier (worker)
- [ ] Vérification manuelle :
  - `curl -H "Authorization: simple-token <email> <token>" \
   https://<instance>/api/v2/interventions` retourne `200`
  - `curl ... /api/v2/procedures` liste `spraying`

### 1.7. Repo GitHub

- [ ] Repo GitHub `ekylibre/zero-mobile` (organisation Ekylibre).
- [ ] Push initial du `main` actuel.
- [ ] **Secrets GitHub Actions** configurés :
  - `EXPO_TOKEN` (pour `eas` en CI, depuis Expo dashboard)
  - `SENTRY_AUTH_TOKEN`
- [ ] Branch protection sur `main` : require PR, require status
      checks (lint + typecheck + test).

## 2. Secrets à fournir au dev (récupérés des étapes ci-dessus)

Les valeurs suivantes devront être renseignées dans le **password
manager partagé** (1Password, Bitwarden, etc.), **jamais commitées** :

| Clé                                         | Source               | Utilisé par                   |
| ------------------------------------------- | -------------------- | ----------------------------- |
| `APPLE_TEAM_ID`                             | Apple Developer      | `eas.json` (build/submit iOS) |
| `APPLE_APP_STORE_CONNECT_KEY_*` (.p8 + IDs) | App Store Connect    | `eas submit` iOS              |
| `GOOGLE_SERVICE_ACCOUNT_KEY` (JSON)         | Google Play Console  | `eas submit` Android          |
| `EXPO_PROJECT_ID` (UUID)                    | `eas init`           | `app.json`                    |
| `EXPO_OWNER` (slug org)                     | Expo dashboard       | `app.json`                    |
| `SENTRY_DSN_DEV`                            | Sentry dev project   | EAS env var                   |
| `SENTRY_DSN_PILOT`                          | Sentry pilot project | EAS env var                   |
| `SENTRY_AUTH_TOKEN`                         | Sentry org settings  | EAS + GitHub Actions secret   |
| `SENTRY_ORG_SLUG`                           | Sentry org settings  | EAS env var (statique)        |
| `SENTRY_PROJECT_SLUG`                       | Sentry project       | EAS env var (statique)        |
| `MAP_TILE_TOKEN` (si fournisseur payant)    | MapTiler/Stadia/IGN  | EAS env var                   |
| `EKY_TEST_INSTANCE_URL`                     | Setup instance test  | Tests E2E (pas dans l'app)    |
| `EKY_TEST_USER_EMAIL` + `_PASSWORD`         | Setup instance test  | Tests E2E                     |

## 3. Ordre recommandé d'exécution

Parallélisable, mais voici l'ordre optimal pour minimiser les
attentes :

1. **Maintenant** (parallèles, lents) :
   - Demande d'inscription Apple Developer (si pas déjà fait)
   - Création repo GitHub `ekylibre/zero-mobile`
2. **Cette semaine** :
   - Création projet Sentry → récupération DSN
   - Création compte Expo organisationnel
   - Setup instance Ekylibre de test
3. **Avant fin P1** :
   - Tous les secrets ci-dessus disponibles dans le password manager
   - `eas init` exécuté (génère EAS Project ID)
4. **Avant P7** au plus tard :
   - Décision et création du compte fournisseur de tuiles
5. **Avant P8** :
   - App ID iOS + package Android créés et configurés en App Store
     Connect / Play Console
   - First TestFlight Internal Testing build accepté

## 4. Statut des items

Tenir à jour ce tableau lors de l'exécution :

| Item                           | Statut | Date | Responsable |
| ------------------------------ | ------ | ---- | ----------- |
| Node 20 + pnpm sur poste dev   | ⬜     |      |             |
| Apple Developer (org Ekylibre) | ⬜     |      |             |
| Apple Team ID récupéré         | ⬜     |      |             |
| Google Play Console            | ⬜     |      |             |
| Service Account Google JSON    | ⬜     |      |             |
| Expo org account               | ⬜     |      |             |
| EAS Project ID                 | ⬜     |      |             |
| Sentry projet zero-mobile      | ⬜     |      |             |
| Sentry DSN dev                 | ⬜     |      |             |
| Sentry DSN pilot               | ⬜     |      |             |
| Sentry Auth Token              | ⬜     |      |             |
| Décision fournisseur tuiles    | ⬜     |      |             |
| Token tuiles (si applicable)   | ⬜     |      |             |
| Instance Ekylibre test active  | ⬜     |      |             |
| Catalogue test seedé           | ⬜     |      |             |
| Repo GitHub poussé             | ⬜     |      |             |
| Secrets GitHub Actions         | ⬜     |      |             |
| Branch protection main         | ⬜     |      |             |

Légende : ⬜ à faire · 🟡 en cours · ✅ fait
