import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import {
  BadgeCheck, Save, ExternalLink, Loader2, Eye, EyeOff, Stethoscope, ShieldQuestion,
} from 'lucide-react';

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="text-xs text-on-surface-variant block mb-1">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-on-surface-variant mt-1">{hint}</p>}
    </div>
  );
}

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-outline-variant text-sm bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30';

export default function PublicProfileTab() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.rpc('ensure_my_practitioner_profile');
      if (!mounted) return;
      if (error) { setError(error.message); setLoading(false); return; }
      const p = Array.isArray(data) ? data[0] : data;
      setProfile(p);
      setForm({
        title: p.title || 'Dr.',
        full_name: p.full_name || '',
        headline: p.headline || '',
        bio: p.bio || '',
        specialties: (p.specialties || []).join(', '),
        city: p.city || '',
        country: p.country || 'Colombia',
        photo_url: p.photo_url || '',
        years_experience: p.years_experience ?? '',
        whatsapp: p.whatsapp || '',
        instagram: p.instagram || '',
        website: p.website || '',
        accepting_patients: p.accepting_patients ?? true,
        is_public: p.is_public ?? false,
      });
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e?.preventDefault();
    setSaving(true); setError('');
    const payload = {
      ...form,
      specialties: form.specialties.split(',').map((s) => s.trim()).filter(Boolean),
      years_experience: form.years_experience === '' ? null : Number(form.years_experience),
    };
    const { data, error } = await supabase.rpc('update_my_practitioner_profile', { p: payload });
    setSaving(false);
    if (error) { logger.error('update_profile', error); setError(error.message); return; }
    const p = Array.isArray(data) ? data[0] : data;
    setProfile(p);
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  const toggleVisibility = async () => {
    const next = !form.is_public;
    set('is_public', next);
    setSaving(true); setError('');
    const { data, error } = await supabase.rpc('update_my_practitioner_profile', { p: { is_public: next } });
    setSaving(false);
    if (error) { setError(error.message); set('is_public', !next); return; }
    const p = Array.isArray(data) ? data[0] : data;
    setProfile(p);
  };

  if (loading) {
    return (
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-12 flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }
  if (!form) {
    return <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-6 text-sm text-error">{error || 'No se pudo cargar tu perfil.'}</div>;
  }

  return (
    <div className="space-y-5">
      {/* Estado del perfil */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-surface-container-high overflow-hidden flex items-center justify-center text-on-surface-variant flex-shrink-0">
              {form.photo_url ? <img src={form.photo_url} alt="" className="w-full h-full object-cover" /> : <Stethoscope size={26} />}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-on-surface">{form.title} {form.full_name}</h3>
                {profile?.verified
                  ? <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5 rounded-full"><BadgeCheck size={13} /> Verificado</span>
                  : <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full"><ShieldQuestion size={13} /> Sin verificar</span>}
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">
                chiropract.co/#dr/{profile?.slug}
              </p>
            </div>
          </div>
          {profile?.is_public && (
            <a href={`#dr/${profile.slug}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
              Ver mi perfil <ExternalLink size={14} />
            </a>
          )}
        </div>

        {/* Toggle de visibilidad */}
        <div className="mt-5 pt-5 border-t border-outline-variant flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {form.is_public ? <Eye size={20} className="text-primary" /> : <EyeOff size={20} className="text-on-surface-variant" />}
            <div>
              <p className="text-sm font-semibold text-on-surface">{form.is_public ? 'Visible en el directorio' : 'Oculto del directorio'}</p>
              <p className="text-xs text-on-surface-variant">
                {form.is_public ? 'Los pacientes pueden encontrarte en la red.' : 'Actívalo cuando tu perfil esté listo.'}
              </p>
            </div>
          </div>
          <button
            onClick={toggleVisibility}
            disabled={saving}
            className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${form.is_public ? 'bg-primary' : 'bg-surface-container-high'}`}
            aria-label="Alternar visibilidad"
          >
            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${form.is_public ? 'left-6' : 'left-1'}`} />
          </button>
        </div>

        {!profile?.verified && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            Tu perfil aún no está verificado. Para obtener la insignia azul y poder publicar en la comunidad,
            completa tu información y el equipo de chiropract.co la revisará.
          </div>
        )}
      </div>

      {/* Formulario */}
      <form onSubmit={save} className="bg-surface-container-lowest rounded-xl border border-outline-variant p-6 space-y-4">
        <h3 className="font-semibold text-on-surface">Información pública</h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Field label="Título">
            <select value={form.title} onChange={(e) => set('title', e.target.value)} className={inputCls}>
              <option>Dr.</option><option>Dra.</option>
            </select>
          </Field>
          <div className="sm:col-span-3">
            <Field label="Nombre completo">
              <input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} className={inputCls} />
            </Field>
          </div>
        </div>

        <Field label="Titular" hint="Una línea que te describe. Ej: Cuidado espinal integral · 15 años">
          <input value={form.headline} onChange={(e) => set('headline', e.target.value)} className={inputCls} maxLength={120} />
        </Field>

        <Field label="Biografía">
          <textarea value={form.bio} onChange={(e) => set('bio', e.target.value)} rows={4} className={inputCls} />
        </Field>

        <Field label="Especialidades" hint="Separadas por coma. Ej: Quiropraxia, Ortopedia funcional, Fisioterapia">
          <input value={form.specialties} onChange={(e) => set('specialties', e.target.value)} className={inputCls} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Ciudad"><input value={form.city} onChange={(e) => set('city', e.target.value)} className={inputCls} /></Field>
          <Field label="País"><input value={form.country} onChange={(e) => set('country', e.target.value)} className={inputCls} /></Field>
          <Field label="Años de experiencia">
            <input type="number" min="0" value={form.years_experience} onChange={(e) => set('years_experience', e.target.value)} className={inputCls} />
          </Field>
        </div>

        <Field label="Foto (URL)" hint="Pega el enlace de una foto profesional.">
          <input value={form.photo_url} onChange={(e) => set('photo_url', e.target.value)} className={inputCls} placeholder="https://…" />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="WhatsApp" hint="Con indicativo. Ej: +57317…">
            <input value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} className={inputCls} placeholder="+57…" />
          </Field>
          <Field label="Instagram"><input value={form.instagram} onChange={(e) => set('instagram', e.target.value)} className={inputCls} placeholder="@usuario" /></Field>
          <Field label="Sitio web"><input value={form.website} onChange={(e) => set('website', e.target.value)} className={inputCls} placeholder="tusitio.com" /></Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-on-surface cursor-pointer">
          <input type="checkbox" checked={form.accepting_patients} onChange={(e) => set('accepting_patients', e.target.checked)} className="rounded" />
          Acepto nuevos pacientes
        </label>

        {error && <p className="text-sm text-error">{error}</p>}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving}
            className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar perfil
          </button>
          {saved && <span className="text-sm text-success font-medium">Perfil actualizado ✓</span>}
        </div>
      </form>
    </div>
  );
}
