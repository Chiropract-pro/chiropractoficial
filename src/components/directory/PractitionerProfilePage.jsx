import {
  ArrowLeft, BadgeCheck, MapPin, Award, Calendar, MessageCircle,
  AtSign, Globe, Stethoscope, CheckCircle2, Heart,
} from 'lucide-react';
import { usePractitioner } from '../../hooks/usePractitioners';
import { useFeed } from '../../hooks/useFeed';

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `hace ${Math.max(1, Math.floor(s / 60))} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 604800) return `hace ${Math.floor(s / 86400)} d`;
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

// Publicaciones de este médico en la red (solo lectura desde el perfil).
function AuthorPosts({ practitionerId, name }) {
  const { posts, loading } = useFeed(practitionerId);

  if (loading) {
    return <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl h-32 animate-pulse" />;
  }
  if (posts.length === 0) {
    return (
      <div className="bg-surface-container-lowest border border-dashed border-outline-variant rounded-2xl p-8 text-center">
        <MessageCircle size={26} className="mx-auto text-on-surface-variant opacity-50 mb-2" />
        <p className="text-on-surface-variant text-sm">{name} aún no ha publicado en la red.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {posts.map((p) => (
        <article key={p.id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5">
          <p className="text-xs text-on-surface-variant mb-2">{timeAgo(p.created_at)}</p>
          <p className="text-on-surface leading-relaxed whitespace-pre-line">{p.content}</p>
          {p.image_url && <img src={p.image_url} alt="" className="mt-3 rounded-xl w-full object-cover max-h-96" />}
          <div className="flex items-center gap-5 mt-4 pt-3 border-t border-outline-variant text-sm text-on-surface-variant">
            <span className="flex items-center gap-1.5"><Heart size={16} /> {p.likes_count}</span>
            <span className="flex items-center gap-1.5"><MessageCircle size={16} /> {p.comments_count}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

const CLINIC = import.meta.env.VITE_CLINIC_NAME || 'chiropract.co';

function waLink(phone, name) {
  const clean = (phone || '').replace(/[^\d]/g, '');
  const msg = encodeURIComponent(`Hola ${name}, vengo de ${CLINIC} y quiero agendar una cita.`);
  return `https://wa.me/${clean}?text=${msg}`;
}

export default function PractitionerProfilePage({ slug, onBack }) {
  const { practitioner: p, loading } = usePractitioner(slug);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-container-low flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!p) {
    return (
      <div className="min-h-screen bg-surface-container-low flex flex-col items-center justify-center gap-4 px-6 text-center">
        <Stethoscope size={40} className="text-on-surface-variant opacity-50" />
        <p className="text-on-surface-variant">No encontramos este médico.</p>
        <button onClick={onBack} className="text-primary font-semibold">← Volver al directorio</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-container-low">
      {/* Header */}
      <header className="bg-surface-container-lowest border-b border-outline-variant sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-on-surface hover:text-primary transition-colors">
            <ArrowLeft size={18} /> <span className="font-semibold">Directorio</span>
          </button>
          <a href="#/" className="font-bold text-on-surface">{CLINIC}</a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Cabecera del perfil */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-3xl overflow-hidden">
          <div className="h-32 sm:h-40 clinical-gradient" />
          <div className="px-6 sm:px-8 pb-8">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-16 sm:-mt-20">
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl border-4 border-surface-container-lowest bg-surface-container-low overflow-hidden flex-shrink-0 shadow-lg">
                {p.photo_url ? (
                  <img src={p.photo_url} alt={p.full_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
                    <Stethoscope size={48} />
                  </div>
                )}
              </div>
              <div className="flex-1 sm:pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-2xl sm:text-3xl font-semibold text-on-surface">{p.title} {p.full_name}</h1>
                  {p.verified && (
                    <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded-full">
                      <BadgeCheck size={14} /> Verificado
                    </span>
                  )}
                </div>
                {p.headline && <p className="text-on-surface-variant mt-1">{p.headline}</p>}
                <div className="flex items-center gap-4 mt-3 text-sm text-on-surface-variant flex-wrap">
                  {p.city && <span className="flex items-center gap-1"><MapPin size={14} /> {p.city}, {p.country}</span>}
                  {p.years_experience && <span className="flex items-center gap-1"><Award size={14} /> {p.years_experience} años de experiencia</span>}
                  {p.accepting_patients && <span className="flex items-center gap-1 text-primary"><CheckCircle2 size={14} /> Acepta pacientes</span>}
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 mt-6">
              {p.whatsapp && (
                <a
                  href={waLink(p.whatsapp, `${p.title} ${p.full_name}`)}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 clinical-gradient text-on-primary px-5 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
                >
                  <Calendar size={16} /> Agendar cita
                </a>
              )}
              {p.whatsapp && (
                <a
                  href={waLink(p.whatsapp, `${p.title} ${p.full_name}`)}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 border border-outline-variant text-on-surface px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-surface-container-low transition-colors"
                >
                  <MessageCircle size={16} /> WhatsApp
                </a>
              )}
              {p.instagram && (
                <a href={p.instagram.startsWith('http') ? p.instagram : `https://instagram.com/${p.instagram.replace('@', '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 border border-outline-variant text-on-surface px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-surface-container-low transition-colors">
                  <AtSign size={16} />
                </a>
              )}
              {p.website && (
                <a href={p.website.startsWith('http') ? p.website : `https://${p.website}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 border border-outline-variant text-on-surface px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-surface-container-low transition-colors">
                  <Globe size={16} />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Bio + especialidades */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-2xl p-6">
            <h2 className="text-lg font-bold text-on-surface mb-3">Acerca de</h2>
            <p className="text-on-surface-variant leading-relaxed whitespace-pre-line">{p.bio || 'Este médico aún no ha completado su biografía.'}</p>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 h-fit">
            <h2 className="text-lg font-bold text-on-surface mb-3">Especialidades</h2>
            {p.specialties?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {p.specialties.map((s) => (
                  <span key={s} className="text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-full font-medium">{s}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant">No especificadas.</p>
            )}
          </div>
        </div>

        {/* Publicaciones en la red profesional */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-on-surface">Publicaciones</h2>
            <a href="#comunidad" className="text-sm font-semibold text-primary hover:underline">Ver la comunidad →</a>
          </div>
          <AuthorPosts practitionerId={p.id} name={`${p.title} ${p.full_name.split(' ')[0]}`} />
        </div>
      </main>
    </div>
  );
}
