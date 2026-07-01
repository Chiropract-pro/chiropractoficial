import { useState } from 'react';
import {
  AlertTriangle, Check, Clock, CreditCard, ExternalLink, Loader2,
  Sparkles, Users, Zap,
} from 'lucide-react';
import { useSubscription } from '../../hooks/useSubscription';
import { useToast } from '../Toast';
import { useAuth } from '../../contexts/AuthContext';

function formatCOP(amount) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(amount);
}

const PLAN_ICONS = { trial: Clock, basic: Sparkles, pro: Zap };

const STATUS_LABEL = {
  trial: 'Prueba gratuita',
  pending_payment: 'Pago pendiente',
  active: 'Activo',
  past_due: 'Pago vencido',
  cancelled: 'Cancelado',
  expired: 'Expirado',
};

const STATUS_COLOR = {
  trial: 'bg-amber-100 text-amber-900',
  pending_payment: 'bg-blue-100 text-blue-900',
  active: 'bg-emerald-100 text-emerald-900',
  past_due: 'bg-red-100 text-red-900',
  cancelled: 'bg-slate-100 text-slate-700',
  expired: 'bg-red-100 text-red-900',
};

export default function PlanTab() {
  const { membership } = useAuth();
  const { subscription, plans, loading, createUpgradeLink, cancelSubscription, reload } = useSubscription();
  const toast = useToast();
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [upgrading, setUpgrading] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const isOwner = membership?.role === 'owner';

  if (loading) {
    return (
      <div className="bg-surface-container-lowest rounded-xl p-8 flex justify-center">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="bg-surface-container-lowest rounded-xl p-6 text-center">
        <p className="text-on-surface-variant">Cargando información de plan...</p>
      </div>
    );
  }

  const handleUpgrade = async (planId) => {
    if (!isOwner) {
      toast.error('Solo el owner puede cambiar el plan');
      return;
    }
    setUpgrading(planId);
    try {
      const result = await createUpgradeLink(planId, billingCycle);
      // Abrir Wompi en nueva pestaña — el webhook se encargará del resto al pagar
      window.open(result.checkout_url, '_blank', 'noopener,noreferrer');
      toast.info('Te abrimos Wompi en otra pestaña. Cuando pagues, el plan se activa solo.');
      await reload();
    } catch (e) {
      toast.error(e.message || 'No se pudo crear el link de pago');
    } finally {
      setUpgrading(null);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const r = await cancelSubscription();
      toast.success(`Suscripción cancelada. Sigues activo hasta ${new Date(r.period_end).toLocaleDateString('es-CO')}.`);
      setConfirmCancel(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCancelling(false);
    }
  };

  const Icon = PLAN_ICONS[subscription.plan_id] || Sparkles;
  const days = Math.floor(subscription.days_remaining || 0);

  return (
    <div className="space-y-6">
      {/* Plan actual */}
      <div className="bg-surface-container-lowest rounded-xl shadow-clinical border border-outline-variant p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl clinical-gradient text-on-primary flex items-center justify-center">
              <Icon size={22} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-on-surface">Plan {subscription.plan_name}</h3>
              <p className="text-sm text-on-surface-variant">{subscription.plan_tagline}</p>
            </div>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-semibold ${STATUS_COLOR[subscription.status] || 'bg-slate-100 text-slate-700'}`}>
            {STATUS_LABEL[subscription.status] || subscription.status}
          </span>
        </div>

        {/* Estado del período */}
        <div className="bg-surface-container-low rounded-lg p-3 text-sm mb-4">
          {subscription.status === 'trial' && (
            <p>
              Tu prueba <b>termina en {days} día{days === 1 ? '' : 's'}</b> ({new Date(subscription.current_period_end).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}).
              {days <= 5 && <span className="text-amber-700 font-semibold"> Activa un plan para no perder acceso.</span>}
            </p>
          )}
          {subscription.status === 'active' && !subscription.cancel_at_period_end && (
            <p>
              Próxima renovación: <b>{new Date(subscription.current_period_end).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</b>
              {' '}({days} días restantes)
            </p>
          )}
          {subscription.cancel_at_period_end && (
            <p className="text-amber-900">
              ⚠ Tu suscripción está programada para cancelarse el{' '}
              <b>{new Date(subscription.current_period_end).toLocaleDateString('es-CO')}</b>.
            </p>
          )}
          {subscription.status === 'pending_payment' && (
            <p className="text-blue-900">
              Tienes un pago pendiente para activar el plan. Si pagaste hace poco, espera unos minutos a la confirmación.
            </p>
          )}
        </div>

        {/* Limits */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <LimitCard
            icon={Users}
            label="Pacientes"
            max={subscription.max_patients}
          />
          <LimitCard
            icon={Users}
            label="Usuarios"
            max={subscription.max_users}
          />
          <LimitCard
            icon={CreditCard}
            label={billingCycle === 'yearly' ? 'Anual' : 'Mensual'}
            value={subscription.plan_id === 'trial' ? 'Gratis' : `$${formatCOP(subscription.price_cop_monthly)}`}
          />
        </div>

        {/* Cancel option */}
        {subscription.status === 'active' && !subscription.cancel_at_period_end && isOwner && (
          <div className="mt-4 text-right">
            {!confirmCancel ? (
              <button
                onClick={() => setConfirmCancel(true)}
                className="text-xs text-on-surface-variant hover:text-error"
              >
                Cancelar suscripción
              </button>
            ) : (
              <div className="flex items-center justify-end gap-2 text-xs">
                <span className="text-on-surface-variant">¿Seguro?</span>
                <button onClick={handleCancel} disabled={cancelling} className="bg-error text-on-error px-3 py-1 rounded font-bold">
                  {cancelling ? '...' : 'Sí, cancelar'}
                </button>
                <button onClick={() => setConfirmCancel(false)} className="text-on-surface-variant px-2">No</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upgrade options */}
      {isOwner && (subscription.plan_id === 'trial' || subscription.plan_id === 'basic' || subscription.cancel_at_period_end) && (
        <div className="bg-surface-container-lowest rounded-xl shadow-clinical border border-outline-variant p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-on-surface">
              {subscription.plan_id === 'trial' ? 'Activa tu plan' : 'Cambiar plan'}
            </h3>
            <div className="inline-flex bg-surface-container-low rounded-full p-1 text-xs">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-3 py-1 rounded-full font-semibold ${billingCycle === 'monthly' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}
              >
                Mensual
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-3 py-1 rounded-full font-semibold ${billingCycle === 'yearly' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}
              >
                Anual <span className="text-[9px] opacity-80">-17%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {plans.filter((p) => p.id !== 'trial' && p.id !== 'enterprise').map((p) => {
              const PIcon = PLAN_ICONS[p.id] || Sparkles;
              const price = billingCycle === 'yearly' && p.price_cop_yearly
                ? Math.round(p.price_cop_yearly / 12)
                : p.price_cop_monthly;
              const isCurrent = subscription.plan_id === p.id && !subscription.cancel_at_period_end;
              const isFeatured = p.badge === 'MÁS POPULAR';

              return (
                <div key={p.id} className={`rounded-xl p-4 border ${isFeatured ? 'border-primary bg-primary/5' : 'border-outline-variant'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <PIcon size={16} className="text-primary" />
                      <h4 className="font-bold text-on-surface">{p.name}</h4>
                    </div>
                    {p.badge && (
                      <span className="text-[10px] bg-primary text-on-primary px-2 py-0.5 rounded-full font-bold">
                        {p.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant mb-3">{p.tagline}</p>
                  <p className="text-2xl font-bold text-on-surface">
                    ${formatCOP(price)}
                    <span className="text-xs text-on-surface-variant font-normal">/mes</span>
                  </p>
                  {billingCycle === 'yearly' && (
                    <p className="text-[11px] text-emerald-700 mb-3">${formatCOP(p.price_cop_yearly)} facturado anual</p>
                  )}
                  <ul className="text-xs space-y-0.5 mb-4 mt-3">
                    {(p.features || []).slice(0, 4).map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <Check size={11} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                        <span className="text-on-surface-variant">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleUpgrade(p.id)}
                    disabled={!!upgrading || isCurrent}
                    className={`w-full px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 ${
                      isCurrent
                        ? 'bg-emerald-100 text-emerald-700 cursor-not-allowed'
                        : isFeatured
                        ? 'clinical-gradient text-on-primary hover:opacity-90'
                        : 'bg-primary/10 text-primary hover:bg-primary/20'
                    }`}
                  >
                    {upgrading === p.id ? <Loader2 size={14} className="animate-spin" />
                      : isCurrent ? <><Check size={14} /> Plan actual</>
                      : <>Activar <ExternalLink size={12} /></>}
                  </button>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-on-surface-variant mt-4 text-center">
            Pagos seguros con Wompi. El plan se activa automáticamente al confirmar el pago.
          </p>
        </div>
      )}

      {!isOwner && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 flex items-start gap-2">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>Solo el owner del consultorio puede cambiar el plan o ver detalles de facturación.</span>
        </div>
      )}
    </div>
  );
}

function LimitCard({ icon: Icon, label, max, value }) {
  return (
    <div className="bg-surface-container-low rounded-lg p-3">
      <Icon size={14} className="mx-auto text-primary mb-1" />
      <p className="text-[10px] uppercase tracking-wide text-on-surface-variant font-semibold">{label}</p>
      <p className="text-base font-bold text-on-surface">
        {value !== undefined ? value : (max === null || max === undefined ? '∞' : max)}
      </p>
    </div>
  );
}
