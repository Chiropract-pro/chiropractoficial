# 🗺 Roadmap — chiropract.co · Ecosistema completo

> Plan en 6 fases para pasar de **MVP de una clínica** → **SaaS comercial vendible a múltiples clínicas**.
>
> Tiempo total estimado: **5-6 meses** con dedicación regular.
> Costo total estimado en infra + terceros: **~$80-150 USD/mes** en operación.

---

## 📍 Visión del ecosistema completo

```
                         ┌──────────────────────────┐
                         │   chiropract.co (SaaS)   │
                         │   Marketing site público  │
                         └────────────┬──────────────┘
                                      │ signup
                  ┌───────────────────┴────────────────────┐
                  │                                          │
        ┌─────────▼─────────┐                    ┌──────────▼──────────┐
        │  Tenant 1         │                    │  Tenant 2 / 3 / N    │
        │  Quiropraxia Díaz │                    │  Otra clínica        │
        └─────────┬─────────┘                    └──────────┬──────────┘
                  │                                          │
       ┌──────────┴───────────┐                              │
       │                      │                              │
┌──────▼──────┐      ┌────────▼────────┐                     │
│  Doctor     │      │   Paciente      │                     │
│  - CRM web  │      │  - Panel web    │                     │
│  - App móvil│      │  - Bot WhatsApp │                     │
│  - PWA      │      │  - Panel mobile │                     │
└──────┬──────┘      └────────┬────────┘                     │
       │                      │                              │
       └──────────────┬───────┘                              │
                      │                                      │
            ┌─────────▼──────────────────────────────────────▼┐
            │              Supabase (Postgres + Storage)        │
            │   RLS por tenant · Edge Functions · Realtime      │
            └────────────────┬──────────────┬───────────────────┘
                             │              │
                  ┌──────────▼────┐    ┌────▼─────────┐
                  │  Wompi        │    │  Alegra      │
                  │  (pagos)      │    │  (DIAN)      │
                  └───────────────┘    └──────────────┘
```

---

## 🚦 Estado actual (línea base)

### ✅ Lo que ya existe en producción
- CRM completo del Dr. Miguel Ángel Díaz (7 módulos)
- Landing pública chiropract-co.vercel.app con branding integrado
- Bot WhatsApp con 11 tools, gpt-4o, memoria persistente, audio
- Multi-tenant técnico (RLS por tenant)
- 4 usuarios de prueba (`miguel@`, `dra.july@`, `recepcion@`, `demo@`)
- 13 migrations aplicadas, 30+ RPCs
- Notificaciones automáticas: recordatorios T-24h/T-2h + aviso a doctor cuando paciente agenda

### ⏳ Pendientes para cerrar el MVP actual
- Deploy de Edge Functions Wompi (necesita Personal Access Token Supabase)
- Configurar webhook URL en Wompi dashboard
- Configurar Site URL de Supabase Auth a producción

---

# FASE 0 — Cierre del MVP actual
**Tiempo: 1 semana · Prioridad: 🔴 inmediata**

Cerrar lo que está al 90%.

| Tarea | Quién | Tiempo |
|---|---|---|
| Deploy 3 Edge Functions Wompi (`receipt`, `wompi-create-link`, `wompi-webhook`) | Yo (necesita PAT Supabase) | 30 min |
| Configurar webhook URL en Wompi dashboard | Tú | 5 min |
| Configurar Supabase Auth: Site URL + Redirect URLs whitelist | Tú | 5 min |
| Probar pago end-to-end (paciente paga vía link, sale se crea automática) | Ambos | 30 min |
| Documentar credenciales y procedimientos | Yo | 1 hora |

**Entregable**: pagos online funcionando E2E.

---

# FASE 1 — Panel del Paciente
**Tiempo: 3 semanas · Prioridad: 🟢 alta**

## Objetivo
El paciente toma control de su experiencia: ve sus citas, paga, descarga recibos, todo sin pasar por recepción.

