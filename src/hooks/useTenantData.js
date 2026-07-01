import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../lib/logger';

export function useTenantData(table, options = {}) {
  const { tenant } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from(table)
        .select(options.select || '*')
        .eq('tenant_id', tenant.id);

      if (options.order) {
        query = query.order(options.order.column, { ascending: options.order.ascending ?? false });
      }

      const { data: rows, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setData(rows || []);
    } catch (err) {
      logger.error(`fetch ${table}`, err);
      setError(err.code || 'fetch_failed');
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, table, options.select, options.order?.column, options.order?.ascending]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Refetch al volver a la pestaña (catch up de cambios mientras estuvo en background)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchAll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchAll]);

  const insert = async (record) => {
    if (!tenant?.id) return { error: 'No tenant' };
    const { data: row, error: insertError } = await supabase
      .from(table)
      .insert({ ...record, tenant_id: tenant.id })
      .select()
      .single();
    if (insertError) {
      logger.error(`insert ${table}`, insertError);
      return { error: insertError };
    }
    setData((prev) => [row, ...prev]);
    return { data: row };
  };

  const update = async (id, updates) => {
    const { data: row, error: updateError } = await supabase
      .from(table)
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (updateError) {
      logger.error(`update ${table}`, updateError);
      return { error: updateError };
    }
    setData((prev) => prev.map((r) => (r.id === id ? row : r)));
    return { data: row };
  };

  const remove = async (id) => {
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq('id', id);
    if (deleteError) {
      logger.error(`delete ${table}`, deleteError);
      return { error: deleteError };
    }
    setData((prev) => prev.filter((r) => r.id !== id));
    return { success: true };
  };

  return { data, loading, error, insert, update, remove, refetch: fetchAll };
}

export function usePatients() {
  const { data, loading, error, insert, update, remove, refetch } = useTenantData('patients', {
    order: { column: 'created_at', ascending: false },
  });

  // Wrapper insertPatient con check de plan limit
  const insertPatient = async (record) => {
    try {
      const { data: limit } = await supabase.rpc('tenant_check_plan_limit', {
        p_tenant_id: record.tenant_id || (await supabase.from('tenants').select('id').limit(1).maybeSingle()).data?.id,
        p_resource: 'patients',
      });
      if (limit && !limit.can_add) {
        return {
          error: {
            message: limit.reason === 'subscription_inactive'
              ? 'Tu suscripción no está activa. Renuévala desde Settings → Plan.'
              : `Tu plan ${limit.plan_id} permite ${limit.max} pacientes. Tienes ${limit.current}. Actualiza el plan en Settings → Plan.`,
            code: 'PLAN_LIMIT',
          },
        };
      }
    } catch {
      // Si el RPC falla (network), permitir el insert — la BD también validará
    }
    return insert(record);
  };

  return { patients: data, loading, error, insertPatient, updatePatient: update, removePatient: remove, refetchPatients: refetch };
}

export function useAppointments() {
  const { data, loading, error, insert, update, remove, refetch } = useTenantData('appointments', {
    select: '*',
    order: { column: 'date', ascending: true },
  });
  return { appointments: data, loading, error, insertAppointment: insert, updateAppointment: update, removeAppointment: remove, refetchAppointments: refetch };
}

export function useJornadas() {
  const { data, loading, error, insert, update, remove, refetch } = useTenantData('jornadas', {
    order: { column: 'date', ascending: true },
  });
  return { jornadas: data, loading, error, insertJornada: insert, updateJornada: update, removeJornada: remove, refetchJornadas: refetch };
}

export function useLeads() {
  const { data, loading, error, insert, update, refetch } = useTenantData('leads', {
    order: { column: 'date', ascending: false },
  });
  return { leads: data, loading, error, insertLead: insert, updateLead: update, refetchLeads: refetch };
}

export function useTransactions() {
  const { data, loading, error, insert, update, remove, refetch } = useTenantData('transactions', {
    order: { column: 'date', ascending: false },
  });
  return { transactions: data, loading, error, insertTransaction: insert, updateTransaction: update, removeTransaction: remove, refetchTransactions: refetch };
}

export function useAlerts() {
  const { data, loading, error, insert, update, refetch } = useTenantData('alerts', {
    order: { column: 'created_at', ascending: false },
  });
  return { alerts: data, loading, error, insertAlert: insert, updateAlert: update, refetchAlerts: refetch };
}

export function useScheduledContent() {
  const { data, loading, error, insert, update, refetch } = useTenantData('scheduled_content', {
    order: { column: 'date', ascending: true },
  });
  return { scheduledContent: data, loading, error, insertContent: insert, updateContent: update, refetchContent: refetch };
}

export function useServices() {
  const { data, loading, error, insert, update, remove, refetch } = useTenantData('services', {
    order: { column: 'created_at', ascending: false },
  });
  return { services: data, loading, error, insertService: insert, updateService: update, removeService: remove, refetchServices: refetch };
}

export function useProducts() {
  const { data, loading, error, insert, update, remove, refetch } = useTenantData('products', {
    order: { column: 'created_at', ascending: false },
  });
  return { products: data, loading, error, insertProduct: insert, updateProduct: update, removeProduct: remove, refetchProducts: refetch };
}

