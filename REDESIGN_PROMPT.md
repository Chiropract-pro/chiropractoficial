# PROMPT DE REDISEÑO — chiropract.co

## SISTEMA DE GESTIÓN INTEGRAL DE QUIROPRAXIA

**Plataforma:** Stitch (React + TailwindCSS + Supabase)
**Dominio:** chiropract.co
**Cliente:** Dr. Miguel Ángel Díaz — Quiropraxia Díaz

---

## 1. VISIÓN GENERAL

Rediseñar completamente chiropract.co como una plataforma web moderna, responsiva y profesional que centraliza TODA la operación del consultorio quiropráctico: desde la captación de pacientes hasta el cierre financiero, pasando por agendamiento, historias clínicas, jornadas itinerantes, marketing y analítica.

### Principios de diseño

- **Mobile-first:** El Dr. Díaz usa principalmente el celular
- **Un clic:** Cualquier acción frecuente debe realizarse en máximo 2 toques
- **Contexto visual:** Colores y estados claros sin necesidad de leer texto
- **Offline-ready:** Funcionalidad básica sin conexión (PWA)
- **Branding consistente:** Paleta teal/ámbar, tipografía Inter, iconografía Lucide

### Stack tecnológico

- **Frontend:** React 19 + Vite + TailwindCSS v4 + Lucide Icons
- **Backend/DB:** Supabase (PostgreSQL + Auth + Realtime + Storage + Edge Functions)
- **State:** Zustand (global) + React Query (server state)
- **Deploy:** Vercel (frontend) + Supabase (backend)
- **PWA:** Service Worker + manifest.json

---

## 2. ARQUITECTURA DE MÓDULOS

```
chiropract.co/
├── 🏠 Dashboard           → Vista general con KPIs y acciones rápidas
├── 👥 Pacientes           → CRM completo con historia clínica
├── 📅 Citas               → Agendamiento con calendario visual
├── 🚗 Jornadas            → Gestión de jornadas itinerantes
├── 📋 Historia Clínica    → Notas clínicas, evolución, documentos
├── 📊 Marketing           → Leads, conversión, redes, contenido
├── 💰 Finanzas            → Ingresos, egresos, facturación, impuestos
├── ⚙️ Configuración       → Usuario, horarios, precios, integraciones
└── 🔔 Notificaciones      → Centro de alertas y recordatorios
```

---

## 3. DETALLE DE CADA MÓDULO

### 3.1 🏠 DASHBOARD

**Propósito:** Pantalla de comando del Dr. Díaz. Todo lo esencial en un vistazo.

**Componentes:**

- **KPI Cards (fila superior):**
  - Pacientes atendidos hoy / esta semana / este mes
  - Ingresos del día (vs. meta diaria)
  - Citas pendientes de confirmar
  - Leads nuevos esta semana
  - Tasa de conversión actual

- **Barra de meta mensual:**
  - Progreso visual (50% → 75% → 100%)
  - Comparativa vs. mes anterior
  - Proyección a cierre de mes

- **Agenda del día (timeline vertical):**
  - Lista de citas con hora, paciente, tipo, ubicación
  - Estado con color: 🟢 confirmada 🟡 pendiente 🔴 cancelada
  - Acción rápida: confirmar / posponer / cancelar con 1 clic
  - Botón de WhatsApp directo por cita

- **Próxima jornada:**
  - Ciudad, fecha, capacidad (% visual)
  - Botón "Ver detalle" → módulo Jornadas

- **Alertas prioritarias:**
  - 🔴 Urgentes: pagos pendientes, pacientes sin seguimiento >30 días
  - 🟡 Atención: jornada al 80%, lead sin contactar >24h
  - 🟢 Info: meta alcanzada, nuevo lead convertido

- **Acciones rápidas (FAB / botones flotantes):**
  - ➕ Nueva cita
  - ➕ Nuevo paciente
  - 📱 Enviar recordatorio masivo (WhatsApp)

**Datos en tiempo real:** Suscripción a Supabase Realtime para citas nuevas y cancelaciones.

---

### 3.2 👥 PACIENTES

**Propósito:** CRM completo. Corazón del sistema.

