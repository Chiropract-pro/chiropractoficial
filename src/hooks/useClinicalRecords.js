import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../lib/logger';

/**
 * Hook para gestionar registros clínicos de un paciente.
 *
 * @param {string} patientId - id del paciente (puede ser null para "todos los del tenant")
 */
export function useClinicalRecords(patientId) {
  const { tenant } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      let query = supabase
        .from('clinical_records')
        .select('*')
        .eq('tenant_id', tenant.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false });

      if (patientId) query = query.eq('patient_id', patientId);

      const { data, error } = await query;
      if (error) throw error;
      setRecords(data || []);
    } catch (e) {
      logger.error('clinical_records load', e);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, patientId]);

  useEffect(() => { reload(); }, [reload]);

  const upsert = async (record) => {
    const { data, error } = await supabase.rpc('clinical_record_upsert', {
      p_record_id: record.id || null,
      p_tenant_id: tenant?.id,
      p_patient_id: record.patient_id,
      p_appointment_id: record.appointment_id || null,
      p_subjective: record.subjective ?? null,
      p_objective: record.objective ?? null,
      p_assessment: record.assessment ?? null,
      p_plan: record.plan ?? null,
      p_weight_kg: record.weight_kg ?? null,
      p_height_cm: record.height_cm ?? null,
      p_bp_systolic: record.blood_pressure_systolic ?? null,
      p_bp_diastolic: record.blood_pressure_diastolic ?? null,
      p_heart_rate: record.heart_rate ?? null,
      p_pain_points: record.pain_points || [],
      p_diagnosis_codes: record.diagnosis_codes || [],
    });
    if (error) throw error;
    await reload();
    return data;
  };

  const archive = async (recordId, reason) => {
    const { error } = await supabase.rpc('clinical_record_archive', {
      p_record_id: recordId,
      p_reason: reason || null,
    });
    if (error) throw error;
    await reload();
  };

  return { records, loading, reload, upsert, archive };
}

/**
 * Hook para obtener un único record por id (o por appointment_id).
 */
export function useClinicalRecord({ id, appointmentId }) {
  const { tenant } = useAuth();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant?.id || (!id && !appointmentId)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let query = supabase
      .from('clinical_records')
      .select('*')
      .eq('tenant_id', tenant.id)
      .is('archived_at', null)
      .limit(1);

    if (id) query = query.eq('id', id);
    else if (appointmentId) query = query.eq('appointment_id', appointmentId);

    query.maybeSingle().then(({ data, error }) => {
      if (error) logger.error('useClinicalRecord', error);
      setRecord(data || null);
      setLoading(false);
    });
  }, [tenant?.id, id, appointmentId]);

  return { record, loading };
}
