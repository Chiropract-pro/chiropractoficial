import { useState } from 'react';
import { Plus, X, Calendar, Car, Users, DollarSign, FileText, CheckCircle, XCircle } from 'lucide-react';
import { formatCOP, formatDate } from '../utils/format';
import { useJornadas } from '../hooks/useTenantData';
import { useToast } from './Toast';
import { userFriendlyError } from '../lib/logger';
import LoadingState from './LoadingState';

export default function Jornadas() {
  const { jornadas, loading, insertJornada, updateJornada, removeJornada } = useJornadas();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();

  if (loading && jornadas.length === 0) return <LoadingState message="Cargando jornadas..." />;
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedJornada, setSelectedJornada] = useState(null);
  const [tab, setTab] = useState('proximas');

  const proximas = jornadas.filter((j) => j.status === 'programada');
  const pasadas = jornadas.filter((j) => j.status === 'completada' || j.status === 'cancelada');

  const booked = (j) => j.booked_count ?? j.booked ?? 0;
  const price = (j) => j.price_per_patient ?? j.pricePerPatient ?? 150000;

  const capacityColor = (b, capacity) => {
    const pct = capacity > 0 ? b / capacity : 0;
    if (pct >= 0.8) return 'text-danger';
    if (pct >= 0.5) return 'text-accent';
    return 'text-primary';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Jornadas</h2>
          <p className="text-on-surface-variant text-sm mt-1">Gestión de jornadas por ciudad</p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={16} /> Nueva Jornada
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('proximas')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'proximas' ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
        >
          Próximas ({proximas.length})
        </button>
        <button
          onClick={() => setTab('pasadas')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'pasadas' ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
        >
          Historial ({pasadas.length})
        </button>
      </div>

      {/* Próximas */}
      {tab === 'proximas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {proximas.map((j) => (
            <div
              key={j.id}
              className="bg-surface-container-lowest rounded-xl shadow-clinical border border-outline-variant hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedJornada(j)}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-primary p-2.5 rounded-lg">
                  <Car size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-on-surface text-lg">{j.city}</h3>
                  <p className="text-sm text-on-surface-variant flex items-center gap-1">
                    <Calendar size={12} /> {formatDate(j.date)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center bg-surface-container-low rounded-lg p-2">
                  <p className={`text-lg font-bold ${capacityColor(booked(j), j.capacity)}`}>{booked(j)}/{j.capacity}</p>
                  <p className="text-[10px] text-on-surface-variant/70">Agendados</p>
                </div>
                <div className="text-center bg-surface-container-low rounded-lg p-2">
                  <p className="text-lg font-bold text-primary">{formatCOP(price(j))}</p>
                  <p className="text-[10px] text-on-surface-variant/70">Por paciente</p>
                </div>
                <div className="text-center bg-surface-container-low rounded-lg p-2">
                  <p className="text-lg font-bold text-success">{formatCOP(booked(j) * price(j))}</p>
                  <p className="text-[10px] text-on-surface-variant/70">Proyectado</p>
                </div>
              </div>

              <div className="w-full bg-surface-container rounded-full h-2 mb-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    booked(j) / j.capacity >= 0.8 ? 'bg-danger' :
                    booked(j) / j.capacity >= 0.5 ? 'bg-accent' : 'bg-primary'
                  }`}
                  style={{ width: `${j.capacity > 0 ? (booked(j) / j.capacity) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-on-surface-variant/70">{j.notes}</p>
            </div>
          ))}
        </div>
      )}

      {/* Pasadas */}
      {tab === 'pasadas' && (
        <div className="space-y-3">
          {pasadas.map((j) => (
            <div key={j.id} className="bg-surface-container-lowest rounded-xl shadow-clinical border border-outline-variant">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-surface-container-high p-2.5 rounded-lg">
                    <Car size={20} className="text-on-surface-variant" />
                  </div>
                  <div>
                    <h3 className="font-bold text-on-surface">{j.city}</h3>
                    <p className="text-sm text-on-surface-variant/70">{formatDate(j.date)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-success">{formatCOP(j.revenue || 0)}</p>
                  <p className="text-xs text-on-surface-variant/70">{booked(j)} pacientes atendidos</p>
                </div>
              </div>
              <p className="text-xs text-on-surface-variant/70 mt-2">{j.notes}</p>
            </div>
          ))}
        </div>
      )}

      {/* Jornada Detail Modal */}
      {selectedJornada && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedJornada(null)}>
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-on-surface">Jornada — {selectedJornada.city}</h3>
              <button onClick={() => setSelectedJornada(null)} className="text-on-surface-variant/50 hover:text-on-surface"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="bg-primary/5 rounded-lg p-4">
                <p className="text-sm text-on-surface-variant">Fecha</p>
                <p className="font-semibold text-on-surface">{formatDate(selectedJornada.date)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-container-low rounded-lg p-4 text-center">
                  <Users size={20} className="mx-auto text-primary mb-1" />
                  <p className="text-2xl font-bold text-on-surface">{booked(selectedJornada)}/{selectedJornada.capacity}</p>
                  <p className="text-xs text-on-surface-variant/70">Pacientes</p>
                </div>
                <div className="bg-surface-container-low rounded-lg p-4 text-center">
                  <DollarSign size={20} className="mx-auto text-success mb-1" />
                  <p className="text-2xl font-bold text-success">{formatCOP(booked(selectedJornada) * price(selectedJornada))}</p>
                  <p className="text-xs text-on-surface-variant/70">Proyectado</p>
                </div>
              </div>
              <div className="w-full bg-surface-container rounded-full h-3">
                <div
                  className={`h-3 rounded-full ${
                    booked(selectedJornada) / selectedJornada.capacity >= 0.8 ? 'bg-danger' : 'bg-primary'
                  }`}
                  style={{ width: `${selectedJornada.capacity > 0 ? (booked(selectedJornada) / selectedJornada.capacity) * 100 : 0}%` }}
                />
              </div>
              <div className="bg-surface-container-low rounded-lg p-4">
                <p className="text-xs text-on-surface-variant/70 mb-1">Notas</p>
                <p className="text-sm text-on-surface">{selectedJornada.notes}</p>
              </div>
              <div className="flex gap-3">
                {selectedJornada.status === 'programada' && (
                  <>
                    <button onClick={() => { updateJornada(selectedJornada.id, { status: 'completada' }); setSelectedJornada(null); }} className="flex-1 bg-success hover:bg-green-600 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                      <CheckCircle size={14} /> Completar
                    </button>
                    <button onClick={() => { updateJornada(selectedJornada.id, { status: 'cancelada' }); setSelectedJornada(null); }} className="flex-1 bg-danger hover:bg-red-600 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                      <XCircle size={14} /> Cancelar
                    </button>
                  </>
                )}
                {!confirmDelete ? (
                  <button onClick={() => setConfirmDelete(true)} className="px-3 py-2 border border-outline-variant text-on-surface-variant hover:bg-surface-container-low rounded-lg text-sm">
                    Eliminar
                  </button>
                ) : (
                  <>
                    <button onClick={async () => {
                      const r = await removeJornada(selectedJornada.id);
                      if (r.error) { toast.error(userFriendlyError(r.error)); return; }
                      toast.success('Jornada eliminada');
                      setSelectedJornada(null); setConfirmDelete(false);
                    }} className="px-3 py-2 bg-danger text-white rounded-lg text-sm font-medium">Sí, eliminar</button>
                    <button onClick={() => setConfirmDelete(false)} className="px-3 py-2 border border-outline-variant rounded-lg text-sm">Cancelar</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Jornada Form */}
      {showNewForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNewForm(false)}>
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-on-surface">Programar Nueva Jornada</h3>
              <button onClick={() => setShowNewForm(false)} className="text-on-surface-variant/50 hover:text-on-surface"><X size={20} /></button>
            </div>
            <form className="space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target;
              const r = await insertJornada({
                city: form.city.value,
                date: form.date.value,
                capacity: parseInt(form.capacity.value) || 15,
                price_per_patient: parseInt(form.price.value) || 150000,
                notes: form.notes.value || null,
              });
              if (r.error) { toast.error(userFriendlyError(r.error)); return; }
              toast.success('Jornada creada');
              setShowNewForm(false);
            }}>
              <div>
                <label className="text-xs text-on-surface-variant block mb-1">Ciudad</label>
                <select name="city" className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option>Soatá</option><option>Guamal</option><option>Muzo</option><option>Garcés Navas</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Fecha</label>
                  <input name="date" type="date" required className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Capacidad</label>
                  <input name="capacity" type="number" defaultValue={15} className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div>
                <label className="text-xs text-on-surface-variant block mb-1">Precio por paciente (COP)</label>
                <input name="price" type="number" defaultValue={150000} className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs text-on-surface-variant block mb-1">Notas</label>
                <textarea name="notes" className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" rows={3} placeholder="Ubicación, equipo necesario, etc." />
              </div>
              <button type="submit" className="w-full bg-primary hover:bg-primary-dark text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
                Programar Jornada
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