## Sprint 1.1 — Auth sin password (semana 1)
- Schema: `patient_sessions` (otp_hash, expires_at, ip)
- Edge Function `patient-otp-request`: envía código de 6 dígitos por WhatsApp via Evolution
- Edge Function `patient-otp-verify`: valida código, emite JWT propio (custom claims con patient_id)
- Componentes: `PatientLogin.jsx`, `PatientLayout.jsx`
- Ruta: `/paciente`

## Sprint 1.2 — Citas + recibos (semana 2)
- `PatientDashboard.jsx`: próxima cita prominente + atajos
- `PatientAppointments.jsx`: listado con acciones
  - Confirmar (registra `patient_confirmed_at`)
  - Solicitar reagendar (alerta a recepción)
  - Cancelar (con motivo opcional)
- `PatientReceipts.jsx`: lista de recibos descargables (usa Edge Function `receipt`)
- Mobile-first design (90% del tráfico será móvil)

## Sprint 1.3 — Pagos + jornadas + perfil (semana 3)
- `PatientPayments.jsx`: pagos pendientes con botón Wompi
- `PatientJornadas.jsx`: próximas jornadas en su ciudad + reservar cupo
- `PatientProfile.jsx`: edición de teléfono, email, dirección
- Notificaciones in-app (toast) + email (futuro)

## Schema nuevo
```sql
patient_sessions (id, patient_id, otp_hash, expires_at, used_at, ip)
appointments.patient_confirmed_at TIMESTAMPTZ
appointments.patient_can_reschedule BOOLEAN DEFAULT TRUE
```

## Entregable
URL pública `chiropract-co.vercel.app/paciente` donde cualquier paciente entra con su WhatsApp y se autoatiende.

## KPIs a medir
- % pacientes que se autoatienden vs llaman
- # confirmaciones automáticas / mes
- # pagos online procesados

---

# FASE 2 — Historia Clínica Estructurada
**Tiempo: 4 semanas · Prioridad: 🟡 media-alta**

## Objetivo
Volver chiropract.co un **software clínico real** (no solo agendador). Cumplir Resolución 1995/1999.

## Sprint 2.1 — Schema clínico (semana 1)
```sql
clinical_history (id, patient_id, antecedentes_jsonb, alergias, medicamentos)
consultations (
  id, patient_id, appointment_id, doctor_id, date,
  subjective TEXT,    -- síntomas reportados
  objective TEXT,     -- examen físico
  assessment TEXT,    -- diagnóstico
  plan TEXT,          -- plan de tratamiento
  vitals JSONB        -- TA, peso, etc.
)
body_diagrams (consultation_id, points JSONB)  -- {x, y, intensity, side}
treatment_plans (id, patient_id, name, sessions_total, sessions_done, status)
patient_files (id, patient_id, type, url, uploaded_by, notes)
consent_signatures (id, patient_id, document_type, signed_at, signature_url)
```

## Sprint 2.2 — UI consulta SOAP + diagrama (semana 2)
- Modal "Nueva Consulta" dentro de detalle de paciente
- Editor SOAP con tabs (Subjetivo / Objetivo / Análisis / Plan)
- Diagrama corporal SVG interactivo: click para marcar dolor, slider intensidad
- Auto-save cada 30s (no perder trabajo)

## Sprint 2.3 — Archivos + plan de tratamiento (semana 3)
- Upload de archivos (X-rays, MRI, fotos antes/después) → Supabase Storage
- Thumbnails y preview en navegador
- Vista de "Plan de tratamiento": 10 sesiones programadas, progreso visual
- Tracking: barra de evolución del dolor por sesión (línea con datos del SOAP)

## Sprint 2.4 — Documentos legales (semana 4)
- Consentimientos digitales con canvas de firma
- Generador de receta médica (PDF descargable)
- Generador de orden de exámenes (PDF)
- Almacenamiento en Storage con RLS

## Entregable
Cada paciente tiene expediente médico completo navegable, con SOAP por sesión, archivos, plan de tratamiento y consentimientos firmados.

## KPIs a medir
- % de citas con SOAP registrado (debería ser 100%)
- # archivos subidos por paciente promedio

---

# FASE 3 — Facturación Electrónica DIAN
**Tiempo: 2 semanas · Prioridad: 🟡 media (legal)**

## Objetivo
Cumplir requisito DIAN. Generar facturas electrónicas válidas legalmente al vender.

