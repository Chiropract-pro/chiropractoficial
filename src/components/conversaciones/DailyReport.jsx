import { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { Card, EmptyState, SectionHeader } from '../ui/Card';

const diaCorto = (iso) => {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '');
};

/**
 * Actividad diaria del canal, en barras apiladas: lo que salió y lo que
 * contestaron. Sirve para responder de un vistazo la única pregunta que
 * importa — «¿esto está trayendo pacientes de vuelta o solo mandando
 * mensajes?».
 */
export default function DailyReport({ rows, days = 14 }) {
  const { barras, max, totales } = useMemo(() => {
    const b = (rows || []).slice(-days).map((r) => ({
      dia: String(r.dia).slice(0, 10),
      enviados: Number(r.enviados) || 0,
      recibidos: Number(r.recibidos) || 0,
      campana: Number(r.de_campana) || 0,
      conversaciones: Number(r.conversaciones) || 0,
      conRespuesta: Number(r.conversaciones_con_respuesta) || 0,
    }));
    const m = Math.max(...b.map((x) => x.enviados + x.recibidos), 1);
    const t = b.reduce((acc, x) => ({
      enviados: acc.enviados + x.enviados,
      recibidos: acc.recibidos + x.recibidos,
      campana: acc.campana + x.campana,
      conversaciones: acc.conversaciones + x.conversaciones,
      conRespuesta: acc.conRespuesta + x.conRespuesta,
    }), { enviados: 0, recibidos: 0, campana: 0, conversaciones: 0, conRespuesta: 0 });
    return { barras: b, max: m, totales: t };
  }, [rows, days]);

  // La tasa de respuesta es la métrica que decide si la reactivación funciona.
  const tasaRespuesta = totales.conversaciones > 0
    ? Math.round((totales.conRespuesta / totales.conversaciones) * 100)
    : 0;

  return (
    <Card>
      <SectionHeader
        icon={Activity}
        title={`Actividad de los últimos ${days} días`}
        hint={totales.enviados > 0 ? `${totales.enviados} enviados · ${totales.recibidos} respuestas · ${tasaRespuesta}% responde` : undefined}
      />

      {barras.length === 0 || totales.enviados + totales.recibidos === 0 ? (
        <EmptyState
          icon={Activity}
          title="Todavía no hay actividad"
          hint="En cuanto el bot envíe o reciba el primer mensaje, aquí aparece el movimiento de cada día."
        />
      ) : (
        <>
          <div className="flex items-end gap-1.5 sm:gap-2 h-36" role="img" aria-label={`Actividad diaria: ${totales.enviados} mensajes enviados y ${totales.recibidos} respuestas`}>
            {barras.map((b) => {
              const hOut = (b.enviados / max) * 100;
              const hIn = (b.recibidos / max) * 100;
              return (
                <div key={b.dia} className="flex-1 flex flex-col items-center justify-end h-full min-w-0 group" title={`${diaCorto(b.dia)} · ${b.enviados} enviados, ${b.recibidos} respuestas`}>
                  <div className="w-full flex flex-col justify-end h-full gap-px">
                    <div style={{ height: `${hIn}%`, transition: 'height .6s cubic-bezier(.22,1,.36,1)' }} className="w-full rounded-t-md amber-gradient" />
                    <div style={{ height: `${hOut}%`, transition: 'height .6s cubic-bezier(.22,1,.36,1)' }} className="w-full clinical-gradient opacity-85 group-hover:opacity-100" />
                  </div>
                  <span className="text-[9.5px] text-on-surface-variant mt-1.5 truncate w-full text-center">{diaCorto(b.dia)}</span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 pt-3 border-t border-outline-variant/60 text-[11.5px]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm clinical-gradient" aria-hidden="true" /> Enviados
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm amber-gradient" aria-hidden="true" /> Respuestas
            </span>
            <span className="text-on-surface-variant">
              De campaña: <span className="font-semibold text-on-surface tnum">{totales.campana}</span>
            </span>
            <span className="text-on-surface-variant">
              Conversaciones: <span className="font-semibold text-on-surface tnum">{totales.conversaciones}</span>
            </span>
          </div>
        </>
      )}
    </Card>
  );
}
