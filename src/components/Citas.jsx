import { useState } from 'react';
import { Plus, X, Clock, MapPin, ChevronLeft, ChevronRight, AlertCircle, CheckCircle, XCircle, Download, Stethoscope } from 'lucide-react';
import { appointmentTypes, formatCOP, formatDate } from '../utils/format';
import { useAppointments, usePatients } from '../hooks/useTenantData';
import { useToast } from './Toast';
import { userFriendlyError } from '../lib/logger';
import LoadingState from './LoadingState';
import PaymentLinkButton from './PaymentLinkButton';
import { downloadCsv } from '../utils/csv';
import SoapEditorModal from './clinical/SoapEditorModal';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { Card } from './ui/Card';
import { cn } from '../lib/utils';

export default function Citas() {
  const { appointments, loading, insertAppointment, updateAppointment } = useAppointments();
  const { patients } = usePatients();
  const toast = useToast();
  const [view, setView] = useState('today');
  const [showNewForm, setShowNewForm] = useState(false);
  const [soapForApt, setSoapForApt] = useState(null); // appointment object para abrir SOAP

  if (loading && appointments.length === 0) return <LoadingState message="Cargando citas..." />;
  const todayStr = new Date().toISOString().split('T')[0];

  const todayApts = appointments.filter((a) => a.date === todayStr);
  const activeApts = todayApts.filter((a) => a.status !== 'cancelada');
  const pendingApts = todayApts.filter((a) => a.status === 'pendiente');
  const confirmedApts = todayApts.filter((a) => a.status === 'confirmada');

  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + i);
    weekDates.push(d.toISOString().split('T')[0]);
  }

  const weekApts = weekDates.map((date) => ({
    date,
    appointments: appointments.filter((a) => a.date === date && a.status !== 'cancelada'),
  }));

  const statusIcon = (status) => {
    switch (status) {
      case 'confirmada': return <CheckCircle size={14} className="text-success" />;
      case 'pendiente': return <AlertCircle size={14} className="text-accent" />;
      case 'cancelada': return <XCircle size={14} className="text-danger" />;
      default: return null;
    }
  };

  const typeLabel = (type) => {
    const t = appointmentTypes.find((at) => at.value === type);
    return t?.label || type;
  };

  const locationLabel = (loc) => {
    if (loc === 'consultorio') return 'Consultorio';
    return loc.charAt(0).toUpperCase() + loc.slice(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-tertiary-fixed-dim">Agenda</p>
          <h1 className="font-display text-3xl font-semibold text-on-surface mt-1">Citas</h1>
          <p className="text-on-surface-variant text-sm mt-1">Gestión de agendamiento y confirmaciones</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm" icon={Download} className="hidden sm:inline-flex"
            onClick={() => downloadCsv(
              `citas-${new Date().toISOString().slice(0, 10)}.csv`,
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
          <Button size="sm" icon={Plus} onClick={() => setShowNewForm(true)}>Agendar cita</Button>
        </div>
      </div>

      {/* Tabs de vista */}
      <div className="inline-flex bg-surface-container-high rounded-xl p-1 gap-1">
        {[
          { id: 'today', label: 'Hoy' },
          { id: 'week', label: 'Semana' },
          { id: 'pending', label: 'Pendientes' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors',
              view === tab.id ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Resumen conectado */}
      <div className="grid grid-cols-2 sm:grid-cols-4 bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-clinical">
        {[
          { v: activeApts.length, k: 'Citas hoy', cls: 'text-on-surface' },
          { v: confirmedApts.length, k: 'Confirmadas', cls: 'text-success' },
          { v: pendingApts.length, k: 'Pendientes', cls: 'text-warning' },
          { v: formatCOP(activeApts.reduce((s, a) => s + (a.price || 0), 0)), k: 'Proyectado', cls: 'text-primary' },
        ].map((s, i) => (
          <div key={s.k} className={cn('p-4', i < 3 && 'sm:border-r', i % 2 === 0 && 'border-r', i < 2 && 'border-b sm:border-b-0', 'border-outline-variant')}>
            <p className={cn('font-display text-2xl font-semibold leading-none tnum', s.cls)}>{s.v}</p>
            <p className="text-[11px] text-on-surface-variant mt-1.5">{s.k}</p>
          </div>
        ))}
      </div>

      {/* Vista Hoy — riel vertebral */}
      {view === 'today' && (
        <Card pad={false} className="overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant">
            <h3 className="font-display text-lg font-semibold text-on-surface">Hoy — {formatDate(todayStr)}</h3>
          </div>
          {todayApts.length === 0 ? (
            <div className="py-14 text-center text-on-surface-variant text-sm">No hay citas para hoy</div>
          ) : (
            <div className="relative pl-8 pr-5 py-3">
              <div className="absolute left-[18px] top-4 bottom-4 w-0.5 bg-outline-variant" />
              {todayApts.map((apt) => (
                <div key={apt.id} className={cn('relative flex items-center gap-4 py-3.5 border-b border-dashed border-outline-variant last:border-b-0', apt.status === 'cancelada' && 'opacity-50')}>
                  <span className={cn('absolute -left-[26px] w-3 h-3 rounded-full border-2 border-surface-container-lowest', apt.status === 'confirmada' ? 'bg-success' : apt.status === 'pendiente' ? 'bg-warning' : apt.status === 'completada' ? 'bg-info' : 'bg-danger')} />
                  <div className="min-w-[58px]">
                    <p className="font-display text-lg font-semibold text-primary tnum leading-none">{apt.time}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">{apt.patient_name}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-on-surface-variant">
                      <span className="flex items-center gap-1"><Clock size={12} /> {typeLabel(apt.type)}</span>
                      <span className="flex items-center gap-1"><MapPin size={12} /> {locationLabel(apt.location)}</span>
                    </div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="font-display text-sm font-semibold text-on-surface tnum">{formatCOP(apt.price || 0)}</p>
                    <Badge status={apt.status} className="mt-1" />
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end max-w-[180px]">
                    {apt.status === 'pendiente' && (
                      <button onClick={() => updateAppointment(apt.id, { status: 'confirmada' })} className="text-xs font-semibold bg-[#e0efe8] text-[#1f6b52] px-2.5 py-1 rounded-lg hover:bg-[#d2e7dd] transition-colors">Confirmar</button>
                    )}
                    {apt.status === 'confirmada' && (
                      <button onClick={() => updateAppointment(apt.id, { status: 'completada' })} className="text-xs font-semibold bg-[#e0e9f1] text-[#3a5a78] px-2.5 py-1 rounded-lg hover:bg-[#d2e0ec] transition-colors">Completar</button>
                    )}
                    {apt.status !== 'cancelada' && apt.status !== 'completada' && (
                      <button onClick={() => updateAppointment(apt.id, { status: 'cancelada' })} className="text-xs font-semibold bg-[#f6ddd3] text-[#a03a22] px-2.5 py-1 rounded-lg hover:bg-[#f0cfc1] transition-colors">Cancelar</button>
                    )}
                    <button
                      onClick={() => setSoapForApt(apt)}
                      className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-lg hover:bg-primary/15 transition-colors flex items-center gap-1"
                      title="Crear/editar nota SOAP"
                    >
                      <Stethoscope size={11} /> SOAP
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeApts.length > 0 && (
            <div className="px-5 py-3.5 border-t border-outline-variant flex justify-between text-sm">
              <span className="text-on-surface-variant">Total · {activeApts.length} citas</span>
              <span className="font-display font-semibold text-primary tnum">{formatCOP(activeApts.reduce((s, a) => s + (a.price || 0), 0))}</span>
            </div>
          )}
        </Card>
      )}

      {/* Week View */}
      {view === 'week' && (
        <div className="space-y-3">
          {weekApts.map((day) => (
            <div key={day.date} className="bg-surface-container-lowest rounded-xl shadow-clinical border border-outline-variant p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-on-surface">{formatDate(day.date)}</h4>
                <span className="text-xs text-on-surface-variant/70">{day.appointments.length} cita(s)</span>
              </div>
              {day.appointments.length === 0 ? (
                <p className="text-xs text-on-surface-variant/50">Sin citas</p>
              ) : (
                <div className="space-y-2">
                  {day.appointments.map((apt) => (
                    <div key={apt.id} className="flex items-center gap-3 p-2.5 bg-surface-container-low rounded-lg text-sm">
                      <span className="font-display font-semibold text-primary min-w-[50px] tnum">{apt.time}</span>
                      <span className="text-on-surface flex-1 truncate">{apt.patient_name}</span>
                      <span className="text-xs text-on-surface-variant hidden sm:inline">{typeLabel(apt.type)}</span>
                      <Badge status={apt.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pending View */}
      {view === 'pending' && (
        <div className="bg-surface-container-lowest rounded-xl shadow-clinical border border-outline-variant">
          <div className="p-4 border-b border-outline-variant">
            <h3 className="font-semibold text-on-surface">Citas pendientes de confirmación</h3>
          </div>
          <div className="divide-y divide-outline-variant/20">
            {appointments.filter((a) => a.status === 'pendiente').length === 0 ? (
              <div className="py-12 text-center text-on-surface-variant/70 text-sm">No hay citas pendientes</div>
            ) : (
              appointments.filter((a) => a.status === 'pendiente').map((apt) => (
                <div key={apt.id} className="flex items-center gap-4 p-4 hover:bg-surface-container-low transition-colors">
                  <div className="text-center min-w-[70px]">
                    <p className="text-sm font-bold text-primary">{apt.time}</p>
                    <p className="text-[10px] text-on-surface-variant/70">{formatDate(apt.date)}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-on-surface">{apt.patient_name}</p>
                    <p className="text-xs text-on-surface-variant/70">{typeLabel(apt.type)} — {locationLabel(apt.location)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <PaymentLinkButton
                      amount={apt.price || 0}
                      description={`${typeLabel(apt.type)} — ${apt.patient_name}`}
                      patientId={apt.patient_id}
                      appointmentId={apt.id}
                      customerName={apt.patient_name}
                      customerPhone={patients.find((p) => p.id === apt.patient_id)?.phone}
                      label="Cobrar"
                      className="!px-3 !py-1.5 !text-xs"
                    />
                    <button onClick={() => updateAppointment(apt.id, { status: 'confirmada' })} className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg hover:bg-green-600 transition-colors font-medium">
                      Confirmar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* New Appointment Form */}
      {showNewForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNewForm(false)}>
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-on-surface">Agendar Nueva Cita</h3>
              <button onClick={() => setShowNewForm(false)} className="text-on-surface-variant/50 hover:text-on-surface"><X size={20} /></button>
            </div>
            <form className="space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target;
              const patientId = form.patient_id.value;
              const patient = patients.find((p) => p.id === patientId);
              const r = await insertAppointment({
                patient_id: patientId,
                patient_name: patient?.full_name || '',
                date: form.date.value,
                time: form.time.value,
                type: form.type.value,
                location: form.location.value,
                notes: form.notes.value || null,
                status: 'pendiente',
                price: appointmentTypes.find((t) => t.value === form.type.value)?.price || 0,
              });
              if (r.error) { toast.error(userFriendlyError(r.error)); return; }
              toast.success('Cita creada');
              setShowNewForm(false);
            }}>
              <div>
                <label className="text-xs text-on-surface-variant block mb-1">Paciente</label>
                <select name="patient_id" required className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">Seleccionar paciente</option>
                  {patients.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Fecha</label>
                  <input name="date" type="date" required className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Hora</label>
                  <input name="time" type="time" required className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Tipo de cita</label>
                  <select name="type" className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {appointmentTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Ubicación</label>
                  <select name="location" className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="consultorio">Consultorio</option>
                    <option value="soata">Soatá</option>
                    <option value="guamal">Guamal</option>
                    <option value="muzo">Muzo</option>
                    <option value="garces_navas">Garcés Navas</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-on-surface-variant block mb-1">Notas</label>
                <textarea name="notes" className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" rows={2} placeholder="Notas adicionales..." />
              </div>
              <button type="submit" className="w-full bg-primary hover:bg-primary-dark text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
                Agendar Cita
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SOAP Editor Modal */}
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
