import { useState, useMemo } from 'react';
import { Package, Stethoscope, ShoppingCart, Plus, Edit2, Trash2, X, AlertTriangle, TrendingUp, Calendar, MapPin } from 'lucide-react';
import { useServices, useProducts, useSales } from '../hooks/useTenantData';
import { formatCOP, formatShortDate } from '../utils/format';
import { userFriendlyError } from '../lib/logger';
import EmitInvoiceButton from './billing/EmitInvoiceButton';

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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-on-surface">Productos y Servicios</h2>
        <p className="text-on-surface-variant text-sm mt-1">
          Catálogo de servicios, inventario de productos y ventas por jornada
        </p>
      </div>

      <div className="border-b border-outline-variant">
        <nav className="flex gap-1">
          <TabButton active={activeTab === 'servicios'} onClick={() => setActiveTab('servicios')} icon={Stethoscope}>
            Servicios
          </TabButton>
          <TabButton active={activeTab === 'productos'} onClick={() => setActiveTab('productos')} icon={Package}>
            Productos
          </TabButton>
          <TabButton active={activeTab === 'ventas'} onClick={() => setActiveTab('ventas')} icon={ShoppingCart}>
            Ventas
          </TabButton>
        </nav>
      </div>

      {activeTab === 'servicios' && <ServicesTab />}
      {activeTab === 'productos' && <ProductsTab />}
      {activeTab === 'ventas' && <SalesTab />}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-on-surface-variant hover:text-on-surface'
      }`}
    >
      <Icon size={16} /> {children}
    </button>
  );
}

// ===========================
// SERVICIOS
// ===========================
function ServicesTab() {
  const { services, loading, insertService, updateService, removeService } = useServices();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const total = services.length;
  const active = services.filter((s) => s.active).length;
  const avgPrice = active > 0 ? Math.round(services.filter((s) => s.active).reduce((sum, s) => sum + (s.price || 0), 0) / active) : 0;

  const handleSave = async (data) => {
    const result = editing
      ? await updateService(editing.id, data)
      : await insertService(data);
    if (!result.error) {
      setShowForm(false);
      setEditing(null);
    } else {
      alert(userFriendlyError(result.error));
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Servicios totales" value={total} />
        <StatCard label="Activos" value={active} />
        <StatCard label="Precio promedio" value={formatCOP(avgPrice)} />
      </div>

      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-on-surface">Catálogo</h3>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="bg-primary hover:bg-primary-light text-on-primary px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={16} /> Nuevo servicio
        </button>
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
    <div className="bg-surface-container-lowest rounded-xl p-4 shadow-clinical border border-outline-variant flex flex-col">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-on-surface truncate">{service.name}</h4>
          <p className="text-xs text-on-surface-variant">{cat?.label || service.category}</p>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="text-on-surface-variant hover:text-primary p-1" title="Editar">
            <Edit2 size={14} />
          </button>
          <button onClick={onDelete} className="text-on-surface-variant hover:text-error p-1" title="Eliminar">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {service.description && (
        <p className="text-xs text-on-surface-variant mb-3 line-clamp-2">{service.description}</p>
      )}
      <div className="flex items-end justify-between mt-auto pt-2 border-t border-outline-variant">
        <div>
          <p className="text-xs text-on-surface-variant">Precio</p>
          <p className="font-bold text-primary">{formatCOP(service.price)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-on-surface-variant">Duración</p>
          <p className="text-sm font-medium text-on-surface">{service.duration_min || 0} min</p>
        </div>
        {!service.active && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Inactivo</span>
        )}
      </div>
    </div>
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
    if (!result.error) {
      setShowForm(false);
      setEditing(null);
    } else {
      alert(userFriendlyError(result.error));
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Productos activos" value={active} />
        <StatCard label="Valor de inventario" value={formatCOP(totalStockValue)} />
        <StatCard
          label="Stock bajo"
          value={lowStock.length}
          accent={lowStock.length > 0 ? 'warning' : 'default'}
        />
      </div>

      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">Productos con stock bajo</p>
            <p className="text-xs text-amber-800 mt-1">
              {lowStock.map((p) => p.name).join(', ')}
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-on-surface">Inventario</h3>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="bg-primary hover:bg-primary-light text-on-primary px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={16} /> Nuevo producto
        </button>
      </div>

      {loading ? (
        <p className="text-on-surface-variant text-center py-8">Cargando...</p>
      ) : products.length === 0 ? (
        <EmptyState icon={Package} message="Aún no tienes productos. Agrega el primero al inventario." />
      ) : (
        <div className="overflow-x-auto bg-surface-container-lowest rounded-xl border border-outline-variant">
          <table className="w-full">
            <thead className="bg-surface-container-low">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase">Producto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase">Categoría</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase">Precio</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase">Stock</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const isLow = p.stock <= (p.low_stock_threshold || 5);
                const cat = PRODUCT_CATEGORIES.find((c) => c.value === p.category);
                return (
                  <tr key={p.id} className="border-t border-outline-variant hover:bg-surface-container-low">
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
                    <td className="px-4 py-3 text-right font-medium">{formatCOP(p.price)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        isLow ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                      }`}>
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
  const { services } = useServices();
  const { products } = useProducts();
  const [showForm, setShowForm] = useState(false);

  const totalSales = sales.length;
  const completedSales = sales.filter((s) => s.status === 'completada');
  const totalRevenue = completedSales.reduce((sum, s) => sum + (s.total || 0), 0);
  const avgSale = completedSales.length > 0 ? Math.round(totalRevenue / completedSales.length) : 0;

  const salesByJornada = useMemo(() => {
    const grouped = {};
    completedSales.forEach((s) => {
      if (!s.jornadas) return;
      const key = `${s.jornadas.city}-${s.jornadas.date}`;
      if (!grouped[key]) {
        grouped[key] = { city: s.jornadas.city, date: s.jornadas.date, count: 0, total: 0 };
      }
      grouped[key].count++;
      grouped[key].total += s.total || 0;
    });
    return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  }, [completedSales]);

  const handleCreate = async (data) => {
    const result = await createSale(data);
    if (!result.error) {
      setShowForm(false);
    } else {
      alert(userFriendlyError(result.error));
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total ventas" value={totalSales} />
        <StatCard label="Ingresos totales" value={formatCOP(totalRevenue)} />
        <StatCard label="Venta promedio" value={formatCOP(avgSale)} />
      </div>

      {salesByJornada.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl p-5 shadow-clinical border border-outline-variant">
          <h3 className="font-semibold text-on-surface mb-3 flex items-center gap-2">
            <TrendingUp size={16} /> Top jornadas por ingresos
          </h3>
          <div className="space-y-2">
            {salesByJornada.map((j, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-outline-variant last:border-0">
                <div className="flex items-center gap-3">
                  <MapPin size={14} className="text-on-surface-variant" />
                  <div>
                    <p className="text-sm font-medium text-on-surface">{j.city}</p>
                    <p className="text-xs text-on-surface-variant">{formatShortDate(j.date)} · {j.count} ventas</p>
                  </div>
                </div>
                <p className="font-bold text-primary">{formatCOP(j.total)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-on-surface">Historial de ventas</h3>
        <button
          onClick={() => setShowForm(true)}
          disabled={services.length === 0 && products.length === 0}
          className="bg-primary hover:bg-primary-light text-on-primary px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={16} /> Nueva venta
        </button>
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
  const statusStyle = {
    completada: 'bg-green-100 text-green-700',
    pendiente: 'bg-yellow-100 text-yellow-700',
    cancelada: 'bg-gray-100 text-gray-600',
    reembolsada: 'bg-red-100 text-red-700',
  }[sale.status] || 'bg-gray-100 text-gray-600';

  return (
    <div className="bg-surface-container-lowest rounded-xl p-4 shadow-clinical border border-outline-variant">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-on-surface">{formatCOP(sale.total)}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${statusStyle}`}>{sale.status}</span>
            <span className="text-xs text-on-surface-variant">{sale.payment_method}</span>
            {sale.status === 'completada' && (
              <EmitInvoiceButton sale={sale} onEmitted={onInvoiceEmitted} compact />
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
        <div className="flex gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-primary hover:underline"
          >
            {expanded ? 'Ocultar' : 'Ver items'}
          </button>
          {sale.status === 'completada' && (
            <button
              onClick={async () => {
                if (confirm('¿Cancelar esta venta?')) {
                  await onCancel(sale.id);
                }
              }}
              className="text-xs text-error hover:underline ml-2"
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
    </div>
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
    if (items.length === 0) return alert('Agrega al menos un item');
    onSave({ items, paymentMethod, notes });
  };

  return (
    <Modal title="Nueva venta" onClose={onCancel} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-2">Servicios disponibles</label>
            <div className="border border-outline-variant rounded-lg max-h-48 overflow-y-auto">
              {services.length === 0 ? (
                <p className="p-3 text-xs text-on-surface-variant">Sin servicios activos</p>
              ) : (
                services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => addItem(s, 'service')}
                    className="w-full text-left p-2 hover:bg-surface-container-low border-b border-outline-variant last:border-0 flex justify-between text-sm"
                  >
                    <span>{s.name}</span>
                    <span className="text-on-surface-variant">{formatCOP(s.price)}</span>
                  </button>
                ))
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-2">Productos en stock</label>
            <div className="border border-outline-variant rounded-lg max-h-48 overflow-y-auto">
              {products.length === 0 ? (
                <p className="p-3 text-xs text-on-surface-variant">Sin productos en stock</p>
              ) : (
                products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addItem(p, 'product')}
                    className="w-full text-left p-2 hover:bg-surface-container-low border-b border-outline-variant last:border-0 flex justify-between text-sm"
                  >
                    <span>{p.name} <span className="text-xs text-on-surface-variant">({p.stock})</span></span>
                    <span className="text-on-surface-variant">{formatCOP(p.price)}</span>
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
              <div className="flex justify-between items-center p-3 bg-surface-container-low font-semibold">
                <span>Total</span>
                <span className="text-primary text-lg">{formatCOP(total)}</span>
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

        <FormActions onCancel={onCancel} submitLabel="Registrar venta" />
      </form>
    </Modal>
  );
}

// ===========================
// SHARED UI
// ===========================
function StatCard({ label, value, accent = 'default' }) {
  const accentClass = {
    default: 'text-on-surface',
    warning: 'text-amber-600',
  }[accent];
  return (
    <div className="bg-surface-container-lowest rounded-xl p-4 shadow-clinical border border-outline-variant">
      <p className="text-xs text-on-surface-variant uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accentClass}`}>{value}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, message }) {
  return (
    <div className="text-center py-12 bg-surface-container-lowest rounded-xl border border-dashed border-outline-variant">
      <Icon size={32} className="mx-auto text-on-surface-variant mb-2" />
      <p className="text-on-surface-variant text-sm">{message}</p>
    </div>
  );
}

function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className={`bg-surface-container-lowest rounded-2xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-5 border-b border-outline-variant sticky top-0 bg-surface-container-lowest">
          <h3 className="font-semibold text-on-surface">{title}</h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <X size={20} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-on-surface-variant mb-1">{label}</label>
      {children}
    </div>
  );
}

function FormActions({ onCancel, submitLabel = 'Guardar' }) {
  return (
    <div className="flex gap-2 justify-end pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low rounded-lg transition-colors"
      >
        Cancelar
      </button>
      <button
        type="submit"
        className="px-4 py-2 text-sm font-medium bg-primary hover:bg-primary-light text-on-primary rounded-lg transition-colors"
      >
        {submitLabel}
      </button>
    </div>
  );
}
