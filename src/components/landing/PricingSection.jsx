import { useState } from 'react';
import { Check, Sparkles, Zap } from 'lucide-react';
import { usePublicPlans } from '../../hooks/useSubscription';

function formatCOP(amount) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(amount);
}

const ICONS = {
  basic: Sparkles,
  pro: Zap,
  enterprise: Check,
};

export default function PricingSection() {
  const { plans, loading } = usePublicPlans();
  const [yearly, setYearly] = useState(false);

  if (loading || plans.length === 0) return null;

  return (
    <section id="pricing" className="py-20 px-6 bg-surface-container-low">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-sm font-bold text-primary uppercase tracking-wider mb-2">Planes</p>
          <h2 className="text-4xl md:text-5xl font-bold text-on-surface tracking-tight">
            Para tu consultorio
          </h2>
          <p className="text-on-surface-variant text-lg mt-3 max-w-2xl mx-auto">
            Empieza con 14 días gratis. Sin tarjeta. Cancela cuando quieras.
          </p>

          {/* Toggle Mensual/Anual */}
          <div className="inline-flex bg-surface-container-lowest border border-outline-variant rounded-full p-1 mt-6">
            <button
              onClick={() => setYearly(false)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                !yearly ? 'clinical-gradient text-on-primary' : 'text-on-surface-variant'
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                yearly ? 'clinical-gradient text-on-primary' : 'text-on-surface-variant'
              }`}
            >
              Anual
              <span className="ml-1.5 text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">-17%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan) => {
            const Icon = ICONS[plan.id] || Sparkles;
            const price = yearly && plan.price_cop_yearly
              ? Math.round(plan.price_cop_yearly / 12)
              : plan.price_cop_monthly;
            const isFeatured = plan.badge === 'MÁS POPULAR';
            const isEnterprise = plan.id === 'enterprise';

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-6 flex flex-col ${
                  isFeatured
                    ? 'bg-surface-container-lowest border-2 border-primary shadow-xl scale-105'
                    : 'bg-surface-container-lowest border border-outline-variant shadow-sm'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-on-primary text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className={`w-11 h-11 rounded-xl ${isFeatured ? 'clinical-gradient text-on-primary' : 'bg-primary/10 text-primary'} flex items-center justify-center mb-3`}>
                  <Icon size={20} />
                </div>

                <h3 className="text-2xl font-bold text-on-surface">{plan.name}</h3>
                {plan.tagline && <p className="text-sm text-on-surface-variant mt-1">{plan.tagline}</p>}

                <div className="mt-5 mb-5">
                  {isEnterprise ? (
                    <>
                      <p className="text-3xl font-bold text-on-surface">A medida</p>
                      <p className="text-xs text-on-surface-variant mt-1">Habla con nosotros</p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-on-surface">${formatCOP(price)}</span>
                        <span className="text-sm text-on-surface-variant">/ mes</span>
                      </div>
                      {yearly && (
                        <p className="text-xs text-emerald-700 mt-1">
                          ${formatCOP(plan.price_cop_yearly || price * 12)} facturado anual
                        </p>
                      )}
                      {!yearly && (
                        <p className="text-xs text-on-surface-variant mt-1">
                          IVA incluido · Pago en pesos
                        </p>
                      )}
                    </>
                  )}
                </div>

                <ul className="space-y-2 flex-1 mb-6">
                  {(plan.features || []).map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-on-surface">
                      <Check size={16} className={`flex-shrink-0 mt-0.5 ${isFeatured ? 'text-primary' : 'text-emerald-600'}`} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {isEnterprise ? (
                  <a
                    href="https://wa.me/573123824844?text=Hola,%20quiero%20info%20del%20plan%20Enterprise%20de%20chiropract.co"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center px-6 py-3 rounded-xl text-sm font-bold border-2 border-primary text-primary hover:bg-primary hover:text-on-primary transition-colors"
                  >
                    Hablar con ventas
                  </a>
                ) : (
                  <a
                    href="#crm"
                    className={`block text-center px-6 py-3 rounded-xl text-sm font-bold transition-all ${
                      isFeatured
                        ? 'clinical-gradient text-on-primary hover:opacity-90'
                        : 'bg-surface-container-low text-on-surface hover:bg-surface-container border border-outline-variant'
                    }`}
                  >
                    Empezar prueba gratis
                  </a>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-on-surface-variant mt-8 max-w-xl mx-auto">
          Todos los planes incluyen 14 días de prueba sin cargo.
          Pagos seguros con Wompi · Tu información encriptada · Cumplimiento DIAN.
        </p>
      </div>
    </section>
  );
}
