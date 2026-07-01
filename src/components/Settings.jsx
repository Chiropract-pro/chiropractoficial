import { useState } from 'react';
import { Settings as SettingsIcon, Building2, User, CreditCard, Shield, Save, CheckCircle, MessageCircle, Clock, Users, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { wa } from '../lib/clinic';
import TeamTab from './TeamTab';
import BillingSettings from './billing/BillingSettings';
import PlanTab from './billing/PlanTab';

export default function Settings() {
  const { tenant, profile, updateProfile, updateTenant } = useAuth();
  const [activeTab, setActiveTab] = useState('clinic');
  const [saved, setSaved] = useState(false);
  const [clinicForm, setClinicForm] = useState({
    name: tenant?.name || '',
    slug: tenant?.slug || '',
    phone: tenant?.phone || '',
    address: tenant?.address || '',
    city: tenant?.city || '',
  });
  const [profileForm, setProfileForm] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
  });

  const handleSaveClinic = async (e) => {
    e.preventDefault();
    if (updateTenant) {
      await updateTenant({
        name: clinicForm.name,
        phone: clinicForm.phone || null,
        address: clinicForm.address || null,
        city: clinicForm.city || null,
      });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (updateProfile) {
      await updateProfile(profileForm);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const tabs = [
    { id: 'clinic', label: 'Consultorio', icon: Building2 },
    { id: 'team', label: 'Equipo', icon: Users },
    { id: 'billing', label: 'Facturación DIAN', icon: FileText },
    { id: 'profile', label: 'Mi Perfil', icon: User },
    { id: 'plan', label: 'Plan', icon: CreditCard },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Configuración</h2>
          <p className="text-on-surface-variant text-sm mt-1">Administra tu consultorio y perfil</p>
        </div>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-success font-medium">
            <CheckCircle size={16} /> Guardado
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-outline-variant pb-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Clinic Tab */}
      {activeTab === 'clinic' && (
        <div className="bg-surface-container-lowest rounded-xl shadow-clinical border border-outline-variant p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-primary/10 p-3 rounded-lg">
              <Building2 size={24} className="text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-on-surface">Información del Consultorio</h3>
              <p className="text-xs text-on-surface-variant">Datos generales de tu práctica</p>
            </div>
          </div>
          <form onSubmit={handleSaveClinic} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-on-surface-variant block mb-1">Nombre del consultorio</label>
                <input
                  value={clinicForm.name}
                  onChange={(e) => setClinicForm({ ...clinicForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs text-on-surface-variant block mb-1">Slug (URL)</label>
                <input
                  value={clinicForm.slug}
                  disabled
                  className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm bg-surface-container-low text-on-surface-variant"
                />
              </div>
              <div>
                <label className="text-xs text-on-surface-variant block mb-1">Teléfono</label>
                <input
                  value={clinicForm.phone}
                  onChange={(e) => setClinicForm({ ...clinicForm, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="310-123-4567"
                />
              </div>
              <div>
                <label className="text-xs text-on-surface-variant block mb-1">Ciudad</label>
                <input
                  value={clinicForm.city}
                  onChange={(e) => setClinicForm({ ...clinicForm, city: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Bogotá"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-on-surface-variant block mb-1">Dirección</label>
                <input
                  value={clinicForm.address}
                  onChange={(e) => setClinicForm({ ...clinicForm, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Dirección completa"
                />
              </div>
            </div>
            <button type="submit" className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
              <Save size={16} /> Guardar Cambios
            </button>
          </form>
        </div>
      )}

      {/* Team Tab */}
      {activeTab === 'team' && <TeamTab />}

      {/* Billing DIAN Tab */}
      {activeTab === 'billing' && <BillingSettings />}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-surface-container-lowest rounded-xl shadow-clinical border border-outline-variant p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-primary/10 p-3 rounded-lg">
              <User size={24} className="text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-on-surface">Mi Perfil</h3>
              <p className="text-xs text-on-surface-variant">Tu información personal</p>
            </div>
          </div>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full clinical-gradient flex items-center justify-center text-xl font-bold text-white">
                {(profileForm.full_name || 'U').split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <p className="font-semibold text-on-surface">{profileForm.full_name || 'Usuario'}</p>
                <p className="text-sm text-on-surface-variant">{profile?.email || ''}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-on-surface-variant block mb-1">Nombre completo</label>
                <input
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs text-on-surface-variant block mb-1">Teléfono</label>
                <input
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="310-123-4567"
                />
              </div>
            </div>
            <button type="submit" className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
              <Save size={16} /> Guardar Cambios
            </button>
          </form>
        </div>
      )}

      {/* Plan Tab — gestión completa de suscripción SaaS */}
      {activeTab === 'plan' && <PlanTab />}
    </div>
  );
}
