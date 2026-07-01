import { useEffect, useState } from 'react';
import { Activity, Heart, Loader2, Ruler, Save, Scale, Stethoscope, X } from 'lucide-react';
import BodyDiagram from './BodyDiagram';
import { useClinicalRecords } from '../../hooks/useClinicalRecords';
import { useToast } from '../Toast';
import { userFriendlyError } from '../../lib/logger';

const EMPTY = {
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
  weight_kg: '',
  height_cm: '',
  blood_pressure_systolic: '',
  blood_pressure_diastolic: '',
  heart_rate: '',
  pain_points: [],
  diagnosis_codes: '',
};

/**
 * Modal de edición SOAP. Crea o actualiza un clinical_record.
 *
 * Props:
 *   - patient: paciente al que pertenece
 *   - appointment: cita opcional para vincular (1-1)
 *   - existingRecord: si se pasa, modo edición
 *   - open / onClose / onSaved
 */
export default function SoapEditorModal({ patient, appointment, existingRecord, open, onClose, onSaved }) {
  const { upsert } = useClinicalRecords(patient?.id);
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existingRecord) {
      setForm({
        ...EMPTY,
        ...existingRecord,
        diagnosis_codes: (existingRecord.diagnosis_codes || []).join(', '),
        weight_kg: existingRecord.weight_kg ?? '',
        height_cm: existingRecord.height_cm ?? '',
        blood_pressure_systolic: existingRecord.blood_pressure_systolic ?? '',
        blood_pressure_diastolic: existingRecord.blood_pressure_diastolic ?? '',
        heart_rate: existingRecord.heart_rate ?? '',
        pain_points: existingRecord.pain_points || [],
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, existingRecord]);

  // Block scroll behind modal
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onEsc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onEsc);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onEsc);
    };
  }, [open, onClose]);

  if (!open || !patient) return null;

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const codes = String(form.diagnosis_codes || '')
        .split(/[,\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

      await upsert({
        id: existingRecord?.id,
        patient_id: patient.id,
        appointment_id: appointment?.id || existingRecord?.appointment_id || null,
        subjective: form.subjective.trim() || null,
        objective: form.objective.trim() || null,
        assessment: form.assessment.trim() || null,
        plan: form.plan.trim() || null,
        weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
        height_cm: form.height_cm ? parseInt(form.height_cm) : null,
        blood_pressure_systolic: form.blood_pressure_systolic ? parseInt(form.blood_pressure_systolic) : null,
        blood_pressure_diastolic: form.blood_pressure_diastolic ? parseInt(form.blood_pressure_diastolic) : null,
        heart_rate: form.heart_rate ? parseInt(form.heart_rate) : null,
        pain_points: form.pain_points,
        diagnosis_codes: codes,
      });

      toast.success(existingRecord ? 'Nota actualizada' : 'Nota guardada');
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error(userFriendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9000] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-surface-container-lowest w-full max-w-3xl sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[95vh] flex flex-col">
        <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
              <Stethoscope size={20} className="text-primary" />
              Nota clínica SOAP
            </h3>
            <p className="text-xs text-on-surface-variant">
              {patient.full_name || patient.name}
              {appointment && ` · ${appointment.date} ${appointment.time}`}
            </p>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface p-1">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Signos vitales */}
          <div>
            <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Activity size={12} /> Signos vitales (opcional)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <VitalInput icon={Scale} label="Peso (kg)" value={form.weight_kg} onChange={(v) => update('weight_kg', v)} />
              <VitalInput icon={Ruler} label="Talla (cm)" value={form.height_cm} onChange={(v) => update('height_cm', v)} />
              <VitalInput label="TA sis" value={form.blood_pressure_systolic} onChange={(v) => update('blood_pressure_systolic', v)} />
              <VitalInput label="TA dia" value={form.blood_pressure_diastolic} onChange={(v) => update('blood_pressure_diastolic', v)} />
              <VitalInput icon={Heart} label="FC" value={form.heart_rate} onChange={(v) => update('heart_rate', v)} />
            </div>
          </div>

          {/* SOAP */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SoapField
              letter="S"
              title="Subjetivo"
              hint="Lo que reporta el paciente: motivo, síntomas, dolor, antecedentes."
              value={form.subjective}
              onChange={(v) => update('subjective', v)}
            />
            <SoapField
              letter="O"
              title="Objetivo"
              hint="Hallazgos del examen: palpación, ROM, postura, tests ortopédicos."
              value={form.objective}
              onChange={(v) => update('objective', v)}
            />
            <SoapField
              letter="A"
              title="Análisis / Diagnóstico"
              hint="Tu evaluación clínica."
              value={form.assessment}
              onChange={(v) => update('assessment', v)}
            />
            <SoapField
              letter="P"
              title="Plan"
              hint="Tratamiento, ajustes, ejercicios, próxima cita."
              value={form.plan}
              onChange={(v) => update('plan', v)}
            />
          </div>

          {/* Diagrama corporal */}
          <div>
            <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-2">
              Diagrama de dolor
            </h4>
            <BodyDiagram value={form.pain_points} onChange={(v) => update('pain_points', v)} />
          </div>

          {/* Diagnóstico CIE-10 */}
          <div>
            <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-1">
              Códigos CIE-10 (separados por coma)
            </label>
            <input
              type="text"
              value={form.diagnosis_codes}
              onChange={(e) => update('diagnosis_codes', e.target.value)}
              placeholder="Ej: M54.5, M62.83"
              className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-outline-variant flex justify-end gap-2 flex-shrink-0 bg-surface-container-lowest">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 border border-outline-variant text-on-surface-variant rounded-lg text-sm font-medium hover:bg-surface-container-low"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 clinical-gradient text-on-primary rounded-lg text-sm font-bold flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {existingRecord ? 'Actualizar' : 'Guardar nota'}
          </button>
        </div>
      </div>
    </div>
  );
}

function VitalInput({ icon: Icon, label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-[10px] text-on-surface-variant flex items-center gap-1 mb-0.5">
        {Icon && <Icon size={10} />}
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 rounded border border-outline-variant bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </label>
  );
}

function SoapField({ letter, title, hint, value, onChange }) {
  return (
    <div className="bg-surface-container-low rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center text-sm font-bold">
          {letter}
        </span>
        <h4 className="text-sm font-bold text-on-surface">{title}</h4>
      </div>
      <p className="text-[11px] text-on-surface-variant mb-1.5 leading-tight">{hint}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none"
      />
    </div>
  );
}
