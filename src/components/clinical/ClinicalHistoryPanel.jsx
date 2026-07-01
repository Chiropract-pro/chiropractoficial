import { useState } from 'react';
import {
  Activity, Calendar, ChevronDown, ChevronRight, Edit2, FileText,
  Loader2, Plus, Stethoscope, Trash2,
} from 'lucide-react';
import { useClinicalRecords } from '../../hooks/useClinicalRecords';
import SoapEditorModal from './SoapEditorModal';
import { useToast } from '../Toast';
import { userFriendlyError } from '../../lib/logger';

const PAIN_TYPE_LABEL = {
  agudo: 'Agudo',
  sordo: 'Sordo',
  irradiado: 'Irradiado',
  punzante: 'Punzante',
  ardiente: 'Ardiente',
};

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Panel de historial clínico para un paciente.
 * Lista los records SOAP y permite crear/editar.
 */
export default function ClinicalHistoryPanel({ patient }) {
  const { records, loading, archive } = useClinicalRecords(patient?.id);
  const toast = useToast();
  const [editing, setEditing] = useState(null); // null | 'new' | recordObject
  const [expandedId, setExpandedId] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(null);

  const handleArchive = async (id) => {
    try {
      await archive(id, 'Eliminado por doctor');
      toast.success('Nota archivada');
      setConfirmArchive(null);
    } catch (e) {
      toast.error(userFriendlyError(e));
    }
  };

  if (!patient) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-on-surface flex items-center gap-1.5">
            <FileText size={14} />
            Historial clínico
          </p>
          <p className="text-xs text-on-surface-variant">
            {records.length} {records.length === 1 ? 'nota' : 'notas'} SOAP
          </p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="bg-primary hover:bg-primary-light text-on-primary px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
        >
          <Plus size={14} />
          Nueva nota
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      )}

      {!loading && records.length === 0 && (
        <div className="bg-surface-container-low rounded-xl p-6 text-center">
          <Stethoscope size={28} className="mx-auto text-on-surface-variant mb-2" />
          <p className="text-sm text-on-surface-variant">Sin notas clínicas todavía.</p>
          <p className="text-xs text-on-surface-variant mt-1">
            Crea la primera para empezar el historial.
          </p>
        </div>
      )}

      {!loading && records.length > 0 && (
        <div className="space-y-2">
          {records.map((r) => {
            const expanded = expandedId === r.id;
            const painCount = (r.pain_points || []).length;
            const codes = (r.diagnosis_codes || []).filter(Boolean);

            return (
              <div key={r.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedId(expanded ? null : r.id)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-surface-container-low transition-colors"
                >
                  <Calendar size={14} className="text-on-surface-variant flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-on-surface">
                      {formatDate(r.created_at)}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-on-surface-variant">
                      {r.assessment && (
                        <span className="truncate max-w-[280px]">
                          {r.assessment.slice(0, 80)}{r.assessment.length > 80 ? '…' : ''}
                        </span>
                      )}
                      {painCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Activity size={10} />
                          {painCount} {painCount === 1 ? 'punto' : 'puntos'} de dolor
                        </span>
                      )}
                      {codes.length > 0 && (
                        <span className="font-mono">{codes.slice(0, 3).join(', ')}</span>
                      )}
                    </div>
                  </div>
                  {expanded
                    ? <ChevronDown size={16} className="text-on-surface-variant flex-shrink-0" />
                    : <ChevronRight size={16} className="text-on-surface-variant flex-shrink-0" />}
                </button>

                {expanded && (
                  <div className="border-t border-outline-variant p-4 space-y-3 bg-surface-container-low/40">
                    {/* SOAP */}
                    <SoapView record={r} />

                    {/* Vitales */}
                    {(r.weight_kg || r.height_cm || r.blood_pressure_systolic || r.heart_rate) && (
                      <div className="bg-surface-container-lowest rounded-lg p-3">
                        <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide mb-1">
                          Signos vitales
                        </p>
                        <div className="flex flex-wrap gap-3 text-xs">
                          {r.weight_kg && <span><b>Peso:</b> {r.weight_kg} kg</span>}
                          {r.height_cm && <span><b>Talla:</b> {r.height_cm} cm</span>}
                          {r.blood_pressure_systolic && r.blood_pressure_diastolic && (
                            <span><b>TA:</b> {r.blood_pressure_systolic}/{r.blood_pressure_diastolic}</span>
                          )}
                          {r.heart_rate && <span><b>FC:</b> {r.heart_rate} lpm</span>}
                        </div>
                      </div>
                    )}

                    {/* Pain points */}
                    {painCount > 0 && (
                      <div className="bg-surface-container-lowest rounded-lg p-3">
                        <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide mb-1">
                          Diagrama de dolor
                        </p>
                        <ul className="text-xs space-y-0.5">
                          {r.pain_points.map((p, i) => (
                            <li key={i}>
                              {i + 1}. {p.side === 'front' ? 'Anterior' : 'Posterior'} ·{' '}
                              {PAIN_TYPE_LABEL[p.type] || p.type} · {p.intensity}/10
                              {p.notes && <span className="text-on-surface-variant"> — {p.notes}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {codes.length > 0 && (
                      <div className="bg-surface-container-lowest rounded-lg p-3">
                        <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide mb-1">
                          Diagnóstico CIE-10
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {codes.map((c) => (
                            <span key={c} className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setEditing(r)}
                        className="flex items-center gap-1.5 text-xs text-primary hover:bg-primary/10 px-3 py-1.5 rounded font-medium"
                      >
                        <Edit2 size={12} /> Editar
                      </button>

                      {confirmArchive === r.id ? (
                        <div className="flex items-center gap-1 ml-auto">
                          <span className="text-xs text-on-surface-variant">¿Archivar?</span>
                          <button
                            onClick={() => handleArchive(r.id)}
                            className="text-xs bg-error text-on-error px-2 py-1 rounded font-bold"
                          >
                            Sí
                          </button>
                          <button
                            onClick={() => setConfirmArchive(null)}
                            className="text-xs text-on-surface-variant px-2 py-1"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmArchive(r.id)}
                          className="ml-auto flex items-center gap-1.5 text-xs text-error hover:bg-error-container/30 px-3 py-1.5 rounded font-medium"
                        >
                          <Trash2 size={12} /> Archivar
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <SoapEditorModal
        patient={patient}
        existingRecord={editing && editing !== 'new' ? editing : null}
        open={!!editing}
        onClose={() => setEditing(null)}
        onSaved={() => setEditing(null)}
      />
    </div>
  );
}

function SoapView({ record }) {
  const sections = [
    { letter: 'S', title: 'Subjetivo', value: record.subjective },
    { letter: 'O', title: 'Objetivo', value: record.objective },
    { letter: 'A', title: 'Análisis', value: record.assessment },
    { letter: 'P', title: 'Plan', value: record.plan },
  ];

  return (
    <div className="space-y-2">
      {sections.map((s) => (
        s.value ? (
          <div key={s.letter} className="bg-surface-container-lowest rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center text-[10px] font-bold">
                {s.letter}
              </span>
              <span className="text-[11px] font-semibold text-on-surface-variant uppercase">
                {s.title}
              </span>
            </div>
            <p className="text-xs text-on-surface whitespace-pre-wrap">{s.value}</p>
          </div>
        ) : null
      ))}
      {!sections.some((s) => s.value) && (
        <p className="text-xs text-on-surface-variant text-center py-2">
          Sin contenido SOAP.
        </p>
      )}
    </div>
  );
}
