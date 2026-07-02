import { motion } from 'framer-motion';
import {
  Users, DollarSign, Activity, MapPin, TrendingUp, AlertTriangle,
  CheckCircle, Info, XCircle, ArrowUpRight, ChevronRight,
} from 'lucide-react';
import { formatCOP, formatDate } from '../utils/format';
import { usePatients, useAppointments, useJornadas, useLeads, useTransactions, useAlerts } from '../hooks/useTenantData';
import { useAuth } from '../contexts/AuthContext';
import { Card, SectionHeader, EmptyState } from './ui/Card';
import Badge from './ui/Badge';
import LoadingState from './LoadingState';

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const rise = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } };

export default function Dashboard({ onNavigate }) {
  const { profile } = useAuth();
  const { patients, loading: lP } = usePatients();
  const { appointments, loading: lA } = useAppointments();
  const { jornadas, loading: lJ } = useJornadas();
  const { leads } = useLeads();
  const { transactions, loading: lT } = useTransactions();
  const { alerts } = useAlerts();

  const isLoading = lP && lA && lJ && lT && patients.length === 0 && appointments.length === 0;
  if (isLoading) return <LoadingState message="Alineando tu panel..." size="lg" />;

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
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
  const monthlyGoal = 5000000;
  const goalPercent = Math.round((monthIncome / monthlyGoal) * 100);
  const jornadaFill = nextJornada ? Math.round(((nextJornada.booked_count ?? 0) / nextJornada.capacity) * 100) : 0;

  const hour = now.getHours();
  const greet = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const firstName = (profile?.full_name || '').replace(/^(dr|dra)\.?\s+/i, '').split(' ')[0] || 'Doctor';

  const stats = [
    { k: 'Pacientes hoy', v: String(todayAppointments.length), icon: Users, sub: `${pendingToday.length} por confirmar` },
    { k: 'Ingresos del día', v: formatCOP(todayIncome), icon: DollarSign, sub: `Meta del mes: ${goalPercent}%` },
    { k: 'Pacientes activos', v: String(activePatients.length), icon: Activity, sub: `de ${patients.length} en total` },
    { k: 'Leads esta semana', v: String(leadsThisWeek), icon: TrendingUp, sub: 'últimos 7 días' },
  ];

  const alertIcon = (type) => {
    const map = { danger: [XCircle, 'text-danger'], warning: [AlertTriangle, 'text-warning'], success: [CheckCircle, 'text-success'], info: [Info, 'text-info'] };
    const [Icon, cls] = map[type] || map.info;
    return <Icon size={16} className={cls} />;
  };

  const apptType = (t) => (t === 'primera_consulta' ? '1ra vez' : t === 'seguimiento' ? 'Seguim.' : t || 'Cita');

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      {/* Encabezado editorial */}
      <motion.header variants={rise} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-tertiary-fixed-dim">
            {formatDate(todayStr)} · Consultorio
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-on-surface mt-1 leading-tight">
            {greet}, <em className="italic text-primary-light">{firstName}</em>
          </h1>
          <p className="text-on-surface-variant text-sm mt-1.5">
            {todayAppointments.length > 0
              ? `Tienes ${todayAppointments.length} cita${todayAppointments.length !== 1 ? 's' : ''} hoy`
              : 'No tienes citas hoy'}
            {nextJornada ? ` · próxima jornada en ${nextJornada.city}.` : '.'}
          </p>
        </div>
      </motion.header>

      {/* Fila de stats — tarjetas conectadas con hairlines */}
      <motion.div variants={rise} className="grid grid-cols-2 lg:grid-cols-4 bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-clinical">
        {stats.map((s, i) => (
          <div key={s.k} className={`p-4 sm:p-5 ${i < 3 ? 'lg:border-r' : ''} ${i % 2 === 0 ? 'border-r' : ''} ${i < 2 ? 'border-b lg:border-b-0' : ''} border-outline-variant`}>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-on-surface-variant">
              <s.icon size={13} className="text-primary-light" /> {s.k}
            </div>
            <p className="font-display text-3xl font-semibold text-on-surface mt-2 leading-none tnum">{s.v}</p>
            <p className="text-[11px] text-on-surface-variant/80 mt-1.5">{s.sub}</p>
          </div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
        {/* Agenda de hoy — riel vertebral */}
        <motion.div variants={rise}>
          <Card className="h-full">
            <SectionHeader title="Agenda de hoy" action="Ver calendario →" onAction={() => onNavigate('citas')} />
            {todayAppointments.length === 0 ? (
              <EmptyState icon={CheckCircle} title="Sin citas hoy" hint="Disfruta el día libre o agenda una nueva." />
            ) : (
              <div className="relative pl-6">
                <div className="absolute left-[7px] top-1 bottom-1 w-0.5 bg-outline-variant" />
                {todayAppointments.map((apt) => (
                  <div key={apt.id} className="relative grid grid-cols-[54px_1fr_auto] gap-3 items-center py-3 border-b border-dashed border-outline-variant last:border-b-0">
                    <span className="absolute -left-[23px] top-4 vertebra-dot" />
                    <div className="text-primary">
                      <p className="text-sm font-bold tnum leading-none">{apt.time}</p>
                      <p className="text-[9.5px] uppercase text-on-surface-variant mt-0.5">{apptType(apt.type)}</p>
                    </div>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-tertiary-container text-primary flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                        {(apt.patient_name || 'P').split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-on-surface truncate">{apt.patient_name}</p>
                        <p className="text-[11px] text-on-surface-variant capitalize truncate">{apt.location === 'consultorio' ? 'Consultorio' : apt.location}</p>
                      </div>
                    </div>
                    <Badge status={apt.status} />
                  </div>
                ))}
                <div className="mt-4 pt-3 hairline flex justify-between text-sm">
                  <span className="text-on-surface-variant">Total · {todayAppointments.length} citas</span>
                  <span className="font-display font-semibold text-primary tnum">{formatCOP(todayAppointments.reduce((s, a) => s + (a.price || 0), 0))}</span>
                </div>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Columna derecha: meta + jornada */}
        <motion.div variants={rise} className="space-y-6">
          <Card>
            <SectionHeader title="Meta del mes" action="Finanzas →" onAction={() => onNavigate('finanzas')} />
            <p className="font-display text-3xl font-semibold text-on-surface tnum leading-none">{formatCOP(monthIncome)}</p>
            <p className="text-xs text-on-surface-variant mt-1">de {formatCOP(monthlyGoal)} · {goalPercent}%</p>
            <div className="mt-4 h-2.5 rounded-full bg-surface-container-high overflow-hidden">
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${Math.min(goalPercent, 100)}%` }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                className={goalPercent >= 100 ? 'h-full bg-success' : goalPercent >= 60 ? 'h-full clinical-gradient' : 'h-full amber-gradient'}
              />
            </div>
          </Card>

          <Card pad={false} className="overflow-hidden">
            <div className="clinical-gradient text-on-primary p-5 relative">
              <MapPin size={80} className="absolute -right-3 -top-3 opacity-10" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-tertiary-fixed">Próxima jornada</p>
              {nextJornada ? (
                <>
                  <p className="font-display text-2xl font-semibold mt-1">{nextJornada.city}</p>
                  <p className="text-sm opacity-85">{formatDate(nextJornada.date)}</p>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] opacity-75">Cupos</p>
                      <p className="font-semibold tnum">{nextJornada.booked_count ?? 0}/{nextJornada.capacity}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] opacity-75">Proyectado</p>
                      <p className="font-semibold tnum">{formatCOP((nextJornada.booked_count ?? 0) * nextJornada.price_per_patient)}</p>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-white/20 overflow-hidden">
                    <div className="h-full bg-tertiary-fixed-dim rounded-full" style={{ width: `${jornadaFill}%` }} />
                  </div>
                </>
              ) : (
                <p className="text-sm opacity-85 mt-2">No hay jornadas programadas.</p>
              )}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Alertas */}
      {alerts.length > 0 && (
        <motion.div variants={rise}>
          <Card>
            <SectionHeader title="Alertas" />
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div key={alert.id} className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl">
                  {alertIcon(alert.type)}
                  <p className="text-sm text-on-surface flex-1">{alert.message}</p>
                  <button
                    onClick={() => {
                      if (alert.action === 'ver_finanzas') onNavigate('finanzas');
                      else if (alert.action === 'ver_jornada') onNavigate('jornadas');
                      else onNavigate('pacientes');
                    }}
                    className="text-xs text-primary hover:underline font-semibold inline-flex items-center gap-0.5"
                  >
                    Atender <ChevronRight size={13} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
