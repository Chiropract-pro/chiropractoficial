# chiropract.co — Compilación Completa del Proyecto

Documento de contexto end-to-end del ecosistema **chiropract.co** (CRM + Panel Paciente + SaaS) para handoff a un nuevo agente o consulta en un Claude project.

**Última actualización:** 2026-05-06
**Repo:** https://github.com/chiropractco/system
**Stack:** React 19 + Vite 8 + Supabase + Tailwind 4 + n8n + Evolution API + Wompi + Alegra

---

## 1. CONTEXTO DEL NEGOCIO

**Producto:** SaaS médico multi-tenant para consultorios de quiropraxia/fisioterapia en Colombia.
**Cliente origen:** Dr. Miguel Ángel Díaz (con su esposa Dra. July Blanco como segunda doctora) — tenant inicial.
**Modelo:** Empezó como CRM custom para Miguel; evolucionó a SaaS vendible a otros consultorios.
**Mercado objetivo:** Quiroprácticos, fisioterapeutas, ortopedistas independientes en Colombia (proyección a LATAM).

**Identidad de marca:**
- Nombre: `chiropract.co`
- Doctor flagship: Dr. Miguel Ángel Díaz
- Teléfonos del consultorio: `+57 317 630 5076` (principal), `+57 312 382 4844` (Miguel)
- Esposa/co-doctora: Dra. July Blanco — `+57 310 608 3690`
- Logo: SVG custom (`/public/logos/v1-spine-mark.svg` y variantes) — diseño abstracto de columna vertebral con gradiente teal `#0f766e` → `#005c55`
- 4 variantes de logo: `v1-spine-mark.svg`, `v1-light.svg`, `v1-icon-only.svg`, `v1-favicon.svg`

**Ciudades de operación:** Bogotá (consultorio fijo) + jornadas itinerantes en Boyacá (Soatá, Guamal, Muzo, Garcés Navas).

---

## 2. STACK TÉCNICO

### Frontend
- **React 19.2.4** + Vite 8 + Tailwind CSS 4 + Framer Motion 12
- **lucide-react** para iconos
- **PWA** vía vite-plugin-pwa + Workbox (instalable + offline-friendly)
- **Sharp** (devDep) para generación de iconos PNG desde SVG

### Backend
- **Supabase** (Postgres + Auth + Storage + Edge Functions + RLS) — proyecto `onwgfixvbyknotnbrkgr`
- **Edge Functions** (Deno) deployadas vía `npx supabase functions deploy`
- **PostgreSQL functions** todas con `SECURITY DEFINER` + `SET search_path = public, pg_catalog` (hardening contra search_path attacks)
- **RLS estricta** en todas las tablas sensibles, scoped por `tenant_memberships`

### Integraciones externas
- **n8n** en `https://lab.inventagency.co` — WhatsApp Bot AI Agent + Reminders Cron
- **Evolution API** en `https://ievoapi.inventagency.co` — instancia WhatsApp `Miguel Angel Diaz Quiropractico`
- **OpenAI** — gpt-4o + Whisper (transcripción de audios)
- **FAL.ai** — generación de imágenes con LoRA personalizada del Dr. Miguel
- **Wompi** (Bancolombia, Colombia) — pasarela de pagos
- **Alegra** — proveedor tecnológico autorizado DIAN (factura electrónica)
- **Vercel** — hosting frontend con auto-deploy GitHub

### Hosting & DNS
- **Vercel** project `system` en cuenta chiropractco
- URL actual: `https://system-beta-kohl.vercel.app/`
- Dominio final (pendiente conectar): `chiropract.co`

---

## 3. ARQUITECTURA — VISTA GLOBAL

### 3 paneles distintos en la misma app

| Panel | Auth | Routing |
|---|---|---|
| **Landing público** | Sin auth | `#` (default) |
| **CRM (doctor/staff)** | Supabase Auth (email+password) | `#crm` |
| **Panel Paciente** | OTP vía WhatsApp (custom) | `#paciente` |
| Legal pages | Sin auth | `#terms`, `#privacy` |

### Multi-tenant model

Cada **consultorio = un tenant** con su:
- Logo, slug, dirección, ciudad
- `plan` (trial/basic/pro/enterprise)
- `plan_status` (active/past_due/cancelled)
- Tabla `tenant_memberships` con roles: `owner`, `admin`, `doctor`, `assistant`, `receptionist`
- RLS scoped por `tenant_id IN (SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid())`

### Patient Authentication (independiente)

Los pacientes NO son usuarios de Supabase Auth — son filas en la tabla `patients`. Auth propia:
- `patient_otp_codes` — código de 6 dígitos enviado por WhatsApp (sha256 hash, expira 10 min, max 5 intentos)
- `patient_sessions` — opaque session token (sha256 hash, TTL 30 días rolling)
- Validación on every request via RPC `patient_session_lookup`
- Edge Function `patient-me` es el gateway único para acciones del paciente

