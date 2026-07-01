import { useEffect, useState } from 'react';
import {
  Activity, Calendar, ChevronDown, ChevronRight, Download, Eye,
  FileImage, FileText, Heart, Loader2, Ruler, Scale, Stethoscope,
} from 'lucide-react';
import { getClinicalHistory, getFileUrl } from '../../lib/patientApi';
import { usePatientAuth } from '../../contexts/PatientAuthContext';
import { useToast } from '../Toast';
import BodyDiagram from '../clinical/BodyDiagram';

const PAIN_TYPE_LABEL = {
  agudo: 'Agudo',
  sordo: 'Sordo',
  irradiado: 'Irradiado',
  punzante: 'Punzante',
  ardiente: 'Ardiente',
};

const KIND_LABEL = {
  rx: 'Rayos X',
  lab: 'Laboratorio',
  photo: 'Foto clínica',
  document: 'Documento',
  consent: 'Consentimiento',
  other: 'Otro',
};

function formatDateTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageMime(mime) {
  return mime?.startsWith('image/');
}

export default function PatientClinicalHistory() {
  const { session } = usePatientAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!session?.session_token) return;
    setLoading(true);
    getClinicalHistory(session.session_token)
      .then(setData)
      .catch((e) => toast.error(e.message || 'No pudimos cargar tu historial'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.session_token]);

  // Cuando se selecciona un archivo para previsualizar, pedir signed URL
  useEffect(() => {
    if (!previewFile || !session?.session_token) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    getFileUrl(session.session_token, previewFile.id)
      .then((res) => { if (!cancelled) setPreviewUrl(res.url); })
      .catch(() => toast.error('No se pudo cargar el archivo'));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewFile?.id, session?.session_token]);

  const handleDownload = async (file) => {
    try {
      const { url } = await getFileUrl(session.session_token, file.id);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      toast.error('No pudimos descargar el archivo');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  const records = data?.records || [];
  const orphanFiles = (data?.files || []).filter((f) => !f.clinical_record_id);

  return (
    <div className="space-y-4">
      {records.length === 0 && orphanFiles.length === 0 && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 text-center">
          <Stethoscope size={28} className="mx-auto text-on-surface-variant mb-2" />
          <p className="text-sm text-on-surface-variant">Tu historial clínico aún está vacío.</p>
          <p className="text-xs text-on-surface-variant mt-1">El doctor lo irá llenando con cada consulta.</p>
        </div>
      )}

      {records.map((r) => {
        const expanded = expandedId === r.id;
        const recordFiles = (data?.files || []).filter((f) => f.clinical_record_id === r.id);
        return (
          <div key={r.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedId(expanded ? null : r.id)}
              className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-surface-container-low transition-colors"
            >
              <Calendar size={14} className="text-on-surface-variant flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-on-surface">{formatDateTime(r.created_at)}</p>
                <p className="text-xs text-on-surface-variant flex flex-wrap gap-x-2 gap-y-0.5">
                  <span>Dr. {r.doctor_name?.replace(/^Dr\.?\s*/i, '')}</span>
                  {r.assessment && <span className="truncate max-w-[200px]">· {r.assessment.slice(0, 60)}{r.assessment.length > 60 ? '…' : ''}</span>}
                  {r.files_count > 0 && (
                    <span className="text-primary">· 📎 {r.files_count} archivo{r.files_count === 1 ? '' : 's'}</span>
                  )}
                </p>
              </div>
              {expanded
                ? <ChevronDown size={16} className="text-on-surface-variant flex-shrink-0" />
                : <ChevronRight size={16} className="text-on-surface-variant flex-shrink-0" />}
            </button>

            {expanded && (
              <div className="border-t border-outline-variant p-4 space-y-3 bg-surface-container-low/40">
                {/* SOAP simplificado para paciente */}
                <SoapSection letter="S" title="Síntomas" value={r.subjective} />
                <SoapSection letter="O" title="Hallazgos" value={r.objective} />
                <SoapSection letter="A" title="Diagnóstico" value={r.assessment} />
                <SoapSection letter="P" title="Plan de tratamiento" value={r.plan} />

                {/* Vitales */}
                {(r.weight_kg || r.height_cm || r.blood_pressure_systolic || r.heart_rate) && (
                  <div className="bg-surface-container-lowest rounded-lg p-3">
                    <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide mb-1.5">Signos vitales</p>
                    <div className="flex flex-wrap gap-3 text-xs">
                      {r.weight_kg && <span className="flex items-center gap-1"><Scale size={11} /> {r.weight_kg} kg</span>}
                      {r.height_cm && <span className="flex items-center gap-1"><Ruler size={11} /> {r.height_cm} cm</span>}
                      {r.blood_pressure_systolic && r.blood_pressure_diastolic && (
                        <span><b>TA:</b> {r.blood_pressure_systolic}/{r.blood_pressure_diastolic}</span>
                      )}
                      {r.heart_rate && <span className="flex items-center gap-1"><Heart size={11} /> {r.heart_rate} lpm</span>}
                    </div>
                  </div>
                )}

                {/* Diagrama de dolor */}
                {r.pain_points && r.pain_points.length > 0 && (
                  <div className="bg-surface-container-lowest rounded-lg p-3">
                    <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide mb-2 flex items-center gap-1">
                      <Activity size={10} /> Diagrama de dolor
                    </p>
                    <BodyDiagram value={r.pain_points} onChange={() => {}} readOnly />
                  </div>
                )}

                {/* Diagnósticos CIE-10 */}
                {r.diagnosis_codes && r.diagnosis_codes.filter(Boolean).length > 0 && (
                  <div className="bg-surface-container-lowest rounded-lg p-3">
                    <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide mb-1">Códigos diagnósticos</p>
                    <div className="flex flex-wrap gap-1">
                      {r.diagnosis_codes.filter(Boolean).map((c) => (
                        <span key={c} className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">{c}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Archivos del record */}
                {recordFiles.length > 0 && (
                  <div className="bg-surface-container-lowest rounded-lg p-3 space-y-1.5">
                    <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide">Archivos adjuntos</p>
                    {recordFiles.map((f) => (
                      <FileRow
                        key={f.id}
                        file={f}
                        onPreview={() => setPreviewFile(f)}
                        onDownload={() => handleDownload(f)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Archivos sueltos (sin record asociado) */}
      {orphanFiles.length > 0 && (
        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
            Otros archivos
          </p>
          {orphanFiles.map((f) => (
            <FileRow
              key={f.id}
              file={f}
              onPreview={() => setPreviewFile(f)}
              onDownload={() => handleDownload(f)}
            />
          ))}
        </section>
      )}

      {/* Lightbox preview */}
      {previewFile && (
        <div
          className="fixed inset-0 z-[9100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewFile(null)}
        >
          {previewUrl && isImageMime(previewFile.mime_type) ? (
            <img
              src={previewUrl}
              alt={previewFile.file_name}
              className="max-w-full max-h-full object-contain rounded shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          ) : previewUrl ? (
            <div className="bg-white rounded-xl p-6 max-w-md text-center" onClick={(e) => e.stopPropagation()}>
              <FileText size={32} className="mx-auto text-primary mb-2" />
              <p className="font-semibold mb-1">{previewFile.file_name}</p>
              <p className="text-xs text-gray-500 mb-4">No se puede previsualizar este tipo de archivo</p>
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-bold"
              >
                Abrir en otra pestaña
              </a>
            </div>
          ) : (
            <Loader2 size={32} className="animate-spin text-white" />
          )}
        </div>
      )}
    </div>
  );
}

function SoapSection({ letter, title, value }) {
  if (!value) return null;
  return (
    <div className="bg-surface-container-lowest rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center text-[10px] font-bold">
          {letter}
        </span>
        <span className="text-[10px] font-semibold text-on-surface-variant uppercase">{title}</span>
      </div>
      <p className="text-xs text-on-surface whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function FileRow({ file, onPreview, onDownload }) {
  const Icon = isImageMime(file.mime_type) ? FileImage : FileText;
  const canPreview = isImageMime(file.mime_type);

  return (
    <div className="flex items-center gap-2 text-xs bg-surface-container-low rounded-lg p-2">
      <Icon size={14} className="text-primary flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-on-surface font-medium truncate">{file.file_name}</p>
        <p className="text-[10px] text-on-surface-variant">
          {KIND_LABEL[file.kind] || file.kind} · {formatBytes(file.file_size)}
          {file.taken_at && ` · ${new Date(file.taken_at + 'T00:00').toLocaleDateString('es-CO')}`}
        </p>
      </div>
      {canPreview && (
        <button
          onClick={onPreview}
          className="text-primary hover:bg-primary/10 p-1.5 rounded"
          title="Ver"
        >
          <Eye size={12} />
        </button>
      )}
      <button
        onClick={onDownload}
        className="text-on-surface-variant hover:text-on-surface hover:bg-surface-container p-1.5 rounded"
        title="Descargar"
      >
        <Download size={12} />
      </button>
    </div>
  );
}
