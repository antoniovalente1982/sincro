#!/bin/bash
# Validazione Ad Set Meta — Metodo Sincro
# Usare: ./validate-adset.sh <ADSET_ID> <ACCESS_TOKEN>

ADSET_ID=$1
TOKEN=$2

if [ -z "$ADSET_ID" ] || [ -z "$TOKEN" ]; then
  echo "❌ Uso: ./validate-adset.sh <ADSET_ID> <ACCESS_TOKEN>"
  exit 1
fi

echo "🔍 Validazione Ad Set: $ADSET_ID"
echo "---"

RESULT=$(curl -s "https://graph.facebook.com/v21.0/$ADSET_ID?fields=targeting,optimization_goal,promoted_object,name&access_token=$TOKEN")

# Estrai valori
AGE_MIN=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('targeting',{}).get('age_min','??'))")
AGE_MAX=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('targeting',{}).get('age_max','??'))")
LOCALES=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('targeting',{}).get('locales','??'))")
COUNTRIES=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('targeting',{}).get('geo_locations',{}).get('countries','??'))")
ADV_AUD=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('targeting',{}).get('targeting_automation',{}).get('advantage_audience','??'))")
OPT_GOAL=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('optimization_goal','??'))")
PIXEL=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('promoted_object',{}).get('pixel_id','??'))")
EVENT=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('promoted_object',{}).get('custom_event_type','??'))")
NAME=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('name','??'))")

echo "Ad Set: $NAME"
echo ""

ERRORS=0

# Validazioni
if [ "$AGE_MIN" = "38" ]; then echo "✅ Età min: $AGE_MIN"; else echo "❌ Età min: $AGE_MIN (deve essere 38)"; ERRORS=$((ERRORS+1)); fi
if [ "$AGE_MAX" = "65" ]; then echo "✅ Età max: $AGE_MAX"; else echo "❌ Età max: $AGE_MAX (deve essere 65)"; ERRORS=$((ERRORS+1)); fi
if [ "$LOCALES" = "[6]" ]; then echo "✅ Lingua: Italiano"; else echo "❌ Lingua: $LOCALES (deve essere [6] = Italiano)"; ERRORS=$((ERRORS+1)); fi
if echo "$COUNTRIES" | grep -q "IT"; then echo "✅ Paese: Italia"; else echo "❌ Paese: $COUNTRIES (deve includere IT)"; ERRORS=$((ERRORS+1)); fi
if [ "$ADV_AUD" = "0" ]; then echo "✅ Advantage+ Audience: Disattivato"; else echo "❌ Advantage+ Audience: $ADV_AUD (deve essere 0)"; ERRORS=$((ERRORS+1)); fi
if [ "$OPT_GOAL" = "OFFSITE_CONVERSIONS" ]; then echo "✅ Ottimizzazione: $OPT_GOAL"; else echo "❌ Ottimizzazione: $OPT_GOAL (deve essere OFFSITE_CONVERSIONS)"; ERRORS=$((ERRORS+1)); fi
if [ "$PIXEL" = "311586900940615" ]; then echo "✅ Pixel: Metodo Sincro"; else echo "❌ Pixel: $PIXEL (deve essere 311586900940615)"; ERRORS=$((ERRORS+1)); fi
if [ "$EVENT" = "LEAD" ]; then echo "✅ Evento: LEAD"; else echo "❌ Evento: $EVENT (deve essere LEAD)"; ERRORS=$((ERRORS+1)); fi

echo ""
if [ $ERRORS -eq 0 ]; then
  echo "🟢 TUTTO OK — L'ad set rispetta tutte le direttive"
else
  echo "🔴 $ERRORS ERRORI TROVATI — Correggere PRIMA di attivare!"
fi
