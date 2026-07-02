import { useState } from 'react';
import { Search, MapPin, BadgeCheck, ArrowRight, Stethoscope, ArrowLeft } from 'lucide-react';
import { usePractitioners } from '../../hooks/usePractitioners';

const CLINIC = import.meta.env.VITE_CLINIC_NAME || 'chiropract.co';

function PractitionerCard({ p, onOpen }) {
  return (
    <button
      onClick={() => onOpen(p.slug)}
      className="text-left bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all group"
    >
      <div className="aspect-[4/3] bg-surface-container-low overflow-hidden">
        {p.photo_url ? (
          <img src={p.photo_url} alt={p.full_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
            <Stethoscope size={40} />
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-1.5">
          <h3 className="font-bold text-on-surface truncate">{p.title} {p.full_name}</h3>
          {p.verified && <BadgeCheck size={16} className="text-primary flex-shrink-0" />}
        </div>
        {p.headline && <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">{p.headline}</p>}
        <div className="flex items-center gap-1 mt-2 text-xs text-on-surface-variant">
          <MapPin size={12} /> {p.city}{p.country ? `, ${p.country}` : ''}
        </div>
        {p.specialties?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {p.specialties.slice(0, 3).map((s) => (
              <span key={s} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{s}</span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1 mt-3 text-sm font-semibold text-primary">
          Ver perfil <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </button>
  );
}

export default function DirectoryPage({ onBack, onOpenProfile }) {
  const [search, setSearch] = useState('');
  const { practitioners, loading } = usePractitioners();

  const filtered = practitioners.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.full_name?.toLowerCase().includes(q) ||
      p.city?.toLowerCase().includes(q) ||
      p.specialties?.some((s) => s.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-surface-container-low">
      {/* Header */}
      <header className="bg-surface-container-lowest border-b border-outline-variant sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-on-surface hover:text-primary transition-colors">
            <ArrowLeft size={18} />
            <span className="font-bold">{CLINIC}</span>
          </button>
          <a href="#crm" className="text-sm font-semibold text-primary hover:underline">Soy médico → Únete</a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="text-center mb-8">
          <p className="text-sm font-bold text-primary uppercase tracking-wider mb-2">Red de profesionales</p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-on-surface tracking-tight">Médicos de la red</h1>
          <p className="text-on-surface-variant mt-2 max-w-xl mx-auto">
            Quiroprácticos y especialistas en salud espinal de Latinoamérica. Encuentra el tuyo o conoce a la comunidad.
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-md mx-auto mb-8">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Busca por nombre, ciudad o especialidad…"
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface-container-lowest border border-outline-variant rounded-2xl h-72 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-on-surface-variant">
            <Stethoscope size={36} className="mx-auto mb-3 opacity-50" />
            <p>No encontramos médicos con esos criterios.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((p) => (
              <PractitionerCard key={p.id} p={p} onOpen={onOpenProfile} />
            ))}
          </div>
        )}

        {/* CTA para médicos */}
        <div className="mt-12 bg-surface-container-lowest border border-outline-variant rounded-2xl p-8 text-center">
          <h2 className="text-xl font-bold text-on-surface">¿Eres quiropráctico?</h2>
          <p className="text-on-surface-variant text-sm mt-1 mb-4 max-w-md mx-auto">
            Únete a la red, gestiona tu consultorio con el software y conecta con colegas de toda Latinoamérica.
          </p>
          <a href="#crm" className="inline-flex items-center gap-2 clinical-gradient text-on-primary px-6 py-3 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">
            Crear mi cuenta gratis <ArrowRight size={16} />
          </a>
        </div>
      </main>
    </div>
  );
}
