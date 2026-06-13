# Onboarding pilote — Installation de Zero Mobile

> À transmettre aux agriculteurs du panel pilote en complément des
> [notes de version](release-notes-v1-pilote.md).

## Sommaire

1. [Pré-requis](#1-pré-requis)
2. [Installation iOS (TestFlight)](#2-installation-ios-testflight)
3. [Installation Android (Internal Testing)](#3-installation-android-internal-testing)
4. [Première utilisation](#4-première-utilisation)
5. [Mises à jour](#5-mises-à-jour)
6. [Signaler un bug](#6-signaler-un-bug)

---

## 1. Pré-requis

- Un compte Ekylibre actif avec accès à votre instance
  (`https://votre-ferme.ekylibre.com`).
- Un smartphone iOS 14+ **ou** Android 8+.
- L'adresse email avec laquelle vous avez été invité au pilote (vérifiez
  votre boîte mail, l'invitation TestFlight / Play Console y est arrivée).

---

## 2. Installation iOS (TestFlight)

### Étape 1 — Installer TestFlight

Sur votre iPhone, ouvrez l'App Store et téléchargez **TestFlight** (gratuit,
application officielle d'Apple).

### Étape 2 — Accepter l'invitation

Vous avez reçu un email d'Apple intitulé _« You're invited to test
Zero Mobile »_.

- Ouvrez l'email sur votre iPhone.
- Tapez sur **View in TestFlight** (ou **Voir dans TestFlight**).
- TestFlight s'ouvre, tapez **Accept** puis **Install**.

### Étape 3 — Lancer l'app

Une fois installée, l'app **Zero Mobile** apparaît sur votre écran d'accueil
avec un point orange à côté du nom (signe qu'il s'agit d'une version de
test). Tapez dessus pour la lancer.

---

## 3. Installation Android (Internal Testing)

### Étape 1 — Accepter l'invitation

Vous avez reçu un email Google Play intitulé
_« Vous avez été invité à un test interne — Zero Mobile »_.

- Ouvrez l'email sur votre téléphone Android.
- Tapez sur **Become a tester** (ou **Devenir testeur**).

### Étape 2 — Installer depuis Google Play

- Le lien vous redirige vers la fiche Google Play de Zero Mobile.
- Tapez **Installer**.
- Une fois l'installation terminée, lancez l'app depuis l'écran d'accueil
  ou le tiroir d'applications.

---

## 4. Première utilisation

### 4.1 Connexion

1. À l'ouverture, l'écran **Connexion à Ekylibre** s'affiche.
2. Renseignez :
   - **Adresse de l'instance** : `https://votre-ferme.ekylibre.com` (avec
     `https://` au début).
   - **Email** et **mot de passe** Ekylibre.
3. Tapez **Se connecter**.

### 4.2 Synchronisation initiale

Au premier login, l'app télécharge votre catalogue : procédures, produits,
parcelles, cultures. Compter **~30 s en 4G** pour une exploitation de taille
moyenne.

Si la sync est interrompue (perte réseau, app fermée), elle reprend
**automatiquement** au prochain lancement depuis l'étape interrompue.

### 4.3 Scénario type — Saisir une pulvérisation

1. Onglet **Interventions** → bouton **+ Nouvelle intervention**.
2. Choisir **Pulvérisation**.
3. Renseigner section par section :
   - **Dates** : date et heure de début + fin (défaut : maintenant + 1 h).
   - **Cibles** : tapez **Choisir sur la carte** pour une sélection
     graphique, ou utilisez la liste.
   - **Conducteur** : sélectionner dans la liste.
   - **Intrants** : ajouter au moins un produit phyto (produit + dose +
     unité).
   - **Pulvérisateur** : sélectionner l'équipement utilisé.
   - **Notes** (optionnel).
4. Tapez **Enregistrer** en bas.
5. L'intervention apparaît dans la liste avec un point **orange**
   (« à synchroniser »).

### 4.4 Synchronisation

- Quand vous avez du réseau, tapez **Synchroniser** en haut de la liste
  (ou glissez vers le bas).
- Le point orange devient **vert** (synchronisé) ou **rouge** (erreur,
  avec le message serveur visible dans le détail).

### 4.5 Vérifier sur le web

Reconnectez-vous à votre instance Ekylibre depuis un navigateur :
l'intervention que vous venez de saisir doit y apparaître.

---

## 5. Mises à jour

### 5.1 Mises à jour automatiques (Expo OTA)

Quand vous rouvrez l'app, elle vérifie en arrière-plan si une mise à jour
est disponible. Si oui, elle la télécharge en quelques secondes — vous
n'avez rien à faire.

### 5.2 Mises à jour majeures (nouveau build)

Pour les changements profonds (ex : nouvelle dépendance technique), une
nouvelle version est publiée sur TestFlight / Internal Testing. Vous
recevrez un email d'invitation à la mettre à jour. Suivez la même
procédure qu'à l'installation initiale.

---

## 6. Signaler un bug

### 6.1 Bugs fonctionnels

Envoyez un email à **`support@ekylibre.com`** avec :

- **Objet** : `[Pilote zero-mobile] <résumé court>`
- **Description** : étapes qui ont amené au problème.
- **Capture d'écran** si possible (sur iOS : volume + power, sur Android :
  volume bas + power).
- **Date et heure** approximatives.
- **Modèle de téléphone** et version OS.

### 6.2 Crashes

Si l'app se ferme brutalement, un rapport technique est envoyé
**automatiquement** à l'équipe Ekylibre. Vous pouvez en complément
envoyer un email court avec le contexte fonctionnel (« j'étais en train
de saisir une intervention quand l'app a planté »).

### 6.3 Suggestions / améliorations

Tous les retours sont précieux. Même format que pour les bugs, avec
l'objet `[Pilote zero-mobile] Suggestion : <résumé>`.

---

Merci pour votre participation au pilote — vos retours guident
directement la suite du produit.

— L'équipe Ekylibre
