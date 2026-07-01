import { useEffect, useState } from 'react';
import {
  Calendar, ChevronRight, CreditCard, Edit3, ExternalLink, FileText,
  Home, LogOut, MapPin, Receipt, Sparkles, Stethoscope, User, Users,
} from 'lucide-react';
import { usePatientAuth } from '../../contexts/PatientAuthContext';
import { useToast } from '../Toast';
import { listJornadas } from '../../lib/patientApi';
import {
  AppointmentDetailModal, BookJornadaModal, CancelAppointmentModal,
  EditProfileModal, RescheduleModal, SaleDetailModal,
} from './PatientModals';
import PatientClinicalHistory from './PatientClinicalHistory';

const CLINIC_NAME = import.meta.env.VITE_CLINIC_NAME || 'chiropract.co';

const APPOINTMENT_TYPE_LABEL = {
  primera_consulta: 'Primera consulta',
  seguimiento: 'Seguimiento',
  jornada: 'Jornada',
  emergencia: 'Emergencia',
};

const STATUS_BADGE = {
  pendiente: 'bg-amber-100 text-amber-800',
  confirmada: 'bg-emerald-100 text-emerald-800',
  cancelada: 'bg-red-100 text-red-800',
  completada: 'bg-slate-100 text-slate-700',
};

