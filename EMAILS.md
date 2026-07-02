# Correos transaccionales — chiropract.co (Resend)

Sistema centralizado de correo. Todas las plantillas viven en
[`supabase/functions/_shared/emails.ts`](supabase/functions/_shared/emails.ts) y se envían
con la función [`send-email`](supabase/functions/send-email/index.ts) vía Resend.

## Casos de uso (plantillas)

| `type` | Cuándo se envía | Disparador | Estado |
|---|---|---|---|
| `welcome` | Al crear consultorio / primer login | backend / n8n | plantilla lista |
| `profile_verified` | Admin verifica un médico (badge azul) | backend / admin | plantilla lista |
| `team_invite` | Owner invita a alguien a su consultorio | **frontend (TeamTab)** ✅ conectado | conectado |
| `directory_invite` | Fase D — outreach a quiroprácticos | script / n8n (batch) | plantilla lista |
| `appointment_confirmation` | Se agenda una cita | backend / n8n | plantilla lista |
| `appointment_reminder` | Antes de la cita | n8n cron | plantilla lista |
| `receipt` | Tras un pago | wompi-webhook / n8n | plantilla lista |
| `trial_ending` | Prueba por terminar | n8n cron | plantilla lista |
| `subscription_success` | Pago de suscripción OK | wompi-webhook | plantilla lista |
| `subscription_failed` | Pago de suscripción falla | wompi-webhook | plantilla lista |

> Los correos de **cuenta** (confirmar email, restablecer contraseña) los maneja
> **Supabase Auth**, no esta función. Para que salgan por Resend, configura Resend como
> SMTP en Supabase (ver abajo).

## Cómo se envía

`POST /functions/v1/send-email` con body `{ type, to, data, cc?, reply_to? }`.

- **Backend / scripts / n8n** → header `Authorization: Bearer <service_role>` → puede enviar **cualquier** tipo.
- **Navegador (usuario logueado)** → `supabase.functions.invoke('send-email', { body })` → solo tipos en la lista blanca (`team_invite`), con chequeo de permiso por RLS.

Cada envío queda registrado en la tabla `email_log` (auditoría / evitar duplicados).

## Setup (una sola vez)

### 1. Secretos en Supabase
```bash
RESEND_API_KEY=re_xxxxx \
SUPABASE_ACCESS_TOKEN=sbp_xxxxx \
EMAIL_FROM="chiropract.co <hola@chiropract.co>" \
node scripts/setup-resend.mjs
```

### 2. Desplegar la función
```bash
supabase functions deploy send-email --project-ref dqxffnibxizlfaeddzrz --use-api
```

### 3. Verificar el dominio en Resend (para enviar a cualquiera)
En Resend → Domains → Add `chiropract.co`, y agrega en tu DNS los registros que te da
(SPF/DKIM `MX`+`TXT`, y DMARC recomendado). Mientras no verifiques el dominio, Resend
solo deja enviar desde `onboarding@resend.dev` a tu propio correo (modo prueba).

### 4. (Opcional) Correos de Auth por Resend
Supabase → Authentication → SMTP Settings → activa SMTP personalizado con los datos SMTP
de Resend (host `smtp.resend.com`, puerto 465, usuario `resend`, password = tu API key).
Así los correos de confirmación y recuperación también salen con tu dominio.

## Probar
```bash
# Modo prueba (a tu propio correo, from onboarding@resend.dev)
curl -X POST https://dqxffnibxizlfaeddzrz.supabase.co/functions/v1/send-email \
  -H "Authorization: Bearer <service_role>" -H "Content-Type: application/json" \
  -d '{"type":"welcome","to":"TU_CORREO","data":{"first_name":"Miguel","title":"Dr."}}'
```