## Sprint 3.1 — Setup Alegra (semana 1)
- Cuenta Alegra del Dr. Díaz (~$60.000 COP/mes)
- Variables: `ALEGRA_API_KEY`, `ALEGRA_USER_EMAIL`
- Mapeo de productos/servicios CRM ↔ catálogo Alegra (script de sync)
- Edge Function `alegra-create-invoice`: al crear sale → POST a Alegra → guarda CUFE + URL del PDF

## Sprint 3.2 — UI + notificaciones (semana 2)
- Botón "Generar factura DIAN" en cada `sale` completada
- Estado de la factura visible en CRM (pendiente, emitida, anulada)
- Notificación al paciente con PDF de factura por WhatsApp
- Reportes mensuales de facturas emitidas

## Schema nuevo
```sql
invoices_dian (
  id, sale_id, alegra_invoice_id, cufe, status,
  pdf_url, xml_url, issued_at, total
)
```

## Entregable
Cada venta puede generar factura electrónica DIAN válida con un click.

---

# FASE 4 — App Móvil del Doctor (PWA)
**Tiempo: 3 semanas · Prioridad: 🟢 alta**

## Objetivo
El Dr. Díaz puede atender en jornadas itinerantes (Soatá, Muzo) usando solo su celular, **sin laptop, con sincronización offline**.

## Por qué PWA primero (no React Native)
- 3 semanas vs 8-10 semanas de Native
- Mismo código del CRM web (reuso 95%)
- Se instala en home screen iOS/Android sin App Store
- Funciona offline con Service Worker
- Si ScP demanda más, en Fase 6 hacemos Native

## Sprint 4.1 — PWA base (semana 1)
- Manifest.json + Service Worker (`vite-plugin-pwa`)
- Install prompt (banner "Agregar a inicio")
- Splash screen + ícono adaptado
- Cache offline: pacientes, próximas citas

## Sprint 4.2 — Vistas mobile-first (semana 2)
- Dashboard mobile: agenda del día, accesos rápidos
- Detalle de paciente optimizado mobile (un swipe entre pestañas)
- "Siguiente paciente" — botón gigante para arrancar consulta
- Registrar venta en 3 taps

## Sprint 4.3 — Modo jornada (semana 3)
- Vista especial "Modo Jornada" con cita-por-cita
- Sync offline (queue de operaciones cuando no hay internet)
- Captura de firma con dedo en pantalla (consentimientos)
- Foto rápida con cámara (paciente, X-ray)

## Entregable
PWA instalable que funciona en iOS y Android sin App Store. El doctor la usa en jornadas itinerantes con conexión intermitente.

## KPIs
- # consultas registradas en mobile vs desktop
- Uso en jornadas itinerantes

---

# FASE 5 — SaaS Comercial Multi-cliente
**Tiempo: 6 semanas · Prioridad: 🟡 media (depende de validación)**

## Objetivo
Convertir chiropract.co en producto vendible a otras clínicas. Generar MRR (Monthly Recurring Revenue).

## Sprint 5.1 — Subdomains + DNS (semana 1)
- Registrar dominio `chiropract.co` (si aún no lo tienes)
- DNS wildcard: `*.chiropract.co` → Vercel
- Vercel: configurar wildcard domain
- Middleware en frontend: detectar subdomain → cargar tenant correcto
- `quiropraxia-diaz.chiropract.co` muestra el sitio del Dr. Díaz
- `clinica-perez.chiropract.co` muestra el de otro tenant

## Sprint 5.2 — White-label parcial (semana 2)
- Schema: `tenants.theme JSONB` (logo_url, primary_color, secondary_color, font)
- Settings → tab "Personalización": subir logo + escoger colores
- Frontend: aplicar theme dinámico a la landing y CRM
- Cada clínica ve SU branding, no chiropract.co (excepto footer "Powered by")

## Sprint 5.3 — Landing comercial chiropract.co (semana 3)
- Sitio en `www.chiropract.co` (o raíz) DIFERENTE al sitio del Dr. Díaz
- Vende el SaaS a otras clínicas: features, precios, testimonios, demo
- CTAs: "Empieza gratis 14 días", "Ver demo"
- Referencia al Dr. Díaz como case study real

