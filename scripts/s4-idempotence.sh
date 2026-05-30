#!/usr/bin/env bash
#
# S4 — Test bac à sable d'idempotence sur provider.id (docs/testing-guide.md §2).
#
# Le SEUL vrai blocker P6 avant pilote (CHANGELOG P6.4) : Ekylibre
# dédoublonne-t-il un POST /api/v2/interventions sur provider.id ?
#
# Le script construit un payload spraying FIDÈLE (même forme que
# src/core/sync/payload-builder.ts) à partir du catalogue live, puis POST
# DEUX FOIS avec le même provider.id (UUIDv4) et compare les `id` rendus.
#
#   Résultat A : 2e POST -> MÊME id  => idempotent  => trust (ship as-is)
#   Résultat B : 2e POST -> id DIFFÉRENT => doublon  => GET défensif (P6.5)
#
# ⚠️ Crée 1 à 2 interventions RÉELLES sur l'instance de test. Les ids créés
#    sont affichés en fin pour nettoyage manuel éventuel.
#
# Usage : scripts/s4-idempotence.sh [chemin-env]   (défaut: .env.test.local)
set -euo pipefail

ENV_FILE="${1:-.env.test.local}"
APP_VERSION="${APP_VERSION:-0.1.0}"
OS="${OS:-ios}"
LOCALE="${LOCALE:-fr-FR}"

[ -r "$ENV_FILE" ] || { echo "❌ $ENV_FILE introuvable/illisible"; exit 1; }
set -a; . "$ENV_FILE"; set +a
: "${EKY_INSTANCE_URL:?manque EKY_INSTANCE_URL}"
: "${EKY_TEST_EMAIL:?manque EKY_TEST_EMAIL}"
: "${EKY_TEST_PASSWORD:?manque EKY_TEST_PASSWORD}"
BASE="${EKY_INSTANCE_URL%/}"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Extrait un champ via python3 (pas de jq sur cette machine).
jget() { python3 -c "import json,sys; d=json.load(open('$1')); print(eval(sys.argv[1], {}, {'d': d}))" "$2"; }

echo "==> 1. Login ($BASE)"
curl -fsS -X POST "$BASE/api/v2/tokens" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EKY_TEST_EMAIL\",\"password\":\"$EKY_TEST_PASSWORD\"}" >"$WORK/tok.json"
TOKEN="$(jget "$WORK/tok.json" "d['token']")"
AUTH="Authorization: simple-token $EKY_TEST_EMAIL $TOKEN"
echo "    token OK (${#TOKEN} chars)"

echo "==> 2. Sanity GET catalogue + interventions (attendu: 200)"
for ep in procedures "products?product_type=workers" cultivable_zones variants interventions; do
  code="$(curl -s -o /dev/null -w '%{http_code}' -H "$AUTH" "$BASE/api/v2/$ep")"
  printf "    %-34s %s\n" "$ep" "$code"
  [ "$code" = 200 ] || { echo "❌ $ep != 200 — stop (cf. §0.4)"; exit 1; }
done

# Références produits valides POUR LEUR RÔLE — défauts découverts depuis une
# intervention spraying réelle de la démo (#2). Le 1er produit de chaque type
# n'est PAS forcément cohérent (un matter peut être une semence, pas un phyto),
# d'où des ids fixes plutôt qu'un auto-pick. Tous overridables par env.
DOER_PID="${DOER_PID:-292}"          # worker -> reference_name driver
INPUT_PID="${INPUT_PID:-333}"        # phyto  -> reference_name plant_medicine
TARGET_PID="${TARGET_PID:-7}"        # cultivation (target)
TOOL_PID="${TOOL_PID:-246}"          # equipment -> reference_name sprayer
# NB: la donnée démo date de 2017 et le produit 246 est un TRACTEUR.
# L'app enverrait reference_name 'sprayer' (cf. spraying.ts) — testé KO ici
# (nil.unit, produit non-pulvérisateur). On utilise 'tractor' pour obtenir un
# POST accepté ; la divergence app/serveur est documentée à part (S3/S5).
TOOL_REF="${TOOL_REF:-tractor}"
HANDLER="${HANDLER:-volume_area_density}"
UNIT="${UNIT:-liter_per_hectare}"
QTY="${QTY:-1.4}"
# Dates dans la fenêtre de validité des cultures démo (clôturées 31/08/2017).
START_AT="${START_AT:-2017-03-09T10:00:00Z}"
STOP_AT="${STOP_AT:-2017-03-09T16:00:00Z}"

echo "==> 3. Construction du payload (forme = buildCreateInterventionPayload)"
echo "    doer=$DOER_PID input=$INPUT_PID target=$TARGET_PID tool=$TOOL_PID/$TOOL_REF handler=$HANDLER unit=$UNIT"
python3 - "$APP_VERSION" "$OS" "$LOCALE" "$DOER_PID" "$INPUT_PID" "$TARGET_PID" "$TOOL_PID" "$TOOL_REF" "$HANDLER" "$UNIT" "$QTY" "$START_AT" "$STOP_AT" >"$WORK/payload.json" <<'PY'
import json, sys, uuid
(app_version, os_name, locale, doer_pid, input_pid, target_pid,
 tool_pid, tool_ref, handler, unit, qty, start, stop) = sys.argv[1:14]

