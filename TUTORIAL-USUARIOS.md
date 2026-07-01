# Tutorial de pruebas — chiropract.co

> Guía con usuarios de prueba listos para que tú o cualquier persona pueda probar el sistema completo. Cada usuario tiene un rol distinto y un flujo de prueba específico.

---

## 🔑 Credenciales (4 usuarios listos)

| Usuario | Rol | Email | Tenant |
|---|---|---|---|
| 👨‍⚕️ **Dr. Miguel Ángel Díaz** | Owner | `miguel@chiropract.co` | Quiropraxia Dr. Díaz |
| 👩‍💼 **Sandra (Recepcionista)** | Admin | `recepcion@chiropract.co` | Quiropraxia Dr. Díaz |
| 👩‍⚕️ **Dra. María González** | Doctor | `dra.maria@chiropract.co` | Quiropraxia Dr. Díaz |
| 🧪 **Demo Owner** | Owner | `demo@chiropract.co` | Consultorio Demo |

**Contraseña común para los 4**: `Chiropract2026!`

🌐 **URL de login**: https://chiropract-co-mauve.vercel.app/#crm

> ⚠ Cada usuario debe **cambiar su contraseña en producción**. Estas son solo para pruebas internas.

---

## 🎬 Flujos de prueba — uno por usuario

---

### 🟢 FLUJO 1 — Dr. Miguel Ángel (Owner principal)

**Para qué sirve probar este flujo**: ver todo el sistema con datos reales sembrados (7 servicios, 5 productos, 4 jornadas).

#### Pasos:

1. **Entrar a** https://chiropract-co-mauve.vercel.app/#crm
2. **Login**:
   - Email: `miguel@chiropract.co`
   - Password: `Chiropract2026!`
3. **Verás el Dashboard** con KPIs (pacientes, citas, ingresos, conversión)
4. **Click en "Pacientes"** → ve la lista (cargados desde semilla)
   - Click en cualquier paciente para ver el detalle
   - Click en "+ Nuevo Paciente" para agregar uno (ej. Carlos Mendoza, +57 311 222 3344)
5. **Click en "Citas"** → ve la agenda
   - Click en "+ Nueva Cita" → escoge el paciente, fecha, tipo (primera consulta, $150.000), confirma
6. **Click en "Jornadas"** → ve las 4 jornadas próximas (Soatá, Guamal, Muzo, Garcés Navas)
   - Click en una jornada para ver capacidad e ingresos proyectados
7. **Click en "Productos y Servicios"**:
   - Tab "Servicios": 7 servicios (consulta, ajuste, paquete, etc.)
   - Tab "Productos": 5 productos con stock e imagen
   - Tab "Ventas": click "+ Nueva venta" → escoge servicio + producto → método de pago (Nequi) → registra
8. **Click en "Finanzas"** → ve los ingresos del mes con la nueva venta reflejada
9. **Click en "Configuración"** → tab Consultorio para editar nombre/dirección

**Tiempo estimado**: 7-10 minutos para ver todo.

---

### 🟡 FLUJO 2 — Sandra (Recepcionista, mismo consultorio)

**Para qué sirve**: probar el flujo de un colaborador que NO es el doctor pero gestiona la operativa diaria.

#### Pasos:

1. **Cierra sesión** del usuario anterior (botón sign-out en sidebar)
2. **Login**:
   - Email: `recepcion@chiropract.co`
   - Password: `Chiropract2026!`
3. **Verás el mismo CRM** del Dr. Díaz porque es admin del mismo tenant
4. **Confirmar citas**:
   - Click en "Citas" → vista "Pendientes"
   - Click en una cita pendiente → cambia estado a "Confirmada"
5. **Registrar un pago en efectivo**:
   - Click en "Productos y Servicios" → tab "Ventas" → "+ Nueva venta"
   - Escoge "Primera consulta" + un paciente real
   - Método de pago: efectivo, $150.000
   - Click "Registrar"
6. **Verificar que cuando cae el pago**:
   - El stock NO baja (es un servicio, no producto)
   - Aparece en finanzas
7. **Logout**

**Tiempo estimado**: 3-5 minutos.

---

### 🔵 FLUJO 3 — Dra. María (Otro doctor del consultorio)

**Para qué sirve**: probar el rol "doctor" — ve agenda compartida pero con permisos limitados.

#### Pasos:

1. **Login**:
   - Email: `dra.maria@chiropract.co`
   - Password: `Chiropract2026!`
2. **Ver el Dashboard del consultorio compartido**
3. **Click en "Citas"** — ve TODA la agenda (también las del Dr. Miguel) — esto es porque las RLS policies son por tenant, no por doctor individual. Es por diseño: el doctor secundario ve el calendario completo.
4. **Click en "Pacientes"** — mismos pacientes del consultorio
5. **Logout**

> 📝 **Nota técnica**: para tener separación por doctor (Dra. María solo ve sus pacientes y no los del Dr. Miguel), eso requiere agregar `assigned_doctor_id` en `appointments` y filtrar. Ahora todos los doctores del tenant comparten todo. Si el doctor lo pide, lo agregamos en una versión 2.

**Tiempo estimado**: 2-3 minutos.

---

### 🟣 FLUJO 4 — Demo Owner (cuenta limpia para mostrar a clientes)

**Para qué sirve**: si quieres mostrar el sistema a un prospect potencial (otro quiropráctico que considere usar chiropract.co), este usuario tiene un tenant vacío para que se vea desde cero.