**Vistas:**

1. **Lista de pacientes:**
   - Tabla responsiva con: nombre, teléfono, ciudad, estado, última visita, total gastado
   - Búsqueda instantánea (nombre, teléfono, email, cédula)
   - Filtros: estado (activo/inactivo/en tratamiento/completado), ciudad, VIP, sin cita >30 días
   - Ordenar por: nombre, última visita, total gastado, fecha de registro
   - Vista de tarjetas (mobile) / vista de tabla (desktop)
   - Paginación infinita

2. **Perfil de paciente (vista detalle):**
   - **Header:** Nombre, edad, foto (si tiene), badge de estado, badge VIP
   - **Contacto:** Teléfono (clic → llamada, clic → WhatsApp), email, dirección, ciudad
   - **Resumen:** Total citas, total gastado, última visita, próxima cita
   - **Historia clínica:** Timeline de notas clínicas (ver módulo 3.5)
   - **Citas:** Historial de citas pasadas y futuras
   - **Pagos:** Historial de pagos y saldos pendientes
   - **Notas del doctor:** Texto libre con timestamps
   - **Tratamiento actual:** Tipo, frecuencia, progreso
   - **Documentos:** Radiografías, remisiones, consentimientos (Supabase Storage)
   - **Acciones:** Editar, nueva cita, enviar WhatsApp, enviar recordatorio, archivar

3. **Formulario nuevo/editar paciente:**
   - Datos personales: nombre, cédula, fecha de nacimiento, género, teléfono, email, dirección, ciudad
   - Datos clínicos: motivo de consulta, diagnóstico, tratamiento, frecuencia
   - Datos de contacto de emergencia
   - Referido por: (dropdown de fuentes)
   - Notas iniciales
   - Foto de perfil (opcional, cámara o galería)

**Datos de paciente en DB:**

```sql
patients (
  id uuid PRIMARY KEY,
  first_name text,
  last_name text,
  phone text,
  email text,
  address text,
  city text,
  date_of_birth date,
  gender text,
  id_number text,
  emergency_contact text,
  emergency_phone text,
  status text DEFAULT 'activo', -- activo, inactivo, en_tratamiento, completado, archivado
  vip boolean DEFAULT false,
  referred_by text, -- whatsapp, instagram, facebook, web, referido, jornada
  treatment text,
  diagnosis text,
  frequency text,
  notes text,
  profile_photo_url text,
  total_spent numeric DEFAULT 0,
  total_appointments integer DEFAULT 0,
  last_visit_date date,
  next_appointment_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
```

---

### 3.3 📅 CITAS

**Propósito:** Sistema de agendamiento completo con calendario visual.

**Vistas:**

1. **Calendario principal:**
   - Vista día / semana / mes (toggle)
   - Citas mostradas como bloques de color por tipo
   - Drag & drop para reprogramar (desktop)
   - Touch & hold para reprogramar (mobile)
   - Click en cita → panel lateral con detalle
   - Días con jornada marcados con icono 🚗

2. **Vista "Hoy":**
   - Timeline vertical de citas del día
   - Resumen: total citas, ingresos proyectados, pendientes por confirmar
   - Acción rápida por cita: confirmar, cancelar, reprogramar, no asistió

3. **Vista "Pendientes":**
   - Lista de citas sin confirmar, ordenadas por fecha
   - Botón "Confirmar" y "Enviar recordatorio WhatsApp" por cita

4. **Panel de cita (slide-over lateral):**
   - Datos: paciente, fecha, hora, tipo, ubicación, precio, estado
   - Historial del paciente (mini)
   - Acciones: confirmar, cancelar, reprogramar, cambiar hora, enviar recordatorio
   - Notas de la cita

5. **Formulario nueva cita:**
   - Paciente (búsqueda con autocompletar)
   - Fecha y hora (selector visual)
   - Tipo: primera consulta / seguimiento / jornada / emergencia
   - Ubicación: consultorio / jornada (ciudad)
   - Precio (auto-calculado por tipo, editable)
   - Notas
   - Recordatorio automático: checkbox (WhatsApp / SMS / Email)

**Tipos de cita y precios configurables:**