function formatCOP(amount) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
    .format(amount || 0);
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = String(t).split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${m} ${ampm}`;
}

export default function PatientHome() {
  const { dashboard, session, signOut, loading, error, refresh } = usePatientAuth();
  const toast = useToast();

  // Tab activo
  const [tab, setTab] = useState('home'); // 'home' | 'clinical'

  // Modales
  const [detailAppt, setDetailAppt] = useState(null); // appointment object
  const [cancelAppt, setCancelAppt] = useState(null);
  const [rescheduleAppt, setRescheduleAppt] = useState(null);
  const [saleDetailId, setSaleDetailId] = useState(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [bookingJornada, setBookingJornada] = useState(null);

  // Jornadas (lazy load — solo si la sección está montada)
  const [jornadas, setJornadas] = useState(null);
  const [loadingJornadas, setLoadingJornadas] = useState(false);

  useEffect(() => {
    if (!session?.session_token) return;
    setLoadingJornadas(true);
    listJornadas(session.session_token, 5)
      .then(setJornadas)
      .catch(() => setJornadas([]))
      .finally(() => setLoadingJornadas(false));
  }, [session?.session_token, dashboard?.patient?.id]);

  if (loading && !dashboard) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full clinical-gradient mx-auto mb-3 animate-pulse" />
          <p className="text-on-surface-variant text-sm">Cargando tus datos...</p>
        </div>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <p className="text-on-surface mb-3">{error}</p>
          <button onClick={refresh} className="bg-primary text-on-primary px-5 py-2.5 rounded-lg text-sm font-medium">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const patient = dashboard?.patient || {};
  const appointments = dashboard?.upcoming_appointments || [];
  const sales = dashboard?.recent_sales || [];
  const pending = dashboard?.pending_payments || [];

  const onActionSuccess = (msg) => {
    toast.success(msg);
    refresh();
    // Recargar jornadas tras booking exitoso para reflejar capacidad/already_booked
    if (session?.session_token) {
      listJornadas(session.session_token, 5).then(setJornadas).catch(() => {});
    }
  };
  const onActionError = (msg) => toast.error(msg);

  return (
    <div className="min-h-screen bg-surface-container-low">
      {/* Header */}
      <header className="bg-surface-container-lowest border-b border-outline-variant sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logos/v1-spine-mark.svg" alt={CLINIC_NAME} className="h-9 w-auto" />
            <div>
              <p className="text-sm font-bold text-on-surface leading-tight">{CLINIC_NAME}</p>
              <p className="text-xs text-on-surface-variant leading-tight">Panel del paciente</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-error px-3 py-2 rounded-lg hover:bg-surface-container-low transition-colors"
            title="Cerrar sesión"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* Tabs (sticky bajo el header) */}
      <div className="bg-surface-container-lowest border-b border-outline-variant sticky top-[57px] z-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex gap-1">
          <button
            onClick={() => setTab('home')}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === 'home'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Home size={14} /> Inicio
          </button>
          <button
            onClick={() => setTab('clinical')}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === 'clinical'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Stethoscope size={14} /> Mi historial
          </button>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {tab === 'clinical' ? (
          <PatientClinicalHistory />
        ) : (
        <>
        {/* Saludo */}
        <section className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full clinical-gradient flex items-center justify-center text-on-primary flex-shrink-0">
              <User size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-on-surface truncate">Hola, {patient.full_name?.split(' ')[0] || 'paciente'}</h1>
              <p className="text-sm text-on-surface-variant">{patient.appointments_count || 0} citas en total</p>
            </div>
            <button
              onClick={() => setEditProfileOpen(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-on-surface-variant hover:text-primary px-3 py-2 rounded-lg hover:bg-surface-container-low transition-colors flex-shrink-0"
            >
              <Edit3 size={14} />
              <span className="hidden sm:inline">Editar</span>
            </button>
          </div>
        </section>

        {/* Pagos pendientes */}
        {pending.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-on-surface uppercase tracking-wide mb-2 px-1 flex items-center gap-2">
              <CreditCard size={14} />
              Pagos pendientes
            </h2>
            <div className="space-y-2">
              {pending.map((p) => (
                <div
                  key={p.id}
                  className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-on-surface text-sm truncate">{p.description || 'Pago pendiente'}</p>
                    <p className="text-lg font-bold text-amber-900">{formatCOP(p.amount)}</p>
                  </div>
                  {p.payment_url && (
                    <a
                      href={p.payment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-1.5 whitespace-nowrap"
                    >
                      Pagar
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Próximas citas */}
        <section>
          <h2 className="text-sm font-bold text-on-surface uppercase tracking-wide mb-2 px-1 flex items-center gap-2">
            <Calendar size={14} />
            Próximas citas
          </h2>
          {appointments.length === 0 ? (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 text-center">
              <Calendar size={28} className="mx-auto text-on-surface-variant mb-2" />
              <p className="text-sm text-on-surface-variant">No tienes citas programadas.</p>
              <p className="text-xs text-on-surface-variant mt-1">Escríbenos por WhatsApp para agendar.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {appointments.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setDetailAppt(a)}
                  className="w-full text-left bg-surface-container-lowest border border-outline-variant rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-on-surface capitalize">{formatDate(a.date)}</p>
                      <p className="text-2xl font-bold text-primary">{formatTime(a.time)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${STATUS_BADGE[a.status] || 'bg-slate-100 text-slate-700'}`}>
                        {a.status}
                      </span>
                      <ChevronRight size={18} className="text-on-surface-variant group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant">
                    <span className="flex items-center gap-1">
                      <Stethoscope size={12} />
                      {a.doctor_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText size={12} />
                      {APPOINTMENT_TYPE_LABEL[a.type] || a.type}
                    </span>
                    {a.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} />
                        {a.location}
                      </span>
                    )}
                    {a.price > 0 && (
                      <span className="ml-auto font-semibold text-on-surface">{formatCOP(a.price)}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Recibos recientes */}
        <section>
          <h2 className="text-sm font-bold text-on-surface uppercase tracking-wide mb-2 px-1 flex items-center gap-2">
            <Receipt size={14} />
            Recibos recientes
          </h2>
          {sales.length === 0 ? (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 text-center">
              <Receipt size={28} className="mx-auto text-on-surface-variant mb-2" />
              <p className="text-sm text-on-surface-variant">Aún no tienes recibos.</p>
            </div>
          ) : (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl divide-y divide-outline-variant overflow-hidden">
              {sales.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSaleDetailId(s.id)}
                  className="w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-surface-container-low transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-on-surface">
                      {new Date(s.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-on-surface-variant capitalize">
                      {s.payment_method || 'Pago'} · {s.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-on-surface">{formatCOP(s.total)}</p>
                    <ChevronRight size={16} className="text-on-surface-variant group-hover:text-primary transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Jornadas reservables */}
        {jornadas && jornadas.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-on-surface uppercase tracking-wide mb-2 px-1 flex items-center gap-2">
              <Sparkles size={14} />
              Próximas jornadas
            </h2>
            <p className="text-xs text-on-surface-variant px-1 mb-2">
              El Dr. Miguel viaja a estas ciudades. Reserva tu lugar antes de que se llenen.
            </p>
            <div className="space-y-2">
              {jornadas.map((j) => {
                const isFull = j.available_spots <= 0;
                const dateLabel = formatDate(j.date);
                return (
                  <div
                    key={j.id}
                    className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <p className="text-base font-bold text-on-surface flex items-center gap-1.5">
                          <MapPin size={14} className="text-primary" />
                          {j.city}
                        </p>
                        <p className="text-sm text-on-surface-variant capitalize">{dateLabel}</p>
                      </div>
                      <p className="text-sm font-bold text-primary whitespace-nowrap">
                        {formatCOP(j.price_per_patient)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-outline-variant">
                      <span className="text-xs text-on-surface-variant flex items-center gap-1">
                        <Users size={12} />
                        {isFull ? 'Llena' : `${j.available_spots} cupos`}
                      </span>
                      {j.already_booked ? (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full">
                          Ya reservada
                        </span>
                      ) : (
                        <button
                          disabled={isFull}
                          onClick={() => setBookingJornada(j)}
                          className="text-xs font-bold px-4 py-2 rounded-full bg-primary text-on-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                        >
                          {isFull ? 'Llena' : 'Reservar lugar'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <p className="text-center text-xs text-on-surface-variant pt-4 pb-2">
          ¿Necesitas algo? Escríbenos por WhatsApp.
        </p>
        </>
        )}
      </main>

      {/* Modales */}
      <AppointmentDetailModal
        appointment={detailAppt}
        open={!!detailAppt}
        onClose={() => setDetailAppt(null)}
        onCancel={() => {
          setCancelAppt(detailAppt);
          setDetailAppt(null);
        }}
        onReschedule={() => {
          setRescheduleAppt(detailAppt);
          setDetailAppt(null);
        }}
      />

      <CancelAppointmentModal
        token={session?.session_token}
        appointment={cancelAppt}
        open={!!cancelAppt}
        onClose={() => setCancelAppt(null)}
        onSuccess={onActionSuccess}
        onError={onActionError}
      />

      <RescheduleModal
        token={session?.session_token}
        appointment={rescheduleAppt}
        open={!!rescheduleAppt}
        onClose={() => setRescheduleAppt(null)}
        onSuccess={onActionSuccess}
        onError={onActionError}
      />

      <SaleDetailModal
        token={session?.session_token}
        saleId={saleDetailId}
        open={!!saleDetailId}
        onClose={() => setSaleDetailId(null)}
        onError={onActionError}
      />

      <EditProfileModal
        token={session?.session_token}
        patient={patient}
        open={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        onSuccess={onActionSuccess}
        onError={onActionError}
      />

      <BookJornadaModal
        token={session?.session_token}
        jornada={bookingJornada}
        open={!!bookingJornada}
        onClose={() => setBookingJornada(null)}
        onSuccess={onActionSuccess}
        onError={onActionError}
      />
    </div>
  );
}
