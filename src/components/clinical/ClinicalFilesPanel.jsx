import { useEffect, useRef, useState } from 'react';
import {
  Camera, Download, Eye, FileText, FileImage, FilePlus,
  Folder, Loader2, Stethoscope, Trash2, Upload, X,
} from 'lucide-react';
import { useClinicalFiles } from '../../hooks/useClinicalFiles';
import { useToast } from '../Toast';
import { userFriendlyError } from '../../lib/logger';

const KIND_LABEL = {
  rx: 'Rayos X',
  lab: 'Laboratorio',
  photo: 'Foto clínica',
  document: 'Documento',
  consent: 'Consentimiento',
  other: 'Otro',
};

const KIND_OPTIONS = Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }));

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageMime(mime) {
  return mime?.startsWith('image/');
}

function fileIcon(mime, kind) {
  if (kind === 'rx') return Stethoscope;
  if (kind === 'photo' || isImageMime(mime)) return FileImage;
  return FileText;
}

/**
 * Panel de archivos clínicos de un paciente.
 */
export default function ClinicalFilesPanel({ patient, clinicalRecordId = null }) {
  const { files, loading, uploading, upload, archive, getSignedUrl } = useClinicalFiles(patient?.id);
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [meta, setMeta] = useState({ kind: 'document', description: '', taken_at: '' });
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(null);

  // Filtrar por record si se especifica
  const visibleFiles = clinicalRecordId
    ? files.filter((f) => f.clinical_record_id === clinicalRecordId)
    : files;

  useEffect(() => {
    if (!previewFile) { setPreviewUrl(null); return; }
    let cancelled = false;
    getSignedUrl(previewFile).then((url) => { if (!cancelled) setPreviewUrl(url); }).catch(() => {});
    return () => { cancelled = true; };
  }, [previewFile, getSignedUrl]);

  const handleFilePick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPendingFile(f);
    // Inferir kind del mime
    const inferredKind =
      f.type?.startsWith('image/') ? 'photo' :
      f.type === 'application/pdf' ? 'lab' : 'document';
    setMeta({ kind: inferredKind, description: '', taken_at: '' });
    setShowUploadForm(true);
    e.target.value = ''; // reset input para poder subir el mismo archivo de nuevo
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    try {
      await upload(pendingFile, {
        kind: meta.kind,
        description: meta.description.trim() || null,
        taken_at: meta.taken_at || null,
        clinical_record_id: clinicalRecordId,
      });
      toast.success('Archivo subido');
      setShowUploadForm(false);
      setPendingFile(null);
    } catch (e) {
      toast.error(userFriendlyError(e));
    }
  };

  const handleDownload = async (file) => {
    try {
      const url = await getSignedUrl(file);
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

  const handleArchive = async (id) => {
    try {
      await archive(id, 'Archivado por doctor');
      toast.success('Archivo archivado');
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
            <Folder size={14} />
            Archivos clínicos
          </p>
          <p className="text-xs text-on-surface-variant">
            {visibleFiles.length} archivo{visibleFiles.length === 1 ? '' : 's'}
            {clinicalRecordId && ' · adjuntos a esta nota'}
          </p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="bg-primary hover:bg-primary-light text-on-primary px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          Subir archivo
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFilePick}
          accept="image/*,application/pdf,.dcm,.doc,.docx"
          className="hidden"
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      )}

      {!loading && visibleFiles.length === 0 && (
        <div className="bg-surface-container-low rounded-xl p-6 text-center">
          <FilePlus size={28} className="mx-auto text-on-surface-variant mb-2" />
          <p className="text-sm text-on-surface-variant">Sin archivos todavía.</p>
          <p className="text-xs text-on-surface-variant mt-1">RX, exámenes, fotos clínicas o documentos.</p>
        </div>
      )}

      {!loading && visibleFiles.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {visibleFiles.map((f) => {
            const Icon = fileIcon(f.mime_type, f.kind);
            const canPreview = isImageMime(f.mime_type);
            return (
              <div key={f.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-3 flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-on-surface truncate" title={f.file_name}>{f.file_name}</p>
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-on-surface-variant">
                    <span className="font-semibold">{KIND_LABEL[f.kind] || f.kind}</span>
                    <span>·</span>
                    <span>{formatBytes(f.file_size)}</span>
                    {f.taken_at && (
                      <>
                        <span>·</span>
                        <span>Examen: {new Date(f.taken_at + 'T00:00').toLocaleDateString('es-CO')}</span>
                      </>
                    )}
                  </div>
                  {f.description && (
                    <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">{f.description}</p>
                  )}
                  <div className="flex items-center gap-1 mt-1.5">
                    {canPreview && (
                      <button
                        onClick={() => setPreviewFile(f)}
                        className="text-[11px] text-primary hover:bg-primary/10 px-2 py-0.5 rounded font-medium flex items-center gap-1"
                      >
                        <Eye size={11} /> Ver
                      </button>
                    )}
                    <button
                      onClick={() => handleDownload(f)}
                      className="text-[11px] text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low px-2 py-0.5 rounded font-medium flex items-center gap-1"
                    >
                      <Download size={11} /> Descargar
                    </button>
                    {confirmArchive === f.id ? (
                      <div className="flex items-center gap-1 ml-auto">
                        <button onClick={() => handleArchive(f.id)} className="text-[11px] bg-error text-on-error px-2 py-0.5 rounded font-bold">Archivar</button>
                        <button onClick={() => setConfirmArchive(null)} className="text-[11px] text-on-surface-variant px-2 py-0.5">No</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmArchive(f.id)}
                        className="ml-auto text-[11px] text-error/70 hover:text-error px-2 py-0.5 rounded"
                        title="Archivar"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de metadata previo a subir */}
      {showUploadForm && pendingFile && (
        <UploadMetaModal
          file={pendingFile}
          meta={meta}
          setMeta={setMeta}
          uploading={uploading}
          onConfirm={handleUpload}
          onCancel={() => { setShowUploadForm(false); setPendingFile(null); }}
        />
      )}

      {/* Lightbox preview */}
      {previewFile && (
        <div
          className="fixed inset-0 z-[9100] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setPreviewFile(null)}
        >
          <button
            onClick={() => setPreviewFile(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
          >
            <X size={24} />
          </button>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={previewFile.file_name}
              className="max-w-full max-h-full object-contain rounded shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <Loader2 size={32} className="animate-spin text-white" />
          )}
        </div>
      )}
    </div>
  );
}

function UploadMetaModal({ file, meta, setMeta, uploading, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[9100] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-surface-container-lowest w-full max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between">
          <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
            <Upload size={18} className="text-primary" />
            Subir archivo
          </h3>
          <button onClick={onCancel} disabled={uploading} className="text-on-surface-variant hover:text-on-surface p-1">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-surface-container-low rounded-lg p-3 text-sm">
            <p className="font-medium text-on-surface truncate">{file.name}</p>
            <p className="text-xs text-on-surface-variant">
              {formatBytes(file.size)} · {file.type || 'desconocido'}
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-1">
              Tipo
            </label>
            <select
              value={meta.kind}
              onChange={(e) => setMeta({ ...meta, kind: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-sm"
            >
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-1">
              Fecha del examen (opcional)
            </label>
            <input
              type="date"
              value={meta.taken_at}
              onChange={(e) => setMeta({ ...meta, taken_at: e.target.value })}
              max={new Date().toISOString().slice(0, 10)}
              className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-1">
              Descripción
            </label>
            <textarea
              value={meta.description}
              onChange={(e) => setMeta({ ...meta, description: e.target.value })}
              rows={2}
              maxLength={300}
              placeholder="Ej: RX columna lumbar AP/Lateral"
              className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-sm resize-none"
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-outline-variant flex justify-end gap-2 bg-surface-container-lowest">
          <button onClick={onCancel} disabled={uploading} className="px-4 py-2 border border-outline-variant text-on-surface-variant rounded-lg text-sm font-medium">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={uploading}
            className="px-4 py-2 clinical-gradient text-on-primary rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Subir
          </button>
        </div>
      </div>
    </div>
  );
}
