import { useMemo, useState } from 'react';
import {
  AlertTriangle, Building2, CalendarRange, Download, MapPin, Plus, Target, TrendingUp, Wallet,
} from 'lucide-react';
import { formatCOP, formatDate } from '../utils/format';
import { useTransactions, usePatients } from '../hooks/useTenantData';
import { useToast } from './Toast';
import { userFriendlyError } from '../lib/logger';
import LoadingState from './LoadingState';
import { downloadCsv } from '../utils/csv';
import PaymentLinkButton from './PaymentLinkButton';
import Button from './ui/Button';
import { Card, EmptyState, PageHeader, SectionHeader } from './ui/Card';
import { ProgressRing, Stat, StatGrid } from './ui/Stat';
import Modal from './ui/Modal';
import { Field, FormGrid, Input, Select, Textarea } from './ui/Field';
import { todayStr as today, toLocalDateStr, addDaysStr, parseDateStr } from '../utils/dates';


const MONTHLY_GOAL = 5000000;

export default function Finanzas() {
  const { transactions, loading, insertTransaction } = useTransactions();
  const { patients } = usePatients();
  const toast = useToast();
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const todayStr = today();
  const monthStr = todayStr.substring(0, 7);
  const monthName = parseDateStr(`${monthStr}-01`).toLocaleDateString('es-CO', { month: 'long' });

  const m = useMemo(() => {
    const now = new Date();
    const incomes = transactions.filter((t) => t.type === 'income');
    const weekStart = new Date(now); weekStart.setHours(12, 0, 0, 0);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekStartStr = toLocalDateStr(weekStart);
    const lastMonthStr = toLocalDateStr(new Date(now.getFullYear(), now.getMonth() - 1, 1, 12)).substring(0, 7);

    const sum = (rows) => rows.reduce((s, t) => s + t.amount, 0);
    const monthIncome = sum(incomes.filter((t) => t.date?.startsWith(monthStr)));
    const lastMonthIncome = sum(incomes.filter((t) => t.date?.startsWith(lastMonthStr)));

    // Comparativa de 6 meses
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1, 12);
      const key = toLocalDateStr(d).substring(0, 7);
      months.push({
        key,
        label: d.toLocaleDateString('es-CO', { month: 'short' }).replace('.', ''),
        income: sum(incomes.filter((t) => t.date?.startsWith(key))),
      });
    }

    // Serie diaria de 30 días para el sparkline
    const daily = Array.from({ length: 30 }, (_, i) => {
      const d = addDaysStr(i - 29);
      return sum(incomes.filter((t) => t.date === d));
    });

    const bySource = { consultorio: 0, jornadas: 0 };
    const byCity = {};
    for (const t of incomes.filter((x) => x.date?.startsWith(monthStr))) {
      if (t.category === 'jornada') bySource.jornadas += t.amount;
      else bySource.consultorio += t.amount;
      const city = patients.find((p) => p.id === t.patient_id)?.city || 'Sin ciudad';
      byCity[city] = (byCity[city] || 0) + t.amount;
    }

    return {
      incomes,
      todayIncome: sum(incomes.filter((t) => t.date === todayStr)),
      weekIncome: sum(incomes.filter((t) => t.date >= weekStartStr)),
      monthIncome,
      lastMonthIncome,
      delta: lastMonthIncome > 0 ? Math.round(((monthIncome - lastMonthIncome) / lastMonthIncome) * 100) : undefined,
      months,
      daily,
      bySource,
      byCity,
      avgPerPatient: patients.length > 0 ? Math.round(monthIncome / patients.length) : 0,
    };
  }, [transactions, patients, monthStr, todayStr]);

  // `balance_due` solo se llena cuando la agenda decía literalmente "Debe"/
  // "Saldo" — las demás cifras del histórico son tarifas o abonos ya pagados.
  const debtors = useMemo(() => patients
    .filter((p) => Number(p.balance_due || 0) > 0)
    .map((p) => ({ id: p.id, name: p.full_name, amount: Number(p.balance_due), phone: p.phone, email: p.email, lastVisit: p.last_visit }))
    .sort((a, b) => b.amount - a.amount), [patients]);
  const totalDebt = debtors.reduce((s, d) => s + d.amount, 0);

  if (loading && transactions.length === 0) return <LoadingState message="Cargando finanzas…" />;

  const goalPercent = Math.round((m.monthIncome / MONTHLY_GOAL) * 100);
  const maxMonth = Math.max(...m.months.map((x) => x.income), 1);
  const maxCity = Math.max(...Object.values(m.byCity), 1);

  const submit = async (e) => {
    e.preventDefault();
    const f = e.target;
    setSaving(true);
    const r = await insertTransaction({
      type: 'income',
      amount: parseInt(f.amount.value, 10),
      category: f.category.value,
      description: f.description.value || null,
      patient_id: f.patient_id.value || null,
      date: f.date.value,
    });
    setSaving(false);
    if (r.error) { toast.error(userFriendlyError(r.error)); return; }
    toast.success('Ingreso registrado');
    setShowNewForm(false);
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <PageHeader kicker="Reporte financiero" title="Finanzas" subtitle="Ingresos, fuentes y cobros pendientes">
          <Button
            variant="outline" size="sm" icon={Download}
            onClick={() => downloadCsv(
              'transacciones.csv',
              transactions,
              [
                { key: 'date', label: 'Fecha' }, { key: 'type', label: 'Tipo' }, { key: 'category', label: 'Categoría' },
                { key: 'description', label: 'Descripción' }, { key: 'amount', label: 'Monto', format: (v) => v ?? 0 },
              ],
            )}
          >
            Exportar
          </Button>
          <Button size="sm" icon={Plus} onClick={() => setShowNewForm(true)}>Registrar ingreso</Button>
        </PageHeader>
      </div>

      <div>
        <StatGrid>
          <Stat label="Ingresos hoy" icon={Wallet} value={formatCOP(m.todayIncome)} sub={formatDate(todayStr)} />
          <Stat label="Esta semana" icon={CalendarRange} value={formatCOP(m.weekIncome)} series={m.daily.slice(-7)} />
          <Stat label="Este mes" icon={TrendingUp} value={formatCOP(m.monthIncome)} delta={m.delta} series={m.daily} />
          <Stat label="Promedio/paciente" icon={Target} tone="accent" value={formatCOP(m.avgPerPatient)} sub={`${patients.length} pacientes`} />
        </StatGrid>
      </div>

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        {/* Meta */}
        <div>
          <Card className="h-full">
            <SectionHeader icon={Target} title="Meta del mes" hint={formatCOP(MONTHLY_GOAL)} />
            <div className="flex items-center gap-5">
              <ProgressRing percent={goalPercent} size={124} sublabel="de la meta" />
              <div className="min-w-0">
                <p className="font-display text-2xl font-semibold text-on-surface tnum leading-none">{formatCOP(m.monthIncome)}</p>
                <p className="text-xs text-on-surface-variant mt-1.5 first-letter:uppercase">facturado en {monthName}</p>
                <p className="text-[11px] text-on-surface-variant mt-3 leading-snug">
                  Faltan <span className="font-semibold text-on-surface tnum">{formatCOP(Math.max(0, MONTHLY_GOAL - m.monthIncome))}</span>
                  {totalDebt > 0 && (
                    <> · hay <span className="font-semibold text-danger tnum">{formatCOP(totalDebt)}</span> por cobrar</>
                  )}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Comparativa 6 meses */}
        <div>
          <Card className="h-full">
            <SectionHeader icon={TrendingUp} title="Últimos 6 meses" hint={`Máximo ${formatCOP(maxMonth)}`} />
            <div className="flex items-end gap-2 sm:gap-3 h-44">
              {m.months.map((x, i) => {
                const current = i === m.months.length - 1;
                const h = Math.max((x.income / maxMonth) * 100, 2);
                return (
                  <div key={x.key} className="flex-1 flex flex-col items-center justify-end h-full min-w-0 group">
                    <span className="text-[9.5px] sm:text-[10.5px] font-display font-semibold text-on-surface mb-1.5 tnum opacity-0 group-hover:opacity-100 transition-opacity sm:opacity-100 truncate w-full text-center">
                      {x.income > 0 ? formatCOP(x.income).replace(/\s/g, '') : '—'}
                    </span>
                    <div
                      style={{ height: `${h}%`, transition: 'height 0.7s cubic-bezier(0.22,1,0.36,1)' }}
                      className={`w-full rounded-t-lg ${current ? 'amber-gradient' : 'clinical-gradient opacity-80 group-hover:opacity-100'}`}
                    />
                    <span className="text-[10px] sm:text-[11px] text-on-surface-variant mt-2 capitalize truncate w-full text-center">{x.label}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-2">
        {/* Fuente */}
        <div>
          <Card className="h-full">
            <SectionHeader icon={Building2} title="Ingresos por fuente" hint="Mes en curso" />
            <div className="space-y-4">
              {[
                { icon: Building2, label: 'Consultorio', val: m.bySource.consultorio, cls: 'clinical-gradient' },
                { icon: MapPin, label: 'Jornadas', val: m.bySource.jornadas, cls: 'amber-gradient' },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3.5">
                  <span className="bg-primary/8 p-2.5 rounded-xl flex-shrink-0"><s.icon size={18} className="text-primary" /></span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2 mb-1.5">
                      <span className="text-[13px] font-medium text-on-surface">{s.label}</span>
                      <span className="text-[13px] font-display font-semibold text-on-surface tnum">{formatCOP(s.val)}</span>
                    </div>
                    <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden">
                      <div
                        style={{ width: `${m.monthIncome > 0 ? (s.val / m.monthIncome) * 100 : 0}%`, transition: 'width 0.8s cubic-bezier(0.22,1,0.36,1)' }}
                        className={`${s.cls} h-full rounded-full`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Ciudad */}
        <div>
          <Card className="h-full">
            <SectionHeader icon={MapPin} title="Ingresos por ciudad" hint="Mes en curso" />
            <div className="space-y-2.5">
              {Object.entries(m.byCity).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a).slice(0, 6).map(([city, income]) => (
                <div key={city} className="flex items-center gap-3">
                  <span className="text-[12.5px] text-on-surface w-20 sm:w-24 truncate flex-shrink-0">{city}</span>
                  <div className="flex-1 bg-surface-container-high rounded-full h-2 overflow-hidden min-w-0">
                    <div
                      style={{ width: `${(income / maxCity) * 100}%`, transition: 'width 0.8s cubic-bezier(0.22,1,0.36,1)' }}
                      className="clinical-gradient h-full rounded-full"
                    />
                  </div>
                  <span className="text-[12.5px] font-display font-semibold text-on-surface min-w-[84px] text-right tnum flex-shrink-0">
                    {formatCOP(income)}
                  </span>
                </div>
              ))}
              {Object.values(m.byCity).every((v) => !v) && <EmptyState title="Sin ingresos este mes" hint="Los cobros aparecerán aquí en cuanto se registren." />}
            </div>
          </Card>
        </div>
      </div>

      {/* Pagos pendientes */}
      <div>
        <Card>
          <SectionHeader
            icon={AlertTriangle}
            title="Pagos pendientes"
            hint={debtors.length > 0 ? `${debtors.length} pacientes · ${formatCOP(totalDebt)}` : undefined}
          />
          {debtors.length === 0 ? (
            <EmptyState icon={Wallet} title="Sin pagos pendientes" hint="Todo al día." />
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3 max-h-[440px] overflow-y-auto pr-1">
              {debtors.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 p-3 bg-surface-container-low border border-outline-variant/60 rounded-xl">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-on-surface truncate">{d.name}</p>
                    <p className="text-[11px] text-on-surface-variant truncate">
                      {d.lastVisit ? `Últ. visita ${formatDate(d.lastVisit)}` : 'Sin visitas registradas'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[13px] font-display font-semibold text-danger tnum">{formatCOP(d.amount)}</p>
                    <PaymentLinkButton
                      amount={d.amount}
                      description={`Saldo pendiente — ${d.name}`}
                      patientId={d.id}
                      customerName={d.name}
                      customerPhone={d.phone}
                      customerEmail={d.email}
                      label="Cobrar"
                      className="!px-2.5 !py-1 !text-[11px] !font-semibold !rounded-lg mt-1"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Proyección */}
      <div>
        <Card tone="pine" className="relative overflow-hidden">
          <TrendingUp size={130} className="absolute -right-5 -bottom-8 opacity-[0.12]" aria-hidden="true" />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-tertiary-fixed">Facturado este mes</p>
          <p className="font-display text-hero font-semibold tnum mt-1.5">{formatCOP(m.monthIncome)}</p>
          <p className="text-sm text-on-primary/75 mt-2 max-w-lg">
            {typeof m.delta === 'number'
              ? `${m.delta >= 0 ? 'Vas' : 'Estás'} ${Math.abs(m.delta)}% ${m.delta >= 0 ? 'por encima' : 'por debajo'} del mes anterior (${formatCOP(m.lastMonthIncome)}).`
              : 'Aún no hay mes anterior para comparar.'}
          </p>
        </Card>
      </div>

      {/* Registrar ingreso */}
      <Modal
        open={showNewForm}
        onClose={() => setShowNewForm(false)}
        title="Registrar ingreso"
        subtitle="Para cobros en efectivo o por fuera de la pasarela"
        footer={
          <div className="flex gap-2.5">
            <Button variant="outline" className="flex-1" type="button" onClick={() => setShowNewForm(false)}>Cancelar</Button>
            <Button className="flex-[2]" type="submit" form="new-income" loading={saving}>Registrar</Button>
          </div>
        }
      >
        <form id="new-income" onSubmit={submit} className="space-y-4 pb-2">
          <Field label="Monto (COP)" required>
            <Input name="amount" type="number" required min="0" step="1000" inputMode="numeric" placeholder="150000" />
          </Field>
          <FormGrid>
            <Field label="Categoría">
              <Select name="category" defaultValue="consulta">
                <option value="consulta">Consulta</option>
                <option value="seguimiento">Seguimiento</option>
                <option value="jornada">Jornada</option>
                <option value="producto">Producto</option>
                <option value="otro">Otro</option>
              </Select>
            </Field>
            <Field label="Fecha" required>
              <Input name="date" type="date" required defaultValue={todayStr} />
            </Field>
          </FormGrid>
          <Field label="Paciente" hint="Opcional — permite atribuir el ingreso por ciudad">
            <Select name="patient_id" defaultValue="">
              <option value="">Sin paciente asociado</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </Select>
          </Field>
          <Field label="Descripción">
            <Textarea name="description" rows={2} placeholder="Detalle del ingreso…" />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
