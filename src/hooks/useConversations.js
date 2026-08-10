import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../lib/logger';
import { isDemoMode, DEMO_CONVERSATIONS, DEMO_WA_MESSAGES } from '../lib/demo';
import { useNow } from './useNow';

const DEMO = isDemoMode();

/**
 * Bandeja de conversaciones de WhatsApp.
 *
 * La fuente es `whatsapp_conversations` / `whatsapp_messages`, que llena el bot
 * de n8n a través de la RPC `wa_log_message` (migración 043). El bot ya existía
 * y respondía bien, pero su memoria vivía dentro de n8n: el consultorio no
 * podía ver una sola conversación ni medir si servía de algo.
 *
 * Se suscribe a Realtime porque una bandeja que hay que recargar a mano no es
 * una bandeja.
 */
export function useConversations() {
  const { tenant } = useAuth();
  const [conversations, setConversations] = useState(DEMO ? DEMO_CONVERSATIONS : []);
  const [loading, setLoading] = useState(!DEMO);

  const reload = useCallback(async () => {
    if (DEMO) return;
    if (!tenant?.id) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('last_message_at', { ascending: false })
      .limit(300);
    if (error) logger.error('useConversations', error);
    else setConversations(data || []);
    setLoading(false);
  }, [tenant?.id]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (DEMO || !tenant?.id) return undefined;
    const channel = supabase
      .channel(`wa_conv_${tenant.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_conversations', filter: `tenant_id=eq.${tenant.id}` },
        () => { reload(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenant?.id, reload]);

  const now = useNow();
  const totals = useMemo(() => {
    return {
      total: conversations.length,
      sinLeer: conversations.reduce((s, c) => s + (c.unread_count || 0), 0),
      ventanaAbierta: conversations.filter((c) => c.window_expires_at && new Date(c.window_expires_at).getTime() > now).length,
      requierenHumano: conversations.filter((c) => c.needs_human).length,
    };
  }, [conversations, now]);

  const markRead = useCallback(async (conversationId) => {
    setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c)));
    if (DEMO) return;
    const { error } = await supabase.rpc('wa_mark_read', { p_conversation_id: conversationId });
    if (error) logger.error('wa_mark_read', error);
  }, []);

  return { conversations, loading, totals, reload, markRead };
}

/**
 * El hilo de una conversación, con Realtime sobre los mensajes nuevos.
 */
export function useConversationMessages(conversationId) {
  const [fetched, setFetched] = useState([]);
  const [loading, setLoading] = useState(false);

  // En demostración los mensajes se DERIVAN del id: ponerlos con setState
  // dentro del efecto provoca renders en cascada y el compilador lo rechaza.
  const messages = useMemo(() => {
    if (DEMO) return DEMO_WA_MESSAGES[conversationId] || [];
    return conversationId ? fetched : [];
  }, [conversationId, fetched]);

  const reload = useCallback(async () => {
    if (DEMO || !conversationId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) logger.error('useConversationMessages', error);
    else setFetched(data || []);
    setLoading(false);
  }, [conversationId]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (DEMO || !conversationId) return undefined;
    const channel = supabase
      .channel(`wa_msg_${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          // Se añade el nuevo en vez de recargar todo el hilo: con 500 mensajes
          // recargar en cada mensaje hace parpadear la pantalla.
          setFetched((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  return { messages, loading, reload };
}

/**
 * Informe diario: qué hizo el canal cada día.
 * Se apoya en la vista `wa_daily_report`, que ya agrega en la base — traer
 * miles de mensajes al navegador para sumarlos aquí sería absurdo.
 */
export function useWhatsappReport(days = 14) {
  const { tenant } = useAuth();
  const [rows, setRows] = useState(() => (DEMO ? demoReport(days) : []));
  const [loading, setLoading] = useState(!DEMO);

  const reload = useCallback(async () => {
    if (DEMO) return;
    if (!tenant?.id) { setLoading(false); return; }
    const desde = new Date();
    desde.setDate(desde.getDate() - (days - 1));
    const { data, error } = await supabase
      .from('wa_daily_report')
      .select('*')
      .eq('tenant_id', tenant.id)
      .gte('dia', desde.toISOString().slice(0, 10))
      .order('dia', { ascending: true });
    if (error) logger.error('useWhatsappReport', error);
    else setRows(data || []);
    setLoading(false);
  }, [tenant?.id, days]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (DEMO || !tenant?.id) return undefined;
    const channel = supabase
      .channel(`wa_report_${tenant.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `tenant_id=eq.${tenant.id}` },
        () => { reload(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenant?.id, reload]);

  const ahora = useNow(60000);
  const hoy = useMemo(() => {
    const key = new Date(ahora).toISOString().slice(0, 10);
    return rows.find((r) => String(r.dia).slice(0, 10) === key) || null;
  }, [rows, ahora]);

  return { rows, hoy, loading, reload };
}

function demoReport(days) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const base = 6 + ((i * 7) % 11);
    out.push({
      dia: d.toISOString().slice(0, 10),
      enviados: base + 4,
      recibidos: Math.round(base * 0.7),
      de_campana: Math.max(0, base - 3),
      del_bot: Math.round(base * 0.6),
      de_humano: 2,
      conversaciones: Math.round(base * 0.8),
      conversaciones_con_respuesta: Math.round(base * 0.5),
    });
  }
  return out;
}
