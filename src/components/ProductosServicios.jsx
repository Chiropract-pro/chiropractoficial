import { useState, useMemo } from 'react';
import { Package, Stethoscope, ShoppingCart, Plus, Edit2, Trash2, X, AlertTriangle, TrendingUp, Calendar, MapPin, Boxes, Receipt } from 'lucide-react';
import { useServices, useProducts, useSales } from '../hooks/useTenantData';
import { formatCOP, formatShortDate } from '../utils/format';
import { userFriendlyError } from '../lib/logger';
import EmitInvoiceButton from './billing/EmitInvoiceButton';
import PaymentLinkButton from './PaymentLinkButton';
import { useToast } from './Toast';
import { Card, EmptyState as UIEmptyState, PageHeader, SectionHeader } from './ui/Card';
import { Stat, StatGrid } from './ui/Stat';
import { SegmentedTabs } from './ui/Tabs';
import UIModal from './ui/Modal';
import { Field } from './ui/Field';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { cn } from '../lib/utils';


const SERVICE_CATEGORIES = [
  { value: 'consulta', label: 'Consulta' },
  { value: 'tratamiento', label: 'Tratamiento' },
  { value: 'paquete', label: 'Paquete' },
  { value: 'evaluacion', label: 'Evaluación' },
  { value: 'otro', label: 'Otro' },
];

const PRODUCT_CATEGORIES = [
  { value: 'almohada', label: 'Almohada' },
  { value: 'cinturon', label: 'Cinturón' },
  { value: 'suplemento', label: 'Suplemento' },
  { value: 'accesorio', label: 'Accesorio' },
  { value: 'general', label: 'General' },
];

const PAYMENT_METHODS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'daviplata', label: 'Daviplata' },
  { value: 'otro', label: 'Otro' },
];

export default function ProductosServicios() {
  const [activeTab, setActiveTab] = useState('servicios');

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <PageHeader
          kicker="Catálogo y punto de venta"
          title="Productos y servicios"
          subtitle="Lo que se cobra en consultorio y lo que se vende en jornada"
        />
      </div>

      <div>
        <SegmentedTabs
          layoutId="productos-tab"
          value={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: 'servicios', label: 'Servicios', icon: Stethoscope },
            { id: 'productos', label: 'Productos', icon: Package },
            { id: 'ventas', label: 'Ventas', icon: ShoppingCart },
          ]}
        />
      </div>

      {activeTab === 'servicios' && <ServicesTab />}
      {activeTab === 'productos' && <ProductsTab />}
      {activeTab === 'ventas' && <SalesTab />}
    </div>
  );
}

