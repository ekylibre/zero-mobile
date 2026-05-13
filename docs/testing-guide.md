# Guide de test dev local — zero-mobile contre Ekylibre

> Méthode pour valider le flux complet **login → catalogue → saisie
> spraying → sync** sur un device réel contre une instance Ekylibre de
> test. Le focus est de **dérisquer P6 avant pilote** : confirmer que
> l'app marche bout en bout, et **trancher la question ouverte
> d'idempotence sur `provider.id`** (cf. arch §11.1, CHANGELOG P6.4 —
> seul vrai blocker pour démarrer le pilote).
>
> Pré-requis supposés acquis : instance Ekylibre HTTPS + API v2 +
> catalogue seedé minimal (cf. `docs/P0-checklist.md` §1.6).

## 0. Setup avant la 1re session

### 0.1. Rebuild EAS dev client (obligatoire)

Le dev client P1/P2 ne marche **plus** depuis P3 (WatermelonDB JSI),
P5.1 (`expo-crypto`) et P5.3a (`@react-native-community/datetimepicker`).
Si tu n'as pas rebuild depuis ces phases, le binaire installé sur le
device va crasher au démarrage.

```bash
nvm use                          # Node 24
pnpm install
pnpm doctor                      # vérifie la cohérence Expo SDK
pnpm build:dev:ios               # ou build:dev:android
```

Installe le `.ipa` / `.apk` sortant sur le device (Expo te donne un QR
code TestFlight ou un lien direct). **Ne pas tenter avec Expo Go.**

### 0.2. Variables côté instance Ekylibre

Note dans ton password manager (jamais commit) :

| Clé                 | Valeur attendue                             |
| ------------------- | ------------------------------------------- |
| `EKY_INSTANCE_URL`  | `https://<ton-instance>` (sans slash final) |
| `EKY_TEST_EMAIL`    | email du compte utilisateur                 |
| `EKY_TEST_PASSWORD` | mot de passe                                |

### 0.3. Sanity check curl

Avant de lancer l'app, vérifie que l'instance répond au schéma attendu :

```bash
# Login → récupère un token
TOKEN=$(curl -s -X POST "$EKY_INSTANCE_URL/api/v2/tokens" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EKY_TEST_EMAIL\",\"password\":\"$EKY_TEST_PASSWORD\"}" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")

# Vérifie les 5 endpoints catalogue + interventions
for ep in procedures products cultivable_zones variants interventions; do
  echo "--- $ep ---"
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "Authorization: simple-token $EKY_TEST_EMAIL $TOKEN" \
    "$EKY_INSTANCE_URL/api/v2/$ep"
done
```

Tous doivent retourner **200**. Si 401/403 → token KO. Si 404 → API v2
pas activée. **Stoppe ici** et corrige avant de continuer.

### 0.4. Lancer Metro

```bash
pnpm start                       # dev client uniquement, pas Expo Go
```

Sur le device, ouvre l'app dev client → scanne le QR code Metro ou colle
l'URL.

## 1. Scénarios smoke (à passer dans l'ordre)

Chaque scénario a 4 cases : **Action**, **Attendu UI**, **Vérif WDB**
(via React Native Debugger ou logs Sentry breadcrumbs si DSN configuré),
**Vérif serveur** (web Ekylibre ou curl).

### S1 — Login + initial sync

| Étape         | Détail                                                                                                                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Action        | Lancer l'app, saisir URL + email + password, taper « Se connecter ».                                                                                                                          |
| Attendu UI    | Redirection sur `InitialSyncScreen`, barre de progression qui passe les 4 étapes (procédures → produits × 3 sous-types → parcelles → variantes), arrivée sur l'onglet **Interventions** vide. |
| Vérif WDB     | Tables `procedures`, `products`, `cultivable_zones`, `variants` non vides. `sync_state.current_step = 'done'`.                                                                                |
| Vérif serveur | (rien, lecture seule)                                                                                                                                                                         |

