import { useState } from 'react';
import { Search, Plus, X, Edit2, Phone, Mail, MapPin, ChevronRight, Filter, Download, Stethoscope, User as UserIcon, Folder } from 'lucide-react';
import { patientStatuses, formatCOP, formatDate } from '../utils/format';
import { usePatients } from '../hooks/useTenantData';
import { useToast } from './Toast';
import { userFriendlyError } from '../lib/logger';
import { downloadCsv } from '../utils/csv';
import ClinicalHistoryPanel from './clinical/ClinicalHistoryPanel';
import ClinicalFilesPanel from './clinical/ClinicalFilesPanel';

export default function Pacientes() {
  const { patients, loading, insertPatient, updatePatient, removePatient } = usePatients();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCity, setFilterCity] = useState('all');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [detailTab, setDetailTab] = useState('data'); // 'data' | 'clinical'

  const patientList = patients.map((p) => ({
    ...p,
    name: p.full_name,
    totalSpent: p.total_spent,
    appointmentsCount: p.appointments_count,
    lastVisit: p.last_visit,
  }));

  const filtered = patientList.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = search === '' ||
      (p.name || '').toLowerCase().includes(q) ||
      (p.phone || '').includes(search) ||
      (p.email || '').toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    const matchCity = filterCity === 'all' || p.city === filterCity;
    return matchSearch && matchStatus && matchCity;
  });

  const uniqueCities = [...new Set(patientList.filter((p) => p.city).map((p) => p.city))];

  const statusBadge = (status) => {
    const s = patientStatuses.find((ps) => ps.value === status);
    const colors = {
      activo: 'bg-green-100 text-green-700',
      inactivo: 'bg-gray-100 text-gray-600',
      en_tratamiento: 'bg-blue-100 text-blue-700',
      completado: 'bg-teal-100 text-teal-700',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
        {s?.label || status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Pacientes</h2>
          <p className="text-on-surface-variant text-sm mt-1">{patientList.length} pacientes registrados</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadCsv(
              `pacientes-${new Date().toISOString().slice(0,10)}.csv`,
              filtered,
              [
                { key: 'name', label: 'Nombre' },
                { key: 'phone', label: 'Teléfono' },
                { key: 'email', label: 'Email' },
                { key: 'city', label: 'Ciudad' },
                { key: 'status', label: 'Estado' },
                { key: 'treatment', label: 'Tratamiento' },
                { key: 'lastVisit', label: 'Última visita' },
                { key: 'totalSpent', label: 'Total gastado', format: (v) => v ?? 0 },
                { key: 'appointmentsCount', label: 'Total citas', format: (v) => v ?? 0 },
              ]
            )}
            className="hidden sm:inline-flex items-center gap-2 px-3 py-2 border border-outline-variant text-on-surface-variant hover:bg-surface-container-low rounded-lg text-sm font-medium transition-colors"
            title="Exportar a CSV (Excel)"
          >
            <Download size={16} /> Exportar
          </button>
          <button
            onClick={() => setShowNewForm(true)}
            className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={16} /> Nuevo Paciente
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50" />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="all">Todos los estados</option>
          {patientStatuses.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={filterCity}
          onChange={(e) => setFilterCity(e.target.value)}
          className="px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="all">Todas las ciudades</option>
          {uniqueCities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Patient List */}
      {loading ? (
        <div className="bg-surface-container-lowest rounded-xl shadow-clinical border border-outline-variant p-12 text-center">
          <p className="text-on-surface-variant">Cargando pacientes...</p>
        </div>
      ) : (
      <div className="bg-surface-container-lowest rounded-xl shadow-clinical border border-outline-variant overflow-hidden">
        {/* Mobile: cards */}
        <div className="md:hidden divide-y divide-outline-variant">
          {filtered.map((p) => (
            <div key={p.id} className="p-4 hover:bg-surface-container-low/50 cursor-pointer" onClick={() => setSelectedPatient(p)}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {(p.name || 'U').split(' ').map((n) => n[0] || '').join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-on-surface truncate">{p.name}</p>
                    {p.vip && <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-bold">VIP</span>}
                  </div>
                  <p className="text-xs text-on-surface-variant truncate">{p.phone || '—'} · {p.city || '—'}</p>
                  <div className="flex items-center justify-between mt-2 gap-2">
                    {statusBadge(p.status)}
                    <span className="text-xs font-medium text-on-surface">{formatCOP(p.totalSpent || 0)}</span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-on-surface-variant/50 flex-shrink-0 mt-2" />
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: tabla */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase">Teléfono</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase">Ciudad</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase">Última visita</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-outline-variant/30 hover:bg-surface-container-low/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedPatient(p)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        {(p.name || 'U').split(' ').map((n) => n[0] || '').join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-on-surface">{p.name}</p>
                        {p.vip && <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-bold">VIP</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">{p.phone}</td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">{p.city}</td>
                  <td className="px-4 py-3">{statusBadge(p.status)}</td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">{formatShortDateLocal(p.lastVisit)}</td>
                  <td className="px-4 py-3 text-sm font-medium text-on-surface text-right">{formatCOP(p.totalSpent)}</td>
                  <td className="px-4 py-3">
                    <ChevronRight size={16} className="text-on-surface-variant/50" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-on-surface-variant/70 text-sm">No se encontraron pacientes</div>
        )}
      </div>
      )}

      {/* Patient Detail Modal */}
      {selectedPatient && !showEditForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => { setSelectedPatient(null); setDetailTab('data'); }}>
          <div className="bg-surface-container-lowest sm:rounded-2xl rounded-t-2xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-3 flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-bold text-on-surface truncate">{selectedPatient.name}</h3>
              <button onClick={() => { setSelectedPatient(null); setDetailTab('data'); }} className="text-on-surface-variant/50 hover:text-on-surface-variant"><X size={20} /></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-outline-variant px-6 flex-shrink-0">
              <button
                onClick={() => setDetailTab('data')}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  detailTab === 'data'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <UserIcon size={14} /> Datos
              </button>
              <button
                onClick={() => setDetailTab('clinical')}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  detailTab === 'clinical'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <Stethoscope size={14} /> Historial clínico
              </button>
              <button
                onClick={() => setDetailTab('files')}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  detailTab === 'files'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <Folder size={14} /> Archivos
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-4 flex-1">
            {detailTab === 'clinical' ? (
              <ClinicalHistoryPanel patient={{ id: selectedPatient.id, full_name: selectedPatient.name, name: selectedPatient.name }} />
            ) : detailTab === 'files' ? (
              <ClinicalFilesPanel patient={{ id: selectedPatient.id, full_name: selectedPatient.name, name: selectedPatient.name }} />
            ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {statusBadge(selectedPatient.status)}
                {selectedPatient.vip && <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full font-bold">VIP</span>}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-on-surface-variant"><Phone size={14} /> {selectedPatient.phone}</div>
                <div className="flex items-center gap-2 text-on-surface-variant"><Mail size={14} /> {selectedPatient.email}</div>
                <div className="flex items-center gap-2 text-on-surface-variant col-span-2"><MapPin size={14} /> {selectedPatient.address}</div>
              </div>
              <div className="bg-surface-container-low rounded-lg p-4">
                <p className="text-xs text-on-surface-variant/70 mb-1">Tratamiento</p>
                <p className="text-sm font-medium text-on-surface">{selectedPatient.treatment}</p>
              </div>
              <div className="bg-surface-container-low rounded-lg p-4">
                <p className="text-xs text-on-surface-variant/70 mb-1">Notas del doctor</p>
                <p className="text-sm text-on-surface">{selectedPatient.notes}</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-primary/5 rounded-lg p-3">
                  <p className="text-lg font-bold text-primary">{selectedPatient.appointmentsCount}</p>
                  <p className="text-xs text-on-surface-variant">Citas</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-lg font-bold text-success">{formatCOP(selectedPatient.totalSpent)}</p>
                  <p className="text-xs text-on-surface-variant">Total</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-lg font-bold text-blue-600">{formatShortDateLocal(selectedPatient.lastVisit)}</p>
                  <p className="text-xs text-on-surface-variant">Última visita</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowEditForm(true); }}
                  className="flex-1 bg-primary hover:bg-primary-dark text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Edit2 size={14} /> Editar
                </button>
                <a
                  href={selectedPatient.phone ? `https://wa.me/${String(selectedPatient.phone).replace(/\D/g, '')}` : '#'}
                  target={selectedPatient.phone ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  onClick={(e) => { if (!selectedPatient.phone) { e.preventDefault(); alert('Este paciente no tiene teléfono registrado.'); } }}
                  className={`flex-1 ${selectedPatient.phone ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-300 cursor-not-allowed'} text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors`}
                >
                  <Phone size={14} /> WhatsApp
                </a>
              </div>
              {confirmDelete ? (
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-sm text-danger font-medium mb-2">¿Eliminar este paciente?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        const r = await removePatient(selectedPatient.id);
                        if (r.error) { toast.error(userFriendlyError(r.error)); return; }
                        toast.success('Paciente eliminado');
                        setSelectedPatient(null);
                        setConfirmDelete(false);
                      }}
                      className="flex-1 bg-danger text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
                    >Sí, eliminar</button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 bg-surface-container text-on-surface-variant py-2 rounded-lg text-sm font-medium hover:bg-surface-container-high transition-colors"
                    >Cancelar</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full text-danger/70 hover:text-danger text-sm py-2 transition-colors"
                >Eliminar paciente</button>
              )}
            </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* New Patient Form Modal */}
      {showNewForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNewForm(false)}>
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-on-surface">Nuevo Paciente</h3>
              <button onClick={() => setShowNewForm(false)} className="text-on-surface-variant/50 hover:text-on-surface-variant"><X size={20} /></button>
            </div>
            <form className="space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target;
              const result = await insertPatient({
                full_name: form.full_name.value,
                phone: form.phone.value || null,
                email: form.email.value || null,
                address: form.address.value || null,
                city: form.city.value,
                status: form.status.value,
                treatment: form.treatment.value || null,
                notes: form.notes.value || null,
                id_type: form.id_type.value || null,
                id_number: form.id_number.value?.replace(/\D/g, '') || null,
              });
              if (result.error) {
                toast.error(userFriendlyError(result.error));
                return;
              }
              toast.success('Paciente creado');
              setShowNewForm(false);
            }}>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-on-surface-variant block mb-1">Nombre completo</label>
                  <input name="full_name" required className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Nombre completo" />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Tipo doc</label>
                  <select name="id_type" className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">—</option>
                    <option value="CC">CC</option>
                    <option value="CE">CE</option>
                    <option value="TI">TI</option>
                    <option value="NIT">NIT</option>
                    <option value="PA">Pasaporte</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">N° identificación <span className="text-on-surface-variant/60">(para facturar)</span></label>
                  <input name="id_number" inputMode="numeric" className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="1234567890" />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Teléfono</label>
                  <input name="phone" className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="311-234-5678" />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Email</label>
                  <input name="email" type="email" className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="email@ejemplo.com" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-on-surface-variant block mb-1">Dirección</label>
                  <input name="address" className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Dirección completa" />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Ciudad</label>
                  <select name="city" className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option>Bogotá</option><option>Soatá</option><option>Guamal</option><option>Muzo</option><option>Garcés Navas</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Estado</label>
                  <select name="status" className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {patientStatuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-on-surface-variant block mb-1">Tratamiento</label>
                  <input name="treatment" className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Tratamiento inicial" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-on-surface-variant block mb-1">Notas</label>
                  <textarea name="notes" className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" rows={3} placeholder="Notas del doctor..." />
                </div>
              </div>
              <button type="submit" className="w-full bg-primary hover:bg-primary-dark text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
                Guardar Paciente
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Patient Form Modal */}
      {showEditForm && selectedPatient && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setShowEditForm(false); setSelectedPatient(null); }}>
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-on-surface">Editar Paciente</h3>
              <button onClick={() => { setShowEditForm(false); setSelectedPatient(null); }} className="text-on-surface-variant/50 hover:text-on-surface-variant"><X size={20} /></button>
            </div>
            <form className="space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target;
              const r = await updatePatient(selectedPatient.id, {
                full_name: form.full_name.value,
                phone: form.phone.value || null,
                email: form.email.value || null,
                address: form.address.value || null,
                city: form.city.value,
                status: form.status.value,
                treatment: form.treatment.value || null,
                notes: form.notes.value || null,
                id_type: form.id_type.value || null,
                id_number: form.id_number.value?.replace(/\D/g, '') || null,
              });
              if (r.error) { toast.error(userFriendlyError(r.error)); return; }
              toast.success('Paciente actualizado');
              setShowEditForm(false);
              setSelectedPatient(null);
            }}>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-on-surface-variant block mb-1">Nombre completo</label>
                  <input name="full_name" required defaultValue={selectedPatient.name} className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Tipo doc</label>
                  <select name="id_type" defaultValue={selectedPatient.id_type || ''} className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">—</option>
                    <option value="CC">CC</option>
                    <option value="CE">CE</option>
                    <option value="TI">TI</option>
                    <option value="NIT">NIT</option>
                    <option value="PA">Pasaporte</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">N° identificación</label>
                  <input name="id_number" defaultValue={selectedPatient.id_number || ''} inputMode="numeric" className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Para facturar" />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Teléfono</label>
                  <input name="phone" defaultValue={selectedPatient.phone} className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Email</label>
                  <input name="email" type="email" defaultValue={selectedPatient.email} className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-on-surface-variant block mb-1">Dirección</label>
                  <input name="address" defaultValue={selectedPatient.address} className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Ciudad</label>
                  <select name="city" defaultValue={selectedPatient.city} className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option>Bogotá</option><option>Soatá</option><option>Guamal</option><option>Muzo</option><option>Garcés Navas</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Estado</label>
                  <select name="status" defaultValue={selectedPatient.status} className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {patientStatuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-on-surface-variant block mb-1">Tratamiento</label>
                  <input name="treatment" defaultValue={selectedPatient.treatment} className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-on-surface-variant block mb-1">Notas</label>
                  <textarea name="notes" defaultValue={selectedPatient.notes} className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" rows={3} />
                </div>
              </div>
              <button type="submit" className="w-full bg-primary hover:bg-primary-dark text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
                Guardar Cambios
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function formatShortDateLocal(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}
