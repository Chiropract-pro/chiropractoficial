import { Users, Calendar, DollarSign, TrendingUp, AlertTriangle, CheckCircle, Info, XCircle, Car } from 'lucide-react';
import { formatCOP, formatDate } from '../utils/format';
import { usePatients, useAppointments, useJornadas, useLeads, useTransactions, useAlerts } from '../hooks/useTenantData';
import LoadingState from './LoadingState';

export default function Dashboard({ onNavigate }) {
  const { patients, loading: lP } = usePatients();
  const { appointments, loading: lA } = useAppointments();
  const { jornadas, loading: lJ } = useJornadas();
  const { leads } = useLeads();
  const { transactions, loading: lT } = useTransactions();
  const { alerts } = useAlerts();

  const isLoading = lP && lA && lJ && lT && patients.length === 0 && appointments.length === 0;
  if (isLoading) return <LoadingState message="Cargando tu dashboard..." size="lg" />;

  const todayStr = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];
  const monthStr = todayStr.substring(0, 7);

  const todayAppointments = appointments.filter((a) => a.date === todayStr && a.status !== 'cancelada');
  const pendingToday = appointments.filter((a) => a.date === todayStr && a.status === 'pendiente');
  const activePatients = patients.filter((p) => p.status === 'activo' || p.status === 'en_tratamiento');
  const nextJornada = jornadas.find((j) => j.status === 'programada');
  const leadsThisWeek = leads.filter((l) => l.date >= weekAgoStr).length;
  const monthIncome = transactions.filter((t) => t.type === 'income' && t.date?.startsWith(monthStr)).reduce((s, t) => s + t.amount, 0);
  const todayIncome = transactions.filter((t) => t.type === 'income' && t.date === todayStr).reduce((s, t) => s + t.amount, 0);
  const totalLeads = leads.length;
  const convertedLeads = leads.filter((l) => l.status === 'convertido').length;
  const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0;
  const monthlyGoal = 5000000;
  const goalPercent = Math.round((monthIncome / monthlyGoal) * 100);

  const alertIcon = (type) => {
    switch (type) {
      case 'danger': return <XCircle size={16} className="text-danger" />;
      case 'warning': return <AlertTriangle size={16} className="text-accent" />;
      case 'info': return <Info size={16} className="text-blue-500" />;
      case 'success': return <CheckCircle size={16} className="text-success" />;
      default: return <Info size={16} className="text-blue-500" />;
    }
  };

  const statCards = [
    { label: 'Pacientes hoy', value: todayAppointments.length, icon: Users, color: 'bg-blue-500', sub: `${pendingToday.length} pendientes` },
    { label: 'Ingresos del día', value: formatCOP(todayIncome), icon: DollarSign, color: 'bg-success', sub: `Meta: ${goalPercent}%` },
    { label: 'Leads esta semana', value: leadsThisWeek, icon: TrendingUp, color: 'bg-purple-500', sub: `Conversión: ${conversionRate}%` },
    { label: 'Pacientes activos', value: activePatients.length, icon: Users, color: 'bg-primary', sub: `de ${patients.length} total` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-on-surface">Dashboard</h2>
        <p className="text-on-surface-variant text-sm mt-1">Vista general — {formatDate(todayStr)}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-surface-container-lowest rounded-xl p-5 shadow-clinical border border-outline-variant hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-on-surface-variant">{card.label}</p>
                  <p className="text-2xl font-bold text-on-surface mt-1">{card.value}</p>
                  <p className="text-xs text-on-surface-variant/70 mt-1">{card.sub}</p>
                </div>
                <div className={`${card.color} p-2.5 rounded-lg`}>
                  <Icon size={20} className="text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Income Goal Progress */}
      <div className="bg-surface-container-lowest rounded-xl p-5 shadow-clinical border border-outline-variant">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-on-surface">Meta mensual de ingresos</h3>
          <span className="text-sm text-on-surface-variant">{formatCOP(monthIncome)} / {formatCOP(monthlyGoal)}</span>
        </div>
        <div className="w-full bg-surface-container rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${goalPercent >= 100 ? 'bg-success' : goalPercent >= 75 ? 'bg-primary' : goalPercent >= 50 ? 'bg-accent' : 'bg-orange-400'}`}
            style={{ width: `${Math.min(goalPercent, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-on-surface-variant/70">
          <span>50%</span><span>75%</span><span>100%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Appointments */}
        <div className="bg-surface-container-lowest rounded-xl p-5 shadow-clinical border border-outline-variant">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-on-surface">Citas de hoy</h3>
            <button onClick={() => onNavigate('citas')} className="text-primary text-sm hover:underline">Ver todas</button>
          </div>
          {todayAppointments.length === 0 ? (
            <p className="text-on-surface-variant/70 text-sm">No hay citas programadas</p>
          ) : (
            <div className="space-y-3">
              {todayAppointments.map((apt) => (
                <div key={apt.id} className="flex items-center gap-3 p-3 bg-surface-container-low rounded-lg">
                  <div className="text-center min-w-[60px]">
                    <p className="text-sm font-bold text-primary">{apt.time}</p>
                    <p className="text-[10px] text-on-surface-variant/70 uppercase">
                      {apt.type === 'primera_consulta' ? '1ra' : apt.type === 'seguimiento' ? 'Seg' : apt.type}
                    </p>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-on-surface">{apt.patient_name}</p>
                    <p className="text-xs text-on-surface-variant/70 capitalize">{apt.location === 'consultorio' ? 'Consultorio' : apt.location}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    apt.status === 'confirmada' ? 'bg-green-100 text-green-700' :
                    apt.status === 'pendiente' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {apt.status}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 pt-3 border-t border-outline-variant flex justify-between text-sm">
            <span className="text-on-surface-variant">Total: {todayAppointments.length} citas</span>
            <span className="font-semibold text-primary">{formatCOP(todayAppointments.reduce((s, a) => s + (a.price || 0), 0))}</span>
          </div>
        </div>

        {/* Next Jornada */}
        <div className="bg-surface-container-lowest rounded-xl p-5 shadow-clinical border border-outline-variant">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-on-surface">Próxima jornada</h3>
            <button onClick={() => onNavigate('jornadas')} className="text-primary text-sm hover:underline">Ver todas</button>
          </div>
          {nextJornada ? (
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-primary p-2 rounded-lg">
                  <Car size={20} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-on-surface">{nextJornada.city}</p>
                  <p className="text-sm text-on-surface-variant">{formatDate(nextJornada.date)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-on-surface-variant/70">Agendados</p>
                  <p className="font-semibold text-on-surface">{nextJornada.booked_count ?? 0}/{nextJornada.capacity}</p>
                </div>
                <div>
                  <p className="text-on-surface-variant/70">Ingreso proyectado</p>
                  <p className="font-semibold text-primary">{formatCOP((nextJornada.booked_count ?? 0) * nextJornada.price_per_patient)}</p>
                </div>
              </div>
              <div className="mt-3 w-full bg-surface-container rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: `${((nextJornada.booked_count ?? 0) / nextJornada.capacity) * 100}%` }} />
              </div>
            </div>
          ) : (
            <p className="text-on-surface-variant/70 text-sm">No hay jornadas programadas</p>
          )}
        </div>
      </div>

      {/* Alerts */}
      <div className="bg-surface-container-lowest rounded-xl p-5 shadow-clinical border border-outline-variant">
        <h3 className="font-semibold text-on-surface mb-4">Alertas</h3>
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div key={alert.id} className="flex items-center gap-3 p-3 bg-surface-container-low rounded-lg">
              {alertIcon(alert.type)}
              <p className="text-sm text-on-surface flex-1">{alert.message}</p>
              <button
                onClick={() => {
                  if (alert.action === 'ver_finanzas') onNavigate('finanzas');
                  else if (alert.action === 'ver_jornada') onNavigate('jornadas');
                  else onNavigate('pacientes');
                }}
                className="text-xs text-primary hover:underline font-medium"
              >
                Atender
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
