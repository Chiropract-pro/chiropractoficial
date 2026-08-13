import { CalendarCheck, MessageSquare, Radio, TrendingUp } from 'lucide-react';
import { formatCOP, formatDate } from '../../utils/format';

/** Fecha corta para tabla: «12 ago». La larga («Miércoles, 12 de agosto de
 *  2026») empujaba la columna de resultado fuera de la tarjeta. Se calcula
 *  desde la marca de tiempo, no cortando el ISO: eso adelantaba un día todo lo
 *  enviado después de las 7 p. m. de Bogotá. */
const fechaCorta = (iso) => new Date(iso).toLocaleDateString('es-CO', {
  day: 'numeric', month: 'short', timeZone: 'America/Bogota',
}).replace('.', '');
import { Card, EmptyState, SectionHeader } from '../ui/Card';
import { Stat, StatGrid } from '../ui/Stat';
import LoadingState from '../LoadingState';
import { useReactivationReport } from '../../hooks/useReactivationReport';

const DESENLACE = {
  volvio: { texto: 'Volvió', clase: 'bg-[#e0efe8] text-[#1f6b52]' },
  respondio: { texto: 'Contestó', clase: 'bg-[#f6e7db] text-[#a85b32]' },
  sin_respuesta: { texto: 'Sin respuesta', clase: 'bg-surface-container-high text-on-surface-variant' },
};

const SEGMENTO = {
  saldo: 'Saldo pendiente',
  abandono: 'Tratamiento interrumpido',
  dormido: 'Paciente dormido',
  primera: 'No volvió tras la primera',
};

/**
 * Lo que hizo el bot: a quién le escribió y qué pasó después.
 *
 * El Radar dice a quién hay que buscar; esta pantalla dice a quién ya se buscó
 * y con qué resultado. Sin ella, el consultorio no tiene forma de saber si la
 * reactivación automática sirve de algo — y una campaña que nadie mide se
 * termina apagando «porque no se notaba».
 */
export default function Resultados() {
  const { rows, resumen, loading } = useReactivationReport(90);

  if (loading) return <LoadingState message="Revisando lo que contestaron…" />;

  const tasa = resumen.total > 0 ? Math.round((resumen.volvieron / resumen.total) * 100) : 0;

  return (
    <div className="space-y-5">
      <StatGrid cols={4}>
        <Stat label="Contactados" icon={Radio} value={String(resumen.total)} sub="últimos 90 días" />
        <Stat label="Contestaron" icon={MessageSquare} value={String(resumen.respondieron + resumen.volvieron)} sub="abrieron conversación" />
        <Stat
          label="Volvieron" icon={CalendarCheck} tone="accent"
          value={String(resumen.volvieron)} sub={`${tasa}% de los contactados`}
        />
        <Stat
          label="Recuperado" icon={TrendingUp} tone="accent"
          value={formatCOP(resumen.recuperado)} sub="de quienes ya agendaron"
        />
      </StatGrid>

      <Card>
        <SectionHeader
          icon={Radio}
          title="Uno por uno"
          hint={rows.length > 0 ? `${rows.length} ${rows.length === 1 ? 'contacto' : 'contactos'}` : undefined}
        />

        {rows.length === 0 ? (
          <EmptyState
            icon={Radio}
            title="El bot todavía no ha escrito a nadie"
            hint="Cuando empiece a contactar pacientes, aquí aparece qué contestó cada uno."
          />
        ) : (
          <div className="max-h-[560px] overflow-y-auto -mx-1 px-1">
            <table className="w-full text-[12.5px] border-collapse">
              <thead className="sticky top-0 bg-surface z-10">
                <tr className="text-left text-[10px] uppercase tracking-wide text-on-surface-variant">
                  <th scope="col" className="font-semibold py-2 pr-3">Paciente</th>
                  <th scope="col" className="font-semibold py-2 pr-3 hidden sm:table-cell">Por qué</th>
                  <th scope="col" className="font-semibold py-2 pr-3">Se le escribió</th>
                  <th scope="col" className="font-semibold py-2 text-right">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const d = DESENLACE[r.outcome] || DESENLACE.sin_respuesta;
                  return (
                    <tr key={r.touch_id} className="border-t border-outline-variant/50">
                      <td className="py-2.5 pr-3 min-w-0">
                        <span className="text-on-surface font-medium block truncate max-w-[22ch]">{r.full_name}</span>
                        {r.appointment_date && (
                          <span className="block text-[11px] text-[#1f6b52]">
                            Volvió el {formatDate(r.appointment_date)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-on-surface-variant hidden sm:table-cell">
                        {SEGMENTO[r.segment] || '—'}
                      </td>
                      <td className="py-2.5 pr-3 text-on-surface-variant whitespace-nowrap tnum">
                        {fechaCorta(r.sent_at)}
                      </td>
                      <td className="py-2.5 text-right">
                        <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${d.clase}`}>
                          {d.texto}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
