import { ArrowLeft } from 'lucide-react';
import { clinic } from '../../lib/clinic';

const TERMS = {
  title: 'Términos de Servicio',
  updated: 'Actualizado: abril 2026',
  sections: [
    {
      heading: '1. Aceptación de los términos',
      body: `Al acceder y utilizar los servicios de ${clinic.name}, usted acepta cumplir con estos Términos de Servicio. Si no está de acuerdo con alguna parte, le pedimos que no utilice nuestros servicios.`,
    },
    {
      heading: '2. Servicios ofrecidos',
      body: `${clinic.name} ofrece servicios de quiropraxia profesional, incluyendo consultas presenciales en ${clinic.city}, jornadas itinerantes en municipios de Boyacá y Cundinamarca, y venta de productos relacionados con la salud espinal y postural.`,
    },
    {
      heading: '3. Citas y cancelaciones',
      body: 'Las citas pueden agendarse vía WhatsApp o a través de nuestro CRM. Solicitamos avisar con al menos 24 horas de anticipación en caso de cancelación. Inasistencias reiteradas pueden implicar el cobro de una tarifa.',
    },
    {
      heading: '4. Pagos',
      body: 'Aceptamos efectivo, transferencia, tarjeta, Nequi y Daviplata. Los precios incluyen IVA cuando aplique. Los productos vendidos en jornadas no son devolvibles salvo defecto de fábrica.',
    },
    {
      heading: '5. Información médica',
      body: 'La información proporcionada en consultas se trata con estricta confidencialidad bajo la normativa colombiana de protección de datos personales (Ley 1581 de 2012). Los pacientes son responsables de informar condiciones médicas relevantes.',
    },
    {
      heading: '6. Limitación de responsabilidad',
      body: 'Los tratamientos quiroprácticos son seguros cuando son aplicados por profesionales certificados. Sin embargo, los resultados varían entre pacientes. No garantizamos resultados específicos y siempre recomendamos consultar a su médico para condiciones graves.',
    },
    {
      heading: '7. Modificaciones',
      body: 'Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios serán publicados en esta página con su fecha de actualización.',
    },
    {
      heading: '8. Contacto',
      body: `Para preguntas sobre estos términos, contáctenos al ${clinic.phoneDisplay} o por correo a ${clinic.email}.`,
    },
  ],
};

const PRIVACY = {
  title: 'Política de Privacidad',
  updated: 'Actualizado: abril 2026',
  sections: [
    {
      heading: '1. Datos que recopilamos',
      body: 'Recopilamos los datos que usted nos proporciona voluntariamente: nombre, identificación, teléfono, correo electrónico, dirección, antecedentes médicos relevantes para el tratamiento, y datos de pago. También registramos información de uso de nuestro sitio web mediante cookies funcionales.',
    },
    {
      heading: '2. Uso de la información',
      body: 'Usamos sus datos para: (a) prestar los servicios contratados, (b) gestionar citas y comunicaciones, (c) enviarle recordatorios e información sobre jornadas, (d) cumplir obligaciones legales y tributarias, (e) mejorar nuestros servicios.',
    },
    {
      heading: '3. Almacenamiento y seguridad',
      body: 'Sus datos se almacenan en servidores seguros con cifrado en tránsito y en reposo. Implementamos controles de acceso por rol y políticas de seguridad de fila (RLS) para garantizar que solo personal autorizado acceda a su información.',
    },
    {
      heading: '4. Compartición con terceros',
      body: 'No vendemos ni alquilamos sus datos. Compartimos información únicamente con (a) procesadores de pago para completar transacciones, (b) autoridades competentes cuando la ley lo exija, (c) proveedores de servicios técnicos sujetos a acuerdos de confidencialidad.',
    },
    {
      heading: '5. Sus derechos',
      body: 'Bajo la Ley 1581 de 2012 de Colombia, usted tiene derecho a conocer, actualizar, rectificar y suprimir sus datos personales, así como revocar la autorización para su tratamiento. Para ejercer estos derechos, escríbanos a ' + clinic.email + '.',
    },
    {
      heading: '6. Retención',
      body: 'Conservamos sus datos médicos por un mínimo de 10 años desde la última atención, conforme a la normativa de historias clínicas colombiana (Resolución 1995 de 1999). Los datos administrativos se conservan según los plazos legales aplicables.',
    },
    {
      heading: '7. Cookies',
      body: 'Usamos cookies estrictamente funcionales para autenticación y preferencias de sesión. No usamos cookies de tracking publicitario.',
    },
    {
      heading: '8. Contacto',
      body: `Para preguntas sobre el tratamiento de sus datos, contáctenos al ${clinic.phoneDisplay} o por correo a ${clinic.email}.`,
    },
  ],
};

export default function LegalPage({ doc, onBack }) {
  const content = doc === 'privacy' ? PRIVACY : TERMS;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary transition-colors mb-8"
        >
          <ArrowLeft size={16} /> Volver al inicio
        </button>

        <div className="space-y-2 mb-10">
          <h1 className="text-4xl font-extrabold text-on-surface editorial-title">{content.title}</h1>
          <p className="text-sm text-on-surface-variant">{content.updated} · {clinic.name}</p>
        </div>

        <div className="prose prose-slate space-y-6">
          {content.sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-lg font-bold text-on-surface mb-2">{s.heading}</h2>
              <p className="text-on-surface-variant leading-relaxed">{s.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-outline-variant text-sm text-on-surface-variant">
          <p>© {new Date().getFullYear()} {clinic.name}. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  );
}
