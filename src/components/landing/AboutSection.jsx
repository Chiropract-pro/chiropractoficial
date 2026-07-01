import { motion } from 'framer-motion';
import { CheckCircle, Award, GraduationCap, Heart, MapPin } from 'lucide-react';

export default function AboutSection() {
  return (
    <section id="about" className="py-24 bg-surface">
      <div className="container mx-auto px-8 grid md:grid-cols-2 gap-16 items-center max-w-7xl">
        <motion.div
          className="relative"
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <div className="rounded-xl overflow-hidden shadow-2xl grayscale hover:grayscale-0 transition-all duration-700">
            <img
              src="/images/dr-diaz/01-portrait-formal.jpg"
              alt="Dr. Miguel Ángel Díaz"
              className="w-full aspect-[4/5] object-cover"
            />
          </div>
          <div className="absolute top-12 -right-4 glass-card p-5 rounded-xl border border-white/20 shadow-lg hidden lg:block">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-tertiary flex items-center justify-center text-on-tertiary">
                <Award size={18} />
              </div>
              <div className="text-xs font-bold uppercase tracking-tighter text-on-surface">Certificado Internacional</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="space-y-8"
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <div className="space-y-2">
            <h4 className="text-primary font-bold uppercase tracking-widest text-sm">Nuestro Fundador</h4>
            <h2 className="text-5xl font-bold tracking-tighter text-on-surface">Dr. Miguel Ángel Díaz</h2>
          </div>

          <p className="text-lg text-on-surface-variant leading-relaxed">
            Con una visión centrada en la precisión clínica y el bienestar integral, el Dr. Díaz ha dedicado su carrera a perfeccionar técnicas de ajuste que no solo alivian el dolor, sino que potencian la vitalidad humana.
          </p>

          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <CheckCircle size={20} className="text-primary mt-1 shrink-0" />
              <div>
                <p className="font-bold text-on-surface">Especialista en Quiropraxia Clínica</p>
                <p className="text-sm text-on-surface-variant">Formación avanzada en técnicas manuales e instrumentales.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <CheckCircle size={20} className="text-primary mt-1 shrink-0" />
              <div>
                <p className="font-bold text-on-surface">Enfoque en Biomecánica Humana</p>
                <p className="text-sm text-on-surface-variant">Análisis detallado de la marcha y la postura.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <CheckCircle size={20} className="text-primary mt-1 shrink-0" />
              <div>
                <p className="font-bold text-on-surface">Jornadas Itinerantes en Boyacá</p>
                <p className="text-sm text-on-surface-variant">Llevando atención quiropráctica a comunidades sin acceso.</p>
              </div>
            </div>
          </div>

          <a href="#contacto" className="text-primary font-bold flex items-center gap-2 group">
            Conocer trayectoria completa
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