**Mode dégradé à tester** : couper le réseau pendant la sync initiale.
L'écran doit afficher l'erreur. Réseau rétabli + tap retry → reprend depuis l'étape qui avait échoué (cf. P3 — sync resumable).

### S2 — Saisie spraying offline

| Étape         | Détail                                                                                                                                                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Action        | **Activer le mode avion**. Tap « + Nouvelle intervention » → « Pulvérisation ». Remplir : dates (par défaut OK), parcelle, conducteur, ≥1 intrant phyto (produit + variant + quantité + handler), pulvérisateur, notes. Tap « Enregistrer ». |
| Attendu UI    | Alert succès, retour à la liste avec **1 ligne `pending`** (badge ambre), bandeau jaune « 1 intervention à synchroniser », badge tab `1`.                                                                                                    |
| Vérif WDB     | Table `interventions` : 1 ligne avec `client_uuid` non vide, `server_id = null`, `sync_state = 'pending'`, `sync_attempt_count = 0`. Tables enfants : 1 doer + N inputs + 1 target + 1 tool + 1 working_period rattachés.                    |
| Vérif serveur | (rien, encore offline)                                                                                                                                                                                                                       |

**Edge case multi-intrants** : ajouter 2-3 lignes phyto, retirer la 2e,
vérifier que les indices se réordonnent et que la sauvegarde garde les
bons inputs.

### S3 — Sync push (mode online)

| Étape         | Détail                                                                                                                                                                                                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Action        | **Désactiver le mode avion**. Tap bouton « Synchroniser » dans le header.                                                                                                                                                                                                  |
| Attendu UI    | Header passe « Téléchargement du catalogue… » → « Envoi des interventions… » → « Prêt ». La ligne pending bascule en `synced` (badge vert). Bandeau pending disparaît. Tab badge à 0. Texte « Dernière sync : HH:MM ».                                                     |
| Vérif WDB     | `interventions[0].server_id != null`, `sync_state = 'synced'`, `last_synced_at` récent.                                                                                                                                                                                    |
| Vérif serveur | Sur Ekylibre web, ouvrir l'intervention créée (id = `server_id`). Vérifier : procédure spraying, dates, parcelle, conducteur, intrants (qty + unit), pulvérisateur. **Vérifier le tag provider** : devrait avoir `vendor=ekylibre-mobile`, `id=<UUID>` (clientUuid local). |

**Vérif curl côté serveur** :

```bash
curl -s -H "Authorization: simple-token $EKY_TEST_EMAIL $TOKEN" \
  "$EKY_INSTANCE_URL/api/v2/interventions" \
  | python3 -m json.tool | head -60
```

Le tableau retourné doit contenir l'intervention avec son `provider.id`.

## 2. Scénarios crucial : idempotence (à débloquer **avant pilote**)

C'est le seul vrai blocker P6 pour passer en pilote (cf. CHANGELOG
P6.4). On veut savoir **si Ekylibre dédoublonne sur `provider.id`**.

### S4 — Test bac à sable : double POST identique

| Étape                               | Détail                                                                                                                                                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup                               | Récupérer un payload exact qu'on enverrait au POST. Le plus simple : faire S2 + S3, puis lire les logs Metro pour voir le body envoyé. Ou intercepter via Charles Proxy. Sauvegarder le payload comme `payload.json`. |
| Action 1                            | `curl -X POST -H "Authorization: simple-token $EKY_TEST_EMAIL $TOKEN" -H "Content-Type: application/json" -d @payload.json "$EKY_INSTANCE_URL/api/v2/interventions"` → noter `id` retourné.                           |
| Action 2                            | **Re-jouer exactement le même curl** (même `provider.id` UUID).                                                                                                                                                       |
| Résultat A — server dédoublonne     | Le 2e appel retourne le **même `id`** (ou 200 sans création). ✅ Idempotent. **Décision : trust (P6 ship as-is)**. Documenter dans CHANGELOG.                                                                         |
| Résultat B — server crée un doublon | Le 2e appel retourne un `id` **différent**. ❌ Pas idempotent. **Décision : ajouter un GET défensif avant chaque POST** (cf. P6.4 _Action requise_). Ouvrir un ticket pour P6.5.                                      |