## Sprint 5.4 — Self-service onboarding (semana 4)
- Signup desde landing comercial
- Onboarding mejorado:
  - Wizard 5 pasos con progress bar
  - Selección de plan
  - Sembrado automático de plantillas/servicios sugeridos
  - Tour interactivo del CRM
- Plan-gating real (límite 50 pacientes en Trial, etc.)

## Sprint 5.5 — Billing automático (semana 5)
- Integrar Stripe Subscriptions (o Wompi recurrente si está disponible)
- Schema: `tenant_subscriptions` (stripe_subscription_id, status, current_period_end)
- Webhooks de Stripe → actualizar estado del tenant
- Email de bienvenida + facturas mensuales (vía Resend/SendGrid)
- Banner "Tu trial termina en X días → upgrade"
- Auto-suspender tenants con pago vencido (después de 7 días gracia)

## Sprint 5.6 — Admin panel Invent + métricas (semana 6)
- Panel `admin.chiropract.co` (solo para Invent)
- Lista de todos los tenants con MRR, plan, churn risk
- Gráficas: MRR mensual, signups, conversión trial→paid, NPS
- Acciones admin: extender trial, dar plan gratis, suspender, exportar data
- Integrar Plausible o PostHog para analytics

## Entregable
Cualquier quiropráctico de Colombia puede entrar a `chiropract.co`, hacer signup, configurar su clínica y empezar a usar el sistema **sin tu intervención**, pagando suscripción mensual.

## KPIs
- # clientes pagando
- MRR
- Churn mensual
- Tiempo promedio trial → paid

---

# FASE 6 — Operaciones, Marketing y Growth
**Tiempo: continuo · Prioridad: 🟢 alta una vez Fase 5 complete**

No es un sprint cerrado, es la operación continua del negocio.

## Marketing
- **SEO técnico**: sitemap.xml, meta tags por jornada/ciudad, Schema.org medical
- **Content**: blog en `chiropract.co/blog` con artículos de quiropraxia (atrae tráfico orgánico)
- **YouTube/TikTok**: videos cortos del Dr. Díaz explicando ejercicios → tráfico
- **Google Ads**: campañas geográficas (Bogotá, Boyacá) por keywords ("quiropráctico Bogotá")
- **Facebook/Instagram Ads**: jornadas en municipios (Soatá, Muzo) con segmentación local

## Operaciones
- **Soporte**: chat en `chiropract.co` con Crisp/Intercom para atender prospects
- **Email transaccional**: Resend o SendGrid para welcome, recordatorios pago, facturas
- **Backups automáticos** Supabase + Storage (cron diario, retención 30 días)
- **Monitoreo**: UptimeRobot + Sentry para errores en producción
- **Status page** en `status.chiropract.co`

## Compliance
- **Auditoría de seguridad** anual con `/security-review`
- **Términos de servicio + Política de privacidad** con asesoría legal
- **Habeas Data** workflow (Ley 1581/2012) con botón "exportar mis datos" + "borrar mi cuenta"

## Customer Success
- **Onboarding humano** para clientes Pro (call de 30 min)
- **Demos por Calendly** para prospects desde landing
- **Webinars mensuales** sobre uso del sistema → engagement + retención

---

# 💰 Costos esperados de operación

| Concepto | Mensual | Notas |
|---|---|---|
| Supabase Pro | $25 USD | Por cada 25 tenants → escala bien |
| Vercel Pro | $20 USD | Hasta 1TB bandwidth |
| OpenAI (gpt-4o + Whisper) | $5-50 USD | Crece con # mensajes WhatsApp |
| n8n self-hosted | $0 (ya es Invent) | Tu instancia actual |
| Evolution API self-hosted | $0 (ya es Invent) | Tu instancia actual |
| Alegra (DIAN) | $15 USD | Plan básico, +~$0.05 por factura |
| Resend (email) | $0-20 USD | 3K emails gratis, después por uso |
| Sentry / monitoring | $0-26 USD | Free tier suficiente al inicio |
| FAL.ai / generación imagen | $5-30 USD | Solo cuando agregas clientes nuevos |
| **Total operación** | **~$70-170 USD/mes** | Depende de # clientes |

