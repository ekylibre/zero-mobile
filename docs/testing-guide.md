# Guide de test dev local — zero-mobile contre Ekylibre

> Méthode pour valider le flux complet **login → catalogue → saisie
> spraying → sync** sur un device réel contre une instance Ekylibre de
> test. Le focus est de **dérisquer P6 avant pilote** : confirmer que
> l'app marche bout en bout, et **trancher la question ouverte
> d'idempotence sur `provider.id`** (cf. arch §11.1, CHANGELOG P6.4 —
> seul vrai blocker pour démarrer le pilote).
>
> Pré-requis supposés acquis : une instance Ekylibre (API v2 + catalogue
> seedé minimal, cf. `docs/P0-checklist.md` §1.6). **L'instance peut être
> locale** (Docker, `https://<tenant>.ekylibre.localhost`) **ou distante** —
> et **ngrok n'est pas obligatoire** : voir §0.2 pour le détail par cas.
> Les tests curl (dont le blocker S4) tournent contre une instance locale
> sans tunnel (validé le 2026-05-30 contre `https://demo.ekylibre.localhost`).

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

### 0.2. Choisir l'instance : locale (sans ngrok) ou distante

Deux modes. **ngrok n'est PAS un pré-requis** : il ne sert qu'à exposer une
instance _locale_ à un _device physique_ en HTTPS public. Tout le reste
(curl, simulateur, émulateur) marche sans tunnel.

**A. Instance locale — recommandé pour le dev quotidien.**

Ekylibre core tourne en local via son `docker compose` (reverse-proxy qui
sert chaque tenant en `https://<tenant>.ekylibre.localhost`, certificat de
dev). Setup côté repo **core** (hors de ce repo mobile) :

```bash
# Dans le repo ekylibre/ekylibre
docker compose up -d                 # web + db + reverse-proxy
# Création tenant + seed démo : les tâches rake EXACTES dépendent de la
# version d'Ekylibre core — se référer à son README. À la fin on dispose :
#   - d'une URL  https://<tenant>.ekylibre.localhost  (API v2 incluse)
#   - d'un compte de test (email + mot de passe)
```

→ `EKY_INSTANCE_URL = https://<tenant>.ekylibre.localhost` (ex. `demo`).

**B. Instance distante** : VM/serveur Ekylibre joignable en HTTPS public
(cf. `docs/P0-checklist.md` §1.6). `EKY_INSTANCE_URL` = son URL. RAS.

#### Joignabilité : qui doit atteindre l'instance ?

Le piège du test local n'est pas l'instance, c'est **qui** lui parle.
`*.ekylibre.localhost` ne résout qu'en `127.0.0.1`, **sur la machine de dev**.

| Depuis…                     | URL à utiliser                                                                           | ngrok ?                                                                                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **curl (machine de dev)**   | `https://<tenant>.ekylibre.localhost`                                                    | ❌ non — c'est le cas de TOUS les tests curl : sanity §0.4, **S4 idempotence**, vérifs serveur S3/S5/S10.                                      |
| **Simulateur iOS**          | `https://<tenant>.ekylibre.localhost`                                                    | ❌ non — partage la pile réseau du Mac (ajouter le vhost à `/etc/hosts` si `.localhost` ne résout pas ; importer le cert de dev au trousseau). |
| **Émulateur Android**       | `adb reverse tcp:443 tcp:443` puis l'URL `.localhost`, ou `https://10.0.2.2`             | ❌ non — `adb reverse` mappe le loopback de l'hôte dans l'émulateur.                                                                           |
| **Device physique (Wi-Fi)** | IP LAN de la machine (`https://192.168.x.x`) + instance acceptant ce host, **ou** tunnel | ⚠️ **ngrok (ou équivalent) ici** : le vhost `.localhost` + cert self-signed ne sont ni résolus ni valides depuis le téléphone.                 |

**TL;DR**

- Le **blocker S4** et tous les tests curl : instance **locale, sans ngrok**.
- Scénarios UI sur **simulateur/émulateur** : instance **locale, sans ngrok**.
- Scénarios UI sur **device physique** contre une instance **locale** :
  c'est le seul cas où ngrok (ou une IP LAN + cert accepté) est requis.
  Sinon, pointer le device vers une instance **distante** (mode B).

> Cert self-signed : si curl refuse le certificat de l'instance locale,
> ajouter `-k` aux commandes (§0.4). Sur device, l'app rejettera un cert de
> dev non approuvé — attendu ; préférer une instance distante pour l'UI device.

### 0.3. Variables côté instance Ekylibre

Note dans ton password manager (jamais commit) :

| Clé                 | Valeur attendue                             |
| ------------------- | ------------------------------------------- |
| `EKY_INSTANCE_URL`  | `https://<ton-instance>` (sans slash final) |
| `EKY_TEST_EMAIL`    | email du compte utilisateur                 |
| `EKY_TEST_PASSWORD` | mot de passe                                |

### 0.4. Sanity check curl

Avant de lancer l'app, vérifie que l'instance répond au schéma attendu.
Lancé **depuis la machine de dev**, donc OK contre une instance locale comme
distante (cf. §0.2). Si le cert local est self-signed, ajoute `-k` à chaque
`curl`.

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

### 0.5. Lancer Metro