**Variante** : tester avec un payload qui a déjà été POSTé via l'app
mobile (réutilise un `client_uuid` existant en local). Si l'app
re-tente après un ack perdu, c'est ce cas-là qui se déclenche en prod.

## 3. Scénarios d'erreur

### S5 — 422 validation serveur

| Étape      | Détail                                                                                                                                                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup      | Saisir un spraying où on triche : par exemple, sélectionner un produit qui n'existe pas en `plant_medicine` côté serveur (rare, mais possible si le catalogue a évolué). Ou modifier le payload côté curl pour omettre un `doer`. |
| Action     | Tap Synchroniser.                                                                                                                                                                                                                 |
| Attendu UI | Header passe « Échec de la synchronisation ». Bandeau rouge persistant « 1 intervention en erreur ». Ligne reste en badge rouge. Ouvrir le détail → message serveur visible.                                                      |
| Vérif WDB  | `sync_state = 'error'`, `sync_error_message` rempli avec le message Eky. `sync_attempt_count = 0` (un 422 n'incrémente pas — c'est un retry inutile sans correction).                                                             |

### S6 — 5xx serveur

| Étape      | Détail                                                                                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup      | Difficile à provoquer. Méthode : couper l'API Eky côté serveur le temps du test, ou utiliser un proxy qui retourne 500 sur la route `/api/v2/interventions` POST. |
| Action     | Saisir + tap Synchroniser.                                                                                                                                        |
| Attendu UI | Header « Échec ». Bandeau syncError affiche « Erreur serveur (500)… ». Ligne reste **`pending`** (pas error).                                                     |
| Vérif WDB  | `sync_state = 'pending'` (retry-able), `sync_attempt_count = 1`.                                                                                                  |
| Action 2   | Réactiver l'API serveur, tap Synchroniser à nouveau → la ligne passe `synced`, attempt reset (en pratique : non remis à 0, on garde la trace).                    |

### S7 — Network down pendant push

| Étape      | Détail                                                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup      | Saisir l'intervention online, **couper le réseau juste avant** de tap Synchroniser.                                                          |
| Action     | Tap Synchroniser.                                                                                                                            |
| Attendu UI | Header « Échec ». Bandeau syncError « Connexion perdue… ». Pull catalogue échoue, push tente quand même puis échoue → ligne reste `pending`. |
| Vérif WDB  | `sync_attempt_count = 1`, `sync_error_message` parle de connexion.                                                                           |
| Action 2   | Réseau rétabli, tap Synchroniser → tout passe synced.                                                                                        |

### S8 — Catalogue stale (produit retiré côté serveur)

| Étape      | Détail                                                                                                                                                                                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup      | Saisir un spraying avec un produit X. **Avant** de synchroniser, retirer X du catalogue Ekylibre (via web ou curl DELETE si supporté). Tap Synchroniser : le pull va supprimer X de WDB local, mais l'intervention référence toujours son local id. |
| Action     | Tap Synchroniser après suppression.                                                                                                                                                                                                                 |
| Attendu UI | Push échoue avec **MissingServerIdError** (capté par le moteur). Ligne `error`, message « Référence X introuvable dans le catalogue ».                                                                                                              |
| Vérif WDB  | Pas d'appel API tenté pour cette intervention (économie d'aller-retour).                                                                                                                                                                            |

### S9 — Logout avec interventions pending

| Étape      | Détail                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Setup      | Avoir ≥1 intervention en `pending` ou `error`.                                                                                 |
| Action     | Settings → « Se déconnecter ».                                                                                                 |
| Attendu UI | Alert avec **2 paragraphes** : « Vos identifiants seront effacés » + « N intervention(s) non synchronisée(s) seront perdues ». |
| Action 2   | Tap « Se déconnecter ».                                                                                                        |
| Vérif      | Retour Login. Re-login → pas d'interventions reprises (les locales ont été purgées).                                           |

