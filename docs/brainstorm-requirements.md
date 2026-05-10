# zero-mobile — Requirements v1 (issu du brainstorming)

> Document produit par `/sc:brainstorm` le 2026-05-10. Phase suivante :
> `/sc:design` (architecture) ou `/sc:workflow` (plan d'implémentation).
> Ce document décrit **uniquement les exigences** ; aucune décision
> d'architecture, schéma de DB ou contrat d'API n'est figée ici.

## 1. Vision

Nouvelle application mobile React Native pour Ekylibre, inspirée de
`zero-kotlin` (Android natif Kotlin/Hilt/Room) et `zero-android-v3`
(Android natif Java/GraphQL). Objectif : permettre à l'**agriculteur**
de saisir ses interventions agricoles sur le terrain, **hors-ligne**,
puis de les synchroniser avec son instance Ekylibre via l'**API REST
v2**.

Refonte volontairement réduite en v1 — l'enjeu est de **prouver la
boucle « saisie hors-ligne → synchro fiable »** avant d'élargir le
périmètre fonctionnel des apps existantes.

## 2. Utilisateurs cibles

- **Profil principal v1** : agriculteur exploitant, francophone,
  saisissant ses propres interventions.
- Profil autonome sur smartphone, charge cognitive faible attendue
  (UX épurée, vocabulaire métier français).
- Pas de techniciens itinérants en v1 (multi-comptes hors périmètre).

## 3. Périmètre fonctionnel v1

### Inclus

- **Authentification** : URL d'instance + email + mot de passe →
  `POST /api/v2/tokens`. Compatible cloud Ekylibre et instances
  on-premise.
- **Synchronisation initiale** : pré-téléchargement à la première
  connexion :
  - Liste des procédures (`GET /procedures`)
  - Produits (`GET /products?product_type=...` pour workers,
    equipments, matters, etc.)
  - Parcelles cultivables (`GET /cultivable_zones`)
  - Variants produit (`GET /variants`)
- **Saisie d'une intervention « pulvérisation » (procedure_name =
  `spraying`)**, en dur, formulaire fait main :
  - 1 cible parcelle (sélection dans liste pré-syncée)
  - ≥1 intrant (plant_medicine + variant + quantité + handler)
  - ≥1 outil (pulvérisateur)
  - ≥1 doer (ouvrier/agriculteur)
  - Période de travail : **saisie a posteriori** (dates et durée
    saisies manuellement, pas de chrono in-situ)
  - Notes / description libres
- **Validation stricte locale** : la cardinalité et les champs
  requis de la procédure spraying sont vérifiés _avant_ la sauvegarde.
  L'utilisateur ne peut pas enregistrer une intervention invalide.
- **Visualisation cartographique** des parcelles (MapLibre + tuiles
  OpenStreetMap, en lecture seule, pas de dessin de polygone).
- **Synchronisation manuelle** : bouton « Synchroniser » qui pousse
  les interventions locales et tire les changements serveur. Pas de
  sync automatique.
- **Hors-ligne complet** après le premier login : toutes les
  fonctions restent utilisables sans réseau.
- **i18n architecturalement prête** : toutes les chaînes externalisées
  (i18next ou équivalent) ; seule la locale FR est livrée en v1.
- **Stockage chiffré du token** d'authentification (Keychain iOS /
  Keystore Android via `expo-secure-store`).

### Hors périmètre v1 (à phaser en v1.5+)

- Moteur de formulaire dynamique pour toutes les procédures (la pièce
  centrale de zero-kotlin) — v1.5
- Procédures autres que `spraying` (`sowing`, `harvesting`, etc.) — v1.5
- Groupes (`group_parameters_attributes`) et readings — v2
- Capture de polygones GPS (`working_zone`) sur le terrain — v2
- Chronomètre in-situ pour les `working_periods` — v2
- Multi-comptes / multi-tenants simultanés sur un appareil — v2
- Tracking GPS continu façon Traccar (présent dans zero-kotlin) — non prévu
- Multi-flavors marque blanche (Agriconomie, etc.) — non prévu en v1
- Vérifications réglementaires phyto (miscibilité, dose homologuée…)
  — explicitement déléguées au serveur Ekylibre en v1
- Multi-langue effective (EN, ES, etc.) — v2

## 4. User stories prioritaires

### US-1 — Premier login avec téléchargement du catalogue

_En tant qu'agriculteur, lorsque je lance l'app pour la première
fois, je saisis l'URL de mon instance, mon email et mon mot de
passe ; après authentification, l'app télécharge mon catalogue
(procédures, produits, parcelles, variants) et m'indique sa
progression._

**Critères d'acceptation** :

- Un échec d'auth affiche un message clair (mauvais identifiants,
  instance injoignable, réseau absent).
