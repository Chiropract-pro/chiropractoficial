import { useState } from 'react';
import { getAppointmentTypes, formatCOP } from '../../utils/format';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../Toast';
import { userFriendlyError } from '../../lib/logger';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Field, FormGrid, Input, Select, Textarea } from '../ui/Field';
import { todayStr } from '../../utils/dates';

const LOCATIONS = [
  { value: 'consultorio', label: 'Consultorio' },
  { value: 'soata', label: 'Soatá' },
  { value: 'guamal', label: 'Guamal' },
  { value: 'muzo', label: 'Muzo' },
  { value: 'garces_navas', label: 'Garcés Navas' },
];

/**
 * Formulario de agendamiento. Hoja inferior en móvil, diálogo en escritorio.
 * El precio se muestra en vivo al elegir el tipo: antes se agendaba a ciegas y
 * la tarifa solo aparecía después, en la lista.
 */
export default function NewAppointmentModal({ open, onClose, patients, onCreate, defaultDate }) {
  const toast = useToast();
  const { tenant } = useAuth();
  const [type, setType] = useState('primera_consulta');
  const [saving, setSaving] = useState(false);

  // Tarifas del consultorio (Ajustes → Tarifas), no las constantes del código.
  const appointmentTypes = getAppointmentTypes(tenant);
  const price = appointmentTypes.find((t) => t.value === type)?.price || 0;

  const submit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const patientId = form.patient_id.value;
    const patient = patients.find((p) => p.id === patientId);
    setSaving(true);
    const r = await onCreate({
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
    setSaving(false);
    if (r.error) { toast.error(userFriendlyError(r.error)); return; }
    toast.success('Cita creada');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Agendar cita"
      subtitle={`${patients.length} pacientes en el directorio`}
      footer={
        <div className="flex gap-2.5">
          <Button variant="outline" className="flex-1" onClick={onClose} type="button">Cancelar</Button>
          <Button className="flex-[2]" type="submit" form="new-appointment" loading={saving}>
            Agendar · {formatCOP(price)}
          </Button>
        </div>
      }
    >
      <form id="new-appointment" onSubmit={submit} className="space-y-4 pb-2">
        <Field label="Paciente" required>
          <Select name="patient_id" required defaultValue="">
            <option value="" disabled>Seleccionar paciente…</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name}{p.phone ? ` · ${p.phone}` : ''}</option>
            ))}
          </Select>
        </Field>

        <FormGrid>
          <Field label="Fecha" required>
            <Input name="date" type="date" required defaultValue={defaultDate || todayStr()} />
          </Field>
          <Field label="Hora" required>
            <Input name="time" type="time" required defaultValue="09:00" />
          </Field>
          <Field label="Tipo de cita">
            <Select name="type" value={type} onChange={(e) => setType(e.target.value)}>
              {appointmentTypes.map((t) => (
                <option key={t.value} value={t.value}>{t.label} — {formatCOP(t.price)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Ubicación">
            <Select name="location" defaultValue="consultorio">
              {LOCATIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </Select>
          </Field>
        </FormGrid>

        <Field label="Notas" hint="Motivo de consulta, indicaciones previas, quién refirió…">
          <Textarea name="notes" rows={2} placeholder="Opcional" />
        </Field>
      </form>
    </Modal>
  );
}
