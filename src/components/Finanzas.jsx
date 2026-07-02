import { useState } from 'react';
import { TrendingUp, AlertTriangle, Building2, MapPin, ArrowUpRight, ArrowDownRight, Plus, X, Download } from 'lucide-react';
import { formatCOP } from '../utils/format';
import { useTransactions, useAppointments, usePatients } from '../hooks/useTenantData';
import { useToast } from './Toast';
import { userFriendlyError } from '../lib/logger';
import LoadingState from './LoadingState';
import { downloadCsv } from '../utils/csv';
import Button from './ui/Button';
import { Card, SectionHeader, EmptyState } from './ui/Card';

export default function Finanzas() {
  const { transactions, loading, insertTransaction } = useTransactions();
  const { appointments } = useAppointments();
  const { patients } = usePatients();
  const toast = useToast();
  const [showNewForm, setShowNewForm] = useState(false);

  // Todos los hooks arriba de cualquier return condicional (Rules of Hooks)
  if (loading && transactions.length === 0) return <LoadingState message="Cargando finanzas..." />;

  const incomes = transactions.filter((t) => t.type === 'income');
  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const monthStr = todayStr.substring(0, 7);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStr = lastMonthDate.toISOString().substring(0, 7);

  const todayIncome = incomes.filter((t) => t.date === todayStr).reduce((s, t) => s + t.amount, 0);
  const weekIncome = incomes.filter((t) => t.date >= weekStartStr).reduce((s, t) => s + t.amount, 0);
  const monthIncome = incomes.filter((t) => t.date?.startsWith(monthStr)).reduce((s, t) => s + t.amount, 0);
  const lastMonthIncome = incomes.filter((t) => t.date?.startsWith(lastMonthStr)).reduce((s, t) => s + t.amount, 0);

  const incomeBySource = { consultorio: 0, jornadas: 0 };
  incomes.filter((t) => t.date?.startsWith(monthStr)).forEach((t) => {
    if (t.category === 'jornada') incomeBySource.jornadas += t.amount;
    else incomeBySource.consultorio += t.amount;
  });

  const incomeByCity = {};
  incomes.filter((t) => t.date?.startsWith(monthStr)).forEach((t) => {
    const p = patients.find((pt) => pt.id === t.patient_id);
    const city = p?.city || 'Otro';
    incomeByCity[city] = (incomeByCity[city] || 0) + t.amount;
  });

  const monthlyGoal = 5000000;
  const monthlyProjection = monthIncome;
  const averagePerPatient = patients.length > 0 ? Math.round(monthIncome / patients.length) : 0;
  const debtors = [];

  const goalPercent = Math.round((monthIncome / monthlyGoal) * 100);
  const monthChange = lastMonthIncome > 0 ? ((monthIncome - lastMonthIncome) / lastMonthIncome * 100).toFixed(1) : 0;
  const isUp = monthChange > 0;

  // Build monthly comparison from transactions (last 6 months)
  const monthlyComparison = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().substring(0, 7);
    const label = d.toLocaleDateString('es-CO', { month: 'short' });
    const income = incomes.filter((t) => t.date?.startsWith(key)).reduce((s, t) => s + t.amount, 0);
    monthlyComparison.push({ month: label, income });
  }
  const maxIncome = Math.max(...monthlyComparison.map((m) => m.income), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-tertiary-fixed-dim">Reporte financiero</p>
          <h1 className="font-display text-3xl font-semibold text-on-surface mt-1">Finanzas</h1>
          <p className="text-on-surface-variant text-sm mt-1">Ingresos, fuentes y proyección del mes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm" icon={Download} className="hidden sm:inline-flex"
            onClick={() => downloadCsv(
              `transacciones-${new Date().toISOString().slice(0, 10)}.csv`,
              transactions,
              [
                { key: 'date', label: 'Fecha' }, { key: 'type', label: 'Tipo' }, { key: 'category', label: 'Categoría' },
                { key: 'description', label: 'Descripción' }, { key: 'amount', label: 'Monto', format: (v) => v ?? 0 },
              ],
            )}
          >
            Exportar
          </Button>
          <Button size="sm" icon={Plus} onClick={() => setShowNewForm(true)}>Registrar ingreso</Button>
        </div>
      </div>

      {/* Métricas conectadas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-clinical">
        {[
          { k: 'Ingresos hoy', v: formatCOP(todayIncome) },
          { k: 'Esta semana', v: formatCOP(weekIncome) },
          { k: 'Este mes', v: formatCOP(monthIncome), delta: monthChange },
          { k: 'Promedio/paciente', v: formatCOP(averagePerPatient), accent: true },
        ].map((s, i) => (
          <div key={s.k} className={`p-4 sm:p-5 ${i < 3 ? 'lg:border-r' : ''} ${i % 2 === 0 ? 'border-r' : ''} ${i < 2 ? 'border-b lg:border-b-0' : ''} border-outline-variant`}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-on-surface-variant">{s.k}</p>
              {s.delta !== undefined && (
                <span className={`text-[11px] font-semibold flex items-center gap-0.5 ${isUp ? 'text-success' : 'text-danger'}`}>
                  {isUp ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{Math.abs(s.delta)}%
                </span>
              )}
            </div>
            <p className={`font-display text-2xl sm:text-[26px] font-semibold mt-2 leading-none tnum ${s.accent ? 'text-primary' : 'text-on-surface'}`}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* Meta mensual */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionHeader title="Meta mensual" className="mb-0" />
          <span className="text-sm font-semibold text-on-surface-variant tnum">{goalPercent}%</span>
        </div>
        <div className="w-full bg-surface-container-high rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${goalPercent >= 100 ? 'bg-success' : goalPercent >= 60 ? 'clinical-gradient' : 'amber-gradient'}`}
            style={{ width: `${Math.min(goalPercent, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-on-surface-variant mt-2">
          <span className="tnum">{formatCOP(monthIncome)}</span>
          <span>Meta · <span className="tnum">{formatCOP(monthlyGoal)}</span></span>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ingresos por fuente */}
        <Card>
          <SectionHeader title="Ingresos por fuente" />
          <div className="space-y-4">
            {[
              { icon: Building2, label: 'Consultorio', val: incomeBySource.consultorio, cls: 'bg-primary' },
              { icon: MapPin, label: 'Jornadas', val: incomeBySource.jornadas, cls: 'amber-gradient' },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-4">
                <div className="bg-primary/10 p-3 rounded-xl"><s.icon size={20} className="text-primary" /></div>
                <div className="flex-1">
                  <div className="flex justify-between mb-1.5">
                    <span className="text-sm font-medium text-on-surface">{s.label}</span>
                    <span className="text-sm font-display font-semibold text-on-surface tnum">{formatCOP(s.val)}</span>
                  </div>
                  <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden">
                    <div className={`${s.cls} h-full rounded-full`} style={{ width: `${monthIncome > 0 ? (s.val / monthIncome) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Ingresos por ciudad */}
        <Card>
          <SectionHeader title="Ingresos por ciudad" />
          <div className="space-y-3">
            {Object.entries(incomeByCity).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a).map(([city, income]) => (
              <div key={city} className="flex items-center gap-3">
                <span className="text-sm text-on-surface w-24 truncate">{city}</span>
                <div className="flex-1 bg-surface-container-high rounded-full h-2 overflow-hidden">
                  <div className="clinical-gradient h-full rounded-full" style={{ width: `${maxIncome > 0 ? (income / maxIncome) * 100 : 0}%` }} />
                </div>
                <span className="text-sm font-display font-semibold text-on-surface min-w-[90px] text-right tnum">{formatCOP(income)}</span>
              </div>
            ))}
            {Object.values(incomeByCity).every((v) => !v) && <EmptyState title="Sin ingresos este mes" />}
          </div>
        </Card>
      </div>

      {/* Comparativa mensual */}
      <Card>
        <SectionHeader title="Comparativa · últimos 6 meses" />
        <div className="flex items-end gap-3 sm:gap-4 h-52 pt-6">
          {monthlyComparison.map((m, i) => {
            const isCurrent = i === monthlyComparison.length - 1;
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center h-full justify-end">
                <span className="text-[10px] sm:text-xs font-display font-semibold text-on-surface mb-1.5 tnum">{formatCOP(m.income)}</span>
                <div
                  className={`w-full rounded-t-lg transition-all ${isCurrent ? 'amber-gradient' : 'clinical-gradient opacity-85 hover:opacity-100'}`}
                  style={{ height: `${Math.max((m.income / maxIncome) * 100, 2)}%` }}
                />
                <span className="text-xs text-on-surface-variant mt-2 capitalize">{m.month}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Pagos pendientes */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-danger" />
          <h3 className="font-display text-lg font-semibold text-on-surface">Pagos pendientes</h3>
        </div>
        {debtors.length === 0 ? (
          <EmptyState title="Sin pagos pendientes" hint="Todo al día." />
        ) : (
          <div className="space-y-2">
            {debtors.map((d) => (
              <div key={d.patient_id || d.patientId} className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl">
                <div>
                  <p className="text-sm font-medium text-on-surface">{d.patient_name || d.patientName}</p>
                  <p className="text-xs text-on-surface-variant">Vencimiento: {d.due_date || d.dueDate}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-display font-semibold text-danger tnum">{formatCOP(d.amount)}</p>
                  <button className="text-xs text-primary hover:underline font-medium">Recordar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Proyección */}
      <div className="clinical-gradient rounded-2xl p-6 text-on-primary relative overflow-hidden shadow-pine">
        <TrendingUp size={90} className="absolute -right-4 -bottom-4 opacity-10" />
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={18} />
          <h3 className="font-semibold text-[10px] uppercase tracking-[0.2em] text-tertiary-fixed">Proyección del mes</h3>
        </div>
        <p className="font-display text-4xl font-semibold tnum">{formatCOP(monthlyProjection)}</p>
        <p className="text-sm text-on-primary/75 mt-1">Basado en la tendencia actual de ingresos</p>
      </div>

      {/* New Transaction Form */}
      {showNewForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNewForm(false)}>
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-on-surface">Registrar Ingreso</h3>
              <button onClick={() => setShowNewForm(false)} className="text-on-surface-variant/50 hover:text-on-surface-variant"><X size={20} /></button>
            </div>
            <form className="space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target;
              const r = await insertTransaction({
                type: 'income',
                amount: parseInt(form.amount.value, 10),
                category: form.category.value,
                description: form.description.value || null,
                patient_id: form.patient_id.value || null,
                date: form.date.value,
              });
              if (r.error) { toast.error(userFriendlyError(r.error)); return; }
              toast.success('Transacción registrada');
              setShowNewForm(false);
            }}>
              <div>
                <label className="text-xs text-on-surface-variant block mb-1">Monto (COP)</label>
                <input name="amount" type="number" required min="0" step="1000" className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="150000" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Categoría</label>
                  <select name="category" className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="consulta">Consulta</option>
                    <option value="seguimiento">Seguimiento</option>
                    <option value="jornada">Jornada</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Fecha</label>
                  <input name="date" type="date" required defaultValue={todayStr} className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div>
                <label className="text-xs text-on-surface-variant block mb-1">Paciente (opcional)</label>
                <select name="patient_id" className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">Sin paciente asociado</option>
                  {patients.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-on-surface-variant block mb-1">Descripción</label>
                <input name="description" className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Descripción del ingreso..." />
              </div>
              <button type="submit" className="w-full bg-primary hover:bg-primary-dark text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
                Registrar Ingreso
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
