import { useState } from 'react';
import { Calendar, CheckCircle2, Loader2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { todayStr, addDaysStr, parseDateStr } from '../../utils/dates';
import { getAppointmentTypes, formatCOP } from '../../utils/format';

/**
 * Pedir cita desde la página del médico, sin cuenta y sin WhatsApp.
 *
 * Antes el único botón abría un chat: servía, pero obligaba al paciente a
 * escribir y a esperar respuesta. Quien entra a las once de la noche quiere
 * dejar su solicitud y acostarse.
 *
 * Lo que se crea es una SOLICITUD, no una cita confirmada: entra como
 * pendiente y el consultorio la aprueba. Toda la validación de verdad —celular
 * colombiano, fechas, topes contra el abuso— vive en la función
 * `public_request_appointment`, no aquí: esto es solo la ventanilla.
 */
export default function AgendarPublico({ slug, doctorName, onClose }) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [listo, setListo] = useState(null);

  // Sin sesión no hay consultorio del que leer tarifas: se usan las de fábrica
  // solo para orientar. El precio real lo confirma el consultorio.
  const tipos = getAppointmentTypes(null);
  const maxFecha = addDaysStr(90, parseDateStr(todayStr()));

  const enviar = async (e) => {
    e.preventDefault();
    const f = e.target;
    setEnviando(true);
    setError(null);

    const { data, error: err } = await supabase.rpc('public_request_appointment', {
      p_slug: slug,
      p_name: f.nombre.value,
      p_phone: f.celular.value,
      p_date: f.fecha.value,
      p_time: f.hora.value,
      p_type: f.tipo.value,
      p_notes: f.motivo.value || null,
    });

    setEnviando(false);
    if (err) { setError('No se pudo enviar la solicitud. Intente de nuevo en un momento.'); return; }
    if (!data?.ok) { setError(data?.error || 'No se pudo enviar la solicitud.'); return; }
    setListo(data);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Pedir cita"
      >
        <div className="flex items-center justify-between p-5 border-b border-outline-variant sticky top-0 bg-surface-container-lowest">
          <h3 className="font-display font-semibold text-on-surface flex items-center gap-2">
            <Calendar size={18} /> Pedir cita
          </h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        {listo ? (
          <div className="p-6 text-center">
            <span className="w-12 h-12 rounded-2xl bg-[#e0efe8] text-[#1f6b52] inline-flex items-center justify-center">
              <CheckCircle2 size={24} />
            </span>
            <h4 className="font-display text-lg font-semibold text-on-surface mt-4">Solicitud enviada</h4>
            <p className="text-[13.5px] text-on-surface-variant mt-2 leading-relaxed">
              Quedó anotada para el <b className="text-on-surface">{listo.fecha}</b> a las{' '}
              <b className="text-on-surface">{listo.hora}</b>. El consultorio la confirma por WhatsApp;
              hasta entonces la hora no está apartada.
            </p>
            <button
              onClick={onClose}
              className="mt-5 px-5 py-2.5 rounded-lg bg-primary text-on-primary text-sm font-semibold"
            >
              Listo
            </button>
          </div>
        ) : (
          <form onSubmit={enviar} className="p-5 space-y-4">
            <p className="text-[13px] text-on-surface-variant leading-relaxed">
              Deje sus datos y {doctorName || 'el consultorio'} le confirma por WhatsApp. No necesita crear
              ninguna cuenta.
            </p>

            <Campo etiqueta="Nombre y apellido" obligatorio>
              <input name="nombre" required autoFocus placeholder="María Fernanda Ríos" className={CONTROL} />
            </Campo>

            <Campo etiqueta="Celular" obligatorio ayuda="A este número le llega la confirmación.">
              <input name="celular" required inputMode="tel" placeholder="310 000 0000" className={CONTROL} />
            </Campo>

            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Día" obligatorio>
                <input name="fecha" type="date" required defaultValue={todayStr()} min={todayStr()} max={maxFecha} className={CONTROL} />
              </Campo>
              <Campo etiqueta="Hora" obligatorio>
                <input name="hora" type="time" required defaultValue="09:00" className={CONTROL} />
              </Campo>
            </div>

            <Campo etiqueta="Tipo de cita">
              <select name="tipo" defaultValue="primera_consulta" className={CONTROL}>
                {tipos.map((t) => (
                  <option key={t.value} value={t.value}>{t.label} — {formatCOP(t.price)}</option>
                ))}
              </select>
            </Campo>

            <Campo etiqueta="¿Qué le pasa?" ayuda="Opcional, pero ayuda a preparar la consulta.">
              <textarea name="motivo" rows={2} placeholder="Dolor lumbar hace tres semanas…" className={`${CONTROL} resize-y`} />
            </Campo>

            {error && (
              <p className="bg-error-container/20 text-error border border-error/20 px-3.5 py-2.5 rounded-lg text-[13px]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="w-full bg-primary hover:bg-primary-light disabled:opacity-50 text-on-primary py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
            >
              {enviando ? <><Loader2 size={18} className="animate-spin" /> Enviando…</> : 'Enviar solicitud'}
            </button>

            <p className="text-[11.5px] text-on-surface-variant text-center leading-snug">
              Es una solicitud: la hora queda apartada cuando el consultorio la confirma.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

const CONTROL = 'w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-[14px] text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary/40';

function Campo({ etiqueta, obligatorio, ayuda, children }) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
        {etiqueta}{obligatorio && <span className="text-danger ml-0.5">*</span>}
      </span>
      <div className="mt-1">{children}</div>
      {ayuda && <span className="block text-[11px] text-on-surface-variant mt-1">{ayuda}</span>}
    </label>
  );
}
