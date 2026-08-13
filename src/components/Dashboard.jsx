import { useMemo } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, CalendarDays, CheckCircle, ChevronRight,
  DollarSign, Info, MapPin, Radar, Target, TrendingUp, Users, XCircle,
} from 'lucide-react';
import { formatCOP, formatDate } from '../utils/format';
import { usePatients, useAppointments, useJornadas, useLeads, useTransactions, useAlerts } from '../hooks/useTenantData';
import { computeCandidates, summarize } from '../hooks/useReactivation';
import { useAuth } from '../contexts/AuthContext';
import { Card, SectionHeader, EmptyState } from './ui/Card';
import { Stat, StatGrid, ProgressRing } from './ui/Stat';
import Badge from './ui/Badge';
import Button from './ui/Button';
import LoadingState from './LoadingState';
import { todayStr as today, addDaysStr, localTimeStr, parseDateStr } from '../utils/dates';


const MONTHLY_GOAL = 5000000;

export default function Dashboard({ onNavigate }) {
  const { profile, membership } = useAuth();
  // Mismo criterio que el menú (`navParaRol`): si no puede entrar a Finanzas,
  // tampoco se le muestran cifras acumuladas aquí.
  const veFinanzas = ['owner', 'admin', 'doctor'].includes(membership?.role);
  const { patients, loading: lP } = usePatients();
  const { appointments, loading: lA } = useAppointments();
  const { jornadas, loading: lJ } = useJornadas();
  const { leads } = useLeads();
  const { transactions, loading: lT } = useTransactions();
  const { alerts } = useAlerts();

  const todayStr = today();
  const monthStr = todayStr.substring(0, 7);
  const lastMonthStr = addDaysStr(-1, parseDateStr(`${monthStr}-01`)).substring(0, 7);

  // Series de los últimos 14 días — alimentan los sparklines de los KPIs.
  const { incomeSeries, apptSeries } = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => addDaysStr(i - 13));
    return {
      incomeSeries: days.map((d) =>
        transactions.filter((t) => t.type === 'income' && t.date === d).reduce((s, t) => s + t.amount, 0)),
      apptSeries: days.map((d) =>
        appointments.filter((a) => a.date === d && a.status !== 'cancelada').length),
    };
  }, [transactions, appointments]);

  const radar = useMemo(() => {
    const list = computeCandidates(patients, appointments);
    return { list, summary: summarize(list) };
  }, [patients, appointments]);

  const isLoading = lP && lA && lJ && lT && patients.length === 0 && appointments.length === 0;
  if (isLoading) return <LoadingState message="Alineando tu panel…" size="lg" />;

  const todayAppointments = appointments
    .filter((a) => a.date === todayStr && a.status !== 'cancelada')
    .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
  const pendingToday = todayAppointments.filter((a) => a.status === 'pendiente');
  const activePatients = patients.filter((p) => p.status === 'activo' || p.status === 'en_tratamiento');
  const nextJornada = jornadas.find((j) => j.status === 'programada');
  const leadsThisWeek = leads.filter((l) => l.date >= addDaysStr(-7)).length;

  const monthIncome = transactions.filter((t) => t.type === 'income' && t.date?.startsWith(monthStr)).reduce((s, t) => s + t.amount, 0);
  const lastMonthIncome = transactions.filter((t) => t.type === 'income' && t.date?.startsWith(lastMonthStr)).reduce((s, t) => s + t.amount, 0);
  const todayIncome = transactions.filter((t) => t.type === 'income' && t.date === todayStr).reduce((s, t) => s + t.amount, 0);
  const monthDelta = lastMonthIncome > 0 ? Math.round(((monthIncome - lastMonthIncome) / lastMonthIncome) * 100) : undefined;
  const goalPercent = Math.round((monthIncome / MONTHLY_GOAL) * 100);

  // La columna real es `booked` (001_initial_schema); `booked_count` no existe
  // y dejaba la jornada llena mostrando 0 cupos.
  const jornadaBooked = nextJornada ? (nextJornada.booked ?? nextJornada.booked_count ?? 0) : 0;
  const jornadaFill = nextJornada && nextJornada.capacity > 0 ? Math.round((jornadaBooked / nextJornada.capacity) * 100) : 0;

  // Hora del consultorio (UTC-5), no la del navegador: con un doctor viajando
  // el saludo llegaba a decir "buenas noches" a media mañana.
  const hour = parseInt(localTimeStr().slice(0, 2), 10);
  const greet = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const firstName = (profile?.full_name || '').replace(/^(dr|dra)\.?\s+/i, '').split(' ')[0] || 'Doctor';

  const nowHHMM = localTimeStr();
  const nextAppointment = todayAppointments.find((a) => String(a.time || '99:99') >= nowHHMM) || null;

  const alertIcon = (type) => {
    const map = { danger: [XCircle, 'text-danger'], warning: [AlertTriangle, 'text-warning'], success: [CheckCircle, 'text-success'], info: [Info, 'text-info'] };
    const [Icon, cls] = map[type] || map.info;
    return <Icon size={16} className={cls} />;
  };

  const apptType = (t) => (t === 'primera_consulta' ? '1ra vez' : t === 'seguimiento' ? 'Seguim.' : t === 'jornada' ? 'Jornada' : t || 'Cita');

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ── Encabezado editorial + lo que sigue ─────────────────────── */}
      <header className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="min-w-0">
          <p className="kicker">{formatDate(todayStr)}</p>
          <h1 className="font-display text-hero font-semibold text-on-surface mt-1.5">
            {greet}, <em className="italic text-primary-light">{firstName}</em>
          </h1>
          <p className="text-on-surface-variant text-sm mt-2 max-w-2xl">
            {todayAppointments.length > 0
              ? `${todayAppointments.length} cita${todayAppointments.length !== 1 ? 's' : ''} en la agenda de hoy`
              : 'Hoy no tienes citas agendadas'}
            {pendingToday.length > 0 && ` · ${pendingToday.length} sin confirmar`}
            {nextJornada && ` · próxima jornada en ${nextJornada.city}`}.
          </p>
        </div>

        {/* Lo que sigue: la única tarjeta que responde "¿y ahora qué?" */}
        <NextUp appointment={nextAppointment} onNavigate={onNavigate} apptType={apptType} />
      </header>

      {/* ── KPIs ─────────────────────────────────────────────────────── */}
      <div>
        <StatGrid>
          <Stat
            label="Pacientes hoy" icon={Users} value={String(todayAppointments.length)}
            sub={pendingToday.length > 0 ? `${pendingToday.length} por confirmar` : 'todas confirmadas'}
            series={apptSeries} onClick={() => onNavigate('citas')}
          />
          {/* Recepción ve lo del día —necesita saber si cuadró la caja— pero no
              el acumulado del mes ni el atajo a Finanzas: esa pantalla no está
              en su menú, y dejar la cifra aquí sería esconder la puerta y
              dejar la ventana abierta. */}
          <Stat
            label="Ingresos del día" icon={DollarSign} value={formatCOP(todayIncome)}
            sub={veFinanzas ? `Mes: ${formatCOP(monthIncome)}` : 'lo cobrado hoy'}
            series={incomeSeries}
            onClick={veFinanzas ? () => onNavigate('finanzas') : undefined}
          />
          <Stat
            label="Pacientes activos" icon={Activity} value={String(activePatients.length)}
            sub={`de ${patients.length} en total`} onClick={() => onNavigate('pacientes')}
          />
          <Stat
            label="Por recuperar" icon={Radar} tone="accent" value={formatCOP(radar.summary.potential)}
            sub={`${radar.summary.total} pacientes dormidos`} onClick={() => onNavigate('reactivacion')}
          />
        </StatGrid>
      </div>

      {/* ── Cuerpo ───────────────────────────────────────────────────── */}
      <div className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="space-y-5 sm:space-y-6 min-w-0">
          {/* Agenda de hoy */}
          <div>
            <Card pad={false} className="overflow-hidden">
              <div className="px-4 sm:px-5 pt-4 sm:pt-5">
                <SectionHeader
                  icon={CalendarDays}
                  title="Agenda de hoy"
                  hint={todayAppointments.length > 0
                    ? `${formatCOP(todayAppointments.reduce((s, a) => s + (a.price || 0), 0))} proyectados`
                    : undefined}
                  action="Ver calendario →"
                  onAction={() => onNavigate('citas')}
                  className="mb-0"
                />
              </div>

              {todayAppointments.length === 0 ? (
                <EmptyState
                  icon={CheckCircle}
                  title="Sin citas hoy"
                  hint="Buen momento para llamar a los pacientes del radar."
                  action={<Button size="sm" variant="soft" icon={Radar} onClick={() => onNavigate('reactivacion')}>Abrir el radar</Button>}
                />
              ) : (
                <ul className="relative px-4 sm:px-5 pt-4 pb-4">
                  <span className="absolute left-[26px] sm:left-[30px] top-6 bottom-6 w-px bg-outline-variant" aria-hidden="true" />
                  {todayAppointments.map((apt) => {
                    const past = String(apt.time || '') < nowHHMM;
                    return (
                      <li
                        key={apt.id}
                        className="relative pl-8 sm:pl-9 py-3 border-b border-dashed border-outline-variant last:border-b-0"
                      >
                        <span
                          className={`absolute left-[6px] sm:left-[10px] top-[19px] w-2.5 h-2.5 rounded-full border-2 border-surface-container-lowest ${
                            apt.status === 'confirmada' ? 'bg-success'
                              : apt.status === 'completada' ? 'bg-info'
                                : apt.status === 'pendiente' ? 'bg-warning' : 'bg-outline'
                          }`}
                        />
                        <div className={`flex items-center gap-3 ${past && apt.status !== 'pendiente' ? 'opacity-60' : ''}`}>
                          <div className="w-[46px] flex-shrink-0">
                            <p className="font-display text-[15px] font-semibold text-primary tnum leading-none">{apt.time || '—'}</p>
                            <p className="text-[9.5px] uppercase tracking-wide text-on-surface-variant mt-1 truncate">{apptType(apt.type)}</p>
                          </div>
                          {/* En 375px el avatar le robaba 44px al nombre y dejaba
                              "Martha Rui…". El nombre manda; la inicial vuelve en sm. */}
                          <div className="hidden sm:flex w-8 h-8 rounded-lg bg-tertiary-container text-on-tertiary-container items-center justify-center text-[11px] font-bold flex-shrink-0">
                            {(apt.patient_name || 'P').split(' ').map((n) => n[0]).join('').slice(0, 2)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13.5px] font-semibold text-on-surface truncate">{apt.patient_name}</p>
                            <p className="text-[11px] text-on-surface-variant capitalize truncate">
                              {apt.location === 'consultorio' ? 'Consultorio' : apt.location}
                              {apt.price ? ` · ${formatCOP(apt.price)}` : ''}
                            </p>
                          </div>
                          <Badge status={apt.status} className="flex-shrink-0" />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          {/* Radar de reactivación — el atajo al dinero dormido */}
          <div>
            <Card>
              <SectionHeader
                icon={Radar}
                title="Radar de reactivación"
                hint={`${formatCOP(radar.summary.potential)} en pacientes que hoy no tienen cita`}
                action="Ver todos →"
                onAction={() => onNavigate('reactivacion')}
              />
              {radar.list.length === 0 ? (
                <EmptyState icon={TrendingUp} title="Nadie por recuperar" hint="Todos tus pacientes activos ya tienen su próxima cita." />
              ) : (
                <>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {radar.list.slice(0, 3).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => onNavigate('reactivacion')}
                        className="text-left p-3 rounded-xl bg-surface-container-low border border-outline-variant/70 hover:border-outline transition-colors min-w-0"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[13px] font-semibold text-on-surface truncate">{c.name}</p>
                          <span className="text-[10px] font-bold tnum text-primary bg-primary/10 rounded-full px-1.5 py-0.5 flex-shrink-0">
                            {c.score}
                          </span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant mt-1 truncate">{c.reason}</p>
                        <p className="font-display text-sm font-semibold text-on-surface tnum mt-1.5">{formatCOP(c.value)}</p>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => onNavigate('reactivacion')}
                    className="mt-3.5 w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                  >
                    Preparar la lista de llamadas de hoy <ArrowRight size={13} />
                  </button>
                </>
              )}
            </Card>
          </div>
        </div>

        {/* Columna lateral */}
        <div className="space-y-5 sm:space-y-6 min-w-0">
          {/* Meta del mes */}
          <div>
            <Card>
              <SectionHeader icon={Target} title="Meta del mes" action="Finanzas →" onAction={() => onNavigate('finanzas')} />
              <div className="flex items-center gap-5">
                <ProgressRing percent={goalPercent} sublabel={`de ${formatCOP(MONTHLY_GOAL)}`} />
                <div className="min-w-0">
                  <p className="font-display text-2xl font-semibold text-on-surface tnum leading-none">{formatCOP(monthIncome)}</p>
                  <p className="text-xs text-on-surface-variant mt-1.5">facturado este mes</p>
                  {typeof monthDelta === 'number' && (
                    <p className={`text-xs font-semibold mt-2.5 ${monthDelta >= 0 ? 'text-success' : 'text-danger'}`}>
                      {monthDelta >= 0 ? '↑' : '↓'} {Math.abs(monthDelta)}% vs. mes anterior
                    </p>
                  )}
                  <p className="text-[11px] text-on-surface-variant mt-2.5 leading-snug">
                    Faltan <span className="font-semibold text-on-surface tnum">{formatCOP(Math.max(0, MONTHLY_GOAL - monthIncome))}</span>
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Próxima jornada */}
          <div>
            <Card tone="pine" pad={false} className="overflow-hidden">
              <button onClick={() => onNavigate('jornadas')} className="w-full text-left p-5 relative">
                <MapPin size={96} className="absolute -right-4 -top-5 opacity-[0.12]" aria-hidden="true" />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-tertiary-fixed">Próxima jornada</p>
                {nextJornada ? (
                  <>
                    <p className="font-display text-2xl font-semibold mt-1.5">{nextJornada.city}</p>
                    <p className="text-sm text-on-primary/80">{formatDate(nextJornada.date)}</p>
                    <div className="mt-5 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-tertiary-fixed/85">Cupos</p>
                        <p className="font-display font-semibold tnum text-lg">{jornadaBooked}/{nextJornada.capacity}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-tertiary-fixed/85">Proyectado</p>
                        <p className="font-display font-semibold tnum text-lg">{formatCOP(jornadaBooked * (nextJornada.price_per_patient || 0))}</p>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 rounded-full bg-white/20 overflow-hidden">
                      <div
                        style={{ width: `${jornadaFill}%`, transition: 'width 0.9s cubic-bezier(0.22,1,0.36,1)' }}
                        className="h-full bg-tertiary-fixed-dim rounded-full"
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-on-primary/80 mt-3">
                    No hay jornadas programadas. Toca aquí para agendar la siguiente salida.
                  </p>
                )}
              </button>
            </Card>
          </div>

          {/* Alertas */}
          {alerts.length > 0 && (
            <div>
              <Card>
                <SectionHeader icon={AlertTriangle} title="Alertas" hint={`${alerts.length} sin atender`} />
                <ul className="space-y-2">
                  {alerts.slice(0, 5).map((alert) => (
                    <li key={alert.id} className="flex items-start gap-2.5 p-3 bg-surface-container-low rounded-xl">
                      <span className="mt-px flex-shrink-0">{alertIcon(alert.type)}</span>
                      <p className="text-[12.5px] text-on-surface flex-1 min-w-0">{alert.message}</p>
                      <button
                        onClick={() => {
                          if (alert.action === 'ver_finanzas') onNavigate('finanzas');
                          else if (alert.action === 'ver_jornada') onNavigate('jornadas');
                          else onNavigate('pacientes');
                        }}
                        className="text-[11px] text-primary hover:underline font-semibold inline-flex items-center gap-0.5 flex-shrink-0"
                      >
                        Atender <ChevronRight size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}

          {/* Leads */}
          <div>
            <Card tone="sunken" className="flex items-center gap-4">
              <span className="w-11 h-11 rounded-xl bg-surface-container-lowest border border-outline-variant flex items-center justify-center flex-shrink-0">
                <TrendingUp size={18} className="text-primary" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-xl font-semibold text-on-surface tnum leading-none">{leadsThisWeek}</p>
                <p className="text-xs text-on-surface-variant mt-1">leads nuevos esta semana</p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * NextUp — la tarjeta "lo que sigue". En un consultorio, la pregunta de las
 * 9 de la mañana no es "¿cuántas citas tengo?" sino "¿quién entra ahora?".
 */
function NextUp({ appointment, onNavigate, apptType }) {
  if (!appointment) {
    return (
      <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low/60 px-5 py-4 lg:min-w-[290px]">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Lo que sigue</p>
        <p className="text-sm text-on-surface mt-1.5 font-medium">No queda nada agendado hoy</p>
        <button onClick={() => onNavigate('citas')} className="text-xs font-semibold text-primary hover:underline mt-1.5 inline-flex items-center gap-1">
          Agendar una cita <ArrowRight size={12} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => onNavigate('citas')}
      className="group text-left rounded-2xl pine-deep text-on-primary shadow-pine px-5 py-4 lg:min-w-[290px] relative overflow-hidden"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-tertiary-fixed">Lo que sigue</p>
      <div className="flex items-baseline gap-2.5 mt-1.5">
        <span className="font-display text-2xl font-semibold tnum leading-none">{appointment.time}</span>
        <span className="text-[11px] uppercase tracking-wide text-on-primary/70">{apptType(appointment.type)}</span>
      </div>
      <p className="text-sm font-semibold mt-1.5 truncate">{appointment.patient_name}</p>
      <span className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-tertiary-fixed group-hover:gap-2 transition-all">
        Abrir agenda <ArrowRight size={12} />
      </span>
    </button>
  );
}
