import { ArrowLeft, Lock } from 'lucide-react';
import { MANUALES, MANUALES_PUBLICOS } from '../../lib/manual';
import BibliotecaManuales from './BibliotecaManuales';
import Ayuda from './Ayuda';

/**
 * Los manuales por link, sin necesidad de entrar al sistema.
 *
 * Sirve para mandarle al paciente su manual por WhatsApp, o para que una
 * recepcionista nueva lo lea antes de tener usuario. El del administrador no
 * se sirve por aquí ni escribiendo la dirección a mano: explica tarifas,
 * facturación y alta de usuarios, y esto es internet abierto.
 */
export default function ManualPublico({ clave, onAbrir, onVolver }) {
  const manual = clave ? MANUALES[clave] : null;

  if (clave && (!manual || !manual.publico)) {
    return (
      <Marco onVolver={onVolver} volverA="Todos los manuales">
        <div className="text-center py-16">
          <span className="w-12 h-12 rounded-2xl bg-surface-container-high text-on-surface-variant inline-flex items-center justify-center">
            <Lock size={22} />
          </span>
          <h1 className="font-display text-xl font-semibold text-on-surface mt-4">
            Este manual no es público
          </h1>
          <p className="text-[13.5px] text-on-surface-variant mt-2 max-w-sm mx-auto leading-relaxed">
            El manual del administrador solo se abre desde adentro del sistema, con la sesión del
            dueño del consultorio.
          </p>
        </div>
      </Marco>
    );
  }

  if (manual) {
    return (
      <Marco onVolver={onVolver} volverA="Todos los manuales">
        <Ayuda manual={manual} />
      </Marco>
    );
  }

  return (
    <Marco>
      <BibliotecaManuales
        manuales={MANUALES_PUBLICOS}
        onAbrir={onAbrir}
        titulo="Manuales de chiropract.co"
        subtitulo="Ábralos aquí o guárdelos en PDF. No hace falta tener cuenta."
      />
    </Marco>
  );
}

function Marco({ children, onVolver, volverA }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-outline-variant bg-surface-container-lowest" data-sin-imprimir>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          {onVolver ? (
            <button
              type="button"
              onClick={onVolver}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <ArrowLeft size={15} /> {volverA}
            </button>
          ) : <span />}
          <a href="#/" className="font-display font-bold text-on-surface">chiropract.co</a>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