```bash
pnpm start                      # dev client uniquement, pas Expo Go
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

> **✅ RÉSOLU (2026-05-30, core).** L'API v2 dédoublonne désormais sur
> `(provider.vendor, provider.id)` : un 2ᵉ POST identique renvoie **`200` avec
> le même `id`** (= Résultat A ci-dessous). Le blocker P6.5 est **levé**.
> Section conservée pour mémoire / non-régression.

C'était le seul vrai blocker P6 pour passer en pilote (cf. CHANGELOG
P6.4/P6.5). On voulait savoir **si Ekylibre dédoublonne sur `provider.id`**.

### S4 — Test bac à sable : double POST identique

| Étape                               | Détail                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup                               | Récupérer un payload exact qu'on enverrait au POST. Le plus simple : faire S2 + S3, puis lire les logs Metro pour voir le body envoyé. Ou intercepter via Charles Proxy. Sauvegarder le payload comme `payload.json`.                                                                                                                                       |
| Action 1                            | `curl -X POST -H "Authorization: simple-token $EKY_TEST_EMAIL $TOKEN" -H "Content-Type: application/json" -d @payload.json "$EKY_INSTANCE_URL/api/v2/interventions"` → noter `id` retourné.                                                                                                                                                                 |
| Action 2                            | **Re-jouer exactement le même curl** (même `provider.id` UUID).                                                                                                                                                                                                                                                                                             |
| Résultat A — server dédoublonne     | Le 2e appel retourne le **même `id`** (ou 200 sans création). ✅ Idempotent. **Décision : trust (P6 ship as-is)**. Documenter dans CHANGELOG.                                                                                                                                                                                                               |
| Résultat B — server crée un doublon | Le 2e appel retourne un `id` **différent**. ❌ Pas idempotent. **C'est le cas observé le 2026-05-30** (ids 44≠45 / 46≠47). ⚠️ Le GET défensif initialement envisagé est **non faisable** : `provider` n'est pas sérialisé par `GET /api/v2/interventions` et il n'existe pas de filtre `provider_id`. Fix → ticket **P6.5** (dédup côté serveur priorisée). |

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

- [x] **S1** Login + sync initiale → catalogue téléchargé sur le device
      (validé device 2026-05-30, après fix géométrie `cultivable_zones`).
- [x] **S2** Saisie spraying offline → ligne pending visible (validé device
      2026-06-14 sur build pilote ; 2 bémols hors-périmètre S2 trackés : handler
      qui ne lock pas l'unité auto, équipements non filtrés par procedure).
- [x] **S3** Sync online → ligne synced + intervention visible côté Eky web avec
      le bon `provider.id` (validé après fix core **P6.6** spraying Procedo +
      fix app du parsing réponse `{ id }` qui laissait la ligne « à
      synchroniser »).
- [x] **S4** Test bac à sable idempotence → **✅ RÉSOLU côté core (2026-05-30)** :
      l'API v2 dédoublonne sur `provider.id` (2ᵉ POST identique → `200`, même
      `id`). Le blocker P6.5 est **levé**. Repro initiale via
      `scripts/s4-idempotence.sh` (RÉSULTAT B), confirmée corrigée depuis.
- [x] **S5** 422 → message serveur visible dans détail (validé device 2026-06-14).
- [x] **S6** 5xx → reste pending + retry OK (validé device 2026-06-14 ; observé
      en pratique : 404 quand l'API Rails est down, traité comme transient par
      le client — retry OK quand l'API remonte).
- [x] **S7** Network down → reste pending + retry OK (validé device 2026-06-14,
      message d'erreur connexion distinct du 5xx).
- [x] **S8** Catalogue stale → MissingServerIdError visible (validé device
      2026-06-14, 0 POST tenté pour cette intervention).
- [x] **S9** Logout warning quand pending > 0 (validé device 2026-06-14, alert
      à 2 paragraphes + purge des locales au logout volontaire).
- [x] **S10** 401 → redirect login avec bannière (validé device 2026-06-14,
      interventions pending **non purgées**, retrouvées au re-login).
- [x] **S11** Double-tap Synchroniser → 1 seul POST (validé device 2026-06-14).
- [x] **S12** Pull-to-refresh + bouton parallèle → 1 seul POST (validé device
      2026-06-14).
- [x] Vérification visuelle du payload dans Charles/logs : `provider` présent avec
      `vendor='ekylibre-mobile'`, `name`, `id`=UUID, `data.app_version`,
      `data.os`, `data.locale` (validé device 2026-06-14).

Si **tous verts** → green light pour préparer P7 (carte) et lancer le
panel pilote en parallèle (cf. P0-checklist §1.6 + workflow §11
checkpoints).

Si **un rouge** → ne pas distribuer au panel. Ouvrir un ticket ciblé sur le
scénario qui casse.

> **MAJ 2026-05-30** — le blocker historique **S4 (idempotence)** est **levé**
> côté core, et **S3** (push spraying) passe désormais bout-en-bout après le fix
> core **P6.6** (procédure spraying : nœuds Procedo `ActorPresenceTest`/
> `Division`/`nil.unit`, cf. `docs/p6.6-ekylibre-spraying-procedo-issue.md`) et
> le fix app du parsing de la réponse d'écriture (`{ id }`).
>
> **MAJ 2026-06-14** — smoke device complet validé sur build pilote (post-rebuild
> EAS, post-PR Ekylibre `shape_geojson`, post-re-sync catalogue). **10/10 verts**
> (S2 + S5–S12 + vérif payload `provider`). Green light côté code ; iOS/TestFlight
> prêt à soumettre une fois les placeholders `eas.json` renseignés. Android attend
> l'approbation du compte developer Google. Les 2 follow-ups initialement
> identifiés (handler qui ne lock pas l'unité auto, filtrage des équipements
> par procedure) ont été **livrés dans la même session** — cf. CHANGELOG entrées
> _Polish UX form spraying_ et _Filtrage des équipements par procedure_. Re-sync
> catalogue requise sur device pour le 2ᵉ (peuple `products.abilities`).

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