| Tipo | Precio default | Duración default |
|------|---------------|-----------------|
| Primera consulta | $150,000 COP | 45 min |
| Seguimiento | $100,000 COP | 30 min |
| Jornada | $150,000 COP | 30 min |
| Emergencia | $200,000 COP | 45 min |

**Automatizaciones:**
- Recordatorio WhatsApp 24h antes
- Recordatorio WhatsApp 2h antes
- Notificación al doctor cuando se agenda/cancela
- Marcar "no asistió" automáticamente si no llega y no cancela
- Encuesta post-cita (NPS) por WhatsApp 2h después

**DB Schema:**

```sql
appointments (
  id uuid PRIMARY KEY,
  patient_id uuid REFERENCES patients(id),
  date date,
  start_time time,
  end_time time,
  type text, -- primera_consulta, seguimiento, jornada, emergencia
  location text, -- consultorio, soata, guamal, muzo, garces_navas
  jornada_id uuid REFERENCES jornadas(id),
  status text DEFAULT 'pendiente', -- pendiente, confirmada, cancelada, no_asistio, completada
  price numeric,
  notes text,
  reminder_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
```

---

### 3.4 🚗 JORNADAS

**Propósito:** Diferenciador único del negocio. Gestión completa de jornadas itinerantes.

**Vistas:**

1. **Calendario de jornadas:**
   - Mapa de Colombia con marcadores por ciudad
   - Timeline de próximas jornadas
   - Filtro por ciudad y estado

2. **Detalle de jornada:**
   - Ciudad, fecha, ubicación física, capacidad máxima
   - Lista de pacientes agendados con hora y estado
   - Barra de capacidad (% visual con colores)
   - Ingreso proyectado vs. real
   - Notas logísticas (hotel, equipo, transporte)
   - Acciones: agregar paciente, cambiar capacidad, cancelar jornada

3. **Formulario nueva jornada:**
   - Ciudad (Soatá / Guamal / Muzo / Garcés Navas / personalizada)
   - Fecha
   - Ubicación física (dirección / nombre del lugar)
   - Capacidad máxima
   - Precio por paciente
   - Notas logísticas
   - Publicar automáticamente en redes (checkbox)

4. **Reporte post-jornada:**
   - Pacientes atendidos vs. agendados
   - Ingresos reales vs. proyectados
   - Nuevos pacientes adquiridos
   - Notas del doctor
   - Fotos (opcional)

5. **Historial de jornadas:**
   - Lista de jornadas pasadas con métricas
   - Comparativa entre jornadas de la misma ciudad
   - Tendencia de asistencia por ciudad

**DB Schema:**

```sql
jornadas (
  id uuid PRIMARY KEY,
  city text,
  date date,
  location_name text,
  location_address text,
  capacity integer,
  booked integer DEFAULT 0,
  price_per_patient numeric,
  status text DEFAULT 'programada', -- programada, en_curso, completada, cancelada
  notes text,
  revenue numeric DEFAULT 0,
  actual_attended integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
```

---

### 3.5 📋 HISTORIA CLÍNICA

**Propósito:** Registro clínico profesional, organizado y consultable.

**Componentes:**

1. **Timeline de evolución:**
   - Notas clínicas ordenadas por fecha (más reciente primero)
   - Cada nota: fecha, tipo (consulta / seguimiento / jornada), diagnóstico, tratamiento, observaciones
   - Iconografía por tipo de nota
   - Adjuntos: imágenes, PDFs, radiografías

2. **Formulario de nota clínica:**
   - Fecha (auto: hoy)
   - Tipo de sesión
   - Síntomas / motivo de consulta
   - Diagnóstico
   - Tratamiento realizado
   - Recomendaciones / ejercicios
   - Próxima cita sugerida
   - Adjuntar archivo (imagen/PDF)
   - Tags: #cervical #lumbar #dorsal #pélvico #craneal #deportiva

