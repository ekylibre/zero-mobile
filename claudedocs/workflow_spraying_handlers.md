# Workflow — Handlers/units spraying : source serveur + saisie conforme

> Généré par `/sc:workflow` le 2026-05-30, **mis à jour** le 2026-05-30 pour
> intégrer la modification **API Ekylibre** (handlers enrichis sur
> `/api/v2/procedures`). **Plan d'implémentation uniquement — aucun code
> modifié.** Exécution via `/sc:implement`. Stratégie : systematic · deep.
>
> ⚠️ **Workflow inter-dépôts** : Track A = `ekylibre/ekylibre` (Rails),
> Track B = `zero-mobile` (RN). Les deux sont décrits ici.

## 1. Problème & objectif

### Symptôme

Le formulaire de pulvérisation produit des paires `(quantity_handler,
quantity_unit)` **non conformes** à la procédure Ekylibre `spraying` :

```jsonc
// ACTUEL (faux) — unité saisie en texte libre
{ "quantity_handler": "area_density", "quantity_unit": "l" }
// ATTENDU (conforme spraying.xml)
{ "quantity_handler": "mass_area_density",   "quantity_unit": "kilogram_per_hectare" }
{ "quantity_handler": "volume_area_density", "quantity_unit": "liter_per_hectare" }
```

### Causes racines

1. **`InputsFieldArray.tsx:20`** — `SPRAYING_HANDLERS = ['population',
'net_volume', 'net_mass', 'area_density']`. `area_density` n'existe pas ;
   liste incomplète et désynchronisée de la procédure.
2. **`InputsFieldArray.tsx:225-235`** — `quantity_unit` = `TextInput` **libre**.
3. **Cause de fond** : l'app **devine** les handlers/units au lieu de les lire
   de la **définition de procédure** servie par l'API. L'API ne fournit
   d'ailleurs **que les noms** (pas les unités).

### Décision d'architecture (NOUVELLE)

La **source de vérité = le serveur**. On enrichit `/api/v2/procedures` pour
qu'il porte, par handler, `{ name, indicator?, unit? }`. L'app **lit** ces
définitions (déjà stockées en WDB dans `Procedure.definition_json`) et **génère
dynamiquement** le sélecteur handler → unité. Plus de mirroir hardcodé de
`spraying.xml` côté app (sauf fallback transitoire).

### Forme actuelle de l'API (vérifiée en bac à sable)

`GET /api/v2/procedures` → procédure `spraying` → parameter `plant_medicine` :

```json
"handlers": ["population","net_mass","net_volume","mass_area_density",
             "volume_area_density","specific_weight","volume_density"]
```

Cible visée (cf. demande) :

```json
"handlers": [
  {"name":"population"},
  {"name":"net_mass","indicator":"net_mass","unit":"kilogram"},
  {"name":"net_volume","indicator":"net_volume","unit":"liter"},
  {"name":"mass_area_density","indicator":"mass_area_density","unit":"kilogram_per_hectare"},
  {"name":"volume_area_density","indicator":"volume_area_density","unit":"liter_per_hectare"},
  {"name":"specific_weight","indicator":"specific_weight","unit":"kilogram_per_hectoliter"},
  {"name":"volume_density","indicator":"volume_density","unit":"liter_per_hectoliter"}
]
```

### Source d'autorité (référence, pour valider la sortie serveur)

`~/projects/ekylibre/config/procedures/spraying.xml`, `<input
name="plant_medicine">` :

| handler `name`        | `indicator`           | `unit`                    |
| --------------------- | --------------------- | ------------------------- |
| `population`          | —                     | — (→ `unity` côté app)    |
| `net_mass`            | `net_mass`            | `kilogram`                |
| `net_volume`          | `net_volume`          | `liter`                   |
| `mass_area_density`   | `mass_area_density`   | `kilogram_per_hectare`    |
| `volume_area_density` | `volume_area_density` | `liter_per_hectare`       |
| `specific_weight`     | `specific_weight`     | `kilogram_per_hectoliter` |
| `volume_density`      | `volume_density`      | `liter_per_hectoliter`    |