---

## 4. RECORRIDO DE FASES (todas completas)

### FASE 0 — Wompi Payment Gateway
**Estado:** ✅ Deployada

**Entregables:**
- 3 Edge Functions: `wompi-create-link`, `wompi-webhook`, `receipt`
- Webhook con verificación HMAC SHA256 (`WOMPI_EVENTS_SECRET`)
- Tabla `payments` con states `pending/approved/declined/voided/error/expired`
- Tabla `wompi_events` (auditoría raw de webhooks)
- RPC `apply_wompi_event` — idempotente, crea sale automática si APPROVED

**Pasos manuales pendientes:**
- Wompi Dashboard → Eventos → Webhook URL = `https://onwgfixvbyknotnbrkgr.supabase.co/functions/v1/wompi-webhook`
- Supabase Auth → Site URL + Redirect URLs whitelist

### FASE 1 — Panel del Paciente (3 sprints)

#### Sprint 1.1 — Auth OTP + Dashboard
- Migración `014_patient_sessions.sql`
- 3 Edge Functions: `patient-otp-request`, `patient-otp-verify`, `patient-me`
- React: `PatientLogin` (phone → OTP), `PatientHome` (citas + recibos + pagos pendientes)
- Rate limit: 5 OTPs/hora por phone
- Sesiones rolling 30 días, revocables
- Tokens almacenados SOLO como `sha256(value)`, nunca plain

#### Sprint 1.2 — Acciones sobre datos
- Migración `015_patient_actions.sql`
- Tabla `appointment_change_requests` para cancel/reschedule pending review
- RPCs: `patient_cancel_appointment`, `patient_request_reschedule`, `patient_get_sale`
- 4 modales React: AppointmentDetail, Cancel, Reschedule, SaleDetail
- Cada acción notifica al doctor por WhatsApp + alert CRM
- Bloqueo de cancelaciones <4h (fuerza llamada al consultorio)
- Anti-spam: 1 reschedule pendiente máx por cita

#### Sprint 1.3 — Self-service final
- Migración `016_patient_self_service.sql`
- ALTER appointments ADD jornada_id
- RPCs: `patient_update_profile`, `patient_list_jornadas`, `patient_book_jornada`
- React: `EditProfileModal`, `BookJornadaModal`
- `SELECT FOR UPDATE` en booking de jornadas (race-safe)
- "Pill" UI: "Llena" / "Ya reservada" / "Reservar lugar"

### FASE 2 — Historia Clínica (3 sprints)

#### Sprint 2.1 — Notas SOAP + Diagrama corporal
- Migración `017_clinical_records.sql`
- Tabla `clinical_records` con:
  - SOAP: subjective, objective, assessment, plan (TEXT)
  - Vitales: weight_kg, height_cm, blood_pressure_systolic/diastolic, heart_rate (con CHECK constraints de rangos físicos)
  - `pain_points` JSONB: `[{side: 'front'|'back', x: 0..1, y: 0..1, intensity: 1..10, type, notes}]`
  - `diagnosis_codes` TEXT[] (CIE-10)
  - Soft delete (`archived_at`, `archived_reason`)
- View `patient_clinical_summary` para dashboards
- RPCs: `clinical_record_upsert` (idempotente por appointment_id), `clinical_record_archive`
- React: `BodyDiagram.jsx` — SVG silueta anterior+posterior con click-to-mark, color por intensidad (verde<5, amber<8, red>=8)
- React: `SoapEditorModal`, `ClinicalHistoryPanel`, `useClinicalRecords` hook
- Integración en Pacientes (tab "Historial clínico") y Citas (botón "SOAP")

#### Sprint 2.2 — Archivos clínicos (RX, exámenes, fotos)
- Migración `018_clinical_files.sql`
- Tabla `clinical_files` con kind enum (rx/lab/photo/document/consent/other), taken_at, soft delete, FK a clinical_records
- **Supabase Storage bucket `clinical-files`** privado, 50 MB limit, mime whitelist (jpeg/png/webp/heic/heif/gif/pdf/doc/docx/dicom)
- Storage policies tenant-scoped via `(storage.foldername(name))[1]::uuid` (primer path segment = tenant_id)
- RPCs: `clinical_file_register`, `clinical_file_archive`, `clinical_file_get`
- React: `useClinicalFiles` hook con upload + signed URLs (1h TTL)
- `ClinicalFilesPanel` con drag-drop, lightbox preview, kind+taken_at meta
- Tab "Archivos" en modal de Pacientes

