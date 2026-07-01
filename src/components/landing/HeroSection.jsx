import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { wa } from '../../lib/clinic';

export default function HeroSection() {
  return (
    <section id="hero" className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      <div className="container mx-auto px-8 z-10 grid md:grid-cols-2 gap-12 items-center max-w-7xl">
        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-secondary-container text-on-secondary-container text-sm font-medium gap-2">
              <ShieldCheck size={14} />
              Clinical Precision in Bogotá & Boyacá
            </span>
          </motion.div>

          <motion.h1
            className="editorial-title text-5xl md:text-7xl font-extrabold text-on-surface leading-[1.1]"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            Tu bienestar empieza con una buena <span className="text-primary">alineación</span>
          </motion.h1>

          <motion.p
            className="text-xl text-on-surface-variant max-w-lg leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            Quiropraxia profesional en Bogotá y jornadas en Boyacá. Restauramos tu salud estructural con técnicas avanzadas y cuidado personalizado.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.1 }}
          >
            <a
              href={wa.schedule()}
              target="_blank"
              rel="noopener noreferrer"
              className="clinical-gradient text-on-primary px-8 py-4 rounded-xl text-lg font-bold shadow-lg shadow-primary/10 hover:scale-[1.02] active:scale-95 transition-all text-center"
            >
              Agendar Cita
            </a>
            <a
              href="#jornadas"
              className="bg-surface-container-high text-on-surface px-8 py-4 rounded-xl text-lg font-bold hover:bg-surface-container-highest transition-colors text-center"
            >
              Ver Jornadas
            </a>
          </motion.div>
        </div>

        <div className="relative flex items-center justify-center mt-8 md:mt-0">
          <motion.div
            className="relative w-full"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
          >
            <div className="absolute -inset-4 bg-primary/5 rounded-[2rem] blur-2xl" />
            <div className="relative aspect-[4/5] max-w-md mx-auto rounded-[2rem] overflow-hidden shadow-2xl">
              <img
                src="/images/dr-diaz/07-portrait-hero.jpg"
                alt="Dr. Miguel Ángel Díaz"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-4 -left-2 md:-bottom-6 md:-left-6 bg-surface-container-lowest p-4 md:p-6 rounded-2xl shadow-xl z-20 flex items-center gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full clinical-gradient flex items-center justify-center text-on-primary">
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </div>
              <div>
                <div className="text-lg md:text-2xl font-bold text-on-surface">15+ Años</div>
                <div className="text-xs md:text-sm text-on-surface-variant uppercase tracking-wider font-semibold">Experiencia</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