> Validé : `volume_area_density`/`liter_per_hectare` et `population`/`unity`
> → POST `201`. (Rappel : le push spraying reste bloqué par le bug serveur
> `nil.unit` sur le tool `sprayer`, cf. `docs/p6.6-…md` — indépendant d'ici.)

## 2. Décisions de conception

- **D0 — Serveur = source de vérité.** Les paires handler/unit viennent de
  `/api/v2/procedures`. L'app ne hardcode plus le mapping.
- **D1 — Enrichissement API non-cassant si possible.** Passer `handlers` de
  `[string]` à `[object]` **casse** les consommateurs actuels (legacy
  zero-android/zero-kotlin ?). Deux options à trancher (§6) :
  - **(a) En place** (comme la demande) : `handlers` devient `[{name,…}]`.
    Simple, mais breaking — exige de recenser/migrer les consommateurs.
  - **(b) Additif** : garder `handlers:[string]` **et** ajouter
    `handler_details:[{name,indicator,unit}]`. Non-cassant, transition douce.
  - Reco : **(b)** si d'autres clients consomment l'API ; **(a)** si seul
    `zero-mobile` la lit. À confirmer avec l'équipe core.
- **D2 — Unité dérivée, non saisie (app).** Choisir un handler fixe l'unité
  (lecture seule). Plus de `TextInput` unité.
- **D3 — Parsing résilient (app).** L'app accepte **les deux formes** (string[]
  legacy et object[] enrichi) pendant la transition serveur → pas de couplage
  dur au déploiement core. Si seulement des strings : fallback unité via une
  petite table interne (mirroir minimal de spraying.xml) + log.
- **D4 — `population` → `unity`.** Pas d'unité dans l'XML/serveur ; l'app force
  `unity` (validé 201).
- **D5 — Validation de paire (app).** Zod : `quantity_unit` doit = l'unité du
  handler choisi (issue de la définition de procédure).
- **D6 — Filtrage par produit = HORS SCOPE (P-v1.5+).** Les conditions `if` du
  XML (`PRODUCT.net_mass?`, dimensions, surface) exigent les indicateurs
  produit, absents du catalogue v1. Risque assumé (§6).

## 3. Périmètre des fichiers

### Track A — Ekylibre core (`~/projects/ekylibre`)

| Fichier                                                | Changement                                                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `app/views/api/v2/procedures/_parameter.json.jbuilder` | **Cœur du changement.** Ligne 19-20 : remplacer `.map(&:name)` par un bloc émettant `{ name, indicator?, unit? }` par handler. |
| `test/.../api/v2/procedures_*` (ou request spec)       | Couvrir la nouvelle forme + le cas `population` (sans indicator/unit).                                                         |
| `CHANGELOG` core (si pratiqué)                         | Noter l'évolution de contrat API.                                                                                              |

Esquisse jbuilder (à confirmer : `.name` renvoie bien la clé string, sinon
`.to_s`) :

```ruby
handlers = parameter.handlers
list = handlers.is_a?(Hash) ? handlers.values : Array(handlers)
json.handlers list do |handler|
  json.name handler.name.to_s
  json.indicator handler.indicator.name.to_s if handler.indicator
  json.unit handler.unit.name.to_s if handler.respond_to?(:unit?) && handler.unit?
end
# Option D1(b) : garder aussi `json.handler_names list.map(&:name)` pour compat.
```

> Modèle : `lib/procedo/procedure/handler.rb` → `attr_reader :unit, :indicator`,
> `unit?`. `population` : `indicator` nil + `unit?` false → `{name:"population"}`.

### Track B — zero-mobile (`~/projects/zero-mobile`)

