import { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Building2, MapPin, Phone, ArrowRight, Loader2, CheckCircle } from 'lucide-react';

const PLANS = [
  { id: 'trial', name: 'Trial', price: 'Gratis', period: '14 días', features: ['Hasta 50 pacientes', '1 usuario', 'Módulo básico'], color: 'border-outline-variant' },
  { id: 'basic', name: 'Básico', price: '$49 USD', period: '/mes', features: ['200 pacientes', '3 usuarios', 'Todos los módulos'], color: 'border-primary' },
  { id: 'pro', name: 'Pro', price: '$99 USD', period: '/mes', features: ['Pacientes ilimitados', '10 usuarios', 'API + integraciones', 'Soporte prioritario'], color: 'border-primary', popular: true },
];

export default function OnboardingPage() {
  const { createTenant, isSlugAvailable } = useAuth();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState(null); // 'checking' | 'available' | 'taken' | 'invalid' | null
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [plan, setPlan] = useState('trial');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const slugDebounceRef = useRef(null);

  const handleCreate = async () => {
    setError('');
    if (!name.trim()) return setError('El nombre del consultorio es obligatorio');
    if (slug.length < 3) return setError('La URL debe tener al menos 3 caracteres');
    if (slugStatus === 'taken') return setError('Esa URL ya está en uso. Elige otra.');

    setLoading(true);
    try {
      await createTenant(name.trim(), slug, { city: city.trim(), phone: phone.trim(), plan });
    } catch (err) {
      setError(err.message || 'Error al crear el consultorio');
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (n) => {
    return n.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 30);
  };

  const checkSlug = async (s) => {
    if (s.length < 3) {
      setSlugStatus('invalid');
      return;
    }
    setSlugStatus('checking');
    const ok = await isSlugAvailable(s);
    setSlugStatus(ok ? 'available' : 'taken');
  };

  const handleSlugChange = (value, isUserEdit = true) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(cleaned);
    setSlugStatus(null);
    if (isUserEdit) setSlugTouched(true);
    if (slugDebounceRef.current) clearTimeout(slugDebounceRef.current);
    if (cleaned.length >= 3) {
      slugDebounceRef.current = setTimeout(() => checkSlug(cleaned), 400);
    } else if (cleaned.length > 0) {
      setSlugStatus('invalid');
    }
  };

  const handleNameChange = (value) => {
    setName(value);
    // Solo regenerar slug automáticamente si el user no lo ha editado a mano
    if (!slugTouched) {
      const newSlug = generateSlug(value);
      handleSlugChange(newSlug, false);
    }
  };

  const canContinueStep1 = name.trim().length >= 2 && slug.length >= 3 && slugStatus === 'available';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="flex items-center gap-3 mb-12">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-3 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step >= s ? 'clinical-gradient text-on-primary' : 'bg-surface-container-highest text-on-surface-variant'
              }`}>
                {step > s ? <CheckCircle size={16} /> : s}
              </div>
              {s < 3 && <div className={`flex-1 h-0.5 ${step > s ? 'bg-primary' : 'bg-outline-variant/30'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Clinic Info */}
        {step === 1 && (
          <div className="bg-surface-container-lowest rounded-2xl p-8 shadow-clinical">
            <h2 className="text-3xl font-bold text-on-surface mb-2">Configura tu consultorio</h2>
            <p className="text-on-surface-variant mb-8">Cuéntanos sobre tu práctica quiropráctica</p>

            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium text-on-surface-variant block mb-1.5">Nombre del consultorio</label>
                <div className="relative">
                  <Building2 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Clínica Quiropráctica Bogotá"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-on-surface-variant block mb-1.5">URL personalizada</label>
                <div className={`flex items-center rounded-xl border overflow-hidden ${
                  slugStatus === 'taken' ? 'border-error' : slugStatus === 'available' ? 'border-primary' : 'border-outline-variant'
                } bg-surface-container-low`}>
                  <span className="px-3 py-3 text-on-surface-variant text-sm bg-surface-container-high">chiropract.co/</span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    className="flex-1 px-3 py-3 text-on-surface text-sm focus:outline-none bg-transparent"
                    placeholder="mi-consultorio"
                  />
                </div>
                {slug.length > 0 && (
                  <p className={`text-xs mt-1 ${
                    slugStatus === 'taken' ? 'text-error' :
                    slugStatus === 'available' ? 'text-primary' :
                    slugStatus === 'invalid' ? 'text-on-surface-variant' :
                    'text-on-surface-variant'
                  }`}>
                    {slugStatus === 'checking' && 'Verificando...'}
                    {slugStatus === 'available' && '✓ Disponible'}
                    {slugStatus === 'taken' && '✗ Ya está en uso'}
                    {slugStatus === 'invalid' && 'Mínimo 3 caracteres, solo letras y números'}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-on-surface-variant block mb-1.5">Ciudad</label>
                  <div className="relative">
                    <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Bogotá"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-on-surface-variant block mb-1.5">Teléfono</label>
                  <div className="relative">
                    <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="+57 311 234 5678"
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => canContinueStep1 ? setStep(2) : null}
              disabled={!canContinueStep1}
              className="w-full mt-8 clinical-gradient text-on-primary py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              Continuar <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* Step 2: Plan Selection */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-on-surface mb-2">Elige tu plan</h2>
              <p className="text-on-surface-variant">Empieza gratis, escala cuando quieras</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PLANS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlan(p.id)}
                  className={`relative text-left p-6 rounded-2xl border-2 ${plan === p.id ? p.color + ' bg-primary/5' : 'border-outline-variant/30 bg-surface-container-lowest'} transition-all hover:shadow-lg`}
                >
                  {p.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-on-primary text-xs font-bold px-3 py-1 rounded-full">Popular</span>
                  )}
                  <h3 className="text-xl font-bold text-on-surface">{p.name}</h3>
                  <div className="mt-2 mb-4">
                    <span className="text-3xl font-extrabold text-on-surface">{p.price}</span>
                    <span className="text-on-surface-variant text-sm">{p.period}</span>
                  </div>
                  <ul className="space-y-2">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-on-surface-variant">
                        <CheckCircle size={14} className="text-primary shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3.5 rounded-xl text-sm font-bold border-2 border-outline-variant text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                Atrás
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 clinical-gradient text-on-primary py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all"
              >
                Continuar <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div className="bg-surface-container-lowest rounded-2xl p-8 shadow-clinical">
            <h2 className="text-3xl font-bold text-on-surface mb-2">Todo listo</h2>
            <p className="text-on-surface-variant mb-8">Confirma los datos de tu consultorio</p>

            <div className="space-y-4 mb-8">
              <div className="bg-surface-container-low p-4 rounded-xl">
                <p className="text-xs text-on-surface-variant uppercase tracking-wider font-bold mb-1">Consultorio</p>
                <p className="text-lg font-bold text-on-surface">{name}</p>
                <p className="text-sm text-on-surface-variant">chiropract.co/{slug}</p>
              </div>
              <div className="bg-surface-container-low p-4 rounded-xl">
                <p className="text-xs text-on-surface-variant uppercase tracking-wider font-bold mb-1">Plan seleccionado</p>
                <p className="text-lg font-bold text-on-surface">{PLANS.find(p => p.id === plan)?.name}</p>
              </div>
            </div>

            {error && (
              <div className="bg-error-container/20 text-error border border-error/20 px-4 py-3 rounded-xl text-sm mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-3.5 rounded-xl text-sm font-bold border-2 border-outline-variant text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                Atrás
              </button>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="flex-1 clinical-gradient text-on-primary py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : 'Crear mi consultorio'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
