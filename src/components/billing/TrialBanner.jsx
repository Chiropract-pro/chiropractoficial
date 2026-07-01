import { useState } from 'react';
import { AlertTriangle, Clock, X } from 'lucide-react';
import { useSubscription } from '../../hooks/useSubscription';
import { useAuth } from '../../contexts/AuthContext';

const DISMISS_KEY = 'chiropract.trial_banner_dismissed';

/**
 * Banner sticky bajo el header del CRM cuando:
 *   - Trial con <= 5 días restantes
 *   - Suscripción cancelada o expirada
 *   - Pago pendiente
 */
export default function TrialBanner({ onUpgradeClick }) {
  const { subscription } = useSubscription();
  const { membership } = useAuth();
  const [dismissed, setDismissed] = useState(() => {
    const d = sessionStorage.getItem(DISMISS_KEY);
    return d === '1';
  });

  if (!subscription || dismissed) return null;

  const days = Math.floor(subscription.days_remaining || 0);
  const isOwner = membership?.role === 'owner';

  let variant = null;
  let message = null;

  if (subscription.status === 'expired' || (subscription.status === 'cancelled' && days <= 0)) {
    variant = 'error';
    message = 'Tu suscripción venció. Activa un plan para seguir usando el sistema.';
  } else if (subscription.cancel_at_period_end && days <= 7) {
    variant = 'warning';
    message = `Tu suscripción se cancela en ${days} día${days === 1 ? '' : 's'}. Reactívala para continuar.`;
  } else if (subscription.status === 'trial' && days <= 5) {
    variant = days <= 1 ? 'error' : 'warning';
    message = days === 0
      ? 'Hoy termina tu prueba. Activa un plan para no perder acceso.'
      : `Tu prueba termina en ${days} día${days === 1 ? '' : 's'}. Activa un plan para continuar.`;
  } else if (subscription.status === 'past_due') {
    variant = 'error';
    message = 'Tu pago no fue procesado. Por favor, intenta nuevamente.';
  } else if (subscription.status === 'pending_payment') {
    variant = 'info';
    message = 'Pago pendiente — el plan se activa cuando confirmes el pago en Wompi.';
  }

  if (!variant) return null;

  const colors = {
    info: 'bg-blue-500',
    warning: 'bg-amber-500',
    error: 'bg-red-600',
  }[variant];

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, '1');
  };

  const Icon = variant === 'error' ? AlertTriangle : Clock;

  return (
    <div className={`${colors} text-white text-sm font-medium py-2 px-4 flex items-center justify-center gap-3 shadow-md sticky top-0 z-40`}>
      <Icon size={14} className="flex-shrink-0" />
      <span className="flex-1 text-center">{message}</span>
      {isOwner && onUpgradeClick && (
        <button
          onClick={onUpgradeClick}
          className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full font-bold whitespace-nowrap"
        >
          Ver planes
        </button>
      )}
      <button onClick={handleDismiss} className="text-white/70 hover:text-white" title="Ocultar por esta sesión">
        <X size={14} />
      </button>
    </div>
  );
}
