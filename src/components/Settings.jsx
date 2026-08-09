import { useState } from 'react';
import { Building2, CheckCircle, CreditCard, FileText, Globe, Save, User, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import TeamTab from './TeamTab';
import BillingSettings from './billing/BillingSettings';
import PlanTab from './billing/PlanTab';
import PublicProfileTab from './directory/PublicProfileTab';
import { userFriendlyError } from '../lib/logger';
import { Card, PageHeader, SectionHeader } from './ui/Card';
import { UnderlineTabs } from './ui/Tabs';
import { Field, FormGrid, Input } from './ui/Field';
import Button from './ui/Button';


const TABS = [
  { id: 'clinic', label: 'Consultorio', icon: Building2 },
  { id: 'directory', label: 'Perfil público', icon: Globe },
  { id: 'team', label: 'Equipo', icon: Users },
  { id: 'billing', label: 'Facturación DIAN', icon: FileText },
  { id: 'profile', label: 'Mi perfil', icon: User },
  { id: 'plan', label: 'Plan', icon: CreditCard },
];

export default function Settings() {
  const { tenant, profile, updateProfile, updateTenant } = useAuth();
  const [activeTab, setActiveTab] = useState('clinic');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
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

  // updateTenant/updateProfile hacen throw. Sin try/catch, un fallo (p.ej. RLS:
  // solo el owner puede editar el consultorio) dejaba la promesa rechazada y la
  // pantalla SIN NINGUNA señal: ni éxito ni error. Ahora siempre hay respuesta.
  const save = async (fn, fallbackMsg) => {
    setSaveError('');
    setSaving(true);
    try {
      await fn();
      setSaved(true);
      setTimeout(() => setSaved(false), 2400);
    } catch (err) {
      setSaveError(userFriendlyError(err) || fallbackMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClinic = (e) => {
    e.preventDefault();
    save(
      () => updateTenant?.({
        name: clinicForm.name,
        phone: clinicForm.phone || null,
        address: clinicForm.address || null,
        city: clinicForm.city || null,
      }),
      'No se pudieron guardar los cambios.',
    );
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    save(() => updateProfile?.(profileForm), 'No se pudo guardar tu perfil.');
  };

  const initials = (profileForm.full_name || 'U').split(' ').map((n) => n[0]).join('').slice(0, 2);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <PageHeader kicker="Configuración" title="Ajustes" subtitle="Consultorio, equipo, facturación y plan">
          {saved && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-success bg-[#e0efe8] px-3 py-1.5 rounded-full">
              <CheckCircle size={14} /> Guardado
            </span>
          )}
        </PageHeader>
      </div>

      {saveError && (
        <div className="bg-error-container/40 text-on-error-container border border-error/25 px-4 py-3 rounded-xl text-sm">
          {saveError}
        </div>
      )}

      <div>
        <UnderlineTabs tabs={TABS} value={activeTab} onChange={setActiveTab} />
      </div>

      <div>
        {activeTab === 'clinic' && (
          <Card className="max-w-3xl">
            <SectionHeader icon={Building2} title="Información del consultorio" hint="Aparece en recibos, correos y el perfil público" />
            <form onSubmit={handleSaveClinic} className="space-y-4">
              <FormGrid>
                <Field label="Nombre del consultorio" required>
                  <Input value={clinicForm.name} onChange={(e) => setClinicForm({ ...clinicForm, name: e.target.value })} />
                </Field>
                <Field label="Slug (URL)" hint="No se puede cambiar: es la dirección de tu perfil">
                  <Input value={clinicForm.slug} disabled />
                </Field>
                <Field label="Teléfono">
                  <Input
                    value={clinicForm.phone}
                    onChange={(e) => setClinicForm({ ...clinicForm, phone: e.target.value })}
                    placeholder="310 123 4567"
                    type="tel"
                  />
                </Field>
                <Field label="Ciudad">
                  <Input value={clinicForm.city} onChange={(e) => setClinicForm({ ...clinicForm, city: e.target.value })} placeholder="Bogotá" />
                </Field>
                <Field label="Dirección" span={2}>
                  <Input value={clinicForm.address} onChange={(e) => setClinicForm({ ...clinicForm, address: e.target.value })} placeholder="Dirección completa" />
                </Field>
              </FormGrid>
              <Button type="submit" icon={Save} loading={saving}>Guardar cambios</Button>
            </form>
          </Card>
        )}

        {activeTab === 'directory' && <PublicProfileTab />}
        {activeTab === 'team' && <TeamTab />}
        {activeTab === 'billing' && <BillingSettings />}
        {activeTab === 'plan' && <PlanTab />}

        {activeTab === 'profile' && (
          <Card className="max-w-3xl">
            <SectionHeader icon={User} title="Mi perfil" hint="Tu información personal dentro del consultorio" />
            <div className="flex items-center gap-4 mb-5 pb-5 hairline border-t-0 border-b border-outline-variant">
              <span className="w-14 h-14 rounded-2xl clinical-gradient flex items-center justify-center text-lg font-bold text-on-primary flex-shrink-0">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="font-display text-base font-semibold text-on-surface truncate">{profileForm.full_name || 'Usuario'}</p>
                <p className="text-sm text-on-surface-variant truncate">{profile?.email || ''}</p>
              </div>
            </div>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <FormGrid>
                <Field label="Nombre completo" required>
                  <Input value={profileForm.full_name} onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} />
                </Field>
                <Field label="Teléfono">
                  <Input
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="310 123 4567"
                    type="tel"
                  />
                </Field>
              </FormGrid>
              <Button type="submit" icon={Save} loading={saving}>Guardar cambios</Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
