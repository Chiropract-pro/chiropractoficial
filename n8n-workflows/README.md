# Workflows n8n — chiropract.co

## Workflows incluidos

| Archivo | Función | Trigger |
|---|---|---|
| `01-MAD-Quiropraxia-Reminders-Cron.json` | Procesa cola de notificaciones (recordatorios T-24h, T-2h, post-cita, anuncios de jornada, links de pago) | Cron cada 5 min |
| `02-MAD-Quiropraxia-Bot-Inbound.json` | Bot conversacional con OpenAI + memoria persistente + RAG | Webhook de Evolution API |

> **Nota:** No hay workflow #3 separado. El "post-cita" se maneja con un trigger SQL en `sales` que inserta un `notification_job` y el workflow #1 lo despacha. Mantiene un solo punto de envío.

## Instalación en n8n

### 1. Variables de entorno en n8n

En tu instancia n8n (`https://lab.inventagency.co`), entra a **Settings → Variables** y crea:

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | `https://onwgfixvbyknotnbrkgr.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | (la tienes en `.env` local) |
| `EVOLUTION_BASE_URL` | `https://ievoapi.inventagency.co` |
| `EVOLUTION_INSTANCE_ID` | `e823bcaa-0a07-4fe5-a1b9-43ec4be54c8d` |
| `EVOLUTION_INSTANCE_NAME` | `Miguel Angel Diaz Quiropractico` |
| `EVOLUTION_API_KEY` | (la tienes en `.env` local) |
| `OPENAI_API_KEY` | (tu key recargada de OpenAI) |

### 2. Importar los workflows

1. En n8n, click en **Workflows → Import from file**
2. Sube cada uno de los 2 JSON
3. Quedan inactivos por defecto. **NO los actives todavía.**

### 3. Configurar webhook de Evolution → n8n

1. Abre el workflow `02-MAD-Quiropraxia-Bot-Inbound`
2. Activa el workflow (toggle arriba a la derecha) — esto registra el webhook
3. Copia la URL del webhook (algo como `https://lab.inventagency.co/webhook/mad-quiropraxia-evolution`)
4. En el dashboard de Evolution API (`https://ievoapi.inventagency.co/manager/instance/e823bcaa-0a07-4fe5-a1b9-43ec4be54c8d/dashboard`), pega esa URL en **Webhook → URL**
5. Eventos a habilitar: solo `MESSAGES_UPSERT` (cuando llega un mensaje)

### 4. Activar el cron de recordatorios

Una vez todo lo demás esté funcionando, activa `01-MAD-Quiropraxia-Reminders-Cron`. Va a correr cada 5 minutos.

## Pruebas iniciales

1. **WhatsApp conectado**: confirma en Evolution dashboard que el state es `open` y aparece el `profileName` del Dr. Díaz.
2. **Mensaje de prueba**: envía un WhatsApp al número del Dr. Díaz desde tu propio número. El bot debería responderte.
3. **Recordatorio**: crea una cita en el CRM para mañana → el trigger SQL crea automáticamente `notification_jobs` para T-24h y T-2h. El cron las despacha.

## Apagado de emergencia

Si algo sale mal:
1. Desactiva ambos workflows en n8n (toggle off).
2. En Supabase, ejecuta:
   ```sql
   UPDATE notification_jobs SET status = 'cancelled' WHERE status = 'scheduled';
   ```
3. Esto limpia la cola sin perder datos.

## Modificar plantillas sin tocar código

Las plantillas viven en la tabla `notification_templates` de Supabase. Para editar el copy de un mensaje:

```sql
UPDATE notification_templates
SET body = 'Nuevo texto con {{patient_first_name}}...',
    version = version + 1
WHERE key = 'reminder_24h' AND tenant_id = '<tenant uuid>';
```

El cambio aplica al siguiente envío. No requiere redeploy.
