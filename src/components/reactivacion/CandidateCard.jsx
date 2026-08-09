import { AlertTriangle, Check, MessageCircle, Phone, ShieldAlert } from 'lucide-react';
import { formatCOP, formatShortDate } from '../../utils/format';
import { messageFor, whatsappLink, SEGMENTS } from '../../hooks/useReactivation';
import PaymentLinkButton from '../PaymentLinkButton';
import { cn } from '../../lib/utils';

const TONE_RING = { danger: '#c25b46', amber: '#cc8a46', pine: '#0c4a3e', info: '#3e6b8e' };
const TONE_CHIP = {
  danger: 'bg-[#f6ddd3] text-[#a03a22]',
  amber: 'bg-[#f6e7db] text-[#a85b32]',
  pine: 'bg-primary/10 text-primary',
  info: 'bg-[#e0e9f1] text-[#3a5a78]',
};

/**
 * PriorityDial — la prioridad como arco, no como número suelto.
 * Da jerarquía visual instantánea al recorrer la lista con el pulgar.
 */
function PriorityDial({ score, tone }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  const color = TONE_RING[tone] || TONE_RING.pine;
  return (
    <div className="relative w-11 h-11 flex-shrink-0">
      <svg viewBox="0 0 40 40" className="w-11 h-11 -rotate-90" aria-hidden="true">
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--color-surface-container-high)" strokeWidth="3.5" />
        <circle
          cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (score / 100) * c}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[12px] font-bold tnum text-on-surface">
        {score}
      </span>
    </div>
  );
}

/**
 * CandidateCard — una fila del radar.
 * Todo lo que hace falta para decidir y actuar sin abrir nada más: prioridad,
 * motivo, valor recuperable, alerta médica si la hay, y las tres acciones.
 */
export default function CandidateCard({ candidate, clinicName, onTouch, compact = false }) {
  const seg = SEGMENTS[candidate.segment];
  const msg = messageFor(candidate, clinicName);
  const wa = whatsappLink(candidate.phone, msg);
  const touched = candidate.lastTouchDays != null;

  return (
    <article
      className={cn(
        'group relative bg-surface-container-lowest border border-outline-variant rounded-2xl transition-colors',
        'hover:border-outline/70 hover:bg-surface-container-low/40',
        compact ? 'p-3.5' : 'p-4',
        touched && 'opacity-70',
      )}
    >
      <div className="flex items-start gap-3">
        <PriorityDial score={candidate.score} tone={seg?.tone} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-on-surface truncate">{candidate.name}</h4>
              <p className="text-[11.5px] text-on-surface-variant mt-0.5 line-clamp-2">{candidate.reason}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-display text-base font-semibold text-on-surface tnum leading-none">
                {formatCOP(candidate.value)}
              </p>
              <p className="text-[10px] text-on-surface-variant mt-1">recuperable</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', TONE_CHIP[seg?.tone] || TONE_CHIP.pine)}>
              {seg?.short}
            </span>
            {candidate.balance > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f6ddd3] text-[#a03a22] tnum">
                Debe {formatCOP(candidate.balance)}
              </span>
            )}
            {candidate.city && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">
                {candidate.city}
              </span>
            )}
            {candidate.lastVisit && (
              <span className="text-[10px] text-on-surface-variant/80">
                Últ. {formatShortDate(candidate.lastVisit)}
              </span>
            )}
          </div>

          {candidate.medicalAlerts && (
            <p className="mt-2.5 flex items-start gap-1.5 text-[11px] text-[#a03a22] bg-[#f6ddd3]/60 rounded-lg px-2.5 py-1.5">
              <ShieldAlert size={13} className="flex-shrink-0 mt-px" />
              <span className="line-clamp-2">{candidate.medicalAlerts}</span>
            </p>
          )}

          {candidate.needsReview && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-on-surface-variant">
              <AlertTriangle size={12} className="text-warning" />
              Dato importado sin verificar — confirma el teléfono antes de escribir.
            </p>
          )}

          {/* Acciones */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onTouch(candidate.id, 'whatsapp')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#e0efe8] text-[#1f6b52] hover:bg-[#d2e7dd] transition-colors"
              >
                <MessageCircle size={13} /> WhatsApp
              </a>
            ) : candidate.email ? (
              <a
                href={`mailto:${candidate.email}?subject=${encodeURIComponent('Tu tratamiento en ' + clinicName)}&body=${encodeURIComponent(msg)}`}
                onClick={() => onTouch(candidate.id, 'email')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#e0e9f1] text-[#3a5a78] hover:bg-[#d2e0ec] transition-colors"
              >
                <MessageCircle size={13} /> Email
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface-variant">
                <Phone size={13} /> Sin contacto
              </span>
            )}

            {candidate.balance > 0 && (
              <PaymentLinkButton
                amount={candidate.balance}
                description={`Saldo pendiente — ${candidate.name}`}
                patientId={candidate.id}
                customerName={candidate.name}
                customerPhone={candidate.phone}
                customerEmail={candidate.email}
                label="Cobrar"
                className="!px-3 !py-1.5 !text-xs !font-semibold !rounded-lg"
              />
            )}

            <button
              onClick={() => onTouch(candidate.id, 'llamada')}
              className={cn(
                'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ml-auto',
                touched
                  ? 'bg-primary/10 text-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-high',
              )}
              title={touched ? `Contactado hace ${candidate.lastTouchDays} día(s)` : 'Marcar como contactado'}
            >
              <Check size={13} />
              {touched ? `Hace ${candidate.lastTouchDays}d` : 'Contactado'}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