## Pricing sugerido para clientes (Fase 5)

| Plan | Precio | Incluye |
|---|---|---|
| Trial | Gratis 14 días | Todo, hasta 50 pacientes |
| Básico | $49 USD/mes | 200 pacientes, 1 doctor, sin DIAN |
| Pro | $99 USD/mes | Pacientes ilimitados, 3 doctores, DIAN incluido |
| Enterprise | $199 USD/mes | Multi-sede, API access, soporte prioritario, dominio propio |

**Punto de equilibrio**: con 5 clientes Pro pagando = $495/mes, cubres operación con margen.

---

# 🎯 Hitos clave (mileposts)

| Hito | Cuándo |
|---|---|
| 🟢 MVP cerrado (Fase 0) | Semana 1 |
| 🟢 Panel del paciente live (Fase 1) | Semana 4 |
| 🟢 Historia clínica + DIAN funcionando (Fases 2+3) | Semana 10 |
| 🟢 PWA del doctor en jornadas (Fase 4) | Semana 13 |
| 🟢 Primer cliente externo pagando (Fase 5) | Semana 19 |
| 🟢 10 clientes pagando = $500-1000 MRR | Semana 24 |

---

# ⚠️ Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El Dr. Díaz no usa la historia clínica estructurada (Fase 2) | Iterar UX con él semanalmente, hacer onboarding presencial |
| DIAN cambia normativa | Alegra absorbe el cambio, no nos toca |
| Otras clínicas no quieren pagar | Validar con 5 demos ANTES de invertir Fase 5 entera |
| Bot WhatsApp baneo masivo | Backup de plantilla oficial Meta WhatsApp Business API |
| Costos OpenAI escalan | Migrar a gpt-4o-mini en flujos no críticos, o usar Claude Haiku |
| Churn alto en clientes pagos | Customer success proactivo, NPS mensual, onboarding humano |

---

# 🚦 Decisiones que necesito de ti

Para arrancar mañana mismo, dime:

### Decisión 1 — Orden
- **A)** Seguir el orden propuesto: Fase 0 → 1 → 2 → 3 → 4 → 5
- **B)** Saltar Fase 4 (PWA) hasta tener clientes externos
- **C)** Empezar Fase 5 (SaaS) antes de Fase 2-3 (más arriesgado pero más rápido a revenue)

### Decisión 2 — Inversión estimada
- **A)** Lento (1 sprint cada 2 semanas, dedicación parcial) → 8-10 meses total
- **B)** Normal (1 sprint por semana, dedicación regular) → 5-6 meses total ← **recomendado**
- **C)** Rápido (2 sprints por semana, dedicación full-time) → 3 meses total

### Decisión 3 — Equipo
- ¿Trabajamos los 2 (yo + tú coordinando con el Dr. Díaz)?
- ¿O quieres sumar otro dev de Invent para algunas fases?
- ¿Diseñador para Fase 1 (panel paciente) y Fase 5 (landing comercial)?

### Decisión 4 — Stack para Fase 5 SaaS
- **Stripe** vs **Wompi recurrente**: Stripe internacional (USD), Wompi local (COP). Mi recomendación: ambos (Stripe para clientes externos premium, Wompi para Colombia).
- **Email transaccional**: Resend (más moderno) vs SendGrid (más maduro). Recomiendo **Resend**.

---

# 📝 Resumen ejecutivo

> **Hoy**: tienes un MVP funcional de UNA clínica.
> **En 6 semanas**: tienes el ecosistema completo para esa clínica (paciente + doctor + DIAN).
> **En 6 meses**: lo conviertes en SaaS vendible a múltiples clínicas con MRR.
> **En 12 meses**: 20-50 clientes pagando, MRR de $1k-3k USD/mes, validación para inversión.

El siguiente paso concreto es **Fase 0** (cerrar lo del 90%) + arrancar **Fase 1** (panel del paciente).

---

*Última actualización: este roadmap es vivo, ajustamos según aprendizajes y feedback del Dr. Díaz.*
