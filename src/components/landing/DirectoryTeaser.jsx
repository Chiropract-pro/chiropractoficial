import { motion } from 'framer-motion';
import { BadgeCheck, MapPin, ArrowRight, Stethoscope, Users } from 'lucide-react';
import { usePractitioners } from '../../hooks/usePractitioners';

function DoctorCard({ p }) {
  return (
    <a
      href={`#dr/${p.slug}`}
      className="text-left bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden hover:shadow-xl hover:border-primary/30 transition-all group block"
    >
      <div className="aspect-[4/3] bg-surface-container-low overflow-hidden">
        {p.photo_url ? (
          <img src={p.photo_url} alt={p.full_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-on-surface-variant"><Stethoscope size={40} /></div>
        )}
      </div>
      <div className="p-5">
        <div className="flex items-center gap-1.5">
          <h3 className="font-bold text-on-surface">{p.title} {p.full_name}</h3>
          {p.verified && <BadgeCheck size={16} className="text-primary flex-shrink-0" />}
        </div>
        {p.headline && <p className="text-sm text-on-surface-variant mt-1 line-clamp-2">{p.headline}</p>}
        <div className="flex items-center gap-1 mt-2 text-xs text-on-surface-variant">
          <MapPin size={12} /> {p.city}{p.country ? `, ${p.country}` : ''}
        </div>
        <span className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-primary">
          Ver perfil <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </span>
      </div>
    </a>
  );
}

export default function DirectoryTeaser() {
  const { practitioners, loading } = usePractitioners();
  const featured = practitioners.slice(0, 3);

  return (
    <section id="medicos" className="py-20 px-6 bg-surface-container-low">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-sm font-bold text-primary uppercase tracking-wider mb-2">La comunidad</p>
          <h2 className="font-display text-4xl md:text-5xl font-semibold text-on-surface tracking-tight">
            Médicos de la red
          </h2>
          <p className="text-on-surface-variant text-lg mt-3 max-w-2xl mx-auto">
            Quiroprácticos verificados que ya usan chiropract.co para cuidar a sus pacientes. Conoce sus perfiles y agenda directamente.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface-container-lowest border border-outline-variant rounded-2xl h-80 animate-pulse" />
            ))}
          </div>
        ) : featured.length > 0 ? (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            {featured.map((p) => <DoctorCard key={p.id} p={p} />)}
          </motion.div>
        ) : (
          <p className="text-center text-on-surface-variant">Pronto verás aquí a los primeros médicos de la red.</p>
        )}

        <div className="text-center mt-10">
          <a
            href="#directorio"
            className="inline-flex items-center gap-2 clinical-gradient text-on-primary px-7 py-3.5 rounded-xl text-base font-bold hover:opacity-90 transition-opacity"
          >
            <Users size={18} /> Ver todo el directorio
          </a>
        </div>
      </div>
    </section>
  );
}