export function useJornadaOfferings(jornadaId) {
  const { tenant } = useAuth();
  const [offerings, setOfferings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOfferings = useCallback(async () => {
    if (!tenant?.id || !jornadaId) {
      setOfferings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('jornada_offerings')
        .select('*, services(*), products(*)')
        .eq('tenant_id', tenant.id)
        .eq('jornada_id', jornadaId);
      if (fetchError) throw fetchError;
      setOfferings(data || []);
    } catch (err) {
      logger.error('fetch jornada_offerings', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, jornadaId]);

  useEffect(() => {
    fetchOfferings();
  }, [fetchOfferings]);

  const addOffering = async ({ itemType, itemId, priceOverride = null }) => {
    if (!tenant?.id || !jornadaId) return { error: 'No tenant or jornada' };
    const record = {
      tenant_id: tenant.id,
      jornada_id: jornadaId,
      item_type: itemType,
      service_id: itemType === 'service' ? itemId : null,
      product_id: itemType === 'product' ? itemId : null,
      price_override: priceOverride,
    };
    const { data, error: insertError } = await supabase
      .from('jornada_offerings')
      .insert(record)
      .select('*, services(*), products(*)')
      .single();
    if (insertError) {
      logger.error('insert jornada_offering', insertError);
      return { error: insertError };
    }
    setOfferings((prev) => [...prev, data]);
    return { data };
  };

  const removeOffering = async (id) => {
    const { error: deleteError } = await supabase
      .from('jornada_offerings')
      .delete()
      .eq('id', id);
    if (deleteError) {
      logger.error('delete jornada_offering', deleteError);
      return { error: deleteError };
    }
    setOfferings((prev) => prev.filter((o) => o.id !== id));
    return { success: true };
  };

  return { offerings, loading, error, addOffering, removeOffering, refetchOfferings: fetchOfferings };
}

export function useSales() {
  const { tenant } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSales = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('sales')
        .select('*, sale_items(*), patients(full_name), jornadas(city, date)')
        .eq('tenant_id', tenant.id)
        .order('date', { ascending: false });
      if (fetchError) throw fetchError;
      setSales(data || []);
    } catch (err) {
      logger.error('fetch sales', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const createSale = async ({ jornadaId = null, patientId = null, appointmentId = null, items, paymentMethod = 'efectivo', notes = '', date = null }) => {
    if (!tenant?.id) return { error: 'No tenant' };
    if (!items || items.length === 0) return { error: 'Debe haber al menos un item' };

    const total = items.reduce((sum, item) => sum + item.subtotal, 0);

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        tenant_id: tenant.id,
        jornada_id: jornadaId,
        patient_id: patientId,
        appointment_id: appointmentId,
        total,
        payment_method: paymentMethod,
        notes,
        date: date || new Date().toISOString().slice(0, 10),
      })
      .select()
      .single();

    if (saleError) {
      logger.error('create sale', saleError);
      return { error: saleError };
    }

    const itemRecords = items.map((item) => ({
      sale_id: sale.id,
      item_type: item.itemType,
      service_id: item.itemType === 'service' ? item.itemId : null,
      product_id: item.itemType === 'product' ? item.itemId : null,
      item_name: item.name,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      subtotal: item.subtotal,
    }));

    const { error: itemsError } = await supabase.from('sale_items').insert(itemRecords);
    if (itemsError) {
      logger.error('insert sale_items', itemsError);
      await supabase.from('sales').delete().eq('id', sale.id);
      return { error: itemsError };
    }

    for (const item of items) {
      if (item.itemType === 'product') {
        const { error: rpcError } = await supabase.rpc('decrement_product_stock', {
          p_id: item.itemId,
          qty: item.quantity,
        });
        if (rpcError) {
          logger.error(`stock decrement ${item.itemId}`, rpcError);
        }
      }
    }

    await fetchSales();
    return { data: sale };
  };

  const cancelSale = async (id) => {
    const { data, error: updateError } = await supabase
      .from('sales')
      .update({ status: 'cancelada' })
      .eq('id', id)
      .select()
      .single();
    if (updateError) {
      logger.error('cancel sale', updateError);
      return { error: updateError };
    }
    setSales((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
    return { data };
  };

  return { sales, loading, error, createSale, cancelSale, refetchSales: fetchSales };
}

export function usePayments() {
  const { tenant } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPayments = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('payments')
        .select('*, patients(full_name)')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (fetchError) throw fetchError;
      setPayments(data || []);
    } catch (err) {
      logger.error('fetch payments', err);
      setError(err.code || 'fetch_failed');
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Genera un link de pago Wompi llamando a la Edge Function
  const createPaymentLink = async ({ amount, description, patientId, appointmentId, jornadaId, customerEmail, customerPhone }) => {
    if (!tenant?.id) return { error: { message: 'No tenant' } };
    try {
      const { data, error } = await supabase.functions.invoke('wompi-create-link', {
        body: {
          tenant_id: tenant.id,
          amount,
          description,
          patient_id: patientId || null,
          appointment_id: appointmentId || null,
          jornada_id: jornadaId || null,
          customer_email: customerEmail || null,
          customer_phone: customerPhone || null,
        },
      });
      if (error) {
        logger.error('createPaymentLink', error);
        return { error };
      }
      await fetchPayments();
      return { data };
    } catch (err) {
      logger.error('createPaymentLink exception', err);
      return { error: err };
    }
  };

  return { payments, loading, error, createPaymentLink, refetchPayments: fetchPayments };
}