| Fichier                                                                                             | Nature      | Changement                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/api/dtos/procedure.ts`                                                                    | modif       | Typer `parameters[].handlers` : accepter `string \| { name, indicator?, unit? }` (union, `.passthrough()` conservé).                                                            |
| `src/domain/procedures/spraying-handlers.ts`                                                        | **nouveau** | Parser : extrait les handlers du `plant_medicine` d'une définition de procédure → `[{ name, unit }]` (normalise string→objet, applique D3/D4). + libellés.                      |
| `src/features/intervention/InputsFieldArray.tsx`                                                    | modif       | Recevoir les handlers en **prop** (issus de la procédure) ; sélecteur dynamique ; unité dérivée lecture seule ; `onChange` écrit la paire. Supprimer `SPRAYING_HANDLERS` local. |
| `src/features/intervention/SprayingFormView.tsx` + route                                            | modif       | Charger la définition `spraying` (hook catalogue) et passer ses handlers au composant.                                                                                          |
| `src/domain/procedures/spraying.ts`                                                                 | modif       | `quantity_handler` validé contre les handlers connus ; `quantity_unit` = unité du handler (superRefine).                                                                        |
| `locales/fr/common.json`                                                                            | modif       | Libellés des 7 handlers + unités lisibles ; retrait `area_density`.                                                                                                             |
| Tests : `spraying-handlers`, `InputsFieldArray`, `SprayingFormView`, `spraying` schema, `persister` | modif/ajout | Voir Phase 5.                                                                                                                                                                   |

> Inchangés : `payload-builder`, `client` (push), modèle `InterventionInput`,
> `persister` (transportent déjà `quantity_handler` + `quantity_unit`).

## 4. Phases & tâches

### Phase 0 — Pré-requis / arbitrage

- [ ] Trancher **D1 (a) en place vs (b) additif** avec l'équipe core (recenser
      les consommateurs de `/api/v2/procedures` : legacy apps ?).
- [ ] Acter l'**ordre de déploiement** : Track A (serveur) **avant** que le
      bénéfice Track B soit visible — mais D3 rend l'app non-bloquante.
- [ ] Rappel checkpoint : push spraying toujours bloqué par p6.6 (tool sprayer)
      — ce workflow corrige la **saisie input**, pas le bug serveur tool.

### Phase A — Ekylibre core : enrichir l'API (Track A) ✅ FAIT (2026-05-30)

- [x] Modifier `_parameter.json.jbuilder` (bloc handlers → objets) — fait :
      `json.handlers handler_list do |h| name/indicator/unit end`.
- [x] Vérifié sur l'instance démo (curl live) : `GET /api/v2/procedures` →
      `spraying/plant_medicine` renvoie les 7 handlers `{name, indicator?,
  unit?}`, `population` sans indicator/unit. Conforme spraying.xml.
- [ ] **Reste à faire** : tests API (request spec) + commit du repo core (non
      commité à ce jour). Hors périmètre app.
- **Débloque** : Track B peut désormais lire les unités depuis l'API.

### Phase B1 — App : parser & DTO (Track B, fondation)

- [ ] `procedure.ts` DTO : union string|objet pour `handlers`.
- [ ] `spraying-handlers.ts` : `parseSprayingHandlers(definition)` →
      `[{ name, unit, labelKey }]` ; normalise string→objet (D3), `population`→
      `unity` (D4) ; fallback table interne si unité absente + log.
- **Dépend de** : rien (peut précéder A grâce à D3). **Bloque** : B2/B3.

### Phase B2 — App : schéma domaine

- [ ] `spraying.ts` : `quantity_handler` contraint ; `quantity_unit` validé
      contre l'unité du handler (superRefine, message FR).
- **Dépend de** : B1.

### Phase B3 — App : formulaire dynamique

- [ ] `InputsFieldArray` reçoit `handlers` en prop ; options dynamiques ;
      `onChange` handler → écrit `{quantity_handler, quantity_unit}` ; unité en
      affichage lecture seule. Retirer `SPRAYING_HANDLERS`.
- [ ] `SprayingFormView` + route : récupèrent la définition `spraying` (hook
      catalogue WDB) et passent ses handlers.
- **Dépend de** : B1 (et B2 pour types).

### Phase B4 — App : i18n

- [ ] Libellés FR des 7 handlers + unités (kg/ha, l/ha, kg/hl, l/hl, kg, l,
      unité). Retrait `area_density`.
- **Dépend de** : B1.

### Phase 5 — Tests (app)

- [ ] `spraying-handlers.test.ts` : parse object[] ; parse string[] (fallback) ;
      `population`→`unity` ; définition vide → liste vide.
- [ ] `spraying.test.ts` : paire valide / handler inconnu / mauvaise unité.
- [ ] `InputsFieldArray.test.tsx` : handler choisi ⇒ unité auto ; pas d'édition
      libre (harness stateful, cf. CLAUDE.md).
- [ ] `SprayingFormView.test.tsx` + `persister.test.ts` : régression verte.
- **Dépend de** : B1-B4.

### Phase 6 — Qualité & doc

- [ ] App : `pnpm typecheck && pnpm test && pnpm lint` verts.
- [ ] Core : suite de tests API verte.
- [ ] CHANGELOG-v1.md (app) : entrée _Unreleased — handlers/units depuis l'API_.
- [ ] Mettre à jour le commentaire « P-v1.5+ » de `InputsFieldArray` (handlers
      désormais dynamiques ; reste le **filtrage par produit**).

## 5. Graphe de dépendances

```
Phase 0 (arbitrage D1 + ordre déploiement)
   │
   ├─▶ Track A (core: jbuilder + tests) ───────────────┐
   │                                                    │ (déploiement)
   └─▶ B1 (parser+DTO) ─┬─▶ B2 (schéma) ─┐              │
                        ├─▶ B3 (form)    ├─▶ 5 (tests) ─┴─▶ 6 (qualité)
                        └─▶ B4 (i18n)   ─┘
