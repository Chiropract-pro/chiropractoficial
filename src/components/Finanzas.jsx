import { useState } from 'react';
import { TrendingUp, AlertTriangle, Building2, MapPin, ArrowUpRight, ArrowDownRight, Plus, X, Download } from 'lucide-react';
import { formatCOP } from '../utils/format';
import { useTransactions, useAppointments, usePatients } from '../hooks/useTenantData';
import { useToast } from './Toast';
import { userFriendlyError } from '../lib/logger';
import LoadingState from './LoadingState';
import { downloadCsv } from '../utils/csv';

export default function Finanzas() {
  const { transactions, loading, insertTransaction } = useTransactions();
  const { appointments } = useAppointments();
  const { patients } = usePatients();
  const toast = useToast();

  if (loading && transactions.length === 0) return <LoadingState message="Cargando finanzas..." />;
  const [showNewForm, setShowNewForm] = useState(false);

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Finanzas</h2>
          <p className="text-on-surface-variant text-sm mt-1">Reporte financiero y proyecciones</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadCsv(
              `transacciones-${new Date().toISOString().slice(0,10)}.csv`,
              transactions,
              [
                { key: 'date', label: 'Fecha' },
                { key: 'type', label: 'Tipo' },
                { key: 'category', label: 'Categoría' },
                { key: 'description', label: 'Descripción' },
                { key: 'amount', label: 'Monto', format: (v) => v ?? 0 },
              ]
            )}
            className="hidden sm:inline-flex items-center gap-2 px-3 py-2 border border-outline-variant text-on-surface-variant hover:bg-surface-container-low rounded-lg text-sm font-medium transition-colors"
          >
            <Download size={16} /> Exportar
          </button>
          <button
            onClick={() => setShowNewForm(true)}
            className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={16} /> Registrar Ingreso
          </button>
        </div>
      </div>

      {/* Income Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest rounded-xl shadow-clinical border border-outline-variant">
          <p className="text-sm text-on-surface-variant">Ingresos hoy</p>
          <p className="text-2xl font-bold text-on-surface mt-1">{formatCOP(todayIncome)}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl shadow-clinical border border-outline-variant">
          <p className="text-sm text-on-surface-variant">Ingresos semana</p>
          <p className="text-2xl font-bold text-on-surface mt-1">{formatCOP(weekIncome)}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl shadow-clinical border border-outline-variant">
          <div className="flex items-center justify-between">
            <p className="text-sm text-on-surface-variant">Ingresos mes</p>
            <span className={`text-xs font-medium flex items-center gap-0.5 ${isUp ? 'text-success' : 'text-danger'}`}>
              {isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(monthChange)}%
            </span>
          </div>
          <p className="text-2xl font-bold text-on-surface mt-1">{formatCOP(monthIncome)}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl shadow-clinical border border-outline-variant">
          <p className="text-sm text-on-surface-variant">Promedio por paciente</p>
          <p className="text-2xl font-bold text-primary mt-1">{formatCOP(averagePerPatient)}</p>
        </div>
      </div>

      {/* Monthly Goal */}
      <div className="bg-surface-container-lowest rounded-xl shadow-clinical border border-outline-variant">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-on-surface">Meta mensual</h3>
          <span className="text-sm text-on-surface-variant">{goalPercent}% alcanzado</span>
        </div>
        <div className="w-full bg-surface-container rounded-full h-4 mb-2">
          <div
            className={`h-4 rounded-full transition-all ${
              goalPercent >= 100 ? 'bg-success' : goalPercent >= 75 ? 'bg-primary' : goalPercent >= 50 ? 'bg-accent' : 'bg-orange-400'
            }`}
            style={{ width: `${Math.min(goalPercent, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-on-surface-variant/70">
          <span>{formatCOP(monthIncome)}</span>
          <span>Meta: {formatCOP(monthlyGoal)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income by Source */}
        <div className="bg-surface-container-lowest rounded-xl shadow-clinical border border-outline-variant">
          <h3 className="font-semibold text-on-surface mb-4">Ingresos por fuente</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-lg">
                <Building2 size={20} className="text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-on-surface">Consultorio</span>
                  <span className="text-sm font-bold text-primary">{formatCOP(incomeBySource.consultorio)}</span>
                </div>
                <div className="w-full bg-surface-container rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: `${monthIncome > 0 ? (incomeBySource.consultorio / monthIncome) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-accent/10 p-3 rounded-lg">
                <MapPin size={20} className="text-accent" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-on-surface">Jornadas</span>
                  <span className="text-sm font-bold text-accent">{formatCOP(incomeBySource.jornadas)}</span>
                </div>
                <div className="w-full bg-surface-container rounded-full h-2">
                  <div className="bg-accent h-2 rounded-full" style={{ width: `${monthIncome > 0 ? (incomeBySource.jornadas / monthIncome) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Income by City */}
        <div className="bg-surface-container-lowest rounded-xl shadow-clinical border border-outline-variant">
          <h3 className="font-semibold text-on-surface mb-4">Ingresos por ciudad</h3>
          <div className="space-y-3">
            {Object.entries(incomeByCity)
              .filter(([, income]) => income > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([city, income]) => (
                <div key={city} className="flex items-center gap-3">
                  <span className="text-sm text-on-surface w-24">{city}</span>
                  <div className="flex-1 bg-surface-container rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: `${maxIncome > 0 ? (income / maxIncome) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm font-medium text-on-surface min-w-[90px] text-right">{formatCOP(income)}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Monthly Comparison Chart */}
      <div className="bg-surface-container-lowest rounded-xl shadow-clinical border border-outline-variant">
        <h3 className="font-semibold text-on-surface mb-4">Comparativa mensual</h3>
        <div className="flex items-end gap-4 h-48">
          {monthlyComparison.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center">
              <span className="text-xs font-bold text-on-surface mb-1">{formatCOP(m.income)}</span>
              <div
                className="w-full bg-primary/80 rounded-t-lg transition-all hover:bg-primary"
                style={{ height: `${(m.income / maxIncome) * 100}%` }}
              />
              <span className="text-xs text-on-surface-variant/70 mt-2">{m.month}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Debtors */}
      <div className="bg-surface-container-lowest rounded-xl shadow-clinical border border-outline-variant">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-danger" />
          <h3 className="font-semibold text-on-surface">Pagos pendientes</h3>
        </div>
        {debtors.length === 0 ? (
          <p className="text-on-surface-variant/50 text-sm">No hay pagos pendientes</p>
        ) : (
          <div className="space-y-2">
            {debtors.map((d) => (
              <div key={d.patient_id || d.patientId} className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg">
                <div>
                  <p className="text-sm font-medium text-on-surface">{d.patient_name || d.patientName}</p>
                  <p className="text-xs text-on-surface-variant/70">Vencimiento: {d.due_date || d.dueDate}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-danger">{formatCOP(d.amount)}</p>
                  <button className="text-xs text-primary hover:underline font-medium">Recordar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Projection */}
      <div className="bg-gradient-to-r from-primary to-primary-dark rounded-xl p-5 text-white">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp size={20} />
          <h3 className="font-semibold">Proyección del mes</h3>
        </div>
        <p className="text-3xl font-bold">{formatCOP(monthlyProjection)}</p>
        <p className="text-sm text-white/70 mt-1">Basado en la tendencia actual de ingresos</p>
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
