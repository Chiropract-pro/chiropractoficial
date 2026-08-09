import { PlayCircle, X } from 'lucide-react';
import { isDemoMode } from '../lib/demo';

/**
 * Aviso permanente mientras se está en modo demostración, para que nadie
 * confunda los datos de ejemplo con los del consultorio.
 */
export default function DemoBanner() {
  if (!isDemoMode()) return null;

  return (
    <div className="bg-tertiary-container border-b border-tertiary-fixed-dim/40">
      <div className="mx-auto max-w-[1560px] px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-2.5">
        <PlayCircle size={15} className="text-on-tertiary-container flex-shrink-0" />
        <p className="text-[12.5px] text-on-tertiary-container flex-1 min-w-0">
          <span className="font-semibold">Modo demostración</span>
          <span className="hidden sm:inline"> — datos de ejemplo. Nada se guarda ni se envía.</span>
        </p>
        <button
          onClick={() => { window.location.hash = ''; window.location.reload(); }}
          className="text-[11px] font-semibold text-on-tertiary-container hover:underline inline-flex items-center gap-1 flex-shrink-0"
        >
          Salir <X size={12} />
        </button>
      </div>
    </div>
  );
}
