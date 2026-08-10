import { useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, Search, X } from 'lucide-react';

/**
 * Visor del manual. Sirve tanto al CRM como al portal del paciente: recibe ya
 * resuelto el manual que le toca a quien está mirando, así que no sabe nada de
 * roles ni de sesiones.
 *
 * El buscador filtra por título, resumen y contenido — no solo por título:
 * quien tiene la duda casi nunca conoce el nombre de la pantalla, busca la
 * palabra del problema («cupo», «vence», «saldo»).
 */
export default function Ayuda({ manual, etiquetaRol, compacto = false }) {
  const [q, setQ] = useState('');

  const secciones = useMemo(() => {
    const texto = q.trim().toLowerCase();
    if (!texto) return manual.secciones;
    return manual.secciones.filter((s) => {
      const heno = [
        s.titulo, s.resumen, s.ojo,
        ...(s.puntos || []).flat(),
        ...(s.pasos || []),
      ].filter(Boolean).join(' ').toLowerCase();
      return heno.includes(texto);
    });
  }, [manual.secciones, q]);

  return (
    <div className={compacto ? 'space-y-4' : 'space-y-5 sm:space-y-6'}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
            <BookOpen size={12} /> Manual
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-on-surface mt-1">
            {manual.titulo}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">{manual.subtitulo}</p>
        </div>
        {etiquetaRol && (
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-tertiary-container text-on-tertiary-container">
            {etiquetaRol}
          </span>
        )}
      </header>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar: cupo, saldo, vence, confirmar…"
          aria-label="Buscar en el manual"
          className="w-full bg-surface-container-low border border-outline-variant rounded-xl pl-9 pr-9 py-2.5 text-[13.5px] text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        {q && (
          <button
            onClick={() => setQ('')}
            aria-label="Limpiar búsqueda"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Índice: solo cuando hay de dónde escoger */}
      {!q && secciones.length > 3 && (
        <nav aria-label="Índice del manual" className="flex flex-wrap gap-1.5">
          {secciones.map((s) => (
            <a
              key={s.id}
              href={`#ayuda-${s.id}`}
              className="text-[12px] px-2.5 py-1 rounded-full border border-outline-variant/70 text-on-surface-variant hover:text-on-surface hover:border-outline-variant transition-colors"
            >
              {s.titulo}
            </a>
          ))}
        </nav>
      )}

      {secciones.length === 0 && (
        <p className="text-[13px] text-on-surface-variant py-8 text-center">
          Nada con esa palabra. Prueba con otra, o borra la búsqueda para ver el manual completo.
        </p>
      )}

      <div className="space-y-4">
        {secciones.map((s, i) => (
          <article
            key={s.id}
            id={`ayuda-${s.id}`}
            className="bg-surface-container-lowest border border-outline-variant/70 rounded-2xl p-5 scroll-mt-24"
          >
            <div className="flex items-baseline gap-3">
              <span
                className="font-display text-[13px] font-semibold text-on-surface-variant/60 tnum flex-shrink-0"
                aria-hidden="true"
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold text-on-surface">{s.titulo}</h2>
                {s.resumen && (
                  <p className="text-[13.5px] text-on-surface-variant mt-1 leading-relaxed">{s.resumen}</p>
                )}
              </div>
            </div>

            {s.puntos?.length > 0 && (
              <dl className="mt-4 space-y-2.5 pl-0 sm:pl-9">
                {s.puntos.map(([que, explica]) => (
                  <div key={que} className="text-[13.5px] leading-relaxed">
                    <dt className="inline font-semibold text-on-surface">{que}</dt>
                    <dd className="inline text-on-surface-variant"> — {explica}</dd>
                  </div>
                ))}
              </dl>
            )}

            {s.pasos?.length > 0 && (
              <ol className="mt-4 space-y-2 pl-0 sm:pl-9 list-none">
                {s.pasos.map((paso, k) => (
                  <li key={paso} className="flex gap-2.5 text-[13.5px] leading-relaxed text-on-surface">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center mt-0.5 tnum">
                      {k + 1}
                    </span>
                    <span>{paso}</span>
                  </li>
                ))}
              </ol>
            )}

            {s.ojo && (
              <p className="mt-4 sm:ml-9 flex items-start gap-2.5 text-[12.5px] leading-relaxed text-[#a85b32] bg-[#f6e7db]/70 border border-warning/30 rounded-xl px-3.5 py-3">
                <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span><strong className="font-semibold">Ojo con esto — </strong>{s.ojo}</span>
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
