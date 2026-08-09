#!/usr/bin/env bash
# Despliega la integración de Bold (pagos en línea) a Supabase.
#
# Uso:
#   ./scripts/deploy-bold.sh test     # llaves de PRUEBAS (por defecto)
#   ./scripts/deploy-bold.sh prod     # llaves de PRODUCCIÓN
#
# Lee las llaves de ./credenciales.md (que está en .gitignore y NUNCA se versiona).
# El script no imprime las llaves: solo confirma su longitud.
#
# Requisito: estar logueado en la cuenta de Supabase dueña del proyecto Chiropract.
#   supabase login && supabase link --project-ref dqxffnibxizlfaeddzrz

set -euo pipefail
cd "$(dirname "$0")/.."

ENV="${1:-test}"
CRED_FILE="credenciales.md"
PROJECT_REF="dqxffnibxizlfaeddzrz"

if [ ! -f "$CRED_FILE" ]; then
  echo "❌ No encuentro $CRED_FILE"; exit 1
fi

# Extrae las llaves. Ojo: algunas líneas traen espacios al final, por eso se
# recortan ANTES de aplicar el patrón (si no, esa llave se pierde silenciosamente
# y se termina mandando la llave equivocada -> Bold responde 403).
# Orden en el archivo: [Pruebas] identidad, secreta ; [Produccion] identidad, secreta
mapfile -t KEYS < <(sed 's/[[:space:]]*$//' "$CRED_FILE" | grep -oE '^[A-Za-z0-9_-]{20,}$' || true)

if [ "${#KEYS[@]}" -lt 4 ]; then
  echo "❌ Esperaba 4 llaves en $CRED_FILE (identidad+secreta de pruebas y de producción); encontré ${#KEYS[@]}"
  exit 1
fi

if [ "$ENV" = "prod" ]; then
  IDENTITY="${KEYS[2]}"; SECRET="${KEYS[3]}"; LABEL="PRODUCCIÓN"
else
  IDENTITY="${KEYS[0]}"; SECRET="${KEYS[1]}"; LABEL="PRUEBAS"
fi

echo "═══════════════════════════════════════════════"
echo " Desplegando Bold — entorno: $LABEL"
echo " Llave de identidad: ${#IDENTITY} caracteres"
echo " Llave secreta:      ${#SECRET} caracteres"
echo "═══════════════════════════════════════════════"

echo
echo "1/3 · Guardando llaves como secretos de Supabase…"
supabase secrets set \
  BOLD_IDENTITY_KEY="$IDENTITY" \
  BOLD_SECRET_KEY="$SECRET" \
  --project-ref "$PROJECT_REF"

echo
echo "2/3 · Aplicando migración 032 (tabla bold_events + apply_bold_event)…"
supabase db query --linked -f supabase/migrations/032_bold_payments.sql

echo
echo "3/3 · Desplegando Edge Functions…"
supabase functions deploy bold-create-link --use-api
supabase functions deploy bold-webhook --use-api

echo
echo "✅ Bold desplegado en $LABEL."
echo
echo "FALTA UN PASO MANUAL en el panel de Bold:"
echo "  Integraciones → Webhook → URL:"
echo "  https://${PROJECT_REF}.supabase.co/functions/v1/bold-webhook"
echo
echo "Luego valida con:  ./scripts/verificar-bold.sh"
