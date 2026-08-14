import { useMemo, useState } from 'react';
import {
  Inbox, MessageSquare, Search, Send, Clock, UserRound, Megaphone,
} from 'lucide-react';
import { useConversations, useWhatsappReport } from '../../hooks/useConversations';
import { useNow } from '../../hooks/useNow';
import { sendWhatsappMessage } from '../../lib/whatsapp';
import { useToast } from '../Toast';
import { userFriendlyError } from '../../lib/logger';
import LoadingState from '../LoadingState';
import { Card, EmptyState, PageHeader } from '../ui/Card';
import { Stat, StatGrid } from '../ui/Stat';
import DailyReport from './DailyReport';
import ChatThread from './ChatThread';

const FILTROS = [
  { id: 'todas', label: 'Todas' },
  { id: 'sin_leer', label: 'Sin leer' },
  { id: 'abiertas', label: 'Ventana abierta' },
  { id: 'campana', label: 'De reactivación' },
  { id: 'humano', label: 'Requieren humano' },
];

const cuando = (iso, ahora) => {
  if (!iso) return '';
  const min = Math.round((ahora - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} d`;
};

export default function Conversaciones() {
  const { conversations, loading, totals, markRead } = useConversations();
  const { rows, hoy } = useWhatsappReport(14);
  const toast = useToast();

  const [selectedId, setSelectedId] = useState(null);
  const [filtro, setFiltro] = useState('todas');
  const [q, setQ] = useState('');
  const [sending, setSending] = useState(false);

  const ahora = useNow();
  const lista = useMemo(() => {
    const texto = q.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filtro === 'sin_leer' && !(c.unread_count > 0)) return false;
      if (filtro === 'abiertas' && !(c.window_expires_at && new Date(c.window_expires_at).getTime() > ahora)) return false;
      if (filtro === 'campana' && !c.last_campaign) return false;
      if (filtro === 'humano' && !c.needs_human) return false;
      if (texto) {
        const heno = `${c.contact_name || ''} ${c.phone || ''} ${c.last_message_text || ''}`.toLowerCase();
        if (!heno.includes(texto)) return false;
      }
      return true;
    });
  }, [conversations, filtro, q, ahora]);

  const selected = conversations.find((c) => c.id === selectedId) || null;

  const abrir = (c) => {
    setSelectedId(c.id);
    if (c.unread_count > 0) markRead(c.id);
  };

  const enviar = async (conversation, texto) => {
    setSending(true);
    const r = await sendWhatsappMessage({
      conversationId: conversation.id,
      phone: conversation.phone,
      text: texto,
    });
    setSending(false);
    if (r.error) { toast.error(userFriendlyError(r.error)); return; }
    toast.success('Mensaje enviado');
  };

  if (loading && conversations.length === 0) return <LoadingState message="Cargando conversaciones…" />;

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <PageHeader
          kicker="Canal de WhatsApp"
          title="Conversaciones"
          subtitle="Lo que el bot y el consultorio hablan con los pacientes"
        />
      </div>

      <div>
        <StatGrid>
          <Stat label="Enviados hoy" icon={Send} value={String(hoy?.enviados ?? 0)} sub={`${hoy?.de_campana ?? 0} de campaña`} />
          <Stat label="Respuestas hoy" icon={MessageSquare} value={String(hoy?.recibidos ?? 0)} sub={`${hoy?.conversaciones ?? 0} conversaciones`} />
          <Stat label="Sin leer" icon={Inbox} tone="accent" value={String(totals.sinLeer)} sub={`${totals.total} hilos en total`} />
          <Stat label="Ventana abierta" icon={Clock} value={String(totals.ventanaAbierta)} sub="se les puede escribir libre" />
        </StatGrid>
      </div>

      <div>
        <DailyReport rows={rows} days={14} />
      </div>

      {/* Bandeja */}
      <div>
        <Card pad={false} className="overflow-hidden">
          {/* En móvil la columna se declara `minmax(0,1fr)` a propósito. Sin
              ella, la rejilla de una sola columna la dimensiona `auto`, que es
              el ancho del CONTENIDO: con mensajes largos la columna salía a
              704px dentro de una tarjeta de 412px, y como la tarjeta recorta,
              el chat quedaba cortado por la derecha en el teléfono. `1fr` con
              mínimo 0 es lo único que la deja encogerse. */}
          <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] h-[min(70vh,42rem)]">
            {/* Lista */}
            <div className={`flex flex-col min-h-0 border-r border-outline-variant ${selected ? 'hidden lg:flex' : 'flex'}`}>
              <div className="p-3 border-b border-outline-variant space-y-2.5 flex-shrink-0">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar por nombre, número o texto…"
                    aria-label="Buscar conversación"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg pl-9 pr-3 py-2 text-[13px] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-0.5 px-0.5">
                  {FILTROS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFiltro(f.id)}
                      aria-pressed={filtro === f.id}
                      className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11.5px] font-medium border transition-colors ${
                        filtro === f.id
                          ? 'bg-primary text-on-primary border-primary'
                          : 'bg-surface-container-low text-on-surface-variant border-outline-variant/70 hover:text-on-surface'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-outline-variant/60">
                {lista.length === 0 && (
                  <li className="p-6">
                    <EmptyState
                      icon={Inbox}
                      title={conversations.length === 0 ? 'Todavía no hay conversaciones' : 'Nada con ese filtro'}
                      hint={conversations.length === 0
                        ? 'Aquí van a aparecer los chats en cuanto el bot reciba o envíe el primer mensaje.'
                        : 'Prueba con otro filtro o limpia la búsqueda.'}
                    />
                  </li>
                )}
                {lista.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => abrir(c)}
                      className={`w-full text-left p-3 flex gap-3 hover:bg-surface-container-low/60 transition-colors ${
                        selectedId === c.id ? 'bg-surface-container-low' : ''
                      }`}
                    >
                      <span className="w-9 h-9 rounded-xl bg-tertiary-container text-on-tertiary-container flex items-center justify-center text-[12px] font-bold flex-shrink-0">
                        {(c.contact_name || c.phone || '?').slice(0, 2).toUpperCase()}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-on-surface truncate flex-1">
                            {c.contact_name || c.phone}
                          </span>
                          <span className="text-[10.5px] text-on-surface-variant flex-shrink-0 tnum">{cuando(c.last_message_at, ahora)}</span>
                        </span>
                        <span className="block text-[11.5px] text-on-surface-variant truncate mt-0.5">
                          {c.last_direction === 'outbound' && '↗ '}{c.last_message_text || 'Sin mensajes'}
                        </span>
                        <span className="flex items-center gap-1.5 mt-1.5">
                          {c.unread_count > 0 && (
                            <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-on-primary tnum">
                              {c.unread_count}
                            </span>
                          )}
                          {c.needs_human && (
                            <span className="flex items-center gap-1 text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-[#f6ddd3] text-[#a03a22]">
                              <UserRound size={9} /> Humano
                            </span>
                          )}
                          {c.last_campaign && (
                            <span className="flex items-center gap-1 text-[9.5px] font-medium px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                              {/* Se nombra la campaña, no «campaña» a secas: saber que
                                  esta conversación nació de una reactivación cambia
                                  cómo se contesta. */}
                              <Megaphone size={9} /> {c.last_campaign === 'reactivacion' ? 'Reactivación' : 'Campaña'}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Hilo */}
            <div className={`min-h-0 ${selected ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'}`}>
              <ChatThread
                conversation={selected}
                onBack={() => setSelectedId(null)}
                onSend={enviar}
                sending={sending}
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