```

Grâce à **D3** (parsing résilient), Track A et Track B sont **découplés** :
l'app peut être livrée avant le déploiement serveur (mode dégradé string[]),
et bascule automatiquement en lisant les objets dès que l'API est déployée.

## 6. Risques & vigilance

| Risque                                                               | Niveau | Mitigation                                                                                                                    |
| -------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **Changement de contrat API cassant** (string[]→object[])            | Élevé  | D1(b) additif, ou recensement consommateurs avant D1(a). App résiliente via D3.                                               |
| **Couplage déploiement core↔app**                                    | Moyen  | D3 : l'app gère les 2 formes → pas de big-bang.                                                                               |
| **`.name` ne renvoie pas la clé attendue** (Onoma item)              | Moyen  | Vérifier en console Rails (`handler.unit.name`, `handler.indicator.name`) ; ajouter `.to_s` si besoin. Test API en garde-fou. |
| **Filtrage par produit absent** → handler incompatible → 400 serveur | Moyen  | Hors scope (D6). Le fix 400→ValidationError (déjà livré) affiche le message.                                                  |
| **Push toujours bloqué par p6.6** (tool sprayer `nil.unit`)          | Élevé  | Indépendant : ce workflow rend l'input conforme ; déblocage complet = fix core p6.6.                                          |
| Tests stateful du composant contrôlé                                 | Faible | Pattern harness CLAUDE.md.                                                                                                    |

## 7. Hors scope (backlog P-v1.5+)

- Filtrage des handlers par produit (indicateurs/dimensions).
- Conversions `forward`/`backward` (population↔dose) côté app.
- Généralisation dynamique multi-procédures (ce workflow cible `spraying`, mais
  le parsing serveur-sourcé pose les bases du moteur de formulaire dynamique).
- Fix serveur p6.6 (`nil.unit` tool `sprayer`).

## 8. Critères d'acceptation

- [ ] **Core** : `GET /api/v2/procedures` renvoie, pour `spraying/plant_medicine`,
      des handlers `{name, indicator?, unit?}` (population sans indicator/unit).
- [ ] **App** : le sélecteur de handler et l'unité sont **construits depuis la
      définition de procédure** (pas hardcodés) ; unité non saisissable.
- [ ] **App** : payload émet une paire valide (`mass_area_density` /
      `kilogram_per_hectare`…), jamais `area_density` / `l`.
- [ ] **App** : fonctionne en dégradé si l'API renvoie encore des strings (D3).
- [ ] `pnpm typecheck && pnpm test && pnpm lint` verts (app) ; tests API verts (core).

---

## 9. Décisions verrouillées (2026-05-30)

1. ✅ **D1 = (a) en place** — `handlers` devient `[{name, indicator?, unit?}]`.
   Aucun client legacy ne consomme `/api/v2/procedures` (confirmé). Pas de
   champ additif ni de compat ascendante côté serveur.
2. ✅ **Unité requise & auto-remplie** — `quantity_unit` obligatoire, fixée par
   le handler (D2/D5), non saisissable.
3. ✅ **Ordre : Track A (core) d'abord.** Instance démo servie par
   `/home/djoulin/projects/ekylibre` (conteneur `app`, mount `-> /app`),
   reload jbuilder automatique en dev → vérif curl immédiate.

**Étape suivante** : exécuter Track A (Phase A), vérifier l'API, puis enchaîner
Track B (`/sc:implement`).

## 10. État d'exécution (2026-05-30)

- ✅ **Track A** (core) : `/api/v2/procedures` enrichi, vérifié live. Reste :
  request spec + commit du repo `ekylibre`.
- ✅ **Track B** (app) : B1 (parser `spraying-handlers.ts` + fallback D3),
  B2 (schéma : unité requise + cohérence handler), B3 (form dynamique + unité
  lecture seule + route lit la définition), B4 (i18n 7 handlers), tests
  (+`spraying-handlers`, schéma, `InputsFieldArray`, persister). **211/211
  verts, typecheck OK**, lint clean sur les fichiers touchés.
- ⏳ **Reste** : commit (app + core), re-sync catalogue device pour les unités
  enrichies, et **déblocage push = fix core P6.6** (`nil.unit` tool sprayer).
- 🔭 **Backlog (hors scope, §7)** : filtrage des handlers par produit.
