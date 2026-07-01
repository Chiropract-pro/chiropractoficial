import { useEffect, useState } from 'react';
import {
  AlertTriangle, Calendar, Clock, FileText, Loader2, Mail, MapPin,
  MessageSquare, Receipt, Stethoscope, Users, X,
} from 'lucide-react';
import {
  bookJornada, cancelAppointment, getSaleDetail,
  requestReschedule, updateProfile,
} from '../../lib/patientApi';

// ===========================================================================
// BaseModal — wrapper común
// ===========================================================================
export function BaseModal({ open, onClose, children, title, maxWidth = 'max-w-md' }) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onEsc);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9000] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 animate-in fade-in" onClick={onClose}>
      <div
        className={`bg-surface-container-lowest w-full ${maxWidth} sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between flex-shrink-0">
            <h3 className="text-lg font-bold text-on-surface">{title}</h3>
            <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface p-1 -m-1">
              <X size={20} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

// Helpers
function formatCOP(amount) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
    .format(amount || 0);
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = String(t).split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${m} ${ampm}`;
}

const APPOINTMENT_TYPE_LABEL = {
  primera_consulta: 'Primera consulta',
  seguimiento: 'Seguimiento',
  jornada: 'Jornada',
  emergencia: 'Emergencia',
};

// ===========================================================================
// AppointmentDetailModal — vista de solo lectura con botones de acción
// ===========================================================================
export function AppointmentDetailModal({ appointment, open, onClose, onCancel, onReschedule }) {
  if (!appointment) return null;
  const isFuture = new Date(appointment.date + 'T' + (appointment.time || '00:00')) >= new Date();
  const isOpen = ['pendiente', 'confirmada'].includes(appointment.status);
  const canModify = isFuture && isOpen;

  return (
    <BaseModal open={open} onClose={onClose} title="Detalle de cita">
      <div className="p-5 space-y-5">
        {/* Fecha y hora destacadas */}
        <div className="text-center bg-surface-container-low rounded-xl p-5">
          <p className="text-sm text-on-surface-variant capitalize">{formatDate(appointment.date)}</p>
          <p className="text-3xl font-bold text-primary mt-1">{formatTime(appointment.time)}</p>
        </div>

        {/* Datos */}
        <div className="space-y-3 text-sm">
          <Row icon={Stethoscope} label="Doctor" value={appointment.doctor_name} />
          <Row icon={FileText} label="Tipo" value={APPOINTMENT_TYPE_LABEL[appointment.type] || appointment.type} />
          <Row icon={MapPin} label="Lugar" value={appointment.location || 'Consultorio'} />
          {appointment.price > 0 && (
            <Row icon={Receipt} label="Costo" value={formatCOP(appointment.price)} />
          )}
          <Row icon={Clock} label="Estado" value={<span className="capitalize font-semibold">{appointment.status}</span>} />
        </div>

        {!canModify && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <span>
              Esta cita no se puede modificar desde el panel.
              Si necesitas hacer cambios, escríbenos por WhatsApp.
            </span>
          </div>
        )}

        {canModify && (
          <div className="flex gap-2 pt-2 border-t border-outline-variant">
            <button
              onClick={onReschedule}
              className="flex-1 px-4 py-3 bg-primary text-on-primary rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
            >
              Reagendar
            </button>
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-3 border border-error/30 text-error rounded-xl text-sm font-bold hover:bg-error-container/20 transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </BaseModal>
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <Icon size={16} className="text-on-surface-variant flex-shrink-0" />
      <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
        <span className="text-on-surface-variant">{label}</span>
        <span className="text-on-surface font-medium text-right truncate">{value}</span>
      </div>
    </div>
  );
}

// ===========================================================================
// CancelAppointmentModal
// ===========================================================================
export function CancelAppointmentModal({ token, appointment, open, onClose, onSuccess, onError }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await cancelAppointment(token, appointment.id, reason.trim() || null);
      onSuccess?.('Tu cita fue cancelada.');
      onClose();
    } catch (e) {
      onError?.(e.message || 'No pudimos cancelar la cita');
    } finally {
      setLoading(false);
    }
  };

  if (!appointment) return null;

  return (
    <BaseModal open={open} onClose={onClose} title="Cancelar cita">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="bg-error-container/20 border border-error/20 text-error rounded-xl p-3 text-sm flex items-start gap-2">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <p>
            Vas a cancelar tu cita del{' '}
            <span className="font-semibold">{formatDate(appointment.date)}</span> a las{' '}
            <span className="font-semibold">{formatTime(appointment.time)}</span>.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-on-surface-variant block mb-1.5">
            Motivo (opcional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder="Cuéntanos por qué cancelas (le ayudará al doctor)"
            className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none"
          />
          <p className="text-xs text-on-surface-variant text-right mt-1">{reason.length}/300</p>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 border border-outline-variant text-on-surface-variant rounded-xl text-sm font-medium hover:bg-surface-container-low"
          >
            No, mantener
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-3 bg-error text-on-error rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Sí, cancelar'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}

// ===========================================================================
// RescheduleModal
// ===========================================================================
export function RescheduleModal({ token, appointment, open, onClose, onSuccess, onError }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setDate('');
      setTime('');
      setNotes('');
    }
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await requestReschedule(token, appointment.id, date, time, notes.trim() || null);
      onSuccess?.('Solicitud enviada. El consultorio te confirmará pronto.');
      onClose();
    } catch (e) {
      onError?.(e.message || 'No pudimos enviar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  if (!appointment) return null;

  // Min date = mañana
  const minDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return (
    <BaseModal open={open} onClose={onClose} title="Solicitar reagendamiento">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="bg-surface-container-low rounded-xl p-3 text-sm text-on-surface-variant">
          Tu cita actual es el{' '}
          <span className="font-semibold text-on-surface">{formatDate(appointment.date)}</span> a las{' '}
          <span className="font-semibold text-on-surface">{formatTime(appointment.time)}</span>.
          <p className="text-xs mt-1">El consultorio confirmará la nueva fecha por WhatsApp.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-on-surface-variant block mb-1.5">
              Nueva fecha
            </label>
            <input
              type="date"
              value={date}
              min={minDate}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-on-surface-variant block mb-1.5">
              Nueva hora
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              step={900}
              required
              className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-on-surface-variant block mb-1.5">
            Notas (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder="Ej: Si no es posible esa hora, prefiero por la tarde"
            className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 border border-outline-variant text-on-surface-variant rounded-xl text-sm font-medium hover:bg-surface-container-low"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || !date || !time}
            className="flex-1 px-4 py-3 clinical-gradient text-on-primary rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Enviar solicitud'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}

// ===========================================================================
// EditProfileModal — patient edits email / address / city
// ===========================================================================
export function EditProfileModal({ token, patient, open, onClose, onSuccess, onError }) {
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && patient) {
      setEmail(patient.email || '');
      setAddress(patient.address || '');
      setCity(patient.city || '');
    }
  }, [open, patient]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile(token, {
        email: email.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
      });
      onSuccess?.('Perfil actualizado');
      onClose();
    } catch (e) {
      onError?.(e.message || 'No pudimos actualizar el perfil');
    } finally {
      setLoading(false);
    }
  };

  if (!patient) return null;

  return (
    <BaseModal open={open} onClose={onClose} title="Editar mis datos">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="bg-surface-container-low rounded-xl p-3 text-xs text-on-surface-variant">
          <p>Tu nombre y teléfono solo los puede cambiar el consultorio. Para cualquier otro dato, escríbenos por WhatsApp.</p>
        </div>

        <div>
          <label className="text-sm font-medium text-on-surface-variant block mb-1.5">
            Email
          </label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-on-surface-variant block mb-1.5">
            Dirección
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Calle 100 # 15-30"
            maxLength={200}
            className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-on-surface-variant block mb-1.5">
            Ciudad
          </label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Bogotá"
            maxLength={80}
            className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 border border-outline-variant text-on-surface-variant rounded-xl text-sm font-medium hover:bg-surface-container-low"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-3 clinical-gradient text-on-primary rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Guardar'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}

// ===========================================================================
// BookJornadaModal — confirma reserva en una jornada
// ===========================================================================
export function BookJornadaModal({ token, jornada, open, onClose, onSuccess, onError }) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setNotes('');
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await bookJornada(token, jornada.id, notes.trim() || null);
      onSuccess?.(`Reserva confirmada para la jornada en ${result.jornada_city}`);
      onClose();
    } catch (e) {
      onError?.(e.message || 'No pudimos confirmar la reserva');
    } finally {
      setLoading(false);
    }
  };

  if (!jornada) return null;

  return (
    <BaseModal open={open} onClose={onClose} title="Reservar jornada">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="bg-surface-container-low rounded-xl p-4 space-y-2">
          <p className="text-lg font-bold text-on-surface flex items-center gap-2">
            <MapPin size={18} className="text-primary" />
            {jornada.city}
          </p>
          <p className="text-sm text-on-surface-variant capitalize">
            {formatDate(jornada.date)}
          </p>
          <div className="flex items-center justify-between pt-2 border-t border-outline-variant">
            <span className="text-sm text-on-surface-variant flex items-center gap-1">
              <Users size={14} /> {jornada.available_spots} cupos disponibles
            </span>
            <span className="text-lg font-bold text-primary">{formatCOP(jornada.price_per_patient)}</span>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-on-surface-variant block mb-1.5">
            ¿Algo que el doctor deba saber? (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder="Ej: Tengo dolor en zona lumbar"
            className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none"
          />
        </div>

        <p className="text-xs text-on-surface-variant">
          El consultorio recibirá tu reserva y te confirmará el horario exacto por WhatsApp.
        </p>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 border border-outline-variant text-on-surface-variant rounded-xl text-sm font-medium hover:bg-surface-container-low"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-3 clinical-gradient text-on-primary rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar reserva'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}

// ===========================================================================
// SaleDetailModal — recibo
// ===========================================================================
export function SaleDetailModal({ token, saleId, open, onClose, onError }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !saleId) {
      setData(null);
      return;
    }
    setLoading(true);
    getSaleDetail(token, saleId)
      .then(setData)
      .catch((e) => {
        onError?.(e.message || 'No pudimos cargar el recibo');
        onClose();
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, saleId]);

  return (
    <BaseModal open={open} onClose={onClose} title="Recibo">
      {loading && (
        <div className="p-12 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-primary" />
        </div>
      )}

      {!loading && data && (
        <div className="p-5 space-y-5">
          {/* Header con clínica */}
          {data.clinic && (
            <div className="text-center pb-4 border-b border-outline-variant">
              <p className="font-bold text-on-surface">{data.clinic.name}</p>
              {data.clinic.phone && <p className="text-xs text-on-surface-variant">{data.clinic.phone}</p>}
              {data.clinic.address && (
                <p className="text-xs text-on-surface-variant">{data.clinic.address}{data.clinic.city ? ` · ${data.clinic.city}` : ''}</p>
              )}
            </div>
          )}

          {/* Datos del recibo */}
          {data.sale && (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Recibo #</span>
                <span className="font-mono text-xs">{String(data.sale.id).slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Fecha</span>
                <span>{new Date(data.sale.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Estado</span>
                <span className="capitalize font-semibold">{data.sale.status}</span>
              </div>
            </div>
          )}

          {/* Items */}
          {data.items && data.items.length > 0 && (
            <div className="bg-surface-container-low rounded-xl overflow-hidden">
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                Detalle
              </div>
              <div className="divide-y divide-outline-variant">
                {data.items.map((it) => (
                  <div key={it.id} className="px-3 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-on-surface truncate">{it.item_name}</p>
                      {it.quantity > 1 && (
                        <p className="text-xs text-on-surface-variant">
                          {it.quantity} × {formatCOP(it.unit_price)}
                        </p>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-on-surface whitespace-nowrap">{formatCOP(it.subtotal)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Total */}
          {data.sale && (
            <div className="flex items-center justify-between pt-3 border-t-2 border-outline">
              <span className="text-base font-bold text-on-surface">Total</span>
              <span className="text-2xl font-bold text-primary">{formatCOP(data.sale.total)}</span>
            </div>
          )}

          {/* Pago */}
          {data.payment && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-900">
              <p className="font-semibold flex items-center gap-1.5">
                <Receipt size={14} /> Pagado
              </p>
              <p className="text-xs mt-1 capitalize">
                Método: {data.payment.payment_method || data.sale?.payment_method || 'no especificado'}
              </p>
              {data.payment.paid_at && (
                <p className="text-xs">
                  Confirmado: {new Date(data.payment.paid_at).toLocaleString('es-CO')}
                </p>
              )}
            </div>
          )}

          {/* Factura electrónica DIAN */}
          {data.sale?.e_invoice_status === 'accepted' || data.sale?.e_invoice_status === 'sent' ? (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-sm">
              <p className="font-semibold text-on-surface flex items-center gap-1.5">
                📡 Factura electrónica DIAN
              </p>
              <p className="text-xs text-on-surface-variant mt-1">
                <b>N°:</b> {data.sale.e_invoice_number}
              </p>
              {data.sale.e_invoice_cufe && (
                <p className="text-[10px] text-on-surface-variant break-all mt-0.5">
                  <b>CUFE:</b> {data.sale.e_invoice_cufe}
                </p>
              )}
              {data.sale.e_invoice_pdf_url && (
                <a
                  href={data.sale.e_invoice_pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-primary font-bold hover:underline"
                >
                  📄 Descargar PDF de la factura
                </a>
              )}
            </div>
          ) : null}
        </div>
      )}
    </BaseModal>
  );
}
