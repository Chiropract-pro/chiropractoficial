import { BookOpen, Check, Copy, Globe, Lock, ArrowRight } from 'lucide-react';
import { useState } from 'react';

/**
 * Biblioteca de manuales: una tarjeta por manual, en vez de soltar al usuario
 * dentro de un documento de quince secciones.
 *
 * El manual del administrador nunca se publica —explica tarifas, facturación,
 * plan y alta de usuarios—, así que su tarjeta muestra un candado en lugar del
 * botón de copiar link. Esa decisión vive en `manual.js` (`publico: false`), no
 * aquí: la interfaz solo la obedece.
 */
export default function BibliotecaManuales({ manuales, onAbrir, titulo, subtitulo }) {
  return (
    <div className="space-y-5 sm:space-y-6">
      <header>
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
          <BookOpen size={12} /> Biblioteca
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-on-surface mt-1">{titulo}</h1>
        <p className="text-sm text-on-surface-variant mt-1">{subtitulo}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {manuales.map((m) => <TarjetaManual key={m.clave} manual={m} onAbrir={onAbrir} />)}
      </div>
    </div>
  );
}

function TarjetaManual({ manual, onAbrir }) {
  const [copiado, setCopiado] = useState(false);
  const link = `${window.location.origin}/#manual/${manual.clave}`;

  const copiar = async (e) => {
    // El botón vive dentro de una tarjeta que abre el manual al hacer clic:
    // sin esto, copiar el link también lo abría.
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* si el navegador no deja, el link igual se ve en pantalla */ }
  };

  return (
    <article
      onClick={() => onAbrir(manual.clave)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(manual.clave); } }}
      className="group text-left bg-surface-container-lowest border border-outline-variant/70 rounded-2xl p-5 flex flex-col gap-3 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <BookOpen size={19} />
        </span>
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full ${
            manual.publico
              ? 'bg-tertiary-container text-on-tertiary-container'
              : 'bg-surface-container-high text-on-surface-variant'
          }`}
        >
          {manual.publico ? <><Globe size={11} /> Se puede compartir</> : <><Lock size={11} /> Solo aquí dentro</>}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <h2 className="font-display text-lg font-semibold text-on-surface">{manual.titulo}</h2>
        <p className="text-[13px] text-on-surface-variant mt-1 leading-relaxed">{manual.audiencia}</p>
      </div>

      <p className="text-[11.5px] text-on-surface-variant/80">
        {manual.secciones.length} {manual.secciones.length === 1 ? 'sección' : 'secciones'}
      </p>

      <div className="flex items-center gap-2 pt-1 border-t border-outline-variant/50 -mx-1 px-1">
        <span className="flex-1 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary pt-3">
          Abrir <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
        </span>
        {manual.publico && (
          <button
            type="button"
            onClick={copiar}
            title={link}
            className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] font-medium px-2 py-1.5 rounded-lg border border-outline-variant text-on-surface-variant hover:text-on-surface hover:border-outline transition-colors"
          >
            {copiado ? <><Check size={12} className="text-success" /> Copiado</> : <><Copy size={12} /> Copiar link</>}
          </button>
        )}
      </div>
    </article>
  );
}
