# Zero Mobile — Notes de version v1 (pilote)

> Note destinée aux agriculteurs du panel pilote.

## Bienvenue

Merci de tester **Zero Mobile**, la nouvelle application Ekylibre pour
saisir vos interventions phytosanitaires directement depuis le tracteur
ou la parcelle, même sans réseau.

Cette première version se concentre volontairement sur **un seul cas
d'usage** : la **pulvérisation**. D'autres procédures arriveront en v1.5+
selon vos retours.

## Ce que vous pouvez faire

### Connexion à votre instance Ekylibre

- Saisissez l'URL de votre instance (ex : `https://ferme.ekylibre.com`),
  votre email et votre mot de passe Ekylibre.
- Au premier login, l'app télécharge votre catalogue : procédures,
  produits, parcelles, cultures.

### Saisir une pulvérisation hors-ligne

- Bouton « + Nouvelle intervention » → choisir « Pulvérisation ».
- Renseigner :
  - Date et heure de début/fin
  - Une ou plusieurs **cibles** (parcelles ou cultures) — soit par la
    liste, soit en tapant directement sur la **carte**
  - Conducteur
  - Intrant(s) phyto (produit + dose + unité)
  - Pulvérisateur
  - Notes libres (optionnel)
- Tout fonctionne **sans connexion** : vos saisies restent localement
  sur le téléphone tant que vous n'avez pas de réseau.

### Synchroniser quand le réseau revient

- Bouton « Synchroniser » en haut de la liste des interventions, ou
  glissement vers le bas (pull-to-refresh).
- Chaque intervention passe en vert (synchronisée) ou rouge (erreur)
  avec le message du serveur expliquant pourquoi.

### Carte des parcelles offline

- L'onglet **Carte** affiche vos parcelles et cultures en polygones
  colorés.
- Le contour autour de vos parcelles (5 km) est précaché à chaque
  synchronisation pour pouvoir naviguer **sans réseau**.

### Modifier ou supprimer une intervention non synchronisée

- Les interventions en attente (`pending`) ou en erreur peuvent être
  éditées ou supprimées.
- Une fois synchronisées, elles ne sont plus modifiables côté mobile
  (passez par le web Ekylibre).

## Ce qui ne fonctionne pas encore

- **Une seule procédure : pulvérisation.** Semis, labour, récolte etc.
  arriveront dans des versions ultérieures.
- **Pas de modification après synchronisation** côté mobile.
- **Lange français uniquement.**
- **Pas de gestion multi-comptes** (un seul utilisateur connecté à la
  fois).
- **Filtrage avancé des doses par produit** (ex : kg/ha vs l/ha selon
  le phyto) : la v1 propose les unités standard, des affinements
  viendront en v1.5.

## Comment nous remonter un problème

1. Notez les étapes qui ont amené au bug (capture d'écran si possible).
2. Notez la date et l'heure.
3. Envoyez à `support@ekylibre.com` avec en objet : `[Pilote zero-mobile] <résumé>`.

Si l'app crashe, un rapport est automatiquement envoyé à Sentry (côté
Ekylibre) — vous n'avez pas besoin de l'envoyer vous-même, mais le
contexte fonctionnel (« j'étais en train de faire X ») nous aide
énormément.

## Mises à jour

L'app peut se mettre à jour **toute seule sans repasser par le store**
(via Expo Updates). Quand vous rouvrez l'app après une nouvelle release
pilote, elle télécharge la dernière version en quelques secondes.

Les changements importants (nouvelles deps natives) nécessitent en
revanche de réinstaller un nouveau build depuis TestFlight (iOS) ou
Google Play Internal Testing (Android). Nous vous préviendrons par
email dans ce cas.

## Merci

Vos retours guident directement la suite des versions. N'hésitez pas à
nous dire ce qui marche, ce qui agace, ce qui manque.

— L'équipe Ekylibre
