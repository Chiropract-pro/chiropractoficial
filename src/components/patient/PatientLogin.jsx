import { useEffect, useState } from 'react';
import { ArrowRight, KeyRound, Loader2, Phone, ShieldCheck } from 'lucide-react';
import { requestOtp, verifyOtp } from '../../lib/patientApi';
import { usePatientAuth } from '../../contexts/PatientAuthContext';

const CLINIC_NAME = import.meta.env.VITE_CLINIC_NAME || 'chiropract.co';

export default function PatientLogin({ onBack }) {
  const { onLoginSuccess } = usePatientAuth();
  const [step, setStep] = useState('phone'); // phone | code
  const [phone, setPhone] = useState('+57 ');
  const [code, setCode] = useState('');
  const [patientName, setPatientName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Cooldown countdown para reenviar código
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleRequestOtp = async (e) => {
    e?.preventDefault();
    setError('');

    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Ingresa un teléfono válido (con código de país).');
      return;
    }

    setLoading(true);
    try {
      const res = await requestOtp(phone);
      setPatientName(res.patient_name || '');
      setStep('code');
      setResendCooldown(60);
    } catch (e) {
      setError(e.message || 'No pudimos enviar el código. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e?.preventDefault();
    setError('');

    if (!/^\d{6}$/.test(code)) {
      setError('El código debe tener 6 dígitos.');
      return;
    }

    setLoading(true);
    try {
      const session = await verifyOtp(phone, code);
      onLoginSuccess(session);
      // PatientApp se encargará de cambiar la pantalla automáticamente
    } catch (e) {
      setError(e.message || 'Código incorrecto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logos/v1-spine-mark.svg" alt={CLINIC_NAME} className="h-12 w-auto mx-auto mb-3" />
          <p className="text-on-surface-variant text-sm">Panel del paciente</p>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant p-7 space-y-6">
          {step === 'phone' && (
            <>
              <div>
                <h2 className="text-2xl font-bold text-on-surface">Bienvenido</h2>
                <p className="text-on-surface-variant text-sm mt-1">
                  Te enviaremos un código de acceso por WhatsApp.
                </p>
              </div>

              {error && (
                <div className="bg-error-container/20 text-error border border-error/20 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleRequestOtp} className="space-y-5">
                <div>
                  <label className="text-sm font-medium text-on-surface-variant block mb-1.5">
                    Teléfono (WhatsApp)
                  </label>
                  <div className="relative">
                    <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      placeholder="+57 311 234 5678"
                      autoFocus
                      autoComplete="tel"
                      required
                    />
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1.5 flex items-center gap-1">
                    <ShieldCheck size={12} />
                    Mismo número que registró tu doctor.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full clinical-gradient text-on-primary py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      Enviar código
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {step === 'code' && (
            <>
              <div>
                <h2 className="text-2xl font-bold text-on-surface">
                  {patientName ? `Hola ${patientName.split(' ')[0]}` : 'Verifica tu código'}
                </h2>
                <p className="text-on-surface-variant text-sm mt-1">
                  Te enviamos un código de 6 dígitos a{' '}
                  <span className="font-semibold text-on-surface">{phone}</span>
                </p>
              </div>

              {error && (
                <div className="bg-error-container/20 text-error border border-error/20 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleVerify} className="space-y-5">
                <div>
                  <label className="text-sm font-medium text-on-surface-variant block mb-1.5">
                    Código de acceso
                  </label>
                  <div className="relative">
                    <KeyRound size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface text-2xl font-mono tracking-[0.5em] text-center focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      placeholder="••••••"
                      autoFocus
                      autoComplete="one-time-code"
                      required
                    />
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1.5">Vence en 10 minutos.</p>
                </div>

                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="w-full clinical-gradient text-on-primary py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      Ingresar
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setStep('phone');
                    setCode('');
                    setError('');
                  }}
                  className="text-on-surface-variant hover:text-primary transition-colors"
                >
                  ← Cambiar número
                </button>
                <button
                  type="button"
                  disabled={resendCooldown > 0 || loading}
                  onClick={handleRequestOtp}
                  className="text-primary font-semibold hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
                >
                  {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : 'Reenviar código'}
                </button>
              </div>
            </>
          )}
        </div>

        {onBack && (
          <div className="text-center mt-6">
            <button
              onClick={onBack}
              className="text-sm text-on-surface-variant hover:text-primary transition-colors"
            >
              ← Volver al sitio
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
