/**
 * Teléfonos colombianos y enlaces de WhatsApp.
 *
 * Los pacientes se guardan con el número tal como lo dicta el consultorio:
 * "311 234 5678", "3112345678", a veces con el indicativo. WhatsApp exige el
 * número con indicativo de país y sin signos. Sin esta normalización, el enlace
 * apunta a un número inexistente y el mensaje nunca sale — que fue justo lo que
 * pasaba al enviar links de pago.
 */

const CO_CODE = '57';

/** Solo los dígitos, con indicativo de Colombia cuando el número es local. */
export function normalizeCoPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  // Celular local: 10 dígitos empezando por 3.
  if (digits.length === 10) return `${CO_CODE}${digits}`;
  // Ya trae indicativo.
  if (digits.length === 12 && digits.startsWith(CO_CODE)) return digits;
  // Con 0 o 00 delante del indicativo.
  const trimmed = digits.replace(/^0+/, '');
  if (trimmed.length === 12 && trimmed.startsWith(CO_CODE)) return trimmed;
  if (trimmed.length === 10) return `${CO_CODE}${trimmed}`;
  // Cualquier otra cosa (fijo, extranjero) se deja como viene: es preferible
  // intentar el envío a inventarle un indicativo.
  return digits;
}

/** Enlace wa.me listo para abrir, o null si no hay número utilizable. */
export function whatsappLink(phone, message = '') {
  const to = normalizeCoPhone(phone);
  if (!to) return null;
  return message
    ? `https://wa.me/${to}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${to}`;
}
