import { motion } from 'framer-motion';
import { ShieldCheck, ArrowRight, Star } from 'lucide-react';

const goToCRM = () => { window.location.hash = 'crm'; };

export default function HeroSoftware() {
  return (
    <section id="hero" className="relative min-h-screen flex items-center pt-24 pb-16 overflow-hidden">
      <div className="container mx-auto px-6 sm:px-8 z-10 max-w-5xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-secondary-container text-on-secondary-container text-sm font-medium gap-2">
            <ShieldCheck size={14} />
            El software de gestión para quiroprácticos en Latinoamérica
          </span>
        </motion.div>

        <motion.h1
          className="editorial-title text-4xl sm:text-6xl md:text-7xl font-extrabold text-on-surface leading-[1.05] mt-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
        >
          El sistema operativo de tu <span className="text-primary">consultorio</span>
        </motion.h1>

        <motion.p
          className="text-lg sm:text-xl text-on-surface-variant max-w-2xl mx-auto leading-relaxed mt-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
        >
          Agenda, historia clínica, pagos, facturación DIAN y un asistente de WhatsApp — todo en un solo lugar.
          Diseñado para quiroprácticos y especialistas en salud espinal.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center mt-9"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
        >
          <button
            onClick={goToCRM}
            className="clinical-gradient text-on-primary px-8 py-4 rounded-xl text-lg font-bold shadow-lg shadow-primary/10 hover:scale-[1.02] active:scale-95 transition-all inline-flex items-center justify-center gap-2"
          >
            Empieza gratis 14 días <ArrowRight size={18} />
          </button>
          <a
            href="#medicos"
            className="bg-surface-container-high text-on-surface px-8 py-4 rounded-xl text-lg font-bold hover:bg-surface-container-highest transition-colors text-center"
          >
            Ver médicos de la red
          </a>
        </motion.div>

        <motion.div
          className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mt-10 text-sm text-on-surface-variant"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.9 }}
        >
          <span className="flex items-center gap-1.5">
            <Star size={15} className="text-amber-500 fill-amber-500" /> Sin tarjeta de crédito
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={15} className="text-primary" /> Cumplimiento DIAN & Habeas Data
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Hecho en Colombia 🇨🇴
          </span>
        </motion.div>
      </div>
    </section>
  );
}
