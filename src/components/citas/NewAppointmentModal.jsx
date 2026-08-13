import { useState } from 'react';
import { getAppointmentTypes, formatCOP } from '../../utils/format';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../Toast';
import { userFriendlyError } from '../../lib/logger';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Field, FormGrid, Input, Select, Textarea } from '../ui/Field';
import PlaceInput from '../ui/PlaceInput';
import { todayStr } from '../../utils/dates';

// Sugerencias de arranque. No es una lista cerrada: el lugar se escribe libre
// y lo que ya se haya usado antes aparece como sugerencia.
const LUGARES_SUGERIDOS = ['Consultorio', 'Soatá', 'Guamal', 'Muzo', 'Garcés Navas'];

/**
 * Formulario de agendamiento. Hoja inferior en móvil, diálogo en escritorio.
 * El precio se muestra en vivo al elegir el tipo: antes se agendaba a ciegas y
 * la tarifa solo aparecía después, en la lista.
 */
export default function NewAppointmentModal({ open, onClose, patients, onCreate, defaultDate, appointments = [], pacienteFijo = null }) {
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
      location: form.location.value.trim() || 'Consultorio',
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
      subtitle={pacienteFijo ? 'Para este paciente' : `${patients.length} pacientes en el directorio`}
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
        {/* Si se entró desde la ficha de un paciente, no se vuelve a pedir
            quién es: ya se sabe, y una lista de 1.427 nombres para reelegir al
            mismo es una forma de equivocarse. */}
        {pacienteFijo ? (
          <Field label="Paciente">
            <input type="hidden" name="patient_id" value={pacienteFijo.id} />
            <p className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-sm text-on-surface">
              {pacienteFijo.full_name}
              {pacienteFijo.phone && <span className="text-on-surface-variant"> · {pacienteFijo.phone}</span>}
            </p>
          </Field>
        ) : (
          <Field label="Paciente" required>
            <Select name="patient_id" required defaultValue="">
              <option value="" disabled>Seleccionar paciente…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}{p.phone ? ` · ${p.phone}` : ''}</option>
              ))}
            </Select>
          </Field>
        )}

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
          <Field label="Lugar" hint="Cualquiera: consultorio, municipio, salón…">
            <PlaceInput
              name="location"
              defaultValue="Consultorio"
              placeholder="Consultorio"
              options={[...LUGARES_SUGERIDOS, ...appointments.map((a) => a.location)]}
            />
          </Field>
        </FormGrid>

        <Field label="Notas" hint="Motivo de consulta, indicaciones previas, quién refirió…">
          <Textarea name="notes" rows={2} placeholder="Opcional" />
        </Field>
      </form>
    </Modal>
  );
}
