#!/bin/bash
# Setea las env vars del frontend en Vercel (production + preview).
# Lee de .env y solo sube las VITE_* (las de backend NO van).

set -e
cd "$(dirname "$0")/.."

# Source .env
set -a
source .env
set +a

VARS=(
  "VITE_SUPABASE_URL"
  "VITE_SUPABASE_ANON_KEY"
  "VITE_SUPABASE_PUBLISHABLE_KEY"
  "VITE_PUBLIC_SITE_URL"
  "VITE_CLINIC_NAME"
  "VITE_CLINIC_DOCTOR"
  "VITE_CLINIC_PHONE"
  "VITE_CLINIC_PHONE_DISPLAY"
  "VITE_WOMPI_PUBLIC_KEY"
)

for V in "${VARS[@]}"; do
  VALUE="${!V}"
  if [ -z "$VALUE" ]; then
    echo "  ⚠  $V no está en .env, skip"
    continue
  fi
  for ENV in production preview development; do
    # remove existing first (idempotent)
    vercel env rm "$V" "$ENV" --yes 2>/dev/null || true
    printf "%s" "$VALUE" | vercel env add "$V" "$ENV" --force 2>&1 | tail -1
  done
  echo "  ✅ $V"
done

echo "\n✅ Env vars seteadas en Vercel"
