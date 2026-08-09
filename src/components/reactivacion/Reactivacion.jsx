import { useMemo, useState } from 'react';
import { Download, Info, Radar, Sparkles, TrendingUp, Users } from 'lucide-react';
import { useReactivation, SEGMENT_LIST, messageFor } from '../../hooks/useReactivation';
import { useAuth } from '../../contexts/AuthContext';
import { formatCOP } from '../../utils/format';
import { downloadCsv } from '../../utils/csv';
import { Card, EmptyState, PageHeader, SectionHeader } from '../ui/Card';
import { SegmentedTabs } from '../ui/Tabs';
import Button from '../ui/Button';
import LoadingState from '../LoadingState';
import CandidateCard from './CandidateCard';
import { cn } from '../../lib/utils';


const TODAY_SIZE = 8;
const PAGE = 25;

/**
 * Radar de Reactivación — el módulo que convierte el archivo histórico en
 * agenda. No pide datos nuevos: lee los 1.424 pacientes ya importados, los
 * ordena por probabilidad × valor, y entrega una lista corta para la mañana.
 */
export default function Reactivacion() {
  const { tenant } = useAuth();
  const { candidates, summary, loading, registerTouch, persisted } = useReactivation();
  const [segment, setSegment] = useState('todos');
  const [limit, setLimit] = useState(PAGE);

  const clinicName = tenant?.name || 'el consultorio';

  const filtered = useMemo(
    () => (segment === 'todos' ? candidates : candidates.filter((c) => c.segment === segment)),
    [candidates, segment],
  );

  const today = candidates.filter((c) => c.lastTouchDays == null).slice(0, TODAY_SIZE);
  const todayValue = today.reduce((s, c) => s + c.value, 0);

  if (loading) return <LoadingState message="Cruzando historia clínica y agenda…" size="lg" />;

  const tabs = [
    { id: 'todos', label: 'Todos', count: candidates.length },
    ...SEGMENT_LIST.map((s) => ({ id: s.id, label: s.short, count: summary.counts[s.id] || 0 })),
  ];
  const activeSeg = SEGMENT_LIST.find((s) => s.id === segment);

  return (
    <div className="space-y-6">
      <div>
        <PageHeader
          kicker="Motor de ingresos"
          title="Radar de reactivación"
          subtitle={
            <>
              <span className="font-semibold text-on-surface tnum">{summary.total}</span> pacientes recuperables ·
              potencial de <span className="font-semibold text-on-surface tnum">{formatCOP(summary.potential)}</span>
            </>
          }
        >
          <Button
            variant="outline"
            size="sm"
            icon={Download}
            onClick={() => downloadCsv(
              'reactivacion.csv',
              filtered,
              [
                { key: 'score', label: 'Prioridad' },
                { key: 'name', label: 'Paciente' },
                { key: 'phone', label: 'Teléfono' },
                { key: 'segment', label: 'Segmento' },
                { key: 'reason', label: 'Motivo' },
                { key: 'balance', label: 'Saldo', format: (v) => v ?? 0 },
                { key: 'value', label: 'Valor recuperable', format: (v) => v ?? 0 },
                { key: 'lastVisit', label: 'Última visita' },
              ],
            )}
          >
            Exportar
          </Button>
        </PageHeader>
      </div>

      {/* Titular: el dinero dormido */}
      <div>
        <Card tone="pine" pad={false} className="overflow-hidden">
          <div className="relative p-5 sm:p-7">
            {/* Textura, no ilustración: en un teléfono un radar de 300px se
                come el titular, así que solo aparece desde `md`. */}
            <Radar size={300} strokeWidth={0.5} className="hidden md:block absolute -right-24 -top-28 opacity-[0.07] pointer-events-none" aria-hidden="true" />
            <div className="relative grid gap-6 lg:grid-cols-[1.2fr_auto] lg:items-end">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-tertiary-fixed">
                  Ingresos dormidos en tu propia base
                </p>
                <p className="font-display text-hero font-semibold mt-2 tnum">{formatCOP(summary.potential)}</p>
                <p className="text-sm text-on-primary/80 mt-2 max-w-xl leading-relaxed">
                  Repartidos entre {summary.total} pacientes que ya conocen el consultorio y hoy no tienen cita.
                  De ese total, <span className="font-semibold text-tertiary-fixed tnum">{formatCOP(summary.debt)}</span> es
                  saldo ya facturado que nunca entró.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 lg:gap-5 lg:text-right">
                {[
                  { k: 'Hoy', v: today.length, s: 'para llamar' },
                  { k: 'Con saldo', v: summary.counts.saldo || 0, s: 'a cobrar' },
                  { k: 'Sin datos', v: summary.unreachable, s: 'ilocalizables' },
                ].map((m) => (
                  <div key={m.k} className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-tertiary-fixed/85">{m.k}</p>
                    <p className="font-display text-2xl font-semibold tnum mt-0.5">{m.v}</p>
                    <p className="text-[10px] text-on-primary/60 truncate">{m.s}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Tu lista de hoy */}
      <div>
        <Card>
          <SectionHeader
            icon={Sparkles}
            title="Tu lista de hoy"
            hint={`Los ${today.length} de mayor prioridad que aún no has contactado · ${formatCOP(todayValue)} en juego`}
          />
          {today.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="Lista al día"
              hint="Ya contactaste a todos los prioritarios. Vuelve mañana o revisa los segmentos completos abajo."
            />
          ) : (
            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
              {today.map((c) => (
                <CandidateCard key={c.id} candidate={c} clinicName={clinicName} onTouch={registerTouch} compact />
              ))}
            </div>
          )}
          {today.length > 0 && (
            <div className="mt-4 pt-3.5 hairline flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <p className="text-xs text-on-surface-variant">
                Cada mensaje sale con el nombre del paciente y el motivo correcto. Revísalo antes de enviar.
              </p>
              <Button
                variant="soft"
                size="sm"
                icon={Users}
                onClick={() => {
                  const lines = today.map((c) => `${c.name} — ${c.phone || c.email || 'sin contacto'}\n${messageFor(c, clinicName)}`);
                  navigator.clipboard?.writeText(lines.join('\n\n---\n\n'));
                }}
              >
                Copiar los {today.length} mensajes
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Lista completa por segmento */}
      <div className="space-y-4">
        <SegmentedTabs
          tabs={tabs}
          value={segment}
          onChange={(v) => { setSegment(v); setLimit(PAGE); }}
          layoutId="reactivacion-seg"
        />

        {activeSeg && (
          <p className="flex items-start gap-2 text-xs text-on-surface-variant bg-surface-container-low border border-outline-variant/70 rounded-xl px-3.5 py-2.5">
            <Info size={14} className="flex-shrink-0 mt-px text-primary-light" />
            {activeSeg.blurb}
          </p>
        )}

        {filtered.length === 0 ? (
          <Card>
            <EmptyState icon={Radar} title="Nadie en este segmento" hint="Buena señal: no hay pacientes por recuperar aquí." />
          </Card>
        ) : (
          <>
            <div className="grid gap-2.5 lg:grid-cols-2">
              {filtered.slice(0, limit).map((c) => (
                <CandidateCard key={c.id} candidate={c} clinicName={clinicName} onTouch={registerTouch} />
              ))}
            </div>
            {filtered.length > limit && (
              <div className="flex justify-center pt-1">
                <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
                  Ver {Math.min(PAGE, filtered.length - limit)} más · quedan {filtered.length - limit}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {!persisted && (
        <p className={cn(
          'flex items-start gap-2 text-xs text-on-surface-variant',
          'bg-[#f6e7db]/60 border border-warning/30 rounded-xl px-3.5 py-2.5',
        )}>
          <Info size={14} className="flex-shrink-0 mt-px text-warning" />
          Los contactos se están guardando solo en este dispositivo. Para compartirlos con el
          equipo hay que aplicar la migración <code className="font-mono">037_reactivation.sql</code>.
        </p>
      )}
    </div>
  );
}
