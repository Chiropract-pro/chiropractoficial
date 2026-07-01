import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../lib/logger';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Hook para gestionar la suscripción SaaS del tenant.
 */
export function useSubscription() {
  const { tenant } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const [{ data: sub }, { data: ps }] = await Promise.all([
        supabase
          .from('tenant_current_subscription')
          .select('*')
          .eq('tenant_id', tenant.id)
          .maybeSingle(),
        supabase
          .from('plans')
          .select('*')
          .eq('is_public', true)
          .order('display_order'),
      ]);
      setSubscription(sub);
      setPlans(ps || []);
    } catch (e) {
      logger.error('subscription load', e);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => { reload(); }, [reload]);

  const createUpgradeLink = async (planId, billingCycle = 'monthly') => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) throw new Error('Sesión expirada');

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/subscription-create-link`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenant_id: tenant.id,
        plan_id: planId,
        billing_cycle: billingCycle,
      }),
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`);
    return data;
  };

  const cancelSubscription = async () => {
    const { data, error } = await supabase.rpc('tenant_cancel_subscription', {
      p_tenant_id: tenant.id,
    });
    if (error) throw error;
    await reload();
    return data;
  };

  const checkLimit = async (resource) => {
    const { data, error } = await supabase.rpc('tenant_check_plan_limit', {
      p_tenant_id: tenant.id,
      p_resource: resource,
    });
    if (error) throw error;
    return data;
  };

  return {
    subscription,
    plans,
    loading,
    reload,
    createUpgradeLink,
    cancelSubscription,
    checkLimit,
  };
}

/**
 * Hook público — carga planes sin auth (para landing).
 */
export function usePublicPlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('plans')
      .select('*')
      .eq('is_public', true)
      .order('display_order')
      .then(({ data }) => {
        setPlans(data || []);
        setLoading(false);
      });
  }, []);

  return { plans, loading };
}
