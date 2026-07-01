import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

const testimonials = [
  {
    name: 'Catalina Forero',
    role: 'Paciente desde hace 2 años',
    text: 'Después de meses con dolor lumbar, las sesiones con el Dr. Miguel fueron un cambio total. Su enfoque profesional y las explicaciones claras me dieron mucha confianza.',
    border: 'border-primary',
    bg: 'bg-surface-container-lowest',
    avatar: '/images/testimonials/catalina-forero.jpg',
  },
  {
    name: 'Jairo Rodríguez',
    role: 'Jornada Boyacá',
    text: 'Excelente atención en la jornada de Soatá. Me ahorró el viaje a Bogotá y el tratamiento fue impecable. Totalmente recomendado.',
    border: 'border-secondary',
    bg: 'bg-surface-container-lowest',
    avatar: '/images/testimonials/jairo-rodriguez.jpg',
  },
  {
    name: 'Ana María López',
    role: 'Quiropraxia deportiva',
    text: 'Mi lesión de hombro mejoró dramáticamente en solo 3 sesiones. Pude volver a entrenar sin dolor. El Dr. Díaz entiende el cuerpo del atleta.',
    border: 'border-tertiary',
    bg: 'bg-surface-container-lowest',
    avatar: '/images/testimonials/ana-maria-lopez.jpg',
  },
];

export default function TestimonialsSection() {
  return (
    <section className="py-24 bg-surface">
      <div className="container mx-auto px-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold tracking-tight mb-8 text-on-surface">Testimonios de Pacientes</h2>
            <div className="space-y-6">
              {testimonials.map((t, i) => (
                <motion.div
                  key={t.name}
                  className={`${t.bg} p-8 rounded-xl shadow-sm border-l-4 ${t.border}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  viewport={{ once: true }}
                >
                  <div className="flex gap-1 mb-4 text-tertiary-fixed-dim">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={16} className="fill-current" />
                    ))}
                  </div>
                  <p className="text-xl italic text-on-surface mb-6">"{t.text}"</p>
                  <div className="flex items-center gap-4">
                    <img
                      src={t.avatar}
                      alt={t.name}
                      className="w-12 h-12 rounded-full object-cover"
                      loading="lazy"
                    />
                    <div>
                      <p className="font-bold text-on-surface">{t.name}</p>
                      <p className="text-sm text-on-surface-variant">{t.role}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="aspect-[4/5] rounded-xl overflow-hidden shadow-2xl relative">
              <img
                src="/images/dr-diaz/04-charla-educativa.jpg"
                alt="Dr. Miguel Ángel Díaz dando una charla"
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                <p className="text-2xl font-bold mb-2">15+ años transformando vidas</p>
                <p className="text-sm opacity-90">A través de la quiropraxia clínica integrada.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