#### Pasos:

1. **Login**:
   - Email: `demo@chiropract.co`
   - Password: `Chiropract2026!`
2. **El tenant "Consultorio Demo" está vacío** (sin pacientes, sin citas, sin nada)
3. Demuestra el flujo desde cero:
   - "+ Nuevo Paciente" → agrega 1-2
   - "+ Nueva Cita" → agenda
   - Tabs de servicios/productos vacíos para que vea cómo poblar el catálogo
4. **Logout**

> 💡 Útil para ventas: dale acceso temporal a un prospect para que toque el sistema 5 minutos.

**Tiempo estimado**: 5-7 minutos.

---

### 🟠 FLUJO 5 — Usuario completamente nuevo (signup desde cero)

**Para qué sirve**: probar el flujo de creación de cuenta nueva como lo haría cualquier visitante.

#### Pasos:

1. Entra a https://chiropract-co-mauve.vercel.app/#crm
2. Click en **"¿No tienes cuenta? Regístrate"**
3. Llena:
   - Nombre: tu nombre (ej. "Dr. Carlos Test")
   - Email: cualquiera real al que tengas acceso
   - Password: mínimo 8 caracteres
4. Click "Crear cuenta"
5. **Revisa tu email** y click en el enlace de confirmación
6. Vuelve al sitio y haz login
7. **Onboarding 3 pasos**:
   - Datos del consultorio (nombre, slug — verás validación en vivo, ciudad, teléfono)
   - Plan: escoge Trial (gratis 14 días)
   - Confirmar
8. Entras al CRM con tu propio tenant aislado

**Tiempo estimado**: 5-10 minutos (depende de cuánto tarde el email).

---

### 🟤 FLUJO 6 — Bot de WhatsApp (perspectiva paciente)

**Para qué sirve**: probar el bot conversacional desde el lado del paciente.

#### Pasos:

1. Desde tu celular o WhatsApp Web, escribe al **+57 317 630 5076**
2. Manda "**Hola**" o pregunta libremente:
   - *"¿Cuándo es la próxima jornada en Soatá?"*
   - *"Tengo dolor lumbar hace una semana, ¿pueden ayudarme?"*
   - *"Quiero agendar una consulta"*
3. **Espera 3-5 segundos** — el bot procesa con OpenAI + memoria conversacional
4. **Verifica**:
   - Te trata de "usted"
   - Se identifica como "el equipo de chiropract.co"
   - Responde profesional pero cálido
   - Termina con "— Equipo chiropract.co"
5. **Manda un AUDIO** ("hola, soy fulano y tengo dolor"):
   - El bot lo transcribe con Whisper
   - Te responde en texto

**Tiempo estimado**: 2-3 minutos.

---

## 📋 Checklist de pruebas (recomendado)

Sigue este orden para cubrir el 90% del sistema:

- [ ] **Login con miguel@** — verificar Dashboard carga
- [ ] **Crear paciente nuevo** desde miguel@
- [ ] **Crear cita** que dispare automáticamente recordatorio T-24h
- [ ] **Registrar venta** en Productos y Servicios
- [ ] **Verificar Finanzas** refleja la venta
- [ ] **Logout y login con recepcion@** — confirmar misma data visible
- [ ] **Confirmar una cita pendiente** desde recepción
- [ ] **Logout y login con dra.maria@** — verificar acceso de doctor
- [ ] **Logout y login con demo@** — tenant vacío visible
- [ ] **Signup con email tuyo** — completar onboarding nuevo
- [ ] **Mensaje al bot WhatsApp** — verificar respuesta
- [ ] **Audio al bot WhatsApp** — verificar transcripción

---

## 🎁 Para presentaciones / demos

### Si quieres demo en vivo (5 min)

Login con `miguel@chiropract.co` y muestra:
1. Dashboard (KPIs en tiempo real)
2. Pacientes (lista poblada)
3. Citas (agenda con jornadas)
4. Productos y Servicios (catálogo + alertas de stock)
5. Bot WhatsApp en vivo (manda mensaje desde tu celular y muestra la respuesta en pantalla)

### Si quieres demo larga (15 min)

Sigue los flujos 1 → 6 en orden.

### Si quieres demo grabada

Logueado con `miguel@`, graba pantalla con OBS o Loom. Los datos sembrados son consistentes y se ven profesionales.

---

## 🔐 Importante para producción

Cuando el sistema esté en uso real:

1. **Cambia las contraseñas** de los 4 usuarios desde Supabase Dashboard
2. **Borra `demo@chiropract.co`** si no la vas a seguir usando
3. **Decide si Sandra y Dra. María existen en la realidad** o si son solo para testing
4. **Configura Supabase Auth → Site URL** apuntando al dominio final (no `*.vercel.app`)

---

## 🆘 Si algo no funciona

| Problema | Solución |
|---|---|
| "Email o contraseña incorrectos" | Revisa que el password sea exacto: `Chiropract2026!` (con C mayúscula y `!`) |
| El email no llega al hacer signup | Configurar Supabase Site URL primero |
| El bot WhatsApp no responde | Verificar que el WhatsApp del Dr. Díaz siga conectado en Evolution |
| Página en blanco al entrar | Hard refresh (Ctrl+Shift+R o Cmd+Shift+R) |
| Citas no muestran | Verificar el tenant del usuario logueado en Supabase |

---

**¿Listo? Login con `miguel@chiropract.co` / `Chiropract2026!` y arranca el flujo 1.** 🚀