3. **Secciones del expediente:**
   - **Antecedentes:** Patológicos, quirúrgicos, alérgicos, farmacológicos
   - **Exploración física:** Postura, rango de movimiento, pruebas ortopédicas
   - **Diagnósticos:** Lista con fechas y estados (activo / resuelto)
   - **Plan de tratamiento:** Sesiones programadas, frecuencia, objetivos
   - **Documentos:** Todos los archivos adjuntos organizados por tipo y fecha

4. **Plantillas de nota:**
   - Primera consulta (completa)
   - Seguimiento estándar
   - Jornada (simplificada)
   - Emergencia
   - Custom (editable por el doctor)

**DB Schema:**

```sql
clinical_notes (
  id uuid PRIMARY KEY,
  patient_id uuid REFERENCES patients(id),
  appointment_id uuid REFERENCES appointments(id),
  type text, -- primera_consulta, seguimiento, jornada, emergencia
  symptoms text,
  diagnosis text,
  treatment text,
  recommendations text,
  next_appointment_suggested date,
  tags text[],
  attachments jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
)

patient_records (
  id uuid PRIMARY KEY,
  patient_id uuid REFERENCES patients(id),
  category text, -- antecedentes, exploracion, diagnosticos, plan_tratamiento
  content jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
```

---

### 3.6 📊 MARKETING

**Propósito:** Gestión de captación, conversión y presencia digital.

**Vistas:**

1. **Dashboard de marketing:**
   - Leads este mes vs. mes anterior
   - Tasa de conversión (leads → citas → pacientes)
   - Fuente principal de leads (pie chart)
   - ROI de pauta publicitaria

2. **Gestión de leads:**
   - Kanban board: Nuevo → Contactado → Cita agendada → Convertido → Perdido
   - Filtros por fuente, fecha, estado
   - Acción rápida: contactar por WhatsApp, agendar cita, marcar perdido
   - Notas por lead

3. **Métricas de redes sociales:**
   - Instagram: followers, engagement, alcance, crecimiento
   - Facebook: followers, engagement, alcance
   - WhatsApp: contactos, mensajes, tasa de respuesta
   - Datos importados vía API o ingreso manual

4. **Contenido programado:**
   - Calendario de publicaciones
   - Estado: borrador / programado / publicado
   - Plataforma: Instagram / Facebook / Stories / Reels
   - Subir imagen/video (Supabase Storage)
   - Conexión con Meta Business Suite API

5. **Email marketing:**
   - Campañas enviadas
   - Tasas de apertura y clics
   - Plantillas de email
   - Listas de segmentación (pacientes activos, inactivos, nuevos)

6. **Pauta publicitaria:**
   - Presupuesto invertido
   - Leads generados por pauta
   - Costo por lead
   - ROI por campaña

**DB Schema:**

```sql
leads (
  id uuid PRIMARY KEY,
  name text,
  phone text,
  email text,
  source text, -- whatsapp, instagram, facebook, web, referido, jornada, pauta
  status text DEFAULT 'nuevo', -- nuevo, contactado, cita_agendada, convertido, perdido
  notes text,
  patient_id uuid REFERENCES patients(id),
  converted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

marketing_metrics (
  id uuid PRIMARY KEY,
  date date,
  platform text,
  metric_name text,
  metric_value numeric,
  created_at timestamptz DEFAULT now()
)

scheduled_content (
  id uuid PRIMARY KEY,
  platform text,
  publish_date date,
  content_type text,
  caption text,
  media_url text,
  status text DEFAULT 'borrador',
  created_at timestamptz DEFAULT now()
)
```

---

### 3.7 💰 FINANZAS

**Propósito:** Control total de ingresos, egresos y salud financiera del negocio.

**Vistas:**

1. **Resumen financiero:**
   - Ingresos del día / semana / mes / año
   - Comparativa vs. periodo anterior (% cambio)
   - Gráfica de tendencia mensual (barras)
   - Meta mensual con progreso

2. **Ingresos por fuente:**
   - Consultorio vs. Jornadas (barras apiladas)
   - Por tipo de cita
   - Por ciudad

3. **Egresos:**
   - Registro de gastos: categoría, monto, fecha, descripción
   - Categorías: insumos, arriendo, transporte jornadas, marketing, software, otros
   - Total egresos del mes

