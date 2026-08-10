import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Bot, Clock, Megaphone, Send, User, UserRound, AlertTriangle,
} from 'lucide-react';
import { useConversationMessages } from '../../hooks/useConversations';
import { useNow } from '../../hooks/useNow';
import { EmptyState } from '../ui/Card';

const ORIGEN = {
  bot: { icon: Bot, label: 'Bot' },
  campana: { icon: Megaphone, label: 'Campaña' },
  humano: { icon: UserRound, label: 'Consultorio' },
  paciente: { icon: User, label: 'Paciente' },
};

const hora = (iso) => new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
const fechaLarga = (iso) => {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  const mismo = (a, b) => a.toDateString() === b.toDateString();
  if (mismo(d, hoy)) return 'Hoy';
  if (mismo(d, ayer)) return 'Ayer';
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
};

/** Cuánto queda de la ventana de 24 h de Meta, en texto humano. */
function ventana(conversation, ahora) {
  const exp = conversation?.window_expires_at ? new Date(conversation.window_expires_at).getTime() : 0;
  const restante = exp - ahora;
  if (restante <= 0) return { abierta: false, texto: 'Ventana cerrada' };
  const h = Math.floor(restante / 3600000);
  const m = Math.floor((restante % 3600000) / 60000);
  return { abierta: true, texto: h > 0 ? `Quedan ${h} h ${m} min` : `Quedan ${m} min` };
}

export default function ChatThread({ conversation, onBack, onSend, sending }) {
  const { messages, loading } = useConversationMessages(conversation?.id);
  const [texto, setTexto] = useState('');
  const finRef = useRef(null);
  const ahora = useNow(30000);

  // El separador de día se calcula aquí, no mutando una variable durante el
  // render: reasignar mientras se pinta rompe el compilador de React.
  const items = useMemo(() => messages.map((m, i) => {
    const dia = fechaLarga(m.created_at);
    const diaPrevio = i > 0 ? fechaLarga(messages[i - 1].created_at) : null;
    return { m, separador: dia !== diaPrevio ? dia : null };
  }), [messages]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, conversation?.id]);

  if (!conversation) {
    return (
      <div className="hidden lg:flex items-center justify-center h-full">
        <EmptyState
          title="Elige una conversación"
          hint="A la izquierda está todo lo que ha pasado por WhatsApp."
        />
      </div>
    );
  }

  const v = ventana(conversation, ahora);

  const enviar = (e) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t || sending) return;
    onSend?.(conversation, t);
    setTexto('');
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Encabezado */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant flex-shrink-0">
        <button onClick={onBack} className="lg:hidden text-on-surface-variant hover:text-on-surface" aria-label="Volver a la lista">
          <ArrowLeft size={20} />
        </button>
        <span className="w-9 h-9 rounded-xl bg-tertiary-container text-on-tertiary-container flex items-center justify-center text-[12px] font-bold flex-shrink-0">
          {(conversation.contact_name || '?').slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-on-surface truncate">
            {conversation.contact_name || conversation.phone}
          </p>
          <p className="text-[11px] text-on-surface-variant truncate">
            {conversation.phone}
            {!conversation.patient_id && ' · sin ficha de paciente'}
          </p>
        </div>
        <span className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${
          v.abierta ? 'bg-[#e0efe8] text-[#1f6b52]' : 'bg-[#f6e7db] text-[#a85b32]'
        }`}>
          <Clock size={12} /> {v.texto}
        </span>
      </div>

      {/* Mensajes */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2.5 bg-surface-container-low/40">
        {loading && messages.length === 0 && (
          <p className="text-center text-[12px] text-on-surface-variant py-6">Cargando conversación…</p>
        )}
        {!loading && messages.length === 0 && (
          <p className="text-center text-[12px] text-on-surface-variant py-6">Sin mensajes todavía.</p>
        )}

        {items.map(({ m, separador }) => {
          const saliente = m.direction === 'outbound';
          const origen = ORIGEN[m.sent_by] || (saliente ? ORIGEN.bot : ORIGEN.paciente);
          const Icono = origen.icon;

          return (
            <div key={m.id}>
              {separador && (
                <p className="text-center text-[10px] uppercase tracking-wide text-on-surface-variant my-3">{separador}</p>
              )}
              <div className={`flex ${saliente ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[min(78%,32rem)] rounded-2xl px-3.5 py-2.5 ${
                  saliente
                    ? 'bg-primary text-on-primary rounded-br-md'
                    : 'bg-surface-container-lowest border border-outline-variant/70 text-on-surface rounded-bl-md'
                }`}>
                  <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words">{m.content}</p>
                  <p className={`flex items-center gap-1.5 text-[10px] mt-1.5 ${saliente ? 'text-on-primary/70' : 'text-on-surface-variant'}`}>
                    <Icono size={11} /> {origen.label}
                    {m.template_name && ' · plantilla'}
                    <span className="ml-auto tnum">{hora(m.created_at)}</span>
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={finRef} />
      </div>

      {/* Redactar */}
      <form onSubmit={enviar} className="border-t border-outline-variant p-3 flex-shrink-0 bg-surface">
        {!v.abierta && (
          <p className="flex items-start gap-2 text-[11.5px] text-[#a85b32] bg-[#f6e7db]/70 border border-warning/30 rounded-lg px-3 py-2 mb-2.5">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            Pasaron más de 24 horas desde el último mensaje del paciente. Meta no permite
            escribir libre: solo se puede retomar con una plantilla aprobada.
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) enviar(e); }}
            rows={1}
            disabled={!v.abierta || sending}
            placeholder={v.abierta ? 'Escribe un mensaje…' : 'Ventana cerrada'}
            className="flex-1 resize-none bg-surface-container-low border border-outline-variant rounded-xl px-3.5 py-2.5 text-[13.5px] text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 max-h-32"
          />
          <button
            type="submit"
            disabled={!v.abierta || sending || !texto.trim()}
            className="flex-shrink-0 bg-primary hover:bg-primary-light disabled:opacity-40 disabled:cursor-not-allowed text-on-primary rounded-xl p-2.5"
            aria-label="Enviar mensaje"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
