import { useMemo, useState } from 'react';
import {
  Activity, ChevronRight, Download, Plus, Search, ShieldAlert, Users, Wallet, X,
} from 'lucide-react';
import { patientStatuses, formatCOP, formatShortDate } from '../utils/format';
import { usePatients } from '../hooks/useTenantData';
import { downloadCsv } from '../utils/csv';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { Card, EmptyState, PageHeader } from './ui/Card';
import { Stat, StatGrid } from './ui/Stat';
import { Select } from './ui/Field';
import LoadingState from './LoadingState';
import PatientDetailModal from './pacientes/PatientDetailModal';
import PatientFormModal from './pacientes/PatientFormModal';
import { cn } from '../lib/utils';


const PAGE = 40;

export default function Pacientes({ focusPatient, onFocusHandled }) {
  const { patients, loading, insertPatient, updatePatient, removePatient } = usePatients();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCity, setFilterCity] = useState('all');
  const [selected, setSelected] = useState(null);
  const [formFor, setFormFor] = useState(undefined); // undefined = cerrado · null = nuevo · obj = editar
  const [limit, setLimit] = useState(PAGE);

  // La paleta ⌘K puede aterrizar aquí con un paciente ya elegido. Se deriva en
  // vez de copiarlo a estado dentro de un efecto: así no hay render en cascada
  // ni un instante en que la lista se ve sin la ficha abierta.
  const detail = selected || focusPatient || null;
  const closeDetail = () => { setSelected(null); onFocusHandled?.(); };

  // Un filtro nuevo siempre empieza desde la primera página.
  const applyFilter = (setter) => (value) => { setter(value); setLimit(PAGE); };
  const onSearch = applyFilter(setSearch);
  const onStatus = applyFilter(setFilterStatus);
  const onCity = applyFilter(setFilterCity);

  const cities = useMemo(
    () => [...new Set(patients.filter((p) => p.city).map((p) => p.city))].sort(),
    [patients],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return patients.filter((p) => {
      const matchSearch = !q
        || (p.full_name || '').toLowerCase().includes(q)
        || (p.phone || '').includes(search.trim())
        || (p.email || '').toLowerCase().includes(q);
      const matchStatus = filterStatus === 'all' || p.status === filterStatus;
      const matchCity = filterCity === 'all' || p.city === filterCity;
      return matchSearch && matchStatus && matchCity;
    });
  }, [patients, search, filterStatus, filterCity]);

  const active = patients.filter((p) => p.status === 'activo' || p.status === 'en_tratamiento').length;
  const debtors = patients.filter((p) => Number(p.balance_due || 0) > 0);
  const totalDebt = debtors.reduce((s, p) => s + Number(p.balance_due || 0), 0);
  const hasFilters = search || filterStatus !== 'all' || filterCity !== 'all';

  const initials = (n) => (n || 'U').split(' ').map((x) => x[0] || '').join('').slice(0, 2);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <PageHeader
          kicker="Directorio clínico"
          title="Pacientes"
          subtitle={`${patients.length} registrados · ${active} en tratamiento`}
        >
          <Button
            variant="outline" size="sm" icon={Download}
            onClick={() => downloadCsv(
              'pacientes.csv',
              filtered,
              [
                { key: 'full_name', label: 'Nombre' }, { key: 'phone', label: 'Teléfono' }, { key: 'email', label: 'Email' },
                { key: 'city', label: 'Ciudad' }, { key: 'status', label: 'Estado' }, { key: 'treatment', label: 'Tratamiento' },
                { key: 'last_visit', label: 'Última visita' },
                { key: 'total_spent', label: 'Total facturado', format: (v) => v ?? 0 },
                { key: 'balance_due', label: 'Saldo', format: (v) => v ?? 0 },
                { key: 'appointments_count', label: 'Citas', format: (v) => v ?? 0 },
              ],
            )}
          >
            Exportar
          </Button>
          <Button size="sm" icon={Plus} onClick={() => setFormFor(null)}>Nuevo paciente</Button>
        </PageHeader>
      </div>

      <div>
        <StatGrid>
          <Stat label="Total" icon={Users} value={String(patients.length)} sub="en el directorio" />
          <Stat label="En tratamiento" icon={Activity} value={String(active)} sub="activos hoy" />
          <Stat label="Con saldo" icon={Wallet} tone="danger" value={String(debtors.length)} sub={formatCOP(totalDebt)} />
          <Stat label="Por verificar" icon={ShieldAlert} value={String(patients.filter((p) => p.needs_review).length)} sub="datos importados" />
        </StatGrid>
      </div>

      {/* Buscador y filtros */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/60 pointer-events-none" />
          <input
            type="search"
            placeholder="Buscar por nombre, teléfono o email…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/12"
          />
          {search && (
            <button onClick={() => onSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface" aria-label="Limpiar">
              <X size={15} />
            </button>
          )}
        </div>
        <div className="flex gap-2.5">
          <Select value={filterStatus} onChange={(e) => onStatus(e.target.value)} className="flex-1 sm:w-44">
            <option value="all">Estado: todos</option>
            {patientStatuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
          <Select value={filterCity} onChange={(e) => onCity(e.target.value)} className="flex-1 sm:w-44">
            <option value="all">Ciudad: todas</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
      </div>

      {/* Lista */}
      <div>
        {loading && patients.length === 0 ? (
          <Card><LoadingState message="Cargando pacientes…" /></Card>
        ) : filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={Users}
              title={hasFilters ? 'Sin resultados' : 'Aún no hay pacientes'}
              hint={hasFilters ? 'Prueba con otro nombre o quita los filtros.' : 'Crea el primero para empezar a agendar.'}
              action={hasFilters
                ? <Button size="sm" variant="outline" onClick={() => { onSearch(''); setFilterStatus('all'); setFilterCity('all'); }}>Quitar filtros</Button>
                : <Button size="sm" icon={Plus} onClick={() => setFormFor(null)}>Nuevo paciente</Button>}
            />
          </Card>
        ) : (
          <Card pad={false} className="overflow-hidden">
            {hasFilters && (
              <p className="px-4 sm:px-5 py-2.5 text-[11px] text-on-surface-variant border-b border-outline-variant bg-surface-container-low">
                {filtered.length} de {patients.length} pacientes
              </p>
            )}

            {/* Móvil y tablet: tarjetas */}
            <ul className="lg:hidden divide-y divide-outline-variant">
              {filtered.slice(0, limit).map((p) => (
                <li key={p.id}>
                  <button onClick={() => setSelected(p)} className="w-full text-left p-4 flex items-start gap-3 hover:bg-surface-container-low/60 transition-colors">
                    <span className="w-10 h-10 rounded-xl bg-tertiary-container text-on-tertiary-container flex items-center justify-center text-[13px] font-bold flex-shrink-0">
                      {initials(p.full_name)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-on-surface truncate">{p.full_name}</span>
                        {Number(p.balance_due || 0) > 0 && (
                          <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-[#f6ddd3] text-[#a03a22] flex-shrink-0 tnum">
                            Debe
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-on-surface-variant truncate mt-0.5">
                        {p.phone || 'Sin teléfono'} · {p.city || 'Sin ciudad'}
                      </span>
                      <span className="flex items-center justify-between gap-2 mt-2">
                        <Badge status={p.status} />
                        <span className="text-xs font-semibold text-on-surface tnum">
                          {Number(p.total_spent || 0) > 0 ? formatCOP(p.total_spent) : '—'}
                        </span>
                      </span>
                    </span>
                    <ChevronRight size={16} className="text-on-surface-variant/50 flex-shrink-0 mt-2.5" />
                  </button>
                </li>
              ))}
            </ul>

            {/* Escritorio: tabla */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    {['Paciente', 'Contacto', 'Ciudad', 'Estado', 'Última visita', 'Facturado', 'Saldo', ''].map((h, i) => (
                      <th
                        key={h || i}
                        className={cn(
                          'px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant',
                          i >= 5 ? 'text-right' : 'text-left',
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, limit).map((p) => {
                    const debt = Number(p.balance_due || 0);
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelected(p)}
                        className="border-b border-outline-variant/40 hover:bg-surface-container-low/60 cursor-pointer transition-colors group"
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-8 h-8 rounded-lg bg-tertiary-container text-on-tertiary-container flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                              {initials(p.full_name)}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[13px] font-semibold text-on-surface truncate max-w-[220px]">{p.full_name}</span>
                              {p.treatment && <span className="block text-[11px] text-on-surface-variant truncate max-w-[220px]">{p.treatment}</span>}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-[12.5px] text-on-surface-variant tnum">{p.phone || '—'}</td>
                        <td className="px-4 py-2.5 text-[12.5px] text-on-surface-variant">{p.city || '—'}</td>
                        <td className="px-4 py-2.5"><Badge status={p.status} /></td>
                        <td className="px-4 py-2.5 text-[12.5px] text-on-surface-variant">{formatShortDate(p.last_visit)}</td>
                        <td className="px-4 py-2.5 text-[13px] font-display font-semibold text-right tnum">
                          {Number(p.total_spent || 0) > 0
                            ? <span className="text-on-surface">{formatCOP(p.total_spent)}</span>
                            : <span className="text-on-surface-variant/40" title="Sin pagos registrados en el sistema">—</span>}
                        </td>
                        <td className={cn('px-4 py-2.5 text-[13px] font-display font-semibold text-right tnum', debt > 0 ? 'text-danger' : 'text-on-surface-variant/40')}>
                          {debt > 0 ? formatCOP(debt) : '—'}
                        </td>
                        <td className="px-3 py-2.5 w-8">
                          <ChevronRight size={15} className="text-on-surface-variant/40 group-hover:text-primary transition-colors" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filtered.length > limit && (
              <div className="p-4 border-t border-outline-variant flex justify-center">
                <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
                  Ver {Math.min(PAGE, filtered.length - limit)} más · quedan {filtered.length - limit}
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>

      <PatientDetailModal
        patient={detail}
        open={Boolean(detail) && formFor === undefined}
        onClose={closeDetail}
        onEdit={() => setFormFor(detail)}
        onDelete={removePatient}
      />

      <PatientFormModal
        open={formFor !== undefined}
        patient={formFor || null}
        onClose={() => setFormFor(undefined)}
        onSave={(values) => (formFor ? updatePatient(formFor.id, values) : insertPatient(values))}
      />
    </div>
  );
}