4. **Flujo de caja:**
   - Ingresos - Egresos = Utilidad
   - Gráfica mensual
   - Margen de utilidad

5. **Pagos y deudores:**
   - Pacientes con saldo pendiente
   - Monto, fecha de vencimiento, días de mora
   - Acción: enviar recordatorio de pago (WhatsApp)
   - Historial de pagos por paciente

6. **Facturación:**
   - Generar factura/recibo por cita
   - Formato PDF descargable
   - Datos fiscales configurables
   - Numeración consecutiva

7. **Reportes:**
   - Reporte semanal / mensual / personalizado
   - Exportar a PDF y Excel
   - Comparar periodos
   - Proyección a cierre de mes

8. **Impuestos:**
   - Base gravable del mes
   - IVA recaudado
   - Retención
   - Resumen para declaración

**DB Schema:**

```sql
transactions (
  id uuid PRIMARY KEY,
  type text, -- ingreso, egreso
  category text,
  amount numeric,
  description text,
  patient_id uuid REFERENCES patients(id),
  appointment_id uuid REFERENCES appointments(id),
  payment_method text, -- efectivo, transferencia, tarjeta, nequi, daviplata
  status text DEFAULT 'completado', -- pendiente, completado, reembolsado
  invoice_number text,
  created_at timestamptz DEFAULT now()
)

expenses (
  id uuid PRIMARY KEY,
  category text,
  amount numeric,
  description text,
  receipt_url text,
  date date,
  created_at timestamptz DEFAULT now()
)
```

---

### 3.8 ⚙️ CONFIGURACIÓN

**Propósito:** Personalización del sistema.

**Secciones:**

1. **Perfil del doctor:**
   - Nombre, especialidad, registro profesional
   - Foto de perfil
   - Horarios de atención
   - Datos de contacto

2. **Consultorio:**
   - Dirección, teléfono, horarios
   - Duración de citas por tipo
   - Precios por tipo de cita
   - Días no laborables

3. **Jornadas:**
   - Ciudades configuradas con dirección de referencia
   - Capacidad default
   - Precio default por ciudad

4. **Integraciones:**
   - WhatsApp Business API (configuración de número, templates)
   - Google Calendar (sync bidireccional)
   - Meta Business Suite (Instagram + Facebook)
   - Pasarela de pagos (Nequi / Daviplata / Wompi)
   - Email (SMTP / Resend)

5. **Notificaciones:**
   - Configurar qué alertas recibir
   - Canales: push, WhatsApp, email
   - Horarios de silencio

6. **Usuarios:**
   - El doctor (admin)
   - Asistente (permisos limitados)
   - Roles y permisos

7. **Backup:**
   - Exportar todos los datos
   - Importar datos
   - Respaldo automático

---

### 3.9 🔔 NOTIFICACIONES

**Propósito:** Centro de alertas y automatizaciones.

**Tipos de alerta:**

| Alerta | Prioridad | Trigger | Acción |
|--------|-----------|---------|--------|
| Nueva cita agendada | 🔴 Alta | Paciente agenda online | Notificación push + WhatsApp al doctor |
| Cita cancelada | 🔴 Alta | Paciente cancela | Notificación push + ofrecer reprogramar |
| Paciente no asistió | 🟡 Media | Hora de cita pasada sin check-in | Marcar no_asistio + WhatsApp seguimiento |
| Paciente sin cita >30 días | 🟡 Media | Cron diario | WhatsApp de reactivación |
| Jornada al 80% capacidad | 🟡 Media | Nuevo agendamiento en jornada | Notificación push |
| Meta mensual al 50%/75%/100% | 🟢 Info | Cada nuevo pago | Notificación push |
| Lead sin contactar >24h | 🔴 Alta | Cron diario | Alerta en dashboard |
| Pago pendiente vencido | 🟡 Media | Cron diario | WhatsApp recordatorio |
| Nueva jornada programada | 🟢 Info | Creación de jornada | Publicar en redes |

**Canales de entrega:**
- Push notifications (PWA)
- WhatsApp Business API
- Email (Resend)
- In-app (badge en sidebar)

---

## 4. DISEÑO UI/UX

### 4.1 Paleta de colores

