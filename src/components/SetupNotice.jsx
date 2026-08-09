import { KeyRound, PlayCircle, Terminal } from 'lucide-react';

/**
 * SetupNotice — lo que se ve cuando faltan las variables de entorno.
 *
 * Antes esto era una pantalla en blanco: `createClient(undefined, undefined)`
 * lanzaba antes de que React montara y no quedaba ni un mensaje. Ahora se
 * explica qué falta, cómo arreglarlo, y se ofrece entrar al modo demostración
 * para ver la interfaz mientras tanto.
 */
export default function SetupNotice() {
  const enterDemo = () => {
    window.location.hash = 'demo';
    window.location.reload();
  };

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <div className="w-14 h-14 rounded-2xl clinical-gradient flex items-center justify-center mb-6">
          <KeyRound size={24} className="text-on-primary" />
        </div>

        <p className="kicker">Configuración pendiente</p>
        <h1 className="font-display text-hero font-semibold text-on-surface mt-1.5">
          Falta conectar la base de datos
        </h1>
        <p className="text-sm text-on-surface-variant mt-3 leading-relaxed">
          La aplicación no encuentra las credenciales de Supabase, así que no puede cargar
          pacientes, citas ni finanzas. Es un archivo de entorno, no un error del código.
        </p>

        <div className="mt-6 bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-clinical">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-3">
            <Terminal size={13} /> En tu terminal
          </p>
          <pre className="text-[12.5px] font-mono text-on-surface bg-surface-container-low rounded-xl p-3.5 overflow-x-auto">
cp .env.example .env.local
          </pre>
          <p className="text-xs text-on-surface-variant mt-3 leading-relaxed">
            Luego abre <code className="font-mono text-on-surface">.env.local</code> y completa{' '}
            <code className="font-mono text-on-surface">VITE_SUPABASE_URL</code> y{' '}
            <code className="font-mono text-on-surface">VITE_SUPABASE_ANON_KEY</code> con los valores
            del proyecto (Supabase → Settings → API). Reinicia el servidor y listo.
          </p>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <button
            onClick={enterDemo}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-primary text-on-primary px-5 py-3.5 rounded-xl text-sm font-semibold hover:bg-primary-light transition-colors shadow-pine"
          >
            <PlayCircle size={17} /> Ver el modo demostración
          </button>
        </div>
        <p className="text-[11px] text-on-surface-variant/80 mt-3 text-center">
          El modo demostración usa datos de ejemplo. No toca la base ni muestra pacientes reales.
        </p>
      </div>
    </div>
  );
}