- Si le téléchargement initial est interrompu, l'app sait reprendre
  sans tout retélécharger.
- Le token est stocké de façon chiffrée et n'est jamais lu en clair
  ailleurs que par l'app.

### US-2 — Saisie d'une pulvérisation hors-ligne

_En tant qu'agriculteur sur le terrain sans réseau, je peux ouvrir
l'app, choisir « Nouvelle pulvérisation », sélectionner une parcelle,
ajouter un ou plusieurs produits phytosanitaires avec leurs
quantités, désigner l'outil utilisé et le doer, saisir les
dates/durées et des notes, puis enregistrer._

**Critères d'acceptation** :

- L'app fonctionne intégralement sans réseau (aucun appel sortant
  bloquant pendant la saisie).
- La validation locale empêche la sauvegarde d'une intervention
  incomplète et signale précisément ce qui manque.
- L'intervention enregistrée apparaît immédiatement dans une liste
  « À synchroniser ».

### US-3 — Visualisation des parcelles sur carte

_En tant qu'agriculteur, je peux ouvrir une carte qui montre mes
parcelles cultivables avec leur géométrie, et y sélectionner une
parcelle pour la cible de mon intervention._

**Critères d'acceptation** :

- La carte affiche les polygones des parcelles du catalogue local.
- Le rendu cartographique fonctionne hors-ligne (tuiles OSM mises en
  cache pour la zone d'intérêt — niveau de zoom à préciser en design).
- Tap sur une parcelle = sélection (pas de dessin libre en v1).

### US-4 — Synchronisation manuelle vers Ekylibre

_En tant qu'agriculteur de retour à la ferme avec une connexion, je
tape « Synchroniser » et l'app envoie mes interventions locales,
récupère les changements distants et m'indique le résultat._

**Critères d'acceptation** :

- Toutes les interventions locales sont envoyées via
  `POST /api/v2/interventions` avec un objet `provider` valide
  (`vendor: "zero-mobile"`, `id: <UUID client>`).
- Les IDs serveur retournés sont mémorisés et liés aux objets locaux
  (pour les éditions futures).
- Un échec serveur (validation, conflit, erreur réseau) laisse
  l'intervention concernée en état « erreur de sync » avec le
  message serveur affiché ; les autres interventions du lot sont
  envoyées indépendamment.
- Aucune duplication serveur si l'utilisateur tape « Synchroniser »
  plusieurs fois (idempotence par UUID client / `provider.id`).

## 5. Exigences non-fonctionnelles

| Exigence                    | Cible v1                                                                 |
| --------------------------- | ------------------------------------------------------------------------ |
| Plateformes                 | iOS + Android livrés en parallèle                                        |
| Volumétrie hypothèse        | < 500 parcelles, < 1 000 produits par exploitation (à mesurer en pilote) |
| Sync initiale               | < 2 min sur 4G dans l'hypothèse « petite ferme »                         |
| Démarrage app (après login) | App utilisable en < 2 s même hors-ligne                                  |
| Sécurité token              | Stockage Keychain/Keystore via `expo-secure-store`                       |
| Sécurité données locales    | Données catalogue non chiffrées en v1 (à ré-évaluer si infos sensibles)  |
| Internationalisation        | Chaînes externalisées dès le départ ; FR livré                           |
| Crash reporting             | À cadrer en design (Sentry vraisemblable)                                |
| Build distribuable          | TestFlight (iOS) + Internal Testing Play Console (Android)               |

## 6. Contraintes techniques actées

- **Stack** : Expo + **Expo Development Build** (custom dev client).
  WatermelonDB requiert du code natif (JSI) et **n'est pas compatible
  avec Expo Go** — il faut builder l'app pour la lancer en dev.
  EAS Build pour la CI/CD.
- **Base locale** : WatermelonDB. Le protocole de synchronisation
  WatermelonDB sera adapté à l'API REST v2 d'Ekylibre (qui n'expose
  pas nativement le format pull/push attendu — couche d'adaptation
  côté client).
- **Cartographie** : MapLibre Native (RN) + tuiles OpenStreetMap.
- **Auth API v2** : token simple, header
  `Authorization: simple-token <email> <token>`. Pas d'OAuth.
- **Provider obligatoire au POST** : chaque intervention envoyée doit
  inclure `{ vendor: "zero-mobile", name: "...", id: <UUID client>, data: {...} }`
  pour assurer l'idempotence et la traçabilité.
- **IDs serveur générés** : `id`, `number`, `event_id` retournés par
  le serveur ; le client doit garder son UUID local et créer le
  mapping après réponse.
- **`procedure_name` immuable** une fois l'intervention créée
  côté serveur — la liste des procédures doit avoir été pré-syncée
  pour valider le choix offline.

## 7. Critères d'acceptation « v1 livrée »

La v1 est considérée terminée quand un build est :

1. Distribué via **TestFlight** (iOS) et **Internal Testing**
   (Play Console / Android).
2. Mis aux mains d'un **panel pilote** d'agriculteurs Ekylibre
   (nombre et profil à fixer hors de ce document).
3. Capable de jouer le scénario complet (login → sync initiale →
   saisie hors-ligne d'une pulvérisation → retour réseau → sync →
   vérification web) **chez ≥3 utilisateurs pilotes différents**.

Le passage en stores publics (production) est explicitement **hors
v1** et conditionné aux retours du panel.

## 8. Questions ouvertes / décisions différées

À trancher avant ou pendant la phase de design :

1. **Bouton « Déconnexion » explicite** : pas explicitement validé
   dans le brainstorm (un seul item « token chiffré » a été coché en
   sécurité). Hypothèse de travail : **le bouton est inclus en v1**
   comme standard ergonomique. À confirmer par l'utilisateur.
2. **Politique de purge à la déconnexion** : conserver les
   interventions non-syncées avec avertissement, ou les effacer ?
3. **Volumétrie réelle des fermes pilotes** : l'hypothèse « petit »
   (< 500 parcelles / < 1 000 produits) doit être instrumentée et
   mesurée dès la première connexion réelle.
4. **Pagination côté Ekylibre** : la doc API v2 ne mentionne pas de
   pagination explicite sur `/products` et `/variants`. Vérifier
   le comportement pour les fermes au catalogue conséquent (au cas
   où l'hypothèse « petit » s'avère fausse).
5. **Mises à jour OTA** (Expo Updates) : à décider — utile pour
   livrer vite des correctifs au pilote, mais nécessite un canal
   séparé du store.
6. **Crash reporting / observabilité** : Sentry, Bugsnag, ou
   solution interne Ekylibre ? Décision en design.
7. **Politique offline pour les tuiles MapLibre** : précachage par
   zone d'intérêt à la sync initiale, ou cache opportuniste ?
8. **Adaptateur WatermelonDB ↔ API v2** : le protocole sync de
   WatermelonDB attend un endpoint pull/push dédié (changes log).
   L'API REST v2 d'Ekylibre ne l'expose pas. Choix d'architecture à
   acter en design : adaptation côté client (transformation des
   réponses REST en changes log) ou contournement (sync ad-hoc
   sans utiliser le protocole WatermelonDB intégré).
9. **Provider.data** : quelles métadonnées y placer (version d'app,
   OS, identifiant device, géolocalisation au moment de la saisie) ?
10. **Procédure pilote pour le pilote** : `spraying` est choisie,
    mais elle touche au domaine phyto réglementaire. À valider que
    les agriculteurs pilotes sont équipés et veulent saisir cette
    intervention en priorité (par opposition à `sowing` ou
    `harvesting`, plus saisonniers).

## 9. Inspirations & antipatterns à éviter

### À reprendre de zero-kotlin

- Architecture MVVM claire avec séparation Activity/Fragment ↔
  ViewModel ↔ couche données ↔ SDK API (transposable en RN avec
  écrans ↔ hooks/store ↔ services ↔ client API).
- Pipeline `procédure → formulaire` (à généraliser plus tard, en v1.5,
  via le moteur dynamique).
- État `LOCAL` / `REMOTE` sur les interventions, mais **corrigé** :
  utiliser un UUID client persistant + le champ `provider.id` côté
  Ekylibre pour garantir l'idempotence et éviter le risque de
  duplication observé dans zero-kotlin lors de l'édition d'une
  intervention déjà synchronisée.

### À ne pas reproduire

- _God-class_ `InterventionActivity` de zero-android-v3 (~71KB,
  > 1 000 lignes) mélangeant UI, sync, validation. Découper en
  > écrans à responsabilité unique dès la v1.
- État global via singletons / `SharedPreferences` statiques.
- Identifiants techniques en dur dans le binaire
  (`TEST_PASSWORD = "12345678"` dans zero-kotlin) : tout secret doit
  passer par un store sécurisé et ne jamais être commité.
- HTTP en clair autorisé (`network_security_config.xml` permissif
  de zero-kotlin) : HTTPS seul, sans exception.
- Couverture de test ~0 dans les deux projets antérieurs : prévoir
  Jest + RN Testing Library dès le début (tests sur la validation
  locale et la couche de sync en priorité).

---

## Hand-off

**Étape suivante recommandée** : `/sc:design` pour définir
l'architecture (modules, modèle de données WatermelonDB, contrat
de l'adaptateur sync, structure de navigation), suivi de
`/sc:workflow` pour le plan d'implémentation jalonnée.