```
Primary:     #0F766E (teal-700)    — Acciones principales, CTAs
Primary Light: #14B8A6 (teal-500) — Hover, estados activos
Accent:      #F59E0B (amber-500)  — Alertas, highlights, VIP
Danger:      #EF4444 (red-500)    — Cancelaciones, errores, urgencias
Success:     #22C55E (green-500)  — Confirmaciones, metas
Background:  #F8FAFC (slate-50)   — Fondo general
Surface:     #FFFFFF               — Cards, modales
Sidebar:     #0F172A (slate-900)  — Navegación lateral
```

### 4.2 Tipografía

```
Headings: Inter, 700, tracking tight
Body: Inter, 400, 14px base
Small: Inter, 400, 12px
Micro: Inter, 500, 10px uppercase (labels)
```

### 4.3 Componentes core

- **Sidebar:** Navegación lateral fija (desktop), drawer inferior (mobile), con badge de alertas
- **Cards:** Rounded-xl, shadow-sm, border-slate-100, hover:shadow-md
- **Tables:** Responsive con scroll horizontal en mobile, sticky header
- **Modals/Slide-overs:** Panel lateral derecho (desktop), bottom sheet (mobile)
- **Forms:** Labels arriba, inputs con focus:ring-2 focus:ring-primary/30
- **Buttons:** Primary (bg-primary), Secondary (bg-slate-100), Danger (bg-danger), Ghost (transparent)
- **Badges:** Rounded-full, text-xs, px-2 py-0.5, colores por estado
- **Progress bars:** Rounded-full, h-2/h-3, colores dinámicos por porcentaje
- **Empty states:** Ilustración + texto + CTA
- **Loading:** Skeleton shimmer, no spinners

### 4.4 Layout responsivo

```
Desktop (≥1024px):
┌─────────┬──────────────────────────┐
│ Sidebar │      Main Content        │
│  256px  │    max-w-6xl mx-auto     │
│  fija   │    p-8                   │
└─────────┴──────────────────────────┘

Tablet (768-1023px):
┌──────────────────────────────────┐
│ Bottom Nav  │    Main Content     │
│   56px      │    p-6              │
└──────────────────────────────────┘

Mobile (<768px):
┌──────────────────────────────────┐
│ Bottom Nav  │    Main Content     │
│   56px      │    p-4              │
│             │    Cards stacked    │
└──────────────────────────────────┘
```

### 4.5 Animaciones

- Transiciones: `transition-all duration-200`
- Entrada de modales: `animate-slideInRight` (desktop) / `animate-slideUp` (mobile)
- Hover en cards: `hover:shadow-md hover:-translate-y-0.5`
- Cambio de estado: `transition-colors duration-150`

---

## 5. PÁGINA PÚBLICA (LANDING)

### 5.1 chiropract.co (landing page)

**Secciones:**

1. **Hero:**
   - Headline: "Tu bienestar empieza con una buena alineación"
   - Subheadline: "Quiropraxia profesional en Bogotá y jornadas en Boyacá"
   - CTA: "Agenda tu primera consulta" → WhatsApp / Formulario
   - Imagen del consultorio o tratamiento

2. **Servicios:**
   - Ajuste quiropráctico
   - Terapia cervical / lumbar / dorsal
   - Quiropraxia deportiva
   - Rehabilitación postural
   - Jornadas itinerantes

3. **Sobre el doctor:**
   - Foto del Dr. Díaz
   - Formación y credenciales
   - Experiencia
   - Enfoque de tratamiento

4. **Testimonios:**
   - Carrusel de testimonios de pacientes
   - Nombre, tratamiento, resultado

5. **Jornadas:**
   - Próximas jornadas con ciudades y fechas
   - CTA: "Reserva tu cupo" → WhatsApp

6. **Contacto:**
   - WhatsApp button (flotante)
   - Formulario de contacto
   - Dirección del consultorio + mapa
   - Redes sociales

7. **Footer:**
   - Links: Servicios, Jornadas, Blog, Contacto
   - Legal: Política de privacidad, términos
   - Redes sociales

### 5.2 Agendamiento online (público)

