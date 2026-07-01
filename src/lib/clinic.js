// Configuración del consultorio para la landing pública.
// Sobrescribir vía env vars (VITE_CLINIC_*) en producción.

export const clinic = {
  name: import.meta.env.VITE_CLINIC_NAME || 'Quiropraxia Díaz',
  doctor: import.meta.env.VITE_CLINIC_DOCTOR || 'Dr. Miguel Ángel Díaz',
  phone: import.meta.env.VITE_CLINIC_PHONE || '+573112345678',
  phoneDisplay: import.meta.env.VITE_CLINIC_PHONE_DISPLAY || '+57 311 234 5678',
  email: import.meta.env.VITE_CLINIC_EMAIL || 'contacto@quiropraxiadiaz.co',
  address: import.meta.env.VITE_CLINIC_ADDRESS || 'Calle 100 # 15-45, Consultorio 502',
  addressLine2: import.meta.env.VITE_CLINIC_ADDRESS_2 || 'Edificio Clínica de la Salud',
  city: import.meta.env.VITE_CLINIC_CITY || 'Bogotá, Colombia',
  hours: {
    weekdays: import.meta.env.VITE_CLINIC_HOURS_WEEKDAYS || 'Lun - Vie: 8:00 AM - 6:00 PM',
    saturday: import.meta.env.VITE_CLINIC_HOURS_SATURDAY || 'Sáb: 8:00 AM - 1:00 PM',
  },
};

const sanitizePhone = (phone) => phone.replace(/\D/g, '');

export function whatsappUrl(message = '') {
  const base = `https://wa.me/${sanitizePhone(clinic.phone)}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export const wa = {
  schedule: () => whatsappUrl('Hola, quiero agendar una consulta'),
  info: () => whatsappUrl('Hola, quiero información sobre quiropraxia'),
  specialist: () => whatsappUrl('Hola, quiero hablar con un especialista'),
};