### S10 — 401 token expiré

| Étape      | Détail                                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------------------- |
| Setup      | Côté Ekylibre web ou curl : révoquer le token de la session courante (`DELETE /api/v2/tokens/$TOKEN`).            |
| Action     | Tap Synchroniser.                                                                                                 |
| Attendu UI | Redirection automatique sur `LoginScreen` avec bandeau **« Votre session a expiré, veuillez vous reconnecter »**. |
| Vérif WDB  | Tables non purgées (la déconnexion 401 garde les interventions pending). Re-login → elles sont toujours là.       |

## 4. Scénarios d'idempotence applicative (P6.4 lock)

### S11 — Double tap sur Synchroniser

| Étape        | Détail                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------- |
| Action       | Avoir 1 pending, **double-tap rapide** sur le bouton Synchroniser.                        |
| Attendu      | 1 seul cycle se lance (pas 2). Le hook `useSyncCycle` a un lock `useRef` anti-réentrance. |
| Vérif réseau | Charles / `adb logcat` doivent montrer **1 seul POST**, pas 2.                            |

### S12 — Pull-to-refresh + bouton

Idem S11 mais avec pull-to-refresh **et** bouton tapés en parallèle. Le 2e
geste doit être no-op silencieusement (pas d'erreur UI).

## 5. Checklist de signoff dev local

À cocher avant d'envisager la phase pilote :

- [ ] **S1** Login + sync initiale → catalogue téléchargé sur le device
- [ ] **S2** Saisie spraying offline → ligne pending visible
- [ ] **S3** Sync online → ligne synced + intervention visible côté Eky web avec le bon `provider.id`
- [ ] **S4** Test bac à sable idempotence → décision **trust** ou **GET défensif** documentée dans CHANGELOG
- [ ] **S5** 422 → message serveur visible dans détail
- [ ] **S6** 5xx → reste pending + retry OK
- [ ] **S7** Network down → reste pending + retry OK
- [ ] **S8** Catalogue stale → MissingServerIdError visible
- [ ] **S9** Logout warning quand pending > 0
- [ ] **S10** 401 → redirect login avec bannière
- [ ] **S11** Double-tap Synchroniser → 1 seul POST
- [ ] **S12** Pull-to-refresh + bouton parallèle → 1 seul POST
- [ ] Vérification visuelle du payload dans Charles/logs : `provider` présent avec `vendor`, `name`, `id`, `data.app_version`, `data.os`, `data.locale`

Si **tous verts** → green light pour préparer P7 (carte) et lancer le
panel pilote en parallèle (cf. P0-checklist §1.6 + workflow §11
checkpoints).

Si **un rouge** → ne pas distribuer au panel. Ouvrir un ticket P6.5
ciblé sur le scénario qui casse.

## 6. Outils utiles

- **React Native Debugger** ou **Flipper** — inspecter l'état WDB
  pendant les tests (les hooks observables n'écrivent pas de log, il
  faut peeker dans la DB).
- **Charles Proxy** ou **Proxyman** (macOS) — capter les POSTs réels
  avec le payload exact. Indispensable pour S4 (extraire le payload à
  re-rejouer en curl).
- **`adb logcat | grep -i metro`** (Android) — voir les `console.log`
  du dev client.
- **Safari Web Inspector** (iOS, Develop menu) — devtools sur le dev
  client iOS.
- **Sentry breadcrumbs** — si le DSN dev est configuré (cf.
  P0-checklist §1.4), chaque cycle de sync laisse des traces.

## 7. Quoi remonter dans le CHANGELOG

Une fois les tests passés, mettre à jour `docs/CHANGELOG-v1.md` :

- Section P6.4 _Action requise_ : marquer **DONE** ou **DEFERRED**
  selon résultat S4.
- Si KO sur S4 : créer une entrée _Unreleased — P6.5_ listant le ticket
  GET défensif.
- Si tous verts : ajouter une entrée _Unreleased — Validation dev local
  P6_ avec date + résumé (3 lignes max).
