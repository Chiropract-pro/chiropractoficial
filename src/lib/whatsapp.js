import { supabase } from './supabase';
import { isDemoMode } from './demo';
import { logger } from './logger';

/**
 * Enviar un mensaje de WhatsApp desde el CRM.
 *
 * POR QUÉ PASA POR EL SERVIDOR
 * El token de Meta NO puede vivir en el navegador: quien abra el inspector
 * podría escribirle a cualquier número desde el WhatsApp del consultorio. La
 * Edge Function `wa-send` es la que habla con Meta y la que deja el registro
 * en `whatsapp_messages`, para que lo que se envía desde aquí quede en el
 * mismo hilo que lo que envía el bot.
 *
 * LA VENTANA DE 24 HORAS
 * Meta solo permite texto libre dentro de las 24 h posteriores al último
 * mensaje del paciente. Fuera de eso hay que usar una plantilla aprobada. La
 * interfaz ya lo impide, pero el servidor lo vuelve a comprobar: una regla que
 * solo vive en el cliente no es una regla.
 */
export async function sendWhatsappMessage({ conversationId, phone, text, templateName, campaign }) {
  if (isDemoMode()) {
    // En demostración no sale nada a la red, igual que en el resto del CRM.
    await new Promise((r) => setTimeout(r, 350));
    return { data: { demo: true }, error: null };
  }

  if (!phone || (!text?.trim() && !templateName)) {
    return { data: null, error: new Error('Falta el destinatario o el contenido del mensaje.') };
  }

  try {
    const { data, error } = await supabase.functions.invoke('wa-send', {
      body: {
        conversation_id: conversationId || null,
        phone,
        text: text?.trim() || null,
        template_name: templateName || null,
        campaign: campaign || null,
      },
    });
    if (error) {
      logger.error('wa-send', error);
      return { data: null, error };
    }
    if (data?.error) return { data: null, error: new Error(data.error) };
    return { data, error: null };
  } catch (err) {
    logger.error('wa-send', err);
    return { data: null, error: err };
  }
}
