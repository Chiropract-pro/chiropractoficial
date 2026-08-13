import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CornerDownLeft, Search, User } from 'lucide-react';
import { cn } from '../../lib/utils';
import { navParaRol } from './nav';
import { useAuth } from '../../contexts/AuthContext';
import { usePatients } from '../../hooks/useTenantData';

/**
 * CommandPalette — ⌘K / Ctrl+K.
 *
 * Con 1.424 pacientes importados, llegar a uno concreto costaba: entrar a
 * Pacientes, esperar la tabla, escribir en el filtro. Aquí se escribe el
 * nombre desde cualquier pantalla y se abre su ficha. También es el atajo de
 * navegación entre módulos.
 */
export default function CommandPalette({ open, onClose, onNavigate, onOpenPatient }) {
  // El panel solo existe mientras está abierto: su estado (consulta y cursor)
  // nace limpio en cada apertura, sin efectos de reseteo. Sin AnimatePresence:
  // ver la nota en ui/Modal.jsx — retenía el nodo esperando una animación de
  // salida que, con las animaciones pausadas, no terminaba nunca.
  if (!open) return null;

  return createPortal(
    <Palette onClose={onClose} onNavigate={onNavigate} onOpenPatient={onOpenPatient} />,
    document.body,
  );
}

function Palette({ onClose, onNavigate, onOpenPatient }) {
  const { membership } = useAuth();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const { patients } = usePatients();

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    // Escape a nivel de documento: si el foco se movió a un resultado (o lo
    // perdió el input), el manejador del campo ya no lo veía y la paleta se
    // quedaba abierta encima de todo.
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    const navHits = navParaRol(membership?.role)
      .filter((i) => !q || i.label.toLowerCase().includes(q) || i.hint?.toLowerCase().includes(q))
      .map((i) => ({ kind: 'nav', id: i.id, label: i.label, hint: i.hint, icon: i.icon }));

    const patientHits = !q
      ? []
      : patients
        .filter((p) =>
          (p.full_name || '').toLowerCase().includes(q) ||
          (p.phone || '').includes(q) ||
          (p.email || '').toLowerCase().includes(q))
        .slice(0, 8)
        .map((p) => ({
          kind: 'patient',
          id: p.id,
          label: p.full_name,
          hint: [p.phone, p.city].filter(Boolean).join(' · ') || 'Sin contacto',
          patient: p,
          icon: User,
        }));

    return [...patientHits, ...navHits];
  }, [q, patients, membership?.role]);

  // El cursor se acota en render en vez de reiniciarse desde un efecto.
  const active = Math.min(cursor, Math.max(results.length - 1, 0));

  const run = (item) => {
    if (!item) return;
    if (item.kind === 'patient') onOpenPatient?.(item.patient);
    else onNavigate?.(item.id);
    onClose();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(Math.min(active + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(Math.max(active - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(results[active]); }
    else if (e.key === 'Escape') { onClose(); }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center p-4 sm:pt-[12vh]">
      {/* Nace visible: ver la nota en ui/Modal.jsx. */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-[#0b120f]/45 backdrop-blur-[3px]"
      />
      <div
        className="relative w-full max-w-xl bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-clinical-lg overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 border-b border-outline-variant">
          <Search size={17} className="text-on-surface-variant flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
            onKeyDown={onKeyDown}
            placeholder="Buscar paciente o ir a un módulo…"
            className="flex-1 py-3.5 bg-transparent text-[15px] text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none"
          />
          <kbd className="hidden sm:block text-[10px] font-semibold px-1.5 py-0.5 rounded border border-outline-variant text-on-surface-variant/80">
            esc
          </kbd>
        </div>

        <div className="max-h-[min(60vh,26rem)] overflow-y-auto py-2">
          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-on-surface-variant">
              Sin resultados para “{query}”.
            </p>
          ) : (
            results.map((item, i) => {
              const Icon = item.icon;
              const isActive = i === active;
              return (
                <button
                  key={`${item.kind}-${item.id}`}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => run(item)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                    isActive ? 'bg-primary/8' : 'hover:bg-surface-container-low',
                  )}
                >
                  <span
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                      item.kind === 'patient' ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-primary/10 text-primary',
                    )}
                  >
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-on-surface truncate">{item.label}</span>
                    <span className="block text-[11px] text-on-surface-variant truncate">{item.hint}</span>
                  </span>
                  {isActive && <CornerDownLeft size={14} className="text-on-surface-variant flex-shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
