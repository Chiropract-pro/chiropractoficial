import { useMemo, useState } from 'react';
import {
  CalendarDays, Car, CheckCircle, MapPin, Plus, TrendingUp, Users, XCircle,
} from 'lucide-react';
import { formatCOP, formatDate, cities } from '../utils/format';
import { useJornadas } from '../hooks/useTenantData';
import { useToast } from './Toast';
import { userFriendlyError } from '../lib/logger';
import LoadingState from './LoadingState';
import Button from './ui/Button';
import { Card, EmptyState, PageHeader } from './ui/Card';
import { ProgressRing, Stat, StatGrid } from './ui/Stat';
import { SegmentedTabs } from './ui/Tabs';
import Modal from './ui/Modal';
import { Field, FormGrid, Input, Select, Textarea } from './ui/Field';
import { cn } from '../lib/utils';
import { todayStr } from '../utils/dates';


const booked = (j) => j.booked ?? j.booked_count ?? 0;
const price = (j) => j.price_per_patient ?? 165000;
const fillOf = (j) => (j.capacity > 0 ? Math.round((booked(j) / j.capacity) * 100) : 0);

export default function Jornadas() {
  const { jornadas, loading, insertJornada, updateJornada, removeJornada } = useJornadas();
  const toast = useToast();
  const [tab, setTab] = useState('proximas');
  const [showNewForm, setShowNewForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const { proximas, pasadas, stats } = useMemo(() => {
    const p = jornadas.filter((j) => j.status === 'programada').sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const done = jornadas.filter((j) => j.status === 'completada' || j.status === 'cancelada')
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return {
      proximas: p,
      pasadas: done,
      stats: {
        cupos: p.reduce((s, j) => s + (j.capacity || 0), 0),
        agendados: p.reduce((s, j) => s + booked(j), 0),
        proyectado: p.reduce((s, j) => s + booked(j) * price(j), 0),
        facturado: done.reduce((s, j) => s + (j.revenue || 0), 0),
      },
    };
  }, [jornadas]);

  if (loading && jornadas.length === 0) return <LoadingState message="Cargando jornadas…" />;

  const submit = async (e) => {
    e.preventDefault();
    const f = e.target;
    setSaving(true);
    const r = await insertJornada({
      city: f.city.value,
      date: f.date.value,
      capacity: parseInt(f.capacity.value, 10) || 15,
      price_per_patient: parseInt(f.price.value, 10) || 165000,
      notes: f.notes.value || null,
    });
    setSaving(false);
    if (r.error) { toast.error(userFriendlyError(r.error)); return; }
    toast.success('Jornada programada');
    setShowNewForm(false);
  };

  const setStatus = async (j, status) => {
    const r = await updateJornada(j.id, { status });
    if (r.error) { toast.error(userFriendlyError(r.error)); return; }
    toast.success(status === 'completada' ? 'Jornada completada' : 'Jornada cancelada');
    setSelected(null);
  };

  const list = tab === 'proximas' ? proximas : pasadas;

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <PageHeader
          kicker="Operación itinerante"
          title="Jornadas"
          subtitle="Salidas por ciudad: cupos, ocupación y proyección"
        >
          <Button size="sm" icon={Plus} onClick={() => setShowNewForm(true)}>Nueva jornada</Button>
        </PageHeader>
      </div>

      <div>
        <StatGrid>
          <Stat label="Programadas" icon={Car} value={String(proximas.length)} sub={`${stats.cupos} cupos totales`} />
          <Stat label="Agendados" icon={Users} value={String(stats.agendados)} sub={stats.cupos > 0 ? `${Math.round((stats.agendados / stats.cupos) * 100)}% de ocupación` : 'sin cupos'} />
          <Stat label="Proyectado" icon={TrendingUp} tone="accent" value={formatCOP(stats.proyectado)} sub="si asisten todos" />
          <Stat label="Histórico" icon={CheckCircle} value={formatCOP(stats.facturado)} sub={`${pasadas.length} jornadas cerradas`} />
        </StatGrid>
      </div>

      <div>
        <SegmentedTabs
          layoutId="jornadas-tab"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'proximas', label: 'Próximas', count: proximas.length },
            { id: 'pasadas', label: 'Historial', count: pasadas.length },
          ]}
        />
      </div>

      <div>
        {list.length === 0 ? (
          <Card>
            <EmptyState
              icon={Car}
              title={tab === 'proximas' ? 'No hay jornadas programadas' : 'Aún no hay historial'}
              hint={tab === 'proximas' ? 'Programa la siguiente salida a Boyacá.' : 'Las jornadas completadas aparecerán aquí.'}
              action={tab === 'proximas' ? <Button size="sm" icon={Plus} onClick={() => setShowNewForm(true)}>Nueva jornada</Button> : undefined}
            />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((j) => {
              const fill = fillOf(j);
              const past = tab === 'pasadas';
              return (
                <Card key={j.id} interactive onClick={() => setSelected(j)} className="min-w-0">
                  <div className="flex items-start gap-3.5">
                    <span
                      className={cn(
                        'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
                        past ? 'bg-surface-container-high text-on-surface-variant' : 'clinical-gradient text-on-primary',
                      )}
                    >
                      <MapPin size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-lg font-semibold text-on-surface truncate">{j.city}</h3>
                      <p className="text-xs text-on-surface-variant flex items-center gap-1.5 mt-0.5">
                        <CalendarDays size={12} /> {formatDate(j.date)}
                      </p>
                    </div>
                    {past && (
                      <span className={cn(
                        'text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0',
                        j.status === 'completada' ? 'bg-[#e0efe8] text-[#1f6b52]' : 'bg-[#f6ddd3] text-[#a03a22]',
                      )}>
                        {j.status === 'completada' ? 'Completada' : 'Cancelada'}
                      </span>
                    )}
                  </div>

                  {past ? (
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Pacientes</p>
                        <p className="font-display text-xl font-semibold text-on-surface tnum">{booked(j)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Facturado</p>
                        <p className="font-display text-xl font-semibold text-success tnum">{formatCOP(j.revenue || 0)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center gap-4">
                      <ProgressRing
                        percent={fill}
                        size={78}
                        stroke={8}
                        label={`${booked(j)}/${j.capacity}`}
                        tone={fill >= 90 ? '#2c7a5e' : fill >= 50 ? '#0c4a3e' : '#cc8a46'}
                      />
                      <div className="min-w-0 flex-1 space-y-2.5">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Proyectado</p>
                          <p className="font-display text-lg font-semibold text-on-surface tnum leading-none mt-0.5">
                            {formatCOP(booked(j) * price(j))}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Por paciente</p>
                          <p className="text-[13px] font-semibold text-on-surface-variant tnum">{formatCOP(price(j))}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {j.notes && <p className="text-[11.5px] text-on-surface-variant mt-3.5 line-clamp-2">{j.notes}</p>}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Detalle */}
      <Modal
        open={Boolean(selected)}
        onClose={() => { setSelected(null); setConfirmDelete(false); }}
        title={selected ? `Jornada · ${selected.city}` : ''}
        subtitle={selected ? formatDate(selected.date) : ''}
      >
        {selected && (
          <div className="space-y-4 pb-2">
            <div className="flex items-center gap-5 bg-surface-container-low rounded-xl p-4">
              <ProgressRing
                percent={fillOf(selected)}
                size={104}
                label={`${booked(selected)}/${selected.capacity}`}
                sublabel="cupos"
              />
              <div className="min-w-0 space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Proyectado</p>
                  <p className="font-display text-xl font-semibold text-on-surface tnum">
                    {formatCOP(booked(selected) * price(selected))}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Tarifa</p>
                  <p className="text-sm font-semibold text-on-surface-variant tnum">{formatCOP(price(selected))} por paciente</p>
                </div>
              </div>
            </div>

            {selected.notes && (
              <div className="bg-surface-container-low rounded-xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Notas</p>
                <p className="text-sm text-on-surface whitespace-pre-wrap">{selected.notes}</p>
              </div>
            )}

            {selected.status === 'programada' && (
              <div className="flex gap-2.5">
                <Button icon={CheckCircle} className="flex-1" onClick={() => setStatus(selected, 'completada')}>Completar</Button>
                <Button icon={XCircle} variant="outline" className="flex-1" onClick={() => setStatus(selected, 'cancelada')}>Cancelar jornada</Button>
              </div>
            )}

            {confirmDelete ? (
              <div className="bg-[#f6ddd3]/60 border border-danger/20 rounded-xl p-3.5 text-center">
                <p className="text-sm text-danger font-semibold mb-3">¿Eliminar esta jornada?</p>
                <div className="flex gap-2">
                  <Button
                    variant="danger" className="flex-1"
                    onClick={async () => {
                      const r = await removeJornada(selected.id);
                      if (r.error) { toast.error(userFriendlyError(r.error)); return; }
                      toast.success('Jornada eliminada');
                      setSelected(null); setConfirmDelete(false);
                    }}
                  >
                    Sí, eliminar
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>Volver</Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full text-danger/70 hover:text-danger text-xs font-semibold py-2 transition-colors"
              >
                Eliminar jornada
              </button>
            )}
          </div>
        )}
      </Modal>

      {/* Nueva jornada */}
      <Modal
        open={showNewForm}
        onClose={() => setShowNewForm(false)}
        title="Programar jornada"
        subtitle="Una salida a otra ciudad con cupos y tarifa propia"
        footer={
          <div className="flex gap-2.5">
            <Button variant="outline" className="flex-1" type="button" onClick={() => setShowNewForm(false)}>Cancelar</Button>
            <Button className="flex-[2]" type="submit" form="new-jornada" loading={saving}>Programar</Button>
          </div>
        }
      >
        <form id="new-jornada" onSubmit={submit} className="space-y-4 pb-2">
          <FormGrid>
            <Field label="Ciudad" required>
              <Select name="city" defaultValue={cities[1] || cities[0]}>
                {cities.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Fecha" required>
              <Input name="date" type="date" required min={todayStr()} />
            </Field>
            <Field label="Capacidad" hint="Cuántos pacientes caben en el día">
              <Input name="capacity" type="number" min="1" defaultValue={15} inputMode="numeric" />
            </Field>
            <Field label="Precio por paciente (COP)">
              <Input name="price" type="number" min="0" step="1000" defaultValue={150000} inputMode="numeric" />
            </Field>
          </FormGrid>
          <Field label="Notas" hint="Ubicación exacta, equipo necesario, contacto local…">
            <Textarea name="notes" rows={3} placeholder="Opcional" />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
