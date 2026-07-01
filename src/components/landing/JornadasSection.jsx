import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { whatsappUrl } from '../../lib/clinic';

const jornadas = [
  { city: 'Soatá', date: 'Mensual', desc: 'Centro médico integral · plaza principal', image: '/images/jornadas/soata.jpg' },
  { city: 'Guamal', date: 'Bimensual', desc: 'Salón comunal · sector centro', image: '/images/jornadas/guamal.jpg' },
  { city: 'Muzo', date: 'Bimensual', desc: 'Atención a comunidad esmeraldera', image: '/images/jornadas/muzo.jpg' },
  { city: 'Garcés Navas', date: 'Mensual', desc: 'Consultorio descentralizado en Bogotá', image: '/images/jornadas/garces-navas.jpg' },
];

export default function JornadasSection() {
  return (
    <section id="jornadas" className="py-24 bg-surface-container">
      <div className="container mx-auto px-8 max-w-7xl">
        <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-16">
          <div className="max-w-xl">
            <h2 className="text-4xl font-bold tracking-tight mb-4 text-on-surface">Próximas Jornadas en Boyacá y Bogotá</h2>
            <p className="text-on-surface-variant">Llevamos la atención de alta calidad a tu comunidad. Reserva tu cupo con anticipación, los espacios son limitados.</p>
          </div>
          <div className="flex gap-4">
            <span className="inline-flex items-center gap-2 text-primary font-bold">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Inscripciones Abiertas
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {jornadas.map((j, i) => (
            <motion.div
              key={j.city}
              className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-shadow group"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              viewport={{ once: true }}
            >
              <div className="h-44 overflow-hidden relative">
                <img
                  src={j.image}
                  alt={j.city}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-lg text-xs font-bold shadow-sm text-on-surface">
                  {j.date}
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin size={16} className="text-primary" />
                  <h3 className="text-xl font-bold text-on-surface">{j.city}</h3>
                </div>
                <p className="text-on-surface-variant text-sm mb-5">{j.desc}</p>
                <a
                  href={whatsappUrl(`Hola, quiero reservar cupo para la jornada en ${j.city}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 border-2 border-primary text-primary font-bold rounded-xl hover:bg-primary hover:text-on-primary transition-all block text-center text-sm"
                >
                  Reservar cupo
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
