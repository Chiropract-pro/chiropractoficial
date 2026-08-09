import { useMemo, useState } from 'react';
import { CalendarCheck, CalendarDays, CheckCircle, Clock, Download, Plus } from 'lucide-react';
import { formatCOP, formatDate } from '../utils/format';
import { useAppointments, usePatients } from '../hooks/useTenantData';
import LoadingState from './LoadingState';
import { downloadCsv } from '../utils/csv';
import SoapEditorModal from './clinical/SoapEditorModal';
import Button from './ui/Button';
import { Card, EmptyState, PageHeader, SectionHeader } from './ui/Card';
import { Stat, StatGrid } from './ui/Stat';
import { SegmentedTabs } from './ui/Tabs';
import AppointmentRow from './citas/AppointmentRow';
import NewAppointmentModal from './citas/NewAppointmentModal';
import { cn } from '../lib/utils';
import { todayStr as today, toLocalDateStr, parseDateStr } from '../utils/dates';


const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function Citas() {
  const { appointments, loading, insertAppointment, updateAppointment } = useAppointments();
  const { patients } = usePatients();
  const [view, setView] = useState('today');
  const [showNewForm, setShowNewForm] = useState(false);
  const [soapForApt, setSoapForApt] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

  const todayStr = today();

  // La semana se calcula a mediodía: a las 11pm, `new Date()` corría el lunes.
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay() + i);
    return toLocalDateStr(d);
  }), []);

  const byDate = useMemo(() => {
    const map = {};
    for (const a of appointments) (map[a.date] ||= []).push(a);
    for (const k of Object.keys(map)) map[k].sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
    return map;
  }, [appointments]);

  const patientById = useMemo(
    () => Object.fromEntries(patients.map((p) => [p.id, p])),
    [patients],
  );

  if (loading && appointments.length === 0) return <LoadingState message="Cargando la agenda…" />;

  const todayApts = byDate[todayStr] || [];
  const activeApts = todayApts.filter((a) => a.status !== 'cancelada');
  const pendingApts = todayApts.filter((a) => a.status === 'pendiente');
  const confirmedApts = todayApts.filter((a) => a.status === 'confirmada');
  const allPending = appointments.filter((a) => a.status === 'pendiente');
  const dayShown = selectedDay || todayStr;
  const dayApts = (byDate[dayShown] || []).filter((a) => a.status !== 'cancelada');

  const renderList = (list, { showDate } = {}) => (
    <ul className="relative px-4 sm:px-5 pb-2">
      <span className="absolute left-[30px] sm:left-[36px] top-3 bottom-5 w-px bg-outline-variant" aria-hidden="true" />
      {list.map((apt) => (
        <li key={apt.id} className="relative pl-8 sm:pl-9 py-3.5 border-b border-dashed border-outline-variant last:border-b-0">
          <span
            className={cn(
              'absolute left-[10px] sm:left-[16px] top-[22px] w-2.5 h-2.5 rounded-full border-2 border-surface-container-lowest',
              apt.status === 'confirmada' ? 'bg-success'
                : apt.status === 'completada' ? 'bg-info'
                  : apt.status === 'pendiente' ? 'bg-warning' : 'bg-danger',
            )}
          />
          <AppointmentRow
            appointment={apt}
            patient={patientById[apt.patient_id]}
            onUpdate={updateAppointment}
            onOpenSoap={setSoapForApt}
            showDate={showDate}
          />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <PageHeader
          kicker="Agenda"
          title="Citas"
          subtitle="Agendamiento, confirmaciones y cobro en el mismo lugar"
        >
          <Button
            variant="outline" size="sm" icon={Download}
            onClick={() => downloadCsv(
              `citas-${todayStr}.csv`,
              appointments,
              [
                { key: 'date', label: 'Fecha' }, { key: 'time', label: 'Hora' }, { key: 'patient_name', label: 'Paciente' },
                { key: 'type', label: 'Tipo' }, { key: 'location', label: 'Ubicación' }, { key: 'status', label: 'Estado' },
                { key: 'price', label: 'Precio', format: (v) => v ?? 0 },
              ],
            )}
          >
            Exportar
          </Button>
          <Button size="sm" icon={Plus} onClick={() => setShowNewForm(true)}>Agendar</Button>
        </PageHeader>
      </div>

      <div>
        <StatGrid>
          <Stat label="Citas hoy" icon={CalendarDays} value={String(activeApts.length)} sub={`${todayApts.length - activeApts.length} canceladas`} />
          <Stat label="Confirmadas" icon={CheckCircle} value={String(confirmedApts.length)} sub={`de ${activeApts.length} activas`} />
          <Stat label="Por confirmar" icon={Clock} value={String(pendingApts.length)} tone={pendingApts.length > 0 ? 'danger' : 'default'} sub="requieren llamada" />
          <Stat label="Proyectado hoy" icon={CalendarCheck} tone="accent" value={formatCOP(activeApts.reduce((s, a) => s + (a.price || 0), 0))} sub="si todas asisten" />
        </StatGrid>
      </div>

      <div>
        <SegmentedTabs
          layoutId="citas-view"
          value={view}
          onChange={(v) => { setView(v); setSelectedDay(null); }}
          tabs={[
            { id: 'today', label: 'Hoy', count: activeApts.length },
            { id: 'week', label: 'Semana' },
            { id: 'pending', label: 'Pendientes', count: allPending.length },
          ]}
        />
      </div>

      {/* ── Hoy ─────────────────────────────────────────────────── */}
      {view === 'today' && (
        <div>
          <Card pad={false} className="overflow-hidden">
            <div className="px-4 sm:px-5 pt-4 sm:pt-5">
              <SectionHeader title={formatDate(todayStr)} hint={`${activeApts.length} citas activas`} className="mb-3" />
            </div>
            {todayApts.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No hay citas para hoy"
                hint="Agenda una nueva o revisa la semana completa."
                action={<Button size="sm" icon={Plus} onClick={() => setShowNewForm(true)}>Agendar cita</Button>}
              />
            ) : (
              <>
                {renderList(todayApts)}
                <div className="px-4 sm:px-5 py-3.5 border-t border-outline-variant flex justify-between text-sm">
                  <span className="text-on-surface-variant">Total · {activeApts.length} citas</span>
                  <span className="font-display font-semibold text-primary tnum">
                    {formatCOP(activeApts.reduce((s, a) => s + (a.price || 0), 0))}
                  </span>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* ── Semana ──────────────────────────────────────────────── */}
      {view === 'week' && (
        <div className="space-y-4">
          {/* Tira de días: en móvil sustituye a las siete tarjetas apiladas que
              obligaban a hacer scroll para encontrar el jueves. */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {weekDates.map((d) => {
              const count = (byDate[d] || []).filter((a) => a.status !== 'cancelada').length;
              const isToday = d === todayStr;
              const active = d === dayShown;
              const dow = parseDateStr(d).getDay();
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDay(d)}
                  className={cn(
                    'flex flex-col items-center gap-0.5 py-2.5 rounded-xl border transition-colors',
                    active
                      ? 'bg-primary text-on-primary border-primary shadow-pine'
                      : 'bg-surface-container-lowest border-outline-variant hover:border-outline text-on-surface',
                  )}
                >
                  <span className={cn('text-[10px] font-semibold uppercase', active ? 'text-tertiary-fixed' : 'text-on-surface-variant')}>
                    {DOW[dow]}
                  </span>
                  <span className="font-display text-base font-semibold tnum leading-none">{d.slice(-2)}</span>
                  <span
                    className={cn(
                      'mt-0.5 text-[10px] font-bold tnum min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center',
                      count === 0
                        ? active ? 'text-on-primary/50' : 'text-on-surface-variant/50'
                        : active ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary',
                    )}
                  >
                    {count || '·'}
                  </span>
                  {isToday && !active && <span className="w-1 h-1 rounded-full bg-tertiary-fixed-dim" />}
                </button>
              );
            })}
          </div>

          <Card pad={false} className="overflow-hidden">
            <div className="px-4 sm:px-5 pt-4 sm:pt-5">
              <SectionHeader
                title={formatDate(dayShown)}
                hint={dayApts.length > 0 ? `${formatCOP(dayApts.reduce((s, a) => s + (a.price || 0), 0))} proyectados` : undefined}
                className="mb-3"
              />
            </div>
            {dayApts.length === 0 ? (
              <EmptyState icon={CalendarDays} title="Día libre" hint="No hay citas agendadas para esta fecha." />
            ) : (
              renderList(dayApts)
            )}
          </Card>
        </div>
      )}

      {/* ── Pendientes ──────────────────────────────────────────── */}
      {view === 'pending' && (
        <div>
          <Card pad={false} className="overflow-hidden">
            <div className="px-4 sm:px-5 pt-4 sm:pt-5">
              <SectionHeader
                title="Pendientes de confirmación"
                hint="Toda fecha, ordenadas por día"
                className="mb-3"
              />
            </div>
            {allPending.length === 0 ? (
              <EmptyState icon={CheckCircle} title="Todo confirmado" hint="No hay citas esperando respuesta del paciente." />
            ) : (
              renderList(allPending, { showDate: true })
            )}
          </Card>
        </div>
      )}

      <NewAppointmentModal
        open={showNewForm}
        onClose={() => setShowNewForm(false)}
        patients={patients}
        onCreate={insertAppointment}
        defaultDate={view === 'week' ? dayShown : todayStr}
      />

      {soapForApt && (
        <SoapEditorModal
          patient={{ id: soapForApt.patient_id, full_name: soapForApt.patient_name, name: soapForApt.patient_name }}
          appointment={soapForApt}
          open={!!soapForApt}
          onClose={() => setSoapForApt(null)}
          onSaved={() => setSoapForApt(null)}
        />
      )}
    </div>
  );
}