- Formulario simple: nombre, teléfono, tipo de cita, fecha preferida
- Disponibilidad en tiempo real (Supabase)
- Confirmación por WhatsApp
- Sin login requerido (lead → paciente automáticamente)

---

## 6. AUTOMATIZACIONES

### 6.1 WhatsApp Business API

- Template de bienvenida (nuevo paciente)
- Recordatorio 24h antes de cita
- Recordatorio 2h antes de cita
- Seguimiento post-cita (encuesta NPS)
- Reactivación (paciente >30 días sin cita)
- Recordatorio de pago pendiente
- Confirmación de jornada

### 6.2 Cron jobs (Supabase Edge Functions)

- Diariamente a 8am: verificar pacientes sin cita >30 días
- Diariamente a 7am: enviar recordatorios de citas del día
- Cada hora: marcar "no asistió" en citas pasadas sin check-in
- Semanalmente (lunes): reporte semanal por email
- Mensualmente (día 1): reporte mensual por email

### 6.3 Webhooks

- Pago recibido → actualizar estado de transacción → actualizar total_spent del paciente
- Cita agendada online → crear paciente si no existe → notificar al doctor
- Lead desde Meta → crear lead en CRM → notificar

---

## 7. SEGURIDAD Y PRIVACIDAD

- **Autenticación:** Supabase Auth (email + password, magic link)
- **RBAC:** Roles admin (doctor) y asistente (permisos limitados)
- **Row Level Security:** Cada tabla con políticas de acceso por usuario
- **Datos médicos:** Encriptación en reposo para notas clínicas
- **Backups:** Automáticos diarios en Supabase
- **Compliance:** Habeas data colombiano (Ley 1581 de 2012)
- **Consentimiento:** Registro de consentimiento informado por paciente
- **Auditoría:** Log de accesos y cambios en datos sensibles

---

## 8. MIGRACIÓN DE DATOS

1. Exportar datos actuales del CRM (pacientes, citas, historial)
2. Mapear campos al nuevo schema
3. Importar via script SQL a Supabase
4. Verificar integridad
5. Crossover: mantener sistema antiguo 1 semana en paralelo

---

## 9. ROADMAP DE IMPLEMENTACIÓN

### Fase 1 — MVP (2 semanas)
- [ ] Setup proyecto (Vite + TailwindCSS + Supabase)
- [ ] Auth (login del doctor)
- [ ] Dashboard con datos mock
- [ ] Pacientes (CRUD)
- [ ] Citas (CRUD + calendario día)
- [ ] Sidebar + navegación responsiva

### Fase 2 — Clínico (2 semanas)
- [ ] Historia clínica (notas + timeline)
- [ ] Jornadas (CRUD + calendario)
- [ ] Finanzas (ingresos + egresos básicos)
- [ ] Notificaciones in-app

### Fase 3 — Marketing (1 semana)
- [ ] Leads (Kanban + CRUD)
- [ ] Métricas de marketing
- [ ] Contenido programado

### Fase 4 — Automatización (2 semanas)
- [ ] WhatsApp Business API
- [ ] Recordatorios automáticos
- [ ] Edge Functions (crons)
- [ ] Landing page pública

### Fase 5 — Pulido (1 semana)
- [ ] PWA (offline + installable)
- [ ] Facturación PDF
- [ ] Reportes exportables
- [ ] Integración Google Calendar
- [ ] Performance y QA

---

## 10. CRITERIOS DE ACEPTACIÓN

1. ✅ El Dr. Díaz puede ver su agenda del día en ≤3 segundos desde abrir la app
2. ✅ Agendar una cita toma ≤5 clics/toques
3. ✅ Buscar un paciente por nombre toma ≤2 segundos
4. ✅ Enviar un recordatorio WhatsApp toma 1 clic
5. ✅ Ver el reporte financiero del mes es inmediato
6. ✅ La app funciona en celular sin conexión (datos básicos)
7. ✅ Un paciente puede agendar online sin llamar
8. ✅ Todas las alertas críticas llegan en ≤1 minuto
9. ✅ Los datos clínicos están protegidos y auditados
10. ✅ El sistema soporta ≥500 pacientes sin degradación