#### Sprint 2.3 — HC visible al paciente
- Migración `019_patient_clinical_view.sql`
- RPC `patient_get_clinical_history` — devuelve SOAP + vitales + pain_points + diagnóstico + metadata de archivos (sin URLs)
- RPC `patient_get_file_storage_path` — valida ownership y devuelve path
- Edge Function `patient-me` extendida con acciones `get_clinical_history` y `get_file_url` (service role genera signed URL al vuelo)
- React: `PatientClinicalHistory.jsx` — timeline read-only con BodyDiagram en modo `readOnly`, archivos descargables y previewables
- Tabs "Inicio" / "Mi historial" en PatientHome

### FASE 3 — Facturación Electrónica DIAN

#### Backend
- Migración `020_billing_dian.sql`:
  - Tabla `tenant_billing_config` (provider/email/token/resolution/business_*) con RLS solo owner/admin
  - ALTER patients ADD `id_type` + `id_number` (DIAN requiere identificar al cliente)
  - ALTER sales ADD `e_invoice_id/number/cufe/status/pdf_url/xml_url/emitted_at/error`
  - RPCs: `tenant_billing_config_upsert`, `get_billing_config_for_emit` (svc_role), `get_sale_for_emit` (svc_role)
- Migración `021_patient_sale_invoice.sql`: extiende `patient_get_sale` con campos e_invoice
- Migración `023_apply_wompi_subscriptions.sql`: `apply_wompi_event` branchea por `purpose`

#### Edge Functions
- `alegra-emit-invoice`: valida JWT + membership, upsert contact en Alegra, crea invoice con stamp DIAN, persiste CUFE + PDF en sale. Idempotente.
- `alegra-test-connection`: valida credentials con GET /company, devuelve numerations DIAN disponibles

#### Frontend
- `useBillingConfig` hook (load/save/test/emit)
- `BillingSettings` tab en Settings con form completo + test conexión + selector de numeración + modo Pruebas/Producción
- `EmitInvoiceButton` (compact + full) con estados visuales
- `id_type`/`id_number` en formulario new/edit de paciente
- `SaleDetailModal` del paciente muestra CUFE + botón "Descargar PDF"

