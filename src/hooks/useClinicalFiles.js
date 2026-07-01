import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../lib/logger';

const BUCKET = 'clinical-files';
const SIGNED_URL_TTL = 60 * 60; // 1 hora

function inferKind(mimeType) {
  if (!mimeType) return 'document';
  if (mimeType.startsWith('image/')) return 'photo';
  if (mimeType === 'application/dicom') return 'rx';
  if (mimeType === 'application/pdf') return 'lab';
  return 'document';
}

function sanitizeFileName(name) {
  // Remove path traversal attempts; keep readable name
  return String(name || 'file').replace(/[^\w.\-]/g, '_').slice(0, 120);
}

/**
 * Hook para listar/subir/archivar archivos clínicos de un paciente.
 */
export function useClinicalFiles(patientId) {
  const { tenant } = useAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const reload = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      let query = supabase
        .from('clinical_files')
        .select('*')
        .eq('tenant_id', tenant.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false });

      if (patientId) query = query.eq('patient_id', patientId);

      const { data, error } = await query;
      if (error) throw error;
      setFiles(data || []);
    } catch (e) {
      logger.error('clinical_files load', e);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, patientId]);

  useEffect(() => { reload(); }, [reload]);

  /**
   * Sube un File a Storage y registra metadata.
   * @param {File} file
   * @param {{ kind?, description?, taken_at?, clinical_record_id? }} meta
   */
  const upload = async (file, meta = {}) => {
    if (!tenant?.id || !patientId) throw new Error('Falta tenant o paciente');
    if (!file) throw new Error('Falta archivo');
    if (file.size > 50 * 1024 * 1024) throw new Error('El archivo no puede pesar más de 50 MB');

    setUploading(true);
    try {
      const fileId = crypto.randomUUID();
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase().slice(0, 10);
      const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'bin';
      const storagePath = `${tenant.id}/${patientId}/${fileId}.${safeExt}`;

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'application/octet-stream',
        });

      if (uploadErr) throw uploadErr;

      const { data, error } = await supabase.rpc('clinical_file_register', {
        p_tenant_id: tenant.id,
        p_patient_id: patientId,
        p_storage_path: storagePath,
        p_file_name: sanitizeFileName(file.name),
        p_file_size: file.size,
        p_mime_type: file.type || 'application/octet-stream',
        p_kind: meta.kind || inferKind(file.type),
        p_description: meta.description || null,
        p_taken_at: meta.taken_at || null,
        p_clinical_record_id: meta.clinical_record_id || null,
      });

      if (error) {
        // rollback storage si falla el registro
        await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
        throw error;
      }

      await reload();
      return data;
    } finally {
      setUploading(false);
    }
  };

  const archive = async (fileId, reason) => {
    const { error } = await supabase.rpc('clinical_file_archive', {
      p_file_id: fileId,
      p_reason: reason || null,
    });
    if (error) throw error;
    await reload();
  };

  /**
   * Genera una signed URL temporal (1 hora) para visualizar/descargar.
   */
  const getSignedUrl = async (file) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(file.storage_path, SIGNED_URL_TTL);
    if (error) throw error;
    return data?.signedUrl;
  };

  return { files, loading, uploading, reload, upload, archive, getSignedUrl };
}
