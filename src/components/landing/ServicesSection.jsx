import { motion } from 'framer-motion';
import { Activity, Stethoscope, PersonStanding, Route, Zap, Bone } from 'lucide-react';

const services = [
  {
    title: 'Ajuste Quiropráctico',
    desc: 'Técnicas manuales precisas para corregir subluxaciones vertebrales, mejorando la función del sistema nervioso y la movilidad general.',
    icon: Bone,
    image: '/images/dr-diaz/02-examining-patient.jpg',
    span: 'md:col-span-2',
    accent: 'bg-primary/10 text-primary',
  },
  {
    title: 'Quiropraxia Deportiva',
    desc: 'Optimización del rendimiento para atletas y recuperación acelerada de lesiones musculoesqueléticas.',
    icon: Activity,
    image: '/images/dr-diaz/13-deportiva.jpg',
    span: '',
    accent: 'bg-primary text-on-primary',
    isPrimary: true,
  },
  {
    title: 'Rehabilitación Postural',
    desc: 'Corrección de hábitos posturales mediante ejercicios específicos y ajustes guiados.',
    icon: PersonStanding,
    image: '/images/dr-diaz/12-checking-posture.jpg',
    span: '',
    accent: 'bg-tertiary-container/10 text-tertiary',
  },
  {
    title: 'Jornadas Itinerantes',
    desc: 'Llevamos la salud quiropráctica a municipios de Boyacá con equipos portátiles de alta gama.',
    icon: Route,
    image: '/images/dr-diaz/03-jornada-rural.jpg',
    span: '',
    accent: 'bg-secondary-container/20 text-secondary',
  },
  {
    title: 'Terapia Cervical/Lumbar',
    desc: 'Tratamiento específico para hernias discales, ciática y dolores de cuello crónicos.',
    icon: Zap,
    image: '/images/dr-diaz/08-with-patient-talking.jpg',
    span: '',
    accent: 'bg-error-container/20 text-error',
  },
  {
    title: 'Diagnóstico Clínico',
    desc: 'Análisis biomecánico completo con estudios radiológicos detallados para un tratamiento preciso.',
    icon: Stethoscope,
    image: '/images/dr-diaz/06-instruments-diagnostic.jpg',
    span: '',
    accent: 'bg-tertiary-fixed/20 text-tertiary',
  },
];

export default function ServicesSection() {
  return (
    <section id="servicios" className="py-24 bg-surface-container-low">
      <div className="container mx-auto px-8 max-w-7xl">
        <motion.div
          className="mb-16 text-center max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true, margin: '-100px' }}
        >
          <h2 className="text-4xl font-bold tracking-tight mb-4 text-on-surface">Nuestros Servicios</h2>
          <p className="text-on-surface-variant">Tratamientos especializados diseñados para corregir la causa raíz de su dolor y mejorar su movilidad.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {services.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.title}
                className={`${s.span} ${s.isPrimary ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest'} rounded-xl shadow-clinical hover:shadow-xl transition-shadow group overflow-hidden flex flex-col`}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                viewport={{ once: true }}
              >
                {s.image && (
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={s.image}
                      alt={s.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    {s.isPrimary && (
                      <div className="absolute inset-0 bg-primary/40 mix-blend-multiply" />
                    )}
                  </div>
                )}
                <div className="p-8 flex-1 flex flex-col">
                  <div className={`w-14 h-14 rounded-2xl ${s.isPrimary ? 'bg-on-primary/20' : s.accent} flex items-center justify-center mb-6`}>
                    <Icon size={28} />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">{s.title}</h3>
                  <p className={`${s.isPrimary ? 'opacity-90' : 'text-on-surface-variant'} leading-relaxed flex-1`}>{s.desc}</p>
                  {!s.isPrimary && (
                    <div className="mt-6 flex justify-end">
                      <span className="text-primary group-hover:translate-x-2 transition-transform">→</span>
                    </div>
                  )}
                  {s.isPrimary && (
                    <div className="pt-8 border-t border-on-primary/10 mt-8">
                      <p className="text-sm font-semibold uppercase tracking-widest">Atletas Pro</p>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
