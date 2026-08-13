import { useState } from 'react';
import { Check, MapPin, MoreHorizontal, Stethoscope, X } from 'lucide-react';
import { appointmentTypes, formatCOP } from '../../utils/format';
import PaymentLinkButton from '../PaymentLinkButton';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import { cn } from '../../lib/utils';

const typeLabel = (type) => appointmentTypes.find((at) => at.value === type)?.label || type || 'Cita';
// Las citas viejas guardan el lugar como clave ('garces_navas'); las nuevas
// guardan lo que el usuario escribió. Esto pinta bien las dos.
const LUGARES_CONOCIDOS = {
  consultorio: 'Consultorio', soata: 'Soatá', guamal: 'Guamal',
  muzo: 'Muzo', garces_navas: 'Garcés Navas',
};
const locationLabel = (loc) => {
  const v = String(loc || '').trim();
  if (!v) return 'Sin lugar';
  return LUGARES_CONOCIDOS[v.toLowerCase()] || v;
};

const ACTION_STYLES = {
  confirm: 'bg-[#e0efe8] text-[#1f6b52] hover:bg-[#d2e7dd]',
  complete: 'bg-[#e0e9f1] text-[#3a5a78] hover:bg-[#d2e0ec]',
  cancel: 'bg-[#f6ddd3] text-[#a03a22] hover:bg-[#f0cfc1]',
  soap: 'bg-primary/10 text-primary hover:bg-primary/15',
};

/**
 * AppointmentRow — una cita en la agenda.
 *
 * POR QUÉ TIENE DOS FORMAS
 * Cinco acciones (confirmar, completar, cancelar, cobrar, SOAP) no caben en
 * 360px: antes se envolvían en tres filas y empujaban la lista. Desde `xl` van
 * en línea; por debajo, un botón "⋯" abre una hoja con las mismas acciones a
 * tamaño de dedo.
 */
export default function AppointmentRow({ appointment: apt, patient, onUpdate, onOpenSoap, showDate }) {
  const [sheet, setSheet] = useState(false);
  const cancelled = apt.status === 'cancelada';

  const actions = [
    apt.status === 'pendiente' && { id: 'confirm', label: 'Confirmar', icon: Check, style: 'confirm', run: () => onUpdate(apt.id, { status: 'confirmada' }) },
    apt.status === 'confirmada' && { id: 'complete', label: 'Completar', icon: Check, style: 'complete', run: () => onUpdate(apt.id, { status: 'completada' }) },
    !cancelled && apt.status !== 'completada' && { id: 'cancel', label: 'Cancelar', icon: X, style: 'cancel', run: () => onUpdate(apt.id, { status: 'cancelada' }) },
    { id: 'soap', label: 'Nota SOAP', icon: Stethoscope, style: 'soap', run: () => onOpenSoap(apt) },
  ].filter(Boolean);

  const canCharge = !cancelled && (apt.price || 0) > 0;

  return (
    <>
      <div className={cn('flex items-center gap-3', cancelled && 'opacity-55')}>
        <div className="w-[52px] flex-shrink-0">
          <p className="font-display text-[15px] font-semibold text-primary tnum leading-none">{apt.time || '—'}</p>
          {showDate && (
            <p className="text-[9.5px] uppercase tracking-wide text-on-surface-variant mt-1 truncate">
              {apt.date?.slice(5)}
            </p>
          )}
        </div>

        <div className="w-9 h-9 rounded-xl bg-tertiary-container text-on-tertiary-container flex items-center justify-center text-[11px] font-bold flex-shrink-0">
          {(apt.patient_name || 'P').split(' ').map((n) => n[0]).join('').slice(0, 2)}
        </div>

        <div className="min-w-0 flex-1">
          <p className={cn('text-[13.5px] font-semibold text-on-surface truncate', cancelled && 'line-through')}>
            {apt.patient_name}
          </p>
          <p className="text-[11px] text-on-surface-variant flex items-center gap-1.5 truncate capitalize">
            <MapPin size={11} className="flex-shrink-0" /> {locationLabel(apt.location)}
            <span className="text-outline">·</span> {typeLabel(apt.type)}
          </p>
        </div>

        <div className="hidden sm:block text-right flex-shrink-0">
          <p className="font-display text-[13px] font-semibold text-on-surface tnum">{formatCOP(apt.price || 0)}</p>
          <Badge status={apt.status} className="mt-1" />
        </div>

        {/* Acciones en línea desde xl */}
        <div className="hidden xl:flex items-center gap-1.5 flex-shrink-0">
          {actions.map((a) => (
            <button
              key={a.id}
              onClick={a.run}
              className={cn('text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1', ACTION_STYLES[a.style])}
            >
              <a.icon size={12} /> {a.label}
            </button>
          ))}
          {canCharge && (
            <PaymentLinkButton
              amount={apt.price || 0}
              description={`${typeLabel(apt.type)} — ${apt.patient_name}`}
              patientId={apt.patient_id}
              appointmentId={apt.id}
              customerName={apt.patient_name}
              customerPhone={patient?.phone}
              customerEmail={patient?.email}
              label="Cobrar"
              className="!px-2.5 !py-1.5 !text-xs !font-semibold !rounded-lg"
            />
          )}
        </div>

        <button
          onClick={() => setSheet(true)}
          className="xl:hidden p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors flex-shrink-0"
          aria-label={`Acciones para la cita de ${apt.patient_name}`}
        >
          <MoreHorizontal size={18} />
        </button>
      </div>

      <Modal
        open={sheet}
        onClose={() => setSheet(false)}
        title={apt.patient_name}
        subtitle={`${apt.time || 'Sin hora'} · ${typeLabel(apt.type)} · ${formatCOP(apt.price || 0)}`}
        size="sm"
      >
        <div className="space-y-2 pb-2">
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="text-xs text-on-surface-variant">Estado actual</span>
            <Badge status={apt.status} />
          </div>
          {actions.map((a) => (
            <button
              key={a.id}
              onClick={() => { a.run(); setSheet(false); }}
              className={cn('w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold transition-colors', ACTION_STYLES[a.style])}
            >
              <a.icon size={16} /> {a.label}
            </button>
          ))}
          {canCharge && (
            <PaymentLinkButton
              amount={apt.price || 0}
              description={`${typeLabel(apt.type)} — ${apt.patient_name}`}
              patientId={apt.patient_id}
              appointmentId={apt.id}
              customerName={apt.patient_name}
              customerPhone={patient?.phone}
              customerEmail={patient?.email}
              label={`Cobrar ${formatCOP(apt.price || 0)}`}
              className="!w-full !justify-center !px-4 !py-3 !text-sm !font-semibold !rounded-xl"
            />
          )}
        </div>
      </Modal>
    </>
  );
}