#### Pasos manuales pendientes para activar facturación
1. Crear cuenta en Alegra (https://www.alegra.com)
2. Activar facturación electrónica DIAN con su contador (1 vez)
3. En Alegra → Configuración → API → copiar email + token
4. CRM → Settings → Facturación DIAN → pegar credenciales → Probar conexión → Seleccionar numeración → Activar

### FASE 4 — PWA Mobile

- `vite-plugin-pwa` con Workbox (autoUpdate)
- 7 iconos PNG generados desde `v1-icon-only.svg` via sharp:
  - 192/512 normal + maskable (Android adaptive)
  - 180 apple-touch
  - 32/16 favicons
- `manifest.webmanifest`:
  - name "chiropract.co — CRM" / short_name "chiropract.co"
  - theme #0f766e, display standalone, orientation portrait
  - start_url `/#crm`
  - shortcuts: "Citas hoy" + "Panel paciente"
- index.html con meta apple-mobile-web-app-* + mask-icon Safari + viewport-fit=cover
- **Service Worker (Workbox)** con cache strategies:
  - Imágenes → CacheFirst 30 días
  - Supabase REST → NetworkFirst timeout 6s + cache 1 día (lecturas offline)
  - Edge Functions → NetworkOnly (mutaciones siempre online)
  - `/auth/*` → NetworkOnly
  - Storage signed URLs → CacheFirst 1h
  - skipWaiting + clientsClaim
- UX components (global en App.jsx):
  - `OfflineIndicator` — banner amber sticky cuando `navigator.onLine = false`
  - `UpdatePrompt` — toast con botón Recargar al detectar nueva versión del SW
  - `InstallPrompt` — captura `beforeinstallprompt`, muestra CTA tras 8s, dismiss persistente 7 días en localStorage

### FASE 5 — SaaS Comercial

#### Backend
- Migración `022_saas_subscriptions.sql`:
  - Tabla `plans` con seed de 4 planes:
    - **trial** — 0 COP, 14 días, 50 pacientes / 2 usuarios / 200 MB
    - **basic** — 199.000 COP/mes (1.990.000/año), 200 pacientes / 3 usuarios / 2 GB
    - **pro** — 399.000 COP/mes (3.990.000/año), 1.000 pacientes / 10 usuarios / 10 GB — MÁS POPULAR
    - **enterprise** — pricing a medida, ilimitado, multi-sede, white-label
  - Tabla `tenant_subscriptions` con period tracking, cancel_at_period_end
  - States: `trial → pending_payment → active → past_due/cancelled/expired`
  - Trigger automático al crear tenant: 14 días de trial
  - Backfill tenants existentes con trial extendido 60d
  - ALTER payments ADD `subscription_id` + `purpose` (sale/subscription_initial/subscription_renewal)
  - View `tenant_current_subscription` con `days_remaining` calculado
  - 4 RPCs: `tenant_check_plan_limit`, `tenant_request_plan_upgrade`, `subscription_apply_payment` (svc_role), `tenant_cancel_subscription`

- Migración `023_apply_wompi_subscriptions.sql`:
  - `apply_wompi_event` branchea por `purpose`:
    - `subscription_*` → llama `subscription_apply_payment`
    - `sale` → crea sales row (lógica original)
  - `create_payment_intent` extendido con subscription_id + purpose

#### Edge Function
- `subscription-create-link`: valida JWT owner → llama `tenant_request_plan_upgrade` → crea payment_intent con purpose → integra Wompi payment_links → devuelve checkout URL

#### Frontend
- `useSubscription` hook (load/upgrade/cancel/checkLimit)
- `usePublicPlans` hook (anon-readable para landing)
- `PricingSection` en landing público con toggle mensual/anual, 3 planes, badge "MÁS POPULAR" en Pro
- `PlanTab` en Settings: plan actual con días restantes, status badge, limits cards, upgrade con Wompi, cancelación al fin de período
- `TrialBanner` sticky bajo header CRM cuando:
  - trial ≤ 5 días
  - expired/cancelled
  - past_due
  - pending_payment
  - Dismiss persistente sessionStorage
- **Plan limits enforcement**: `usePatients.insertPatient` verifica `tenant_check_plan_limit` antes de insertar; retorna error `PLAN_LIMIT` con mensaje accionable

---

## 5. SCHEMA DE BASE DE DATOS — RESUMEN

### Tablas core (multi-tenant)
- `tenants` — consultorios
- `tenant_memberships` — usuarios ↔ tenants con roles
- `profiles` — datos del usuario Supabase Auth (full_name, phone, default_tenant_id)
- `patients` — pacientes (no son auth users); ahora con `id_type` + `id_number` para DIAN
- `appointments` — citas con `assigned_doctor_id` y `jornada_id`
- `jornadas` — días itinerantes en otras ciudades

### Tablas de productos/ventas
- `services` — servicios del consultorio
- `products` — productos vendibles
- `jornada_offerings` — qué servicios/productos están disponibles en cada jornada
- `sales` — ventas con `e_invoice_*` fields para DIAN
- `sale_items` — line items de cada venta

### Tablas operativas
- `alerts` — alertas dashboard del CRM
- `notification_jobs` — cola de mensajes WhatsApp (cron n8n los despacha)
- `scheduled_content` — calendario marketing
- `leads` — pipeline de leads

### Tablas WhatsApp + RAG
- `whatsapp_messages` — historial mensajes inbound/outbound
- `whatsapp_chat_memory` — memoria de conversación por session_key (LangChain Postgres Chat Memory)
- `knowledge_chunks` (con `embedding` pgvector) — RAG para el bot

### Tablas pagos
- `payments` — intentos de pago Wompi con `subscription_id` y `purpose`
- `wompi_events` — auditoría raw de webhooks

### Tablas panel paciente
- `patient_otp_codes` — códigos OTP (sha256, RLS sin policies = solo service_role)
- `patient_sessions` — sesiones del paciente (sha256, RLS sin policies)
- `appointment_change_requests` — bandeja de cambios solicitados por el paciente

### Tablas historia clínica
- `clinical_records` — notas SOAP + vitales + pain_points + CIE-10
- `clinical_files` — archivos médicos (Supabase Storage bucket `clinical-files`)

### Tablas billing DIAN
- `tenant_billing_config` — credenciales Alegra (RLS solo owner/admin)

### Tablas SaaS
- `plans` — catálogo de planes (RLS public read si is_public)
- `tenant_subscriptions` — suscripción activa por tenant

### Views
- `tenant_current_subscription` — última subscription + plan info con days_remaining
- `patient_clinical_summary` — resumen para dashboards

### Storage Buckets
- `clinical-files` — privado, 50 MB, mimes whitelist, RLS por path

---

## 6. EDGE FUNCTIONS DEPLOYADAS

| Función | Auth | Propósito |
|---|---|---|
| `receipt` | Pública | Página de "gracias" post-pago Wompi |
| `wompi-create-link` | Service role internamente | Crea Wompi payment link para una venta |
| `wompi-webhook` | HMAC signature | Recibe eventos de Wompi y actualiza payments |
| `patient-otp-request` | Anon | Envía código OTP por WhatsApp |
| `patient-otp-verify` | Anon | Valida código y emite session token |
| `patient-me` | Bearer session_token | Gateway único del panel paciente (GET dashboard + POST acciones múltiples) |
| `alegra-emit-invoice` | JWT Supabase | Emite factura electrónica a DIAN vía Alegra |
| `alegra-test-connection` | JWT Supabase | Valida credenciales Alegra + lista numerations |
| `subscription-create-link` | JWT Supabase | Crea Wompi payment link para upgrade de plan |

---

## 7. INTEGRACIONES — CONFIGURACIÓN

### n8n — WhatsApp Bot AI Agent
- **Instance:** `https://lab.inventagency.co`
- **Workflow ID bot:** `894oc1X7Z8iuK9H5` ("MAD-Quiropraxia Bot")
- **Workflow ID cron:** `JO9JQseyInqTvvin` ("MAD-Quiropraxia Reminders Cron")
- **Arquitectura:** AI Agent (LangChain) con gpt-4o + Postgres Chat Memory + 11 tools
- **Tools del bot (RPCs):**
  1. `bot_resolve_inbound` — identifica paciente por phone
  2. `bot_upcoming_appointments` — citas próximas
  3. `bot_request_appointment` — agenda con `p_doctor_id`
  4. `bot_list_doctors` — lista doctores del tenant
  5. `bot_list_services` — servicios disponibles
  6. `bot_search_knowledge` — RAG sobre `knowledge_chunks`
  7. (+5 más de utilities)
- **Soporte audio:** Whisper transcribe → text flow
- **Patrón base:** clonado de "TheIOSBogota" (la versión que funciona perfecto)

### Evolution API
- **Base URL:** `https://ievoapi.inventagency.co`
- **Instance:** `Miguel Angel Diaz Quiropractico`
- **Webhook → n8n:** mensajes entrantes disparan el bot
- **Outbound:** Edge Functions (patient-otp-request) + n8n cron envían vía `POST /message/sendText/{instance}`

### FAL.ai
- **Modelo entrenado:** LoRA personalizada del Dr. Miguel con ~20 fotos de referencia
- **Uso:** generación de imágenes para landing + redes (consultas, jornadas, charlas educativas)
- **Costo histórico:** ~$4.30 USD total para 26 imágenes
- **Aprendizajes UX:**
  - Sin bata blanca (Flux inventaba logos random)
  - Sin descriptores "fit/lean" (lo dejaba muy delgado)
  - LoRA scale 1.0 funciona mejor
  - Safety checker a veces rechaza prompts médicos — alternar poses

### Wompi
- **Modo:** PRODUCCIÓN (todas las llaves son `pub_prod_*` / `prv_prod_*`)
- **Webhook URL configurar:** `https://onwgfixvbyknotnbrkgr.supabase.co/functions/v1/wompi-webhook`
- **Soporta:**
  - Single-use payment links para ventas
  - Single-use payment links para suscripciones (auto-renovación)
- **Integrity hash:** sha256(reference + amount_in_cents + currency + integrity_secret)

### Alegra (DIAN)
- **API:** `https://api.alegra.com/api/v1`
- **Auth:** Basic Auth (email:token base64)
- **Endpoints usados:**
  - `GET /company` — test de credenciales
  - `GET /number-templates` — listar numerations DIAN
  - `GET/POST /contacts` — upsert cliente
  - `POST /invoices` con `stamp: { generateStamp: true }` — emite a DIAN

---

## 8. SEGURIDAD — MODELO

### Auth multi-tier
- **CRM (staff):** Supabase Auth email+password + idle timeout 30min con warning modal
- **Patient panel:** OTP custom (NO Supabase Auth)
- **Bot WhatsApp:** Sin auth (público), pero RPCs validan ownership por phone

### RLS (Row Level Security)
- Habilitada en TODAS las tablas sensibles
- Patrón: `tenant_id IN (SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid() AND accepted_at IS NOT NULL)`
- Role-restricted en tablas críticas (`tenant_billing_config`, `tenant_subscriptions` → solo owner/admin)
- Tablas del paciente (`patient_otp_codes`, `patient_sessions`) → RLS habilitada SIN policies → solo service_role accede

### Storage policies
- Bucket privado, paths como `{tenant_id}/{patient_id}/{file_id}.ext`
- Policy valida `(storage.foldername(name))[1]::uuid IN (...tenant_memberships...)`
- DELETE solo para owner/admin/doctor

### Hashing
- OTPs: `sha256(code)` en BD, plain solo devuelto al Edge Function que lo envía por WA
- Session tokens: `sha256(token)` en BD, plain solo devuelto al verify
- Wompi webhook: HMAC SHA256 verification con `signature.properties + timestamp + secret`

### Function hardening
- TODAS las funciones SQL: `SECURITY DEFINER` + `SET search_path = public, pg_catalog` (mitiga search_path injection)

### Rate limiting
- OTPs: max 5/hora por phone (validado en RPC `patient_otp_create`)
- OTP verify: max 5 intentos por código antes de invalidar
- Sesiones: 30 días rolling, revocables

### CSP & Security Headers (vercel.json)
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; ...
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
```

### Soft delete en datos clínicos
- `clinical_records.archived_at` — la HC es documento legal, no se borra realmente
- `clinical_files.archived_at` — idem
- Solo owner/admin/doctor pueden archivar

---

## 9. CREDENCIALES & SECRETS — DÓNDE ESTÁN

> ⚠ Todas las credenciales están en `.env` (local) y como Vercel env vars / Supabase secrets. NUNCA committeadas.

### .env (local) — variables frontend (VITE_*)
- `VITE_SUPABASE_URL=https://onwgfixvbyknotnbrkgr.supabase.co`
- `VITE_SUPABASE_ANON_KEY=eyJhbG...` (JWT anon role)
- `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...` (nuevo formato, equivalente)
- `VITE_PUBLIC_SITE_URL=https://chiropract.co`
- `VITE_CLINIC_NAME=chiropract.co`
- `VITE_CLINIC_DOCTOR=Dr. Miguel Ángel Díaz`
- `VITE_CLINIC_PHONE=+573176305076`
- `VITE_CLINIC_PHONE_DISPLAY=+57 317 630 5076`
- `VITE_WOMPI_PUBLIC_KEY=pub_prod_...`

### .env (local) — variables backend (NO exponer al frontend)
- `SUPABASE_DB_URL=postgresql://...` (pooled connection para scripts)
- `SUPABASE_SERVICE_ROLE_KEY=eyJhbG...` (JWT service_role, bypass RLS)
- `SUPABASE_ACCESS_TOKEN=sbp_...` (Personal Access Token para CLI deploys)
- `N8N_BASE_URL=https://lab.inventagency.co`
- `N8N_API_TOKEN=eyJhbG...`
- `EVOLUTION_BASE_URL=https://ievoapi.inventagency.co`
- `EVOLUTION_API_KEY=B40B124DE012-4D0A-9517-204388E3DBAD`
- `EVOLUTION_INSTANCE_ID=e823bcaa-0a07-4fe5-a1b9-43ec4be54c8d`
- `EVOLUTION_INSTANCE_NAME=Miguel Angel Diaz Quiropractico`
- `FAL_KEY=f7262123-...:2b79e835...`
- `WOMPI_PUBLIC_KEY=pub_prod_...`
- `WOMPI_PRIVATE_KEY=prv_prod_...`
- `WOMPI_EVENTS_SECRET=prod_events_...`
- `WOMPI_INTEGRITY_SECRET=prod_integrity_...`
- `WOMPI_BASE_URL=https://production.wompi.co/v1`

### Supabase secrets (configurados via `npx supabase secrets set`)
- `WOMPI_PRIVATE_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`, `WOMPI_BASE_URL`
- `EVOLUTION_BASE_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME`
- `CLINIC_NAME`

### Vercel env vars (a configurar manualmente en Settings → Environment Variables)
Las 9 `VITE_*` del .env. Sin estas, el frontend queda en blanco.

---

## 10. ESTADO ACTUAL DE DESPLIEGUE

### Producción funcional
- **Supabase project:** `onwgfixvbyknotnbrkgr` — todas las 23 migraciones aplicadas, todas las Edge Functions deployadas
- **GitHub:** https://github.com/chiropractco/system (rama `main`, 23 commits)

### Vercel — estado actual
- Proyecto auto-creado al conectar GitHub: `system` (alias `system-beta-kohl.vercel.app`)
- **PROBLEMA ACTUAL:** Bundle sin env vars baked in → pantalla blanca
- **FIX PENDIENTE:** Agregar 9 vars VITE_* en Vercel Settings → Environment Variables + Redeploy

### Dominio
- `chiropract.co` aún no conectado
- Cuando esté: agregar en Vercel Settings → Domains + configurar DNS:
  - `A` record `@` → `76.76.21.21`
  - `CNAME` record `www` → `cname.vercel-dns.com`

### URLs previas (deprecated tras migración a chiropractco team)
- `crm-quiropraxia-nine.vercel.app` (invent1) — ya no responde
- `chiropract-co-mauve.vercel.app` (invent1) — ya no responde

---

## 11. PASOS MANUALES PENDIENTES (PARA TENER 100% FUNCIONAL)

| # | Tarea | Tiempo | Quién |
|---|---|---|---|
| 1 | Agregar 9 env vars `VITE_*` en Vercel + Redeploy | 5 min | Owner |
| 2 | Wompi Dashboard → Webhook URL configurar | 2 min | Owner |
| 3 | Supabase Auth → Site URL + Redirect URLs whitelist | 2 min | Owner |
| 4 | Conectar dominio `chiropract.co` en Vercel + DNS records | 10 min + propagación | Owner |
| 5 | Crear cuenta Alegra + activar e-invoicing con contador | 1-3 días | Owner + contador |
| 6 | Configurar Alegra en Settings → Facturación DIAN | 10 min | Owner |
| 7 | Editar pacientes existentes → agregar `id_type` + `id_number` | gradual | Staff |
| 8 | Probar flujo end-to-end de OTP del paciente (con teléfono real) | 10 min | Owner |

---

## 12. ISSUES CONOCIDOS / DEUDA TÉCNICA

### Performance
- Bundle JS ~800 KB (gzipped 213 KB) — warning de Vite por chunk > 500 KB
- **Mitigación futura:** code-split por route (dynamic import para PatientApp, módulos pesados del CRM)

### Storage de secrets
- `tenant_billing_config.api_token` (Alegra) en **plain text bajo RLS estricta**
- **TODO:** Migrar a pgsodium / Supabase Vault para encryption-at-rest

### Subscriptions
- No es Wompi "recurring billing" real — son payment links one-shot que renuevan el período
- **Trade-off:** más simple, menos error-prone, pero requiere acción del usuario al final de cada período
- **Alternativa futura:** Wompi Subscriptions API cuando esté más madura para Colombia

### PWA
- Service Worker cache puede mostrar datos viejos si el usuario no recarga
- `UpdatePrompt` mitiga (toast cuando hay nueva versión) pero requiere acción del usuario
- **Mitigación adicional:** check de update cada 1 hora ya implementado

### Multi-doctor
- Cada appointment tiene `assigned_doctor_id`, pero el bot WA por ahora pregunta al paciente con cuál doctor agendar
- **Mejora futura:** lógica de auto-asignación por especialidad / disponibilidad

---

## 13. ROADMAP FORWARD (POST-MVP)

| Feature | Esfuerzo | Impacto |
|---|---|---|
| Subdominios per-tenant (`july.chiropract.co`) | 3-5d | Branding profesional |
| White-label theming (logo + colores per tenant) | 2-3d | Diferenciación, plan Enterprise |
| Push notifications via Web Push API | 1-2d | Engagement |
| Reportes avanzados (BI) en Finanzas con charts | 3-5d | Insight para el doctor |
| Backup automático export CSV/JSON | 1d | Cumplimiento Habeas Data |
| Dark mode | 1-2d | UX moderna |
| Onboarding self-serve con plan selection durante signup | 2d | Conversion del SaaS |
| Billing history page con download invoices | 1d | Profesionalismo |
| Wompi Subscriptions API real (recurring) | 3-5d | Reduce friction renovación |
| Cancel subscription flow con razones | 1d | Datos de churn |
| Multi-sede para Enterprise | 5-7d | Plan top |
| API pública con tokens per-tenant | 5-7d | Plan Enterprise |
| App nativa iOS/Android (Capacitor) | 7-10d | Engagement mobile |

---

## 14. ESTRUCTURA DEL REPO

```
crm-quiropraxia/
├── public/
│   ├── icons/             # PWA icons (192/512 any+maskable, 180 apple, 32/16 favicons)
│   ├── images/dr-diaz/    # Fotos generadas con FAL (consultas, jornadas, retratos)
│   └── logos/             # SVG logos (v1-*.svg)
├── scripts/
│   ├── _db.js             # pg connection pool con SSL bypass
│   ├── run-0XX-migration.js  # scripts uno por migración
│   ├── generate-pwa-icons.js # genera PNGs desde SVG via sharp
│   ├── vercel-env-set.js  # setea VITE_* en Vercel via CLI
│   ├── upgrade-bot-toptier.js   # actualizaciones del workflow n8n
│   └── ...
├── src/
│   ├── App.jsx            # Router por hash (#crm, #paciente, #terms, #privacy)
│   ├── main.jsx
│   ├── components/
│   │   ├── auth/          # AuthPage, OnboardingPage (CRM signup)
│   │   ├── billing/       # BillingSettings, EmitInvoiceButton, PlanTab, TrialBanner
│   │   ├── clinical/      # BodyDiagram, SoapEditorModal, ClinicalHistoryPanel, ClinicalFilesPanel
│   │   ├── landing/       # HeroSection, Navbar, SpineVideo, PricingSection, etc.
│   │   ├── patient/       # PatientApp, PatientLogin, PatientHome, PatientModals, PatientClinicalHistory
│   │   ├── Sidebar.jsx, Dashboard.jsx, Pacientes.jsx, Citas.jsx, Jornadas.jsx,
│   │   ├── ProductosServicios.jsx, Finanzas.jsx, Settings.jsx
│   │   ├── Toast.jsx, LoadingState.jsx, TeamTab.jsx
│   │   └── PWAComponents.jsx
│   ├── contexts/
│   │   ├── AuthContext.jsx        # Supabase Auth wrapper
│   │   └── PatientAuthContext.jsx # OTP session wrapper
│   ├── hooks/
│   │   ├── useTenantData.js       # Generic tenant-scoped CRUD
│   │   ├── useClinicalRecords.js, useClinicalFiles.js
│   │   ├── useBillingConfig.js, useSubscription.js
│   │   └── useIdleTimeout.js
│   ├── lib/
│   │   ├── supabase.js            # Cliente Supabase singleton
│   │   ├── patientApi.js          # Cliente HTTP para Edge Functions del paciente
│   │   ├── clinic.js, logger.js
│   └── utils/
│       ├── format.js, csv.js
├── supabase/
│   ├── functions/         # Edge Functions (Deno)
│   │   ├── receipt/, wompi-create-link/, wompi-webhook/
│   │   ├── patient-otp-request/, patient-otp-verify/, patient-me/
│   │   ├── alegra-emit-invoice/, alegra-test-connection/
│   │   └── subscription-create-link/
│   └── migrations/        # 23 SQL files (001 al 023)
├── PROJECT_COMPILATION.md # este documento
├── ROADMAP.md, BRAND.md, README.md, TUTORIAL-USUARIOS.md, TUTORIAL-GAMMA.md
├── vercel.json            # Headers de seguridad + framework Vite
├── vite.config.js         # Plugin React + Tailwind + PWA
└── package.json
```

---

## 15. CONTACTOS & RECURSOS

- **GitHub repo:** https://github.com/chiropractco/system
- **Supabase Dashboard:** https://supabase.com/dashboard/project/onwgfixvbyknotnbrkgr
- **Vercel Project:** chiropractco/system (URL provisional: `system-beta-kohl.vercel.app`)
- **n8n:** `https://lab.inventagency.co` (workflows MAD-Quiropraxia Bot + Reminders Cron)
- **Evolution API:** `https://ievoapi.inventagency.co` (instance "Miguel Angel Diaz Quiropractico")
- **Wompi Dashboard:** https://comercios.wompi.co
- **Alegra:** https://www.alegra.com

---

## 16. CÓMO PROBAR EL SISTEMA EN PRODUCCIÓN (FLUJO END-TO-END)

Una vez resuelto el problema de env vars:

1. **Landing:** ir a `https://chiropract.co` (o URL Vercel actual) → ver hero + servicios + jornadas + pricing
2. **Signup CRM:** click "CRM" en navbar → crear cuenta → onboarding crea tenant + trial 14d
3. **Crear paciente:** Pacientes → Nuevo Paciente → llenar (con id_type/id_number si se va a facturar)
4. **Agendar cita:** Citas → Nueva Cita → asignar doctor
5. **Probar SOAP:** Citas → botón SOAP en la cita → llenar notas + clickear silueta para puntos de dolor → guardar
6. **Subir archivo clínico:** Pacientes → click paciente → tab Archivos → Subir archivo → RX/PDF
7. **Patient login:** ir a `/#paciente` → ingresar phone del paciente → recibir código por WhatsApp → ingresar
8. **Acciones del paciente:** ver citas → cancelar/reagendar → ver recibo con CUFE → ver Mi Historial con SOAP
9. **Wompi:** crear venta → click "Generar link de pago" → pagar en Wompi (modo prod) → webhook actualiza
10. **Facturación DIAN:** Settings → Facturación → activar Alegra → en cualquier venta click "Emitir factura" → CUFE + PDF
11. **Plan upgrade:** Settings → Plan → seleccionar Pro mensual → abre Wompi → pagar → subscription activa
12. **Instalar PWA:** desde Chrome móvil → prompt "Instalar" (tras 8s) o "Compartir → Añadir a pantalla de inicio" en iOS

---

## CONCLUSIÓN

El sistema está **funcionalmente completo end-to-end** en Supabase (BD + Edge Functions) y en el repo GitHub. El único bloqueo activo es **configurar las 9 env vars `VITE_*` en Vercel** para que el frontend deje de quedar en blanco, y luego conectar el dominio `chiropract.co`.

Las 6 fases del roadmap original están entregadas:
- ✅ FASE 0 — Wompi pagos
- ✅ FASE 1 — Panel del Paciente (auth OTP, acciones, perfil, jornadas, HC)
- ✅ FASE 2 — Historia Clínica (SOAP, diagrama corporal, archivos médicos)
- ✅ FASE 3 — Facturación DIAN (Alegra)
- ✅ FASE 4 — PWA mobile + offline
- ✅ FASE 5 — SaaS comercial (planes, suscripciones, billing self-serve)

A partir de aquí, todo es iteración: tema dark, push notifications, dominios per-tenant, white-label, etc.