client_uuid = str(uuid.uuid4())

inp = {
    "product_id": int(input_pid),
    "reference_name": "plant_medicine",
    "quantity_value": float(qty),
    "quantity_handler": handler,
    "quantity_unit": unit,
}

payload = {
    "procedure_name": "spraying",
    "actions": [],
    "provider": {
        "vendor": "ekylibre-mobile",
        "name": "zero-mobile",
        "id": client_uuid,
        "data": {"app_version": app_version, "os": os_name, "locale": locale},
    },
    "working_periods_attributes": [
        {"started_at": start, "stopped_at": stop}
    ],
    "doers_attributes":  [{"product_id": int(doer_pid),   "reference_name": "driver"}],
    "inputs_attributes": [inp],
    "targets_attributes":[{"product_id": int(target_pid), "reference_name": "cultivation"}],
    "tools_attributes":  [{"product_id": int(tool_pid),   "reference_name": tool_ref}],
    "description": "S4 idempotence bac-à-sable (zero-mobile)",
}
json.dump(payload, sys.stdout, ensure_ascii=False)
sys.stderr.write(f"    client_uuid(provider.id)={client_uuid}\n")
PY

PROVIDER_ID="$(jget "$WORK/payload.json" "d['provider']['id']")"

post() {  # $1=label -> écrit la réponse dans $WORK/$1.json, renvoie le code HTTP
  curl -s -o "$WORK/$1.json" -w '%{http_code}' \
    -X POST -H "$AUTH" -H 'Content-Type: application/json' \
    --data-binary @"$WORK/payload.json" "$BASE/api/v2/interventions"
}

echo "==> 4. POST #1 (création)"
C1="$(post post1)"; echo "    HTTP $C1"
[ "$C1" = 200 ] || [ "$C1" = 201 ] || { echo "❌ POST #1 a échoué:"; cat "$WORK/post1.json"; exit 1; }
ID1="$(jget "$WORK/post1.json" "d['id']")"
echo "    id #1 = $ID1"

echo "==> 5. POST #2 (MÊME provider.id = $PROVIDER_ID)"
C2="$(post post2)"; echo "    HTTP $C2"
ID2=""
if [ "$C2" = 200 ] || [ "$C2" = 201 ]; then
  ID2="$(jget "$WORK/post2.json" "d['id']")"
  echo "    id #2 = $ID2"
else
  echo "    body #2:"; cat "$WORK/post2.json"; echo
fi

echo "==> 6. Contre-vérif : nb d'interventions portant ce provider.id côté serveur"
curl -fsS -H "$AUTH" "$BASE/api/v2/interventions" >"$WORK/list.json"
# ⚠️ Le serializer v2 (GET list) N'EXPOSE PAS `provider` -> ce compteur est
# INFORMATIF seulement, jamais un signal de verdict. Le signal fiable = id1≠id2.
COUNT="$(python3 -c "import json;d=json.load(open('$WORK/list.json'));print(sum(1 for i in d if (i.get('provider') or {}).get('id')=='$PROVIDER_ID'))")"
PROV_SERIALIZED="$(python3 -c "import json;d=json.load(open('$WORK/list.json'));print('oui' if any(i.get('provider') for i in d) else 'non')")"
echo "    provider sérialisé dans GET list ? $PROV_SERIALIZED"
echo "    (info, peu fiable) interventions exposant provider.id=$PROVIDER_ID : $COUNT"

echo
echo "================= VERDICT S4 ================="
# Signal primaire = les deux ids rendus par les POST. Le compteur serveur est
# inexploitable tant que provider n'est pas sérialisé (cf. PROV_SERIALIZED).
if [ "$C2" != 200 ] && [ "$C2" != 201 ]; then
  echo "⚠️  2e POST rejeté (HTTP $C2). Un rejet pourrait indiquer un refus de"
  echo "    doublon côté serveur — inspecter le body #2 ci-dessus pour trancher."
elif [ "$ID1" = "$ID2" ]; then
  echo "✅ RÉSULTAT A — IDEMPOTENT : 2e POST a rendu le MÊME id ($ID1)."
  echo "   Décision: TRUST (P6 ship as-is). Marquer P6.4 DONE dans le CHANGELOG."
else
  echo "❌ RÉSULTAT B — NON IDEMPOTENT : 2e POST a créé une 2e intervention"
  echo "   (id #1=$ID1, id #2=$ID2). Ekylibre ne dédoublonne PAS sur provider.id."
  if [ "$PROV_SERIALIZED" = non ]; then
    echo "   AGGRAVANT: provider absent du GET list -> un GET défensif par"
    echo "   provider.id n'est PAS faisable via l'API v2 actuelle. Le fix P6.5"
    echo "   exige du serveur (dédup sur provider.id) ou un protocole d'ack."
  else
    echo "   Décision: GET défensif avant POST (provider exposé). Ticket P6.5."
  fi
fi
echo "=============================================="
echo "ids créés (doublons à nettoyer côté instance) : #1=$ID1 ${ID2:+#2=$ID2}"
