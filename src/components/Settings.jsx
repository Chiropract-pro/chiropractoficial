import { useState } from 'react';
import { Building2, CheckCircle, CreditCard, FileText, Globe, Save, Tag, User, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import TeamTab from './TeamTab';
import BillingSettings from './billing/BillingSettings';
import PlanTab from './billing/PlanTab';
import PricingTab from './settings/PricingTab';
import PerfilTab from './settings/PerfilTab';
import PublicProfileTab from './directory/PublicProfileTab';
import { userFriendlyError } from '../lib/logger';
import { Card, PageHeader, SectionHeader } from './ui/Card';
import { UnderlineTabs } from './ui/Tabs';
import { Field, FormGrid, Input } from './ui/Field';
import Button from './ui/Button';


const TABS = [
  { id: 'clinic', label: 'Consultorio', icon: Building2 },
  { id: 'pricing', label: 'Tarifas', icon: Tag },
  { id: 'directory', label: 'Perfil público', icon: Globe },
  { id: 'team', label: 'Equipo', icon: Users },
  { id: 'billing', label: 'Facturación DIAN', icon: FileText },
  { id: 'profile', label: 'Mi perfil', icon: User },
  { id: 'plan', label: 'Plan', icon: CreditCard },
];

export default function Settings() {
  const { tenant, updateTenant } = useAuth();
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

        {activeTab === 'pricing' && <PricingTab />}
        {activeTab === 'directory' && <PublicProfileTab />}
        {activeTab === 'team' && <TeamTab />}
        {activeTab === 'billing' && <BillingSettings />}
        {activeTab === 'profile' && <PerfilTab />}
        {activeTab === 'plan' && <PlanTab />}
      </div>
    </div>
  );
}
