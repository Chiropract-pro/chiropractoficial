import { motion } from 'framer-motion';
import { Calendar, FileText, CreditCard, Receipt, MessageSquare, Users, BarChart3, Smartphone } from 'lucide-react';

const FEATURES = [
  { icon: Calendar, title: 'Agenda inteligente', desc: 'Citas, recordatorios automáticos y control de jornadas itinerantes en municipios.' },
  { icon: FileText, title: 'Historia clínica', desc: 'Evoluciones, diagnósticos y adjuntos por paciente. Seguro y siempre disponible.' },
  { icon: CreditCard, title: 'Cobros con Wompi', desc: 'Genera links de pago y cobra en pesos. El recibo llega solo al paciente.' },
  { icon: Receipt, title: 'Facturación DIAN', desc: 'Factura electrónica con Alegra. Cumple sin salir del sistema.' },
  { icon: MessageSquare, title: 'Asistente WhatsApp', desc: 'Un bot que agenda, responde y confirma citas por ti, 24/7.' },
  { icon: Users, title: 'Portal del paciente', desc: 'Tus pacientes ven su historia, recibos y agendan con acceso propio.' },
  { icon: BarChart3, title: 'Finanzas claras', desc: 'Ingresos, egresos y metas del mes. Sabes cómo va tu consultorio de un vistazo.' },
  { icon: Smartphone, title: 'App instalable (PWA)', desc: 'Funciona en el celular como app nativa, incluso sin buena señal.' },
];

export default function SoftwareFeatures() {
  return (
    <section id="producto" className="py-20 px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-sm font-bold text-primary uppercase tracking-wider mb-2">Producto</p>
          <h2 className="font-display text-4xl md:text-5xl font-semibold text-on-surface tracking-tight">
            Todo lo que tu consultorio necesita
          </h2>
          <p className="text-on-surface-variant text-lg mt-3 max-w-2xl mx-auto">
            Deja el cuaderno y el Excel. chiropract.co reúne agenda, clínica, dinero y pacientes en una sola plataforma.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: (i % 4) * 0.08 }}
              className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 hover:shadow-lg hover:border-primary/30 transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <f.icon size={20} />
              </div>
              <h3 className="font-bold text-on-surface">{f.title}</h3>
              <p className="text-sm text-on-surface-variant mt-1.5 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
