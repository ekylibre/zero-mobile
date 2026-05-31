# Workflow — Refonte UI de la saisie d'intervention (alignement sur `zero-android-v3`)

> **Type :** plan d'implémentation (aucun code n'est écrit par ce document).
> **Cible :** harmoniser l'UI de capture d'intervention de `zero-mobile` avec
> l'ergonomie de l'ancienne app Android `zero-android-v3`.
> **Source de vérité visuelle :** `zero-android-v3/doc/screenshots/` (4 captures).
> **Phase repo :** fin P6 → ce chantier est un **P7-bis (polish UI)**, à mener
> en parallèle / avant la carte parcellaire (P7).
> **Prochaine étape :** `/sc:implement` phase par phase.

---

## 1. Analyse des écrans de référence (ancienne app)

| # | Capture | Écran | Patterns clés à reprendre |
|---|---------|-------|---------------------------|
| 1 | `170514` | **Liste des interventions** | Toolbar = nom de ferme · toggle segmenté « Mes interventions / Toutes » · sous-titre « Dernière synchronisation HH:MM » · ligne = **pictogramme procédure** + titre bleu + `N cultures • X ha` + résumé produit/outil + **date relative verte** (aujourd'hui/hier) · **barre d'action basse fixe** « ENREGISTRER UNE INTERVENTION » |
| 2 | `170524` | **Choix de la procédure** | **Bottom-sheet** sur fond grisé · titre « ENREGISTRER UNE INTERVENTION DE… » · **grille 3 colonnes de tuiles à pictogrammes** (Semis, Travail du sol, Irrigation, Récolte, Entretien, Fertilisation, Pulvérisation) |
| 3 | `170556` | **Sélecteur de cultures** | **Modal** · en-tête vert « Sélectionnez des cultures » · liste **groupée** : parcelle (checkbox + surface + chevron) → productions imbriquées (checkbox + vignette + nom + `X ha travaillés`) · **barre de validation verte** « N cultures • X ha » + VALIDER |
| 4 | `170705` | **Formulaire d'intervention** | **Sections accordéon** à titre bleu + **résumé inline** quand replié (`Cultures → 2 cultures • 4,3 ha`, `Temps de travail → 11 avr. • 3 h`) · action inline verte **« + AJOUTER »** pour les tableaux · **cartes d'item** (icône + nom + fournisseur + croix verte de suppression) · **quantité + unité côte à côte + total calculé** (`51,9 l au total`) · **barre basse fixe** ANNULER / ENREGISTRER |

### Charte visuelle observée
- **Vert Ekylibre** `≈ #607D41` (toggle actif, en-têtes de modal, barres de validation, actions « + AJOUTER », croix de suppression, dates relatives).
- **Bleu** toolbar `≈ #2196F3` + barres d'action basses.
- Titres de section **bleus**, valeurs **grises**, libellés secondaires gris clair.
- Densité forte, cartes à coins arrondis, séparateurs fins.

---

## 2. État actuel de `zero-mobile` (écart à combler)

| Zone | Ancienne app | `zero-mobile` aujourd'hui | Écart |
|------|--------------|---------------------------|-------|
| Liste | pictogrammes + résumé cultures/ha + date relative verte + barre basse | `FlatList` + `InterventionListItem` (icône grise vide, pas de pictogramme, ajout via route) | Pictogrammes, résumé `N cultures • X ha`, date relative, barre basse |
| Picker procédure | grille pictogrammes en bottom-sheet | `ProcedurePickerView` = liste verticale de cartes texte | Grille + pictogrammes + bottom-sheet |
| Formulaire | accordéon + résumés + barre basse + total | `SprayingFormView` = `ScrollView` plat, sections empilées, submit inline | Accordéon, résumés repliés, barre basse, total `X l au total` |
| Sélecteur cible | modal groupé multi-cultures avec totaux | `SelectField<CultivableZoneOption>` mono-sélection | Modal groupé, surfaces, total, (multi-sélection = décision §6) |
| Intrants | carte + qté + unité + **total calculé** | `InputsFieldArray` (qté + unité, pas de total affiché) | Total `X l au total`, style carte |
| Thème | charte verte/bleue centralisée | couleurs hex en dur, éparpillées | Tokens de thème partagés |

**Contraintes architecture à respecter (cf. `CLAUDE.md`)**
- UI primitives sans dépendance router/DB dans `src/ui/` ; vues feature prennent les données en props ; câblage par hooks dans `app/(tabs)/…`.
- i18n obligatoire : toute string passe par `locales/fr/common.json` + `useTranslation()`.
- RHF + `Controller` pour les champs non natifs ; schémas Zod dans `src/domain/` (messages FR dans le schéma).
- `react-native-svg` déjà présent (pictogrammes possibles en SVG) — **dépendance native, déjà dans le dev build**, pas de rebuild requis si on ne change pas les deps.
- Le `client_uuid` est généré une seule fois (ADR-13) — **ne pas y toucher** dans la refonte.
- Pattern tableaux mono-élément (`targets`/`doers`/`tools` = array 0/1) à préserver tant que la décision §6 n'est pas tranchée.

---

## 3. Brique de design system (pré-requis transverse)

À créer dans `src/ui/` avant de toucher les écrans, pour éviter le copier-coller de styles :

1. **`theme.ts`** — tokens centralisés (`colors.greenEky`, `colors.blue`, `colors.textPrimary/secondary/muted`, `spacing`, `radius`). Remplace progressivement les hex en dur.
2. **`ProcedureIcon.tsx`** — mappe `ProcedureKey → pictogramme` (SVG via `react-native-svg`, fallback rond coloré + initiale si l'asset manque). Réutilisé par la liste **et** le picker.
3. **`AccordionSection.tsx`** — section repliable : titre bleu + slot `summary` (affiché replié) + slot enfants (affiché déplié) + chevron. Contrôlé (`expanded`/`onToggle`) pour rester testable.
4. **`BottomActionBar.tsx`** — barre basse fixe (1 ou 2 boutons), `SafeAreaView` bottom inset.
5. **`ItemCard.tsx`** — carte d'item générique (icône + titre + sous-titre + croix de suppression verte) ; mutualise intrants/outils/doers.
6. **`InlineAddButton.tsx`** — action verte « + AJOUTER ».
7. **`GroupedSelectModal.tsx`** — modal de sélection groupée (en-tête vert, groupes repliables avec checkbox + total, barre de validation verte). Générique `<Group, Item>`.

> Chaque primitive : composant pur, props-driven, testé isolément (harness `useState` cf. pattern P5 dans `CLAUDE.md`).

---

## 4. Plan phasé

### Phase A — Design system & thème *(fondation, sans changement visuel net)*
- **A1** Créer `src/ui/theme.ts` ; exporter via `src/ui/index.ts`.
- **A2** Créer `ProcedureIcon`, `AccordionSection`, `BottomActionBar`, `ItemCard`, `InlineAddButton` (sans encore les brancher).
- **A3** Tests unitaires des primitives (rendu + interactions repli/suppression).
- **Checkpoint A :** `pnpm typecheck` + `pnpm test` verts ; primitives exportées.
- **Dépendances :** aucune. **Risque :** faible.

### Phase B — Picker de procédure (grille pictogrammes)
- **B1** Réécrire `ProcedurePickerView` en **grille** (2–3 colonnes) de tuiles `ProcedureIcon` + libellé ; états indisponibles grisés (« Bientôt disponible »).
- **B2** Présenter l'écran en **bottom-sheet / modal** (titre « Enregistrer une intervention de… »). Vérifier la route `app/(tabs)/interventions/new.tsx`.
- **B3** Clés i18n : réutiliser `intervention.procedures.*` (déjà présentes) ; ajouter le titre du sheet.
- **B4** Adapter `ProcedurePickerView.test.tsx`.
- **Checkpoint B :** picker en grille, navigation vers `spraying` intacte, tests verts.
- **Dépendances :** A2. **Risque :** faible.

### Phase C — Formulaire de saisie (accordéon + barre basse + total)
- **C1** Restructurer `SprayingFormView` en **sections `AccordionSection`** : Cibles, Temps de travail, Intrants, Outils, Opérateurs — chacune avec **résumé inline replié** (`N cultures • X ha`, `date • durée`, `n intrants`, …).
- **C2** Brancher la **`BottomActionBar`** (Annuler / Enregistrer) ; retirer le submit inline ; conserver `handleSubmit`, `submitting`, et le `defaultClientUuid`.
- **C3** Dans `InputsFieldArray` : style **carte** (`ItemCard`), action **`InlineAddButton`**, **total calculé** « X {unit} au total » (qté × surface cible). ⚠️ le total dépend de la surface → nécessite `areaHectares` de la cible (déjà dispo via `CultivableZoneOption`/`useCultivableZones`).
- **C4** Préserver intégralement : Zod (`makeSprayingSchema`), forme `[{id, reference_name, name}]`, `client_uuid` (ADR-13).
- **C5** Mettre à jour `SprayingFormView.test.tsx` + `InputsFieldArray.test.tsx`.
- **Checkpoint C :** formulaire accordéon fonctionnel, total affiché, persistance inchangée (`persistSprayingIntervention`), tests verts, **smoke device** (saisie → save `pending`).
- **Dépendances :** A2. **Risque :** moyen (le calcul du total et la conservation de la forme RHF sont les points sensibles).

### Phase D — Sélecteur de cibles (modal groupé)
- **D1** Créer `GroupedSelectModal` rempli depuis `useCultivableZones` (surfaces, noms de production complets, filtre `dead_at`).
- **D2** Brancher dans la section « Cibles » du formulaire à la place du `SelectField` actuel.
- **D3** ✅ Décision §6 tranchée = **multi-cibles**. Côté domaine, **une seule ligne** : `spraying.ts` `targets … .length(1)` → `.min(1, 'Au moins 1 parcelle cible.')`. Persister + push-engine bouclent déjà sur le tableau (vérifié) — rien d'autre à toucher. Mettre à jour `spraying.ts` (tests du schéma) + le détail (déjà multi) si besoin.
- **D4** Tests du modal + intégration formulaire.
- **Checkpoint D :** sélection de cible(s) via modal, résumé `N cultures • X ha` remonté dans l'accordéon.
- **Dépendances :** A2, C1, décision §6. **Risque :** moyen→élevé si multi-cibles retenu.

### Phase E — Liste des interventions (pictogrammes + résumé + barre basse)
- **E1** Enrichir `InterventionListItem` : `ProcedureIcon` à gauche, résumé `N cultures • X ha`, date relative **verte** (réutiliser `Intl.DateTimeFormat`, cf. pattern P4 — pas de date-fns).
- **E2** Ajouter la **barre d'action basse** « Nouvelle intervention » dans `InterventionsListView` (équivalent v1 du double bouton « Déjà réalisée / Qui commence » de l'ancienne app — voir §6).
- **E3** Conserver pull-to-refresh + `SyncBadge` + action « Supprimer » existante.
- **E4** Mettre à jour `InterventionsListView.test.tsx`.
- **Checkpoint E :** liste alignée visuellement, tri/sync/suppression intacts, tests verts.
- **Dépendances :** A2. **Risque :** faible.

### Phase F — Détail d'intervention (cohérence visuelle)
- **F1** Aligner `app/(tabs)/interventions/[id].tsx` sur les nouvelles primitives (cartes, `ProcedureIcon`, `ParcelShape` déjà en place pour les cibles).
- **F2** Vérifier l'affichage du total et des unités cohérent avec le formulaire.
- **Checkpoint F :** détail cohérent avec liste + formulaire.
- **Dépendances :** A2, C, E. **Risque :** faible.

### Phase G — Finition & validation
- **G1** Passe i18n : zéro string en dur, clés ajoutées dans `locales/fr/common.json`.
- **G2** Remplacer les derniers hex en dur par `theme.ts`.
- **G3** `pnpm lint` + `pnpm format` + `pnpm typecheck` + `pnpm test:ci`.
- **G4** **Smoke device** sur dev build : login → liste → picker → formulaire → save → Synchroniser → `synced` (re-jouer S1/S3/S4).
- **Checkpoint G :** CI verte, parcours device validé, captures avant/après archivées.
- **Dépendances :** toutes. **Risque :** faible.

---

## 5. Graphe de dépendances

```
A (thème + primitives)
├─► B (picker grille)
├─► C (formulaire accordéon) ──► D (modal cibles) ─┐
├─► E (liste) ────────────────────────────────────┤
└──────────────────────────────────────────────► F (détail) ──► G (finition)
                                  (décision §6 bloque D)
```
Parallélisable après A : **B**, **C**, **E** indépendants. **D** dépend de C + décision §6. **F** dépend de C/E. **G** clôture.

---

## 6. Décisions à trancher avant implémentation (bloquantes)

1. **Mono- vs multi-cibles.** ✅ **TRANCHÉ (2026-05-31) : MULTI-CIBLES.** Fidèle à l'ancienne app (sélection de plusieurs cultures). **Vérification du code faite** : la couche données supporte déjà N cibles — `intervention_targets` est une relation 1-N, `persister.ts` boucle déjà `for (const target of input.targets)`, `push-engine.fetchRelations` récupère toutes les lignes cibles, le détail fait `detail.targets.map`. **Seul changement domaine requis** : relâcher `spraying.ts` `targets: z.array(targetSchema).length(1, …)` → `.min(1, 'Au moins 1 parcelle cible.')` (rétro-compatible : 1 cible passe toujours). Le reste = UI (GroupedSelectModal multi-select, Phase D) + total intrants sur la somme des surfaces (Phase C §6.5).
2. **Pictogrammes.** Réutiliser/convertir les pictos de `zero-android-v3` (assets vectoriels) ou créer un jeu SVG maison ? Fallback rond+initiale acceptable en intérim ?
3. **Entrée de saisie.** L'ancienne app propose 2 boutons « Déjà réalisée / Qui commence ». La v1 ne capture que la pulvérisation a posteriori → **garder un seul bouton « Nouvelle intervention »** (confirmer).
4. **Toggle « Mes / Toutes les interventions ».** Présent dans l'ancienne app — hors périmètre v1 (mono-utilisateur, données locales) ? → **À exclure** sauf avis contraire.
5. **Calcul du total intrants.** `qté × surface_cible` — confirmer la règle métier (par cible vs total intervention) et le comportement multi-cibles.

---

## 7. Fichiers impactés (estimation)

**Créés :** `src/ui/theme.ts`, `ProcedureIcon.tsx`, `AccordionSection.tsx`, `BottomActionBar.tsx`, `ItemCard.tsx`, `InlineAddButton.tsx`, `GroupedSelectModal.tsx` (+ tests).
**Modifiés :** `ProcedurePickerView.tsx`, `SprayingFormView.tsx`, `InputsFieldArray.tsx`, `InterventionsListView.tsx`, `InterventionListItem.tsx`, `app/(tabs)/interventions/[id].tsx`, `app/(tabs)/interventions/new.tsx`, `src/ui/index.ts`, `locales/fr/common.json` (+ tests associés).
**Potentiellement (si multi-cibles) :** `src/domain/intervention/spraying-schema.ts`, `src/features/intervention/persister.ts`.

---

## 8. Quality gates par phase

- **Code :** `pnpm typecheck`, `pnpm lint`, `pnpm format:check`.
- **Tests :** `pnpm test` (unitaires primitives + vues) ; `pnpm test:ci` en clôture.
- **Device :** dev build Expo (`expo start --dev-client`), re-jouer smoke S1/S3/S4 ; vérifier `react-native-svg` rend bien les pictogrammes (symptôme connu : rendu blanc si native module pas rebuild — ici pas de nouvelle dep, donc OK).
- **i18n :** grep des strings JSX en dur = 0.
- **Non-régression sync :** ne pas toucher `src/core/sync/*` ni `client_uuid` ; le parcours save→sync doit rester identique.

---

## 9. Risques & mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Casser la forme RHF (`targets`/`inputs`) lors du passage accordéon | save échoue / rows bloqués | Conserver `Controller` + forme `[{...}]` à l'identique ; tests RHF avant/après |
| ~~Multi-cibles non décidé~~ | ✅ résolu | Multi-cibles tranché (2026-05-31). Coût réel = UI Phase D + 1 ligne Zod (DB/persist/sync déjà compatibles, vérifié). |
| Pictogrammes manquants → rendu vide | UI dégradée | Fallback rond+initiale dans `ProcedureIcon` dès A2 |
| Hex en dur résiduels | dette visuelle | Phase G dédiée + `theme.ts` introduit dès A1 |
| Total intrants faux (surface) | donnée erronée affichée | Spécifier la règle §6.5 + test de calcul dédié |

---

## 10. Avancement (2026-05-31)

| Phase | Statut | Notes |
|-------|--------|-------|
| A — Design system | ✅ | `theme`, `ProcedureIcon`, `AccordionSection`, `BottomActionBar`, `ItemCard`, `InlineAddButton` (+ tests) |
| B — Picker grille | ✅ | grille de pictogrammes, procédures non gérées grisées « Bientôt » |
| C — Formulaire accordéon | ✅ | sections repliables + résumés, `BottomActionBar`, **total intrants** à l'hectare |
| D — Multi-cibles | ✅ | `MultiSelectField` (sélection à plat — pas d'arbre, données plates), Zod `targets.min(1)` |
| E — Liste | ✅ | `ProcedureIcon` + date relative verte + « N cultures • X ha » (hook `useInterventionTargetCounts`) + barre basse |
| F — Détail | ✅ | `ItemCard` + `ProcedureIcon` + total intrants + tokens |
| G — Finition | ⏳ | CI **verte** (lint/format/typecheck/test:ci, 247 tests). Reste : (1) **smoke device** sur dev build ; (2) migration optionnelle des hex des **primitives héritées** `SelectField`/`DateTimeField`/`EmptyState` vers `theme` — implique un **alignement d'accent `#0066cc → blue #2196F3`** à valider visuellement. `SyncBadge` déjà migré (tokens = valeurs identiques). |

### G4 — Smoke device (manuel, non automatisable ici)
Sur dev build (`expo start --dev-client`), re-jouer S1/S3/S4 + vérifier :
- pictogrammes emoji (`ProcedureIcon`) rendus liste/picker/détail/formulaire ;
- accordéon (repli/dépli, sections en erreur forcées ouvertes) ;
- modal **multi-cibles** (cocher plusieurs, VALIDER, résumé « N cultures • X ha ») ;
- **total intrants** « X l au total » cohérent form ↔ détail ;
- barres basses `BottomActionBar` (inset SafeArea) liste + formulaire ;
- parcours complet save (`pending`) → Synchroniser → `synced`.
