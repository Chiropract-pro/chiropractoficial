import { useState } from 'react';
import {
  CalendarDays, Edit2, Folder, Mail, MapPin, MessageCircle, Phone, ShieldAlert,
  Stethoscope, Trash2, User as UserIcon, Wallet,
} from 'lucide-react';
import { formatCOP, formatShortDate } from '../../utils/format';
import { useToast } from '../Toast';
import { userFriendlyError } from '../../lib/logger';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { UnderlineTabs } from '../ui/Tabs';
import ClinicalHistoryPanel from '../clinical/ClinicalHistoryPanel';
import ClinicalFilesPanel from '../clinical/ClinicalFilesPanel';
import PaymentLinkButton from '../PaymentLinkButton';

const TABS = [
  { id: 'data', label: 'Datos', icon: UserIcon },
  { id: 'clinical', label: 'Historia clínica', icon: Stethoscope },
  { id: 'files', label: 'Archivos', icon: Folder },
];

/**
 * Ficha del paciente. Hoja a pantalla casi completa en móvil, diálogo ancho en
 * escritorio, con la historia clínica y los archivos como pestañas dentro del
 * mismo contenedor (antes el panel clínico heredaba el ancho de un diálogo
 * pensado para un formulario y las notas SOAP salían en una columna de 300px).
 */
export default function PatientDetailModal({ patient, open, onClose, onEdit, onDelete }) {
  const [tab, setTab] = useState('data');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();

  if (!patient) return null;

  const name = patient.full_name || patient.name;
  const balance = Number(patient.balance_due || 0);
  const waLink = patient.phone ? `https://wa.me/${String(patient.phone).replace(/\D/g, '')}` : null;

  const remove = async () => {
    const r = await onDelete(patient.id);
    if (r?.error) { toast.error(userFriendlyError(r.error)); return; }
    toast.success('Paciente eliminado');
    setConfirmDelete(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={() => { setTab('data'); setConfirmDelete(false); onClose(); }}
      size="xl"
      title={name}
      subtitle={[patient.city, patient.treatment].filter(Boolean).join(' · ') || 'Sin tratamiento asignado'}
    >
      <div className="flex items-center gap-2 flex-wrap pb-4">
        <Badge status={patient.status} />
        {patient.vip && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-tertiary-container text-on-tertiary-container">VIP</span>}
        {balance > 0 && (
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[#f6ddd3] text-[#a03a22] tnum">
            Debe {formatCOP(balance)}
          </span>
        )}
        {patient.needs_review && (
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[#f6e7db] text-[#a85b32]">Dato por verificar</span>
        )}
      </div>

      {patient.medical_alerts && (
        <p className="flex items-start gap-2 text-[12.5px] text-[#a03a22] bg-[#f6ddd3]/60 border border-danger/20 rounded-xl px-3.5 py-2.5 mb-4">
          <ShieldAlert size={15} className="flex-shrink-0 mt-px" />
          <span><strong className="font-semibold">Alerta médica:</strong> {patient.medical_alerts}</span>
        </p>
      )}

      <UnderlineTabs tabs={TABS} value={tab} onChange={setTab} className="mb-4" />

      {tab === 'clinical' && <ClinicalHistoryPanel patient={{ id: patient.id, full_name: name, name }} />}
      {tab === 'files' && <ClinicalFilesPanel patient={{ id: patient.id, full_name: name, name }} />}

      {tab === 'data' && (
        <div className="space-y-4 pb-2">
          {/* Métricas del paciente */}
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { icon: CalendarDays, v: patient.appointments_count ?? patient.appointmentsCount ?? 0, k: 'Citas' },
              {
                icon: Wallet,
                v: Number(patient.total_spent ?? patient.totalSpent ?? 0) > 0
                  ? formatCOP(patient.total_spent ?? patient.totalSpent)
                  : '—',
                k: 'Facturado',
              },
              { icon: CalendarDays, v: formatShortDate(patient.last_visit || patient.lastVisit), k: 'Última visita' },
            ].map((m) => (
              <div key={m.k} className="bg-surface-container-low border border-outline-variant/60 rounded-xl p-3 text-center min-w-0">
                <m.icon size={15} className="mx-auto text-primary-light mb-1.5" />
                <p className="font-display text-[15px] font-semibold text-on-surface tnum truncate">{m.v}</p>
                <p className="text-[10px] text-on-surface-variant mt-0.5">{m.k}</p>
              </div>
            ))}
          </div>

          {/* Contacto */}
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { icon: Phone, v: patient.phone, href: patient.phone ? `tel:${patient.phone}` : null },
              { icon: Mail, v: patient.email, href: patient.email ? `mailto:${patient.email}` : null },
              { icon: MapPin, v: [patient.address, patient.city].filter(Boolean).join(', '), span: true },
            ].map((c, i) => (
              <div key={i} className={c.span ? 'sm:col-span-2' : ''}>
                {c.href ? (
                  <a href={c.href} className="flex items-center gap-2.5 text-sm text-on-surface bg-surface-container-low rounded-xl px-3.5 py-2.5 hover:bg-surface-container transition-colors">
                    <c.icon size={14} className="text-on-surface-variant flex-shrink-0" />
                    <span className="truncate">{c.v}</span>
                  </a>
                ) : (
                  <div className="flex items-center gap-2.5 text-sm text-on-surface-variant bg-surface-container-low rounded-xl px-3.5 py-2.5">
                    <c.icon size={14} className="flex-shrink-0" />
                    <span className="truncate">{c.v || '—'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {patient.notes && (
            <div className="bg-surface-container-low rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Notas del doctor</p>
              <p className="text-sm text-on-surface whitespace-pre-wrap">{patient.notes}</p>
            </div>
          )}

          {/* Acciones */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button icon={Edit2} onClick={onEdit} className="flex-1 min-w-[140px]">Editar</Button>
            {waLink ? (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#e0efe8] text-[#1f6b52] hover:bg-[#d2e7dd] transition-colors"
              >
                <MessageCircle size={16} /> WhatsApp
              </a>
            ) : (
              <span className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-surface-container-high text-on-surface-variant">
                <Phone size={16} /> Sin teléfono
              </span>
            )}
            {balance > 0 && (
              <PaymentLinkButton
                amount={balance}
                description={`Saldo pendiente — ${name}`}
                patientId={patient.id}
                customerName={name}
                customerPhone={patient.phone}
                customerEmail={patient.email}
                label={`Cobrar ${formatCOP(balance)}`}
                className="!flex-1 !min-w-[140px] !justify-center !px-4 !py-2.5 !text-sm !font-semibold !rounded-xl"
              />
            )}
          </div>

          {confirmDelete ? (
            <div className="bg-[#f6ddd3]/60 border border-danger/20 rounded-xl p-3.5 text-center">
              <p className="text-sm text-danger font-semibold mb-3">
                ¿Eliminar a {name}? Se borra también su historia clínica.
              </p>
              <div className="flex gap-2">
                <Button variant="danger" className="flex-1" onClick={remove}>Sí, eliminar</Button>
                <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full flex items-center justify-center gap-1.5 text-danger/70 hover:text-danger text-xs font-semibold py-2 transition-colors"
            >
              <Trash2 size={13} /> Eliminar paciente
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
