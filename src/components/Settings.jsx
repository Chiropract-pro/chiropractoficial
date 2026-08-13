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


// `soloDueno` marca lo que solo debe ver quien manda en el consultorio:
// tarifas, equipo, facturación y plan. Sin esto, la recepcionista podía subir
// el precio de la consulta, invitar usuarios o cancelar la suscripción — no
// por mala fe, sino porque estaba ahí y se puede tocar sin querer.
// «Mi perfil» lo ve todo el mundo: es donde cada uno cambia su contraseña.
const TABS = [
  { id: 'clinic', label: 'Consultorio', icon: Building2, soloDueno: true },
  { id: 'pricing', label: 'Tarifas', icon: Tag, soloDueno: true },
  { id: 'directory', label: 'Perfil público', icon: Globe, soloDueno: true },
  { id: 'team', label: 'Equipo', icon: Users, soloDueno: true },
  { id: 'billing', label: 'Facturación DIAN', icon: FileText, soloDueno: true },
  { id: 'profile', label: 'Mi perfil', icon: User },
  { id: 'plan', label: 'Plan', icon: CreditCard, soloDueno: true },
];

export default function Settings() {
  const { tenant, updateTenant, membership } = useAuth();
  // Ante la duda —rol desconocido o sesión a medio cargar— el más restringido.
  const manda = ['owner', 'admin'].includes(membership?.role);
  const visibles = TABS.filter((t) => !t.soloDueno || manda);
  const [activeTab, setActiveTab] = useState(() => (manda ? 'clinic' : 'profile'));
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
        <UnderlineTabs tabs={visibles} value={activeTab} onChange={setActiveTab} />
      </div>

      <div>
        {manda && activeTab === 'clinic' && (
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

        {manda && activeTab === 'pricing' && <PricingTab />}
        {manda && activeTab === 'directory' && <PublicProfileTab />}
        {manda && activeTab === 'team' && <TeamTab />}
        {manda && activeTab === 'billing' && <BillingSettings />}
        {activeTab === 'profile' && <PerfilTab />}
        {manda && activeTab === 'plan' && <PlanTab />}
      </div>
    </div>
  );
}
