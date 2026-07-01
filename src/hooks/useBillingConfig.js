import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../lib/logger';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Hook para gestionar la config de facturación electrónica del tenant.
 */
export function useBillingConfig() {
  const { tenant } = useAuth();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tenant_billing_config')
        .select('*')
        .eq('tenant_id', tenant.id)
        .maybeSingle();
      if (error) throw error;
      setConfig(data);
    } catch (e) {
      logger.error('billing config load', e);
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => { reload(); }, [reload]);

  const save = async (form) => {
    const { data, error } = await supabase.rpc('tenant_billing_config_upsert', {
      p_tenant_id: tenant.id,
      p_provider: form.provider || 'alegra',
      p_api_email: form.api_email || null,
      p_api_token: form.api_token || null,
      p_resolution_id: form.resolution_id || null,
      p_test_mode: form.test_mode ?? true,
      p_business_name: form.business_name || null,
      p_business_id: form.business_id || null,
      p_business_id_type: form.business_id_type || 'NIT',
      p_business_address: form.business_address || null,
      p_business_city: form.business_city || null,
      p_is_active: form.is_active ?? false,
    });
    if (error) throw error;
    setConfig(data);
    return data;
  };

  /**
   * Test conexión con Alegra. Retorna { ok, account_name, numerations }.
   */
  const testConnection = async (overrideCreds = {}) => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) throw new Error('Sesión expirada');

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/alegra-test-connection`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenant_id: tenant.id,
        ...overrideCreds,
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data?.error || `HTTP ${resp.status}`);
    }
    await reload();
    return data;
  };

  /**
   * Emite factura electrónica para un sale_id.
   */
  const emitInvoice = async (saleId) => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) throw new Error('Sesión expirada');

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/alegra-emit-invoice`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sale_id: saleId }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      const err = new Error(data?.error || `HTTP ${resp.status}`);
      err.status = resp.status;
      err.data = data;
      throw err;
    }
    return data;
  };

  return { config, loading, reload, save, testConnection, emitInvoice };
}