// ===========================
// SERVICIOS
// ===========================
function ServicesTab() {
  const { services, loading, insertService, updateService, removeService } = useServices();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const total = services.length;
  const active = services.filter((s) => s.active).length;
  const avgPrice = active > 0 ? Math.round(services.filter((s) => s.active).reduce((sum, s) => sum + (s.price || 0), 0) / active) : 0;

  const handleSave = async (data) => {
    const result = editing
      ? await updateService(editing.id, data)
      : await insertService(data);
    if (result.error) { toast.error(userFriendlyError(result.error)); return; }
    toast.success('Guardado');
    setShowForm(false);
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <StatGrid cols={3}>
        <Stat label="Servicios" icon={Stethoscope} value={String(total)} sub="en el catálogo" />
        <Stat label="Activos" icon={Boxes} value={String(active)} sub="visibles en jornadas" />
        <Stat label="Precio promedio" icon={TrendingUp} tone="accent" value={formatCOP(avgPrice)} sub="de los activos" />
      </StatGrid>

      <div className="flex items-center justify-between gap-3">
        <SectionHeader icon={Stethoscope} title="Catálogo" className="mb-0" />
        <Button size="sm" icon={Plus} onClick={() => { setEditing(null); setShowForm(true); }}>Nuevo servicio</Button>
      </div>

      {loading ? (
        <p className="text-on-surface-variant text-center py-8">Cargando...</p>
      ) : services.length === 0 ? (
        <EmptyState icon={Stethoscope} message="Aún no tienes servicios. Crea el primero." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {services.map((s) => (
            <ServiceCard
              key={s.id}
              service={s}
              onEdit={() => { setEditing(s); setShowForm(true); }}
              onDelete={async () => {
                if (confirm(`¿Eliminar "${s.name}"?`)) {
                  await removeService(s.id);
                }
              }}
            />
          ))}
        </div>
      )}

      {showForm && (
        <ServiceForm
          service={editing}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function ServiceCard({ service, onEdit, onDelete }) {
  const cat = SERVICE_CATEGORIES.find((c) => c.value === service.category);
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-display text-[15px] font-semibold text-on-surface truncate">{service.name}</h4>
          <p className="text-[11px] text-on-surface-variant mt-0.5">{cat?.label || service.category}</p>
        </div>
        <div className="flex gap-0.5 flex-shrink-0">
          <button onClick={onEdit} className="text-on-surface-variant hover:text-primary hover:bg-surface-container-low p-1.5 rounded-lg transition-colors" title="Editar">
            <Edit2 size={14} />
          </button>
          <button onClick={onDelete} className="text-on-surface-variant hover:text-error hover:bg-error-container/40 p-1.5 rounded-lg transition-colors" title="Eliminar">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {service.description && (
        <p className="text-[11.5px] text-on-surface-variant mb-3 line-clamp-2">{service.description}</p>
      )}
      <div className="flex items-end justify-between gap-3 mt-auto pt-3 hairline">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Precio</p>
          <p className="font-display text-lg font-semibold text-primary tnum leading-none mt-0.5">{formatCOP(service.price)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Duración</p>
          <p className="text-[13px] font-semibold text-on-surface tnum mt-0.5">{service.duration_min || 0} min</p>
        </div>
        {!service.active && <Badge tone="neutral">Inactivo</Badge>}
      </div>
    </Card>
  );
}

function ServiceForm({ service, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: service?.name || '',
    description: service?.description || '',
    category: service?.category || 'consulta',
    price: service?.price || 0,
    duration_min: service?.duration_min || 30,
    active: service?.active ?? true,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return alert('El nombre es obligatorio');
    onSave({
      ...form,
      price: Number(form.price) || 0,
      duration_min: Number(form.duration_min) || 0,
    });
  };

  return (
    <Modal title={service ? 'Editar servicio' : 'Nuevo servicio'} onClose={onCancel}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre *">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input"
            required
          />
        </Field>
        <Field label="Descripción">
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input min-h-[60px]"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoría">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="input"
            >
              {SERVICE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Duración (min)">
            <input
              type="number"
              min="0"
              value={form.duration_min}
              onChange={(e) => setForm({ ...form, duration_min: e.target.value })}
              className="input"
            />
          </Field>
        </div>
        <Field label="Precio (COP)">
          <input
            type="number"
            min="0"
            step="1000"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="input"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Activo (visible en jornadas)
        </label>
        <FormActions onCancel={onCancel} />
      </form>
    </Modal>
  );
}

// ===========================
// PRODUCTOS
// ===========================
function ProductsTab() {
  const { products, loading, insertProduct, updateProduct, removeProduct } = useProducts();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const total = products.length;
  const active = products.filter((p) => p.active).length;
  const lowStock = products.filter((p) => p.active && p.stock <= (p.low_stock_threshold || 5));
  const totalStockValue = products.reduce((sum, p) => sum + (p.stock || 0) * (p.price || 0), 0);

  const handleSave = async (data) => {
    const result = editing
      ? await updateProduct(editing.id, data)
      : await insertProduct(data);
    if (result.error) { toast.error(userFriendlyError(result.error)); return; }
    toast.success('Guardado');
    setShowForm(false);
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <StatGrid cols={3}>
        <Stat label="Productos activos" icon={Package} value={String(active)} sub={`${total} en total`} />
        <Stat label="Valor de inventario" icon={Boxes} tone="accent" value={formatCOP(totalStockValue)} sub="a precio de venta" />
        <Stat
          label="Stock bajo" icon={AlertTriangle} value={String(lowStock.length)}
          tone={lowStock.length > 0 ? 'danger' : 'default'} sub="requieren reposición"
        />
      </StatGrid>

      {lowStock.length > 0 && (
        <div className="bg-[#f6e7db]/70 border border-warning/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-warning flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#a85b32]">Productos con stock bajo</p>
            <p className="text-xs text-[#a85b32]/85 mt-1">{lowStock.map((p) => p.name).join(' · ')}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <SectionHeader icon={Package} title="Inventario" className="mb-0" />
        <Button size="sm" icon={Plus} onClick={() => { setEditing(null); setShowForm(true); }}>Nuevo producto</Button>
      </div>

      {loading ? (
        <p className="text-on-surface-variant text-center py-8">Cargando...</p>
      ) : products.length === 0 ? (
        <EmptyState icon={Package} message="Aún no tienes productos. Agrega el primero al inventario." />
      ) : (
        <Card pad={false} className="overflow-hidden">
          {/* Móvil: la tabla de 5 columnas se salía de la pantalla y obligaba a
              hacer scroll lateral para llegar a los botones. Aquí son tarjetas. */}
          <ul className="md:hidden divide-y divide-outline-variant">
            {products.map((p) => {
              const isLow = p.stock <= (p.low_stock_threshold || 5);
              const cat = PRODUCT_CATEGORIES.find((c) => c.value === p.category);
              return (
                <li key={p.id} className="p-4 flex items-start gap-3">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-11 h-11 rounded-xl object-cover bg-surface-container-low flex-shrink-0" loading="lazy" />
                  ) : (
                    <span className="w-11 h-11 rounded-xl bg-surface-container-low flex-shrink-0 flex items-center justify-center text-on-surface-variant">
                      <Package size={17} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-on-surface truncate">{p.name}</p>
                    <p className="text-[11px] text-on-surface-variant truncate">
                      {cat?.label || p.category}{p.sku ? ` · SKU ${p.sku}` : ''}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="font-display text-[15px] font-semibold text-on-surface tnum">{formatCOP(p.price)}</span>
                      <span className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full tnum',
                        isLow ? 'bg-[#f6e7db] text-[#a85b32]' : 'bg-[#e0efe8] text-[#1f6b52]',
                      )}>
                        {p.stock} en stock
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={() => { setEditing(p); setShowForm(true); }} className="text-on-surface-variant hover:text-primary p-1.5 rounded-lg hover:bg-surface-container-low transition-colors">
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={async () => { if (confirm(`¿Eliminar "${p.name}"?`)) await removeProduct(p.id); }}
                      className="text-on-surface-variant hover:text-error p-1.5 rounded-lg hover:bg-error-container/40 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-container-low">
              <tr>
                <th className="text-left px-4 py-3 text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">Producto</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">Categoría</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">Precio</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">Stock</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const isLow = p.stock <= (p.low_stock_threshold || 5);
                const cat = PRODUCT_CATEGORIES.find((c) => c.value === p.category);
                return (
                  <tr key={p.id} className="border-t border-outline-variant/50 hover:bg-surface-container-low/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover bg-surface-container-low flex-shrink-0" loading="lazy" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-surface-container-low flex-shrink-0 flex items-center justify-center text-on-surface-variant">
                            <Package size={16} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-on-surface truncate">{p.name}</p>
                          {p.sku && <p className="text-xs text-on-surface-variant">SKU: {p.sku}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-on-surface-variant">{cat?.label || p.category}</td>
                    <td className="px-4 py-3 text-right text-[13px] font-display font-semibold text-on-surface tnum">{formatCOP(p.price)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn(
                        'inline-block px-2 py-0.5 rounded-full text-[11px] font-bold tnum',
                        isLow ? 'bg-[#f6e7db] text-[#a85b32]' : 'bg-[#e0efe8] text-[#1f6b52]',
                      )}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => { setEditing(p); setShowForm(true); }} className="text-on-surface-variant hover:text-primary p-1">
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`¿Eliminar "${p.name}"?`)) {
                              await removeProduct(p.id);
                            }
                          }}
                          className="text-on-surface-variant hover:text-error p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </Card>
      )}

      {showForm && (
        <ProductForm
          product={editing}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function ProductForm({ product, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: product?.name || '',
    description: product?.description || '',
    category: product?.category || 'general',
    sku: product?.sku || '',
    price: product?.price || 0,
    cost: product?.cost || 0,
    stock: product?.stock || 0,
    low_stock_threshold: product?.low_stock_threshold || 5,
    active: product?.active ?? true,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return alert('El nombre es obligatorio');
    onSave({
      ...form,
      price: Number(form.price) || 0,
      cost: Number(form.cost) || 0,
      stock: Number(form.stock) || 0,
      low_stock_threshold: Number(form.low_stock_threshold) || 5,
    });
  };

  return (
    <Modal title={product ? 'Editar producto' : 'Nuevo producto'} onClose={onCancel}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre *">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input"
            required
          />
        </Field>
        <Field label="Descripción">
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input min-h-[60px]"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoría">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="input"
            >
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field label="SKU">
            <input
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="input"
              placeholder="Opcional"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio venta (COP)">
            <input
              type="number"
              min="0"
              step="1000"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Costo (COP)">
            <input
              type="number"
              min="0"
              step="1000"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
              className="input"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stock actual">
            <input
              type="number"
              min="0"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Alerta stock bajo">
            <input
              type="number"
              min="0"
              value={form.low_stock_threshold}
              onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
              className="input"
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Activo
        </label>
        <FormActions onCancel={onCancel} />
      </form>
    </Modal>
  );
}

// ===========================
// VENTAS
// ===========================
function SalesTab() {
  const { sales, loading, createSale, cancelSale, refetchSales } = useSales();
  const toast = useToast();
  const { services } = useServices();
  const { products } = useProducts();
  const [showForm, setShowForm] = useState(false);

  const totalSales = sales.length;
  const completedSales = sales.filter((s) => s.status === 'completada');
  const totalRevenue = completedSales.reduce((sum, s) => sum + (s.total || 0), 0);
  const avgSale = completedSales.length > 0 ? Math.round(totalRevenue / completedSales.length) : 0;

  // El filtro va DENTRO del memo: `completedSales` es un array nuevo en cada
  // render, así que como dependencia no memoizaba nada.
  const salesByJornada = useMemo(() => {
    const grouped = {};
    sales.filter((s) => s.status === 'completada').forEach((s) => {
      if (!s.jornadas) return;
      const key = `${s.jornadas.city}-${s.jornadas.date}`;
      if (!grouped[key]) {
        grouped[key] = { city: s.jornadas.city, date: s.jornadas.date, count: 0, total: 0 };
      }
      grouped[key].count++;
      grouped[key].total += s.total || 0;
    });
    return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  }, [sales]);

  const handleCreate = async (data) => {
    const result = await createSale(data);
    if (result.error) { toast.error(userFriendlyError(result.error)); return; }
    toast.success('Venta registrada');
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <StatGrid cols={3}>
        <Stat label="Ventas" icon={Receipt} value={String(totalSales)} sub={`${completedSales.length} completadas`} />
        <Stat label="Ingresos" icon={TrendingUp} tone="accent" value={formatCOP(totalRevenue)} sub="histórico" />
        <Stat label="Venta promedio" icon={ShoppingCart} value={formatCOP(avgSale)} sub="por transacción" />
      </StatGrid>

      {salesByJornada.length > 0 && (
        <Card>
          <SectionHeader icon={TrendingUp} title="Top jornadas por ingresos" hint="Las 5 más recientes" />
          <div className="space-y-1">
            {salesByJornada.map((j, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-outline-variant last:border-0">
                <div className="flex items-center gap-3">
                  <MapPin size={14} className="text-on-surface-variant" />
                  <div>
                    <p className="text-sm font-medium text-on-surface">{j.city}</p>
                    <p className="text-xs text-on-surface-variant">{formatShortDate(j.date)} · {j.count} ventas</p>
                  </div>
                </div>
                <p className="font-display font-semibold text-primary tnum">{formatCOP(j.total)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between gap-3">
        <SectionHeader icon={Receipt} title="Historial de ventas" className="mb-0" />
        <Button
          size="sm" icon={Plus}
          disabled={services.length === 0 && products.length === 0}
          onClick={() => setShowForm(true)}
        >
          Nueva venta
        </Button>
      </div>

      {loading ? (
        <p className="text-on-surface-variant text-center py-8">Cargando...</p>
      ) : sales.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          message={services.length === 0 && products.length === 0
            ? 'Crea servicios o productos primero para registrar ventas.'
            : 'Aún no tienes ventas registradas.'}
        />
      ) : (
        <div className="space-y-2">
          {sales.map((s) => (
            <SaleCard key={s.id} sale={s} onCancel={cancelSale} onInvoiceEmitted={refetchSales} />
          ))}
        </div>
      )}

      {showForm && (
        <SaleForm
          services={services.filter((s) => s.active)}
          products={products.filter((p) => p.active && p.stock > 0)}
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function SaleCard({ sale, onCancel, onInvoiceEmitted }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-lg font-semibold text-on-surface tnum">{formatCOP(sale.total)}</span>
            <Badge status={sale.status} />
            <span className="text-[11px] text-on-surface-variant capitalize">{sale.payment_method}</span>
            {sale.status === 'completada' && (
              <EmitInvoiceButton sale={sale} onEmitted={onInvoiceEmitted} compact />
            )}
            {/* Venta sin pagar: se cobra en línea. Cuando Bold confirma el pago,
                el webhook la marca como completada automáticamente. */}
            {sale.status === 'pendiente' && (sale.total || 0) > 0 && (
              <PaymentLinkButton
                amount={sale.total}
                description={`Venta ${formatShortDate(sale.date)}${sale.patients?.full_name ? ` — ${sale.patients.full_name}` : ''}`}
                patientId={sale.patient_id}
                customerName={sale.patients?.full_name}
                customerPhone={sale.patients?.phone}
                customerEmail={sale.patients?.email}
                label="Cobrar"
                className="!px-2.5 !py-0.5 !text-xs"
              />
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-on-surface-variant">
            <span className="flex items-center gap-1"><Calendar size={12} /> {formatShortDate(sale.date)}</span>
            {sale.patients?.full_name && <span>· {sale.patients.full_name}</span>}
            {sale.jornadas?.city && <span className="flex items-center gap-1">· <MapPin size={12} /> {sale.jornadas.city}</span>}
          </div>
          {sale.e_invoice_pdf_url && (
            <a
              href={sale.e_invoice_pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1"
            >
              📄 Descargar PDF de factura
            </a>
          )}
        </div>
        <div className="flex gap-3 flex-shrink-0">
          <button onClick={() => setExpanded(!expanded)} className="text-xs font-semibold text-primary hover:underline">
            {expanded ? 'Ocultar' : 'Ver items'}
          </button>
          {sale.status === 'completada' && (
            <button
              onClick={async () => { if (confirm('¿Cancelar esta venta?')) await onCancel(sale.id); }}
              className="text-xs font-semibold text-error hover:underline"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
      {expanded && sale.sale_items?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-outline-variant space-y-1">
          {sale.sale_items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-on-surface-variant">
                {item.quantity}× {item.item_name}
                <span className="text-xs ml-1 opacity-70">({item.item_type === 'service' ? 'servicio' : 'producto'})</span>
              </span>
              <span className="font-medium">{formatCOP(item.subtotal)}</span>
            </div>
          ))}
        </div>
      )}
      {sale.notes && expanded && (
        <p className="mt-2 text-xs text-on-surface-variant italic">{sale.notes}</p>
      )}
    </Card>
  );
}

function SaleForm({ services, products, onSave, onCancel }) {
  const [items, setItems] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [notes, setNotes] = useState('');

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

  const addItem = (item, type) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.itemId === item.id && i.itemType === type);
      if (existing) {
        return prev.map((i) =>
          i.itemId === item.id && i.itemType === type
            ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unitPrice }
            : i
        );
      }
      return [...prev, {
        itemType: type,
        itemId: item.id,
        name: item.name,
        unitPrice: item.price,
        quantity: 1,
        subtotal: item.price,
      }];
    });
  };

  const updateQuantity = (idx, qty) => {
    const q = Math.max(1, Number(qty) || 1);
    setItems((prev) => prev.map((it, i) =>
      i === idx ? { ...it, quantity: q, subtotal: q * it.unitPrice } : it
    ));
  };

  const removeItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (items.length === 0) return;
    onSave({ items, paymentMethod, notes });
  };

  return (
    <Modal title="Nueva venta" onClose={onCancel} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-2">Servicios disponibles</label>
            <div className="border border-outline-variant rounded-xl max-h-52 overflow-y-auto bg-surface-container-lowest">
              {services.length === 0 ? (
                <p className="p-3 text-xs text-on-surface-variant">Sin servicios activos</p>
              ) : (
                services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => addItem(s, 'service')}
                    className="w-full text-left px-3 py-2.5 hover:bg-surface-container-low border-b border-outline-variant/60 last:border-0 flex justify-between gap-2 text-sm transition-colors"
                  >
                    <span className="truncate">{s.name}</span>
                    <span className="text-on-surface-variant tnum flex-shrink-0">{formatCOP(s.price)}</span>
                  </button>
                ))
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-2">Productos en stock</label>
            <div className="border border-outline-variant rounded-xl max-h-52 overflow-y-auto bg-surface-container-lowest">
              {products.length === 0 ? (
                <p className="p-3 text-xs text-on-surface-variant">Sin productos en stock</p>
              ) : (
                products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addItem(p, 'product')}
                    className="w-full text-left px-3 py-2.5 hover:bg-surface-container-low border-b border-outline-variant/60 last:border-0 flex justify-between gap-2 text-sm transition-colors"
                  >
                    <span className="truncate">{p.name} <span className="text-xs text-on-surface-variant tnum">({p.stock})</span></span>
                    <span className="text-on-surface-variant tnum flex-shrink-0">{formatCOP(p.price)}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-2">Items en la venta</label>
          {items.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-4 border border-dashed border-outline-variant rounded-lg">
              Agrega items desde las listas de arriba
            </p>
          ) : (
            <div className="border border-outline-variant rounded-lg divide-y divide-outline-variant">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2">
                  <span className="flex-1 text-sm">{it.name}</span>
                  <input
                    type="number"
                    min="1"
                    value={it.quantity}
                    onChange={(e) => updateQuantity(idx, e.target.value)}
                    className="input w-16 text-sm"
                  />
                  <span className="text-sm font-medium w-24 text-right">{formatCOP(it.subtotal)}</span>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="text-error hover:bg-error/10 p-1 rounded"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <div className="flex justify-between items-center p-3.5 bg-surface-container-low font-semibold">
                <span className="text-sm">Total</span>
                <span className="font-display text-primary text-xl tnum">{formatCOP(total)}</span>
              </div>
            </div>
          )}
        </div>

        <Field label="Método de pago">
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="input"
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Notas">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input min-h-[50px]"
            placeholder="Opcional"
          />
        </Field>

        <FormActions onCancel={onCancel} submitLabel="Registrar venta" disabled={items.length === 0} />
      </form>
    </Modal>
  );
}

// ===========================
// SHARED UI
// ===========================
// Estos tres adaptadores mantienen las firmas locales (que usan 40 llamadas en
// este archivo) pero delegan en el sistema de diseño: así el módulo hereda la
// hoja inferior en móvil, el cierre con Escape y el bloqueo de scroll sin
// reescribir cada formulario.
function EmptyState({ icon: Icon, message }) {
  return (
    <Card tone="sunken" className="border-dashed">
      <UIEmptyState icon={Icon} title={message} />
    </Card>
  );
}

function Modal({ title, onClose, children, wide = false }) {
  return (
    <UIModal open onClose={onClose} title={title} size={wide ? 'xl' : 'md'}>
      <div className="pb-2">{children}</div>
    </UIModal>
  );
}

function FormActions({ onCancel, submitLabel = 'Guardar', disabled = false }) {
  return (
    <div className="flex gap-2.5 pt-2">
      <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancelar</Button>
      <Button type="submit" className="flex-[2]" disabled={disabled}>{submitLabel}</Button>
    </div>
  );
}
