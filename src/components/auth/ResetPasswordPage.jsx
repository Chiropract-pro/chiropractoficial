import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, Lock, CheckCircle, AlertCircle } from 'lucide-react';

const CLINIC_NAME = import.meta.env.VITE_CLINIC_NAME || 'chiropract.co';

/**
 * Pantalla para fijar una nueva contraseña tras el email de recuperación.
 *
 * Flujo: el usuario hace click en el enlace del correo → Supabase (con
 * detectSessionInUrl activo) establece una sesión temporal de "recovery" y
 * emite el evento PASSWORD_RECOVERY. Aquí mostramos el formulario y llamamos
 * a supabase.auth.updateUser({ password }). Antes esta mitad del flujo NO
 * existía (no había ruta ni llamada a updateUser) → el enlace no llevaba a nada.
 */
export default function ResetPasswordPage({ onDone }) {
  const [ready, setReady] = useState(false);      // hay sesión de recovery válida
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase procesa el token del hash automáticamente. Verificamos que haya
    // sesión (de recovery) para permitir el cambio.
    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        if (mounted) setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted && session) setReady(true);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (password !== confirm) return setError('Las contraseñas no coinciden.');

    setLoading(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) throw updErr;
      setDone(true);
      // Tras cambiar, cerramos la sesión de recovery y mandamos al login limpio.
      setTimeout(async () => {
        await supabase.auth.signOut().catch(() => {});
        window.location.hash = 'crm';
        onDone?.();
      }, 1800);
    } catch (err) {
      setError(err.message || 'No se pudo cambiar la contraseña. Solicita un nuevo enlace.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-2xl font-bold text-primary">{CLINIC_NAME}</p>
          <p className="text-on-surface-variant text-sm mt-1">Restablecer contraseña</p>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl shadow-clinical border border-outline-variant p-7">
          {done ? (
            <div className="text-center py-6">
              <CheckCircle size={44} className="mx-auto text-primary mb-3" />
              <h2 className="text-xl font-bold text-on-surface">Contraseña actualizada</h2>
              <p className="text-on-surface-variant text-sm mt-1">Te llevamos al inicio de sesión…</p>
            </div>
          ) : !ready ? (
            <div className="text-center py-8">
              <Loader2 size={28} className="animate-spin text-primary mx-auto mb-3" />
              <p className="text-on-surface-variant text-sm">Validando tu enlace de recuperación…</p>
              <p className="text-on-surface-variant/70 text-xs mt-4">
                Si llegaste aquí sin usar el enlace del correo, solicita uno nuevo desde
                "¿Olvidaste tu contraseña?" en el login.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-on-surface mb-1">Nueva contraseña</h2>
              <p className="text-on-surface-variant text-sm mb-6">Elige una contraseña segura para tu cuenta.</p>

              {error && (
                <div className="bg-error-container/20 text-error border border-error/20 px-4 py-3 rounded-xl text-sm mb-4 flex items-start gap-2">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-on-surface-variant block mb-1.5">Nueva contraseña</label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Mínimo 8 caracteres"
                      autoFocus
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-on-surface-variant block mb-1.5">Confirmar contraseña</label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Repite la contraseña"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full clinical-gradient text-on-primary py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : 'Cambiar contraseña'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
