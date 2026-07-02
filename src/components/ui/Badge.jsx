import { cn } from '../../lib/utils';

const TONES = {
  neutral: 'bg-surface-container-high text-on-surface-variant',
  pine: 'bg-primary/10 text-primary',
  amber: 'bg-tertiary-container text-on-tertiary-container',
  success: 'bg-[#e0efe8] text-[#1f6b52]',
  warning: 'bg-[#f6e7db] text-[#a85b32]',
  danger: 'bg-[#f6ddd3] text-[#a03a22]',
  info: 'bg-[#e0e9f1] text-[#3a5a78]',
};

// Mapea estados comunes del dominio a un tono.
const STATUS_TONE = {
  confirmada: 'success', activo: 'success', en_tratamiento: 'success', pagada: 'success',
  completada: 'info', completado: 'info',
  pendiente: 'warning', programada: 'warning', por_pagar: 'warning',
  cancelada: 'danger', vencida: 'danger', inactivo: 'neutral',
  nuevo: 'amber', convertido: 'pine',
};

export default function Badge({ tone, status, className, children }) {
  const resolved = tone || (status && STATUS_TONE[status]) || 'neutral';
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full capitalize',
      TONES[resolved] || TONES.neutral,
      className,
    )}>
      {children || status}
    </span>
  );
}
