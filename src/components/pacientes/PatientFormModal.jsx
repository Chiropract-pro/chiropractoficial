import { useState } from 'react';
import { patientStatuses, cities } from '../../utils/format';
import { useToast } from '../Toast';
import { userFriendlyError } from '../../lib/logger';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Field, FormGrid, Input, Select, Textarea } from '../ui/Field';

const ID_TYPES = [
  { value: '', label: '—' },
  { value: 'CC', label: 'CC' },
  { value: 'CE', label: 'CE' },
  { value: 'TI', label: 'TI' },
  { value: 'NIT', label: 'NIT' },
  { value: 'PA', label: 'Pasaporte' },
];

/**
 * Alta y edición de paciente en un solo formulario — antes eran dos bloques
 * de 80 líneas casi idénticos, y cualquier campo nuevo había que añadirlo dos
 * veces (que es justo como `id_number` terminó faltando en uno de los dos).
 */
export default function PatientFormModal({ open, onClose, patient, onSave }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const editing = Boolean(patient);

  const submit = async (e) => {
    e.preventDefault();
    const f = e.target;
    setSaving(true);
    const r = await onSave({
      full_name: f.full_name.value,
      phone: f.phone.value || null,
      email: f.email.value || null,
      address: f.address.value || null,
      city: f.city.value,
      status: f.status.value,
      treatment: f.treatment.value || null,
      notes: f.notes.value || null,
      id_type: f.id_type.value || null,
      id_number: f.id_number.value?.replace(/\D/g, '') || null,
    });
    setSaving(false);
    if (r?.error) { toast.error(userFriendlyError(r.error)); return; }
    toast.success(editing ? 'Paciente actualizado' : 'Paciente creado');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? 'Editar paciente' : 'Nuevo paciente'}
      subtitle={editing ? patient.full_name || patient.name : 'Los datos de identificación permiten facturar a la DIAN'}
      footer={
        <div className="flex gap-2.5">
          <Button variant="outline" className="flex-1" type="button" onClick={onClose}>Cancelar</Button>
          <Button className="flex-[2]" type="submit" form="patient-form" loading={saving}>
            {editing ? 'Guardar cambios' : 'Crear paciente'}
          </Button>
        </div>
      }
    >
      <form id="patient-form" onSubmit={submit} className="space-y-4 pb-2">
        <FormGrid>
          <Field label="Nombre completo" required span={2}>
            <Input name="full_name" required defaultValue={patient?.full_name || patient?.name || ''} placeholder="Nombre y apellidos" />
          </Field>
          <Field label="Tipo de documento">
            <Select name="id_type" defaultValue={patient?.id_type || ''}>
              {ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="N° identificación" hint="Necesario para emitir factura electrónica">
            <Input name="id_number" inputMode="numeric" defaultValue={patient?.id_number || ''} placeholder="1234567890" />
          </Field>
          <Field label="Teléfono" hint="Con este número entra a su portal">
            <Input name="phone" type="tel" inputMode="tel" defaultValue={patient?.phone || ''} placeholder="311 234 5678" />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" defaultValue={patient?.email || ''} placeholder="correo@ejemplo.com" />
          </Field>
          <Field label="Dirección" span={2}>
            <Input name="address" defaultValue={patient?.address || ''} placeholder="Dirección completa" />
          </Field>
          <Field label="Ciudad">
            <Select name="city" defaultValue={patient?.city || cities[0]}>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Estado">
            <Select name="status" defaultValue={patient?.status || 'activo'}>
              {patientStatuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Tratamiento" span={2}>
            <Input name="treatment" defaultValue={patient?.treatment || ''} placeholder="Ej: ajuste lumbar, plan de 8 sesiones" />
          </Field>
          <Field label="Notas del doctor" span={2}>
            <Textarea name="notes" rows={3} defaultValue={patient?.notes || ''} placeholder="Antecedentes, observaciones…" />
          </Field>
        </FormGrid>
      </form>
    </Modal>
  );
}
