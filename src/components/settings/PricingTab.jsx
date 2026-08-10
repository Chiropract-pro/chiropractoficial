import { useState } from 'react';
import { Save, Tag, RotateCcw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { appointmentTypes, getAppointmentTypes, formatCOP } from '../../utils/format';
import { userFriendlyError } from '../../lib/logger';
import { useToast } from '../Toast';
import Button from '../ui/Button';
import { Card, SectionHeader } from '../ui/Card';
import { Field, FormGrid, Input } from '../ui/Field';

/**
 * Tarifas del consultorio.
 *
 * Antes los precios estaban quemados en el código y cambiarlos exigía un
 * despliegue. Ahora viven en `tenants.appointment_prices` (migración 041) y
 * los edita el propio consultorio.
 */
export default function PricingTab() {
  const { tenant, updateTenant } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  // Se arranca de los valores efectivos (los del consultorio, o los de fábrica
  // si aún no ha configurado nada), no de un formulario vacío.
  const [prices, setPrices] = useState(() =>
    Object.fromEntries(getAppointmentTypes(tenant).map((t) => [t.value, String(t.price)])));

  const setOne = (key, value) => setPrices((p) => ({ ...p, [key]: value.replace(/[^\d]/g, '') }));

  const restoreDefaults = () =>
    setPrices(Object.fromEntries(appointmentTypes.map((t) => [t.value, String(t.price)])));

  const submit = async (e) => {
    e.preventDefault();
    const payload = {};
    for (const t of appointmentTypes) {
      const v = Number(prices[t.value]);
      if (!Number.isFinite(v) || v < 0) {
        toast.error(`La tarifa de "${t.label}" no es un valor válido.`);
        return;
      }
      payload[t.value] = Math.round(v);
    }
    setSaving(true);
    try {
      await updateTenant?.({ appointment_prices: payload });
      toast.success('Tarifas actualizadas');
    } catch (err) {
      toast.error(userFriendlyError(err) || 'No se pudieron guardar las tarifas.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-3xl">
      <SectionHeader
        icon={Tag}
        title="Tarifas por tipo de cita"
        hint="Se aplican al agendar y al cobrar"
      />
      <form onSubmit={submit} className="space-y-4">
        <FormGrid>
          {appointmentTypes.map((t) => (
            <Field
              key={t.value}
              label={t.label}
              hint={`Vista previa: ${formatCOP(Number(prices[t.value]) || 0)}`}
            >
              <Input
                value={prices[t.value] ?? ''}
                onChange={(e) => setOne(t.value, e.target.value)}
                inputMode="numeric"
                placeholder={String(t.price)}
                aria-label={`Tarifa de ${t.label} en pesos`}
              />
            </Field>
          ))}
        </FormGrid>

        <p className="text-[11px] text-on-surface-variant leading-snug">
          El cambio aplica a las citas que se agenden de aquí en adelante. Las citas
          ya registradas conservan el precio con el que se crearon.
        </p>

        <div className="flex flex-wrap gap-2.5">
          <Button type="submit" icon={Save} loading={saving}>Guardar tarifas</Button>
          <Button type="button" variant="outline" icon={RotateCcw} onClick={restoreDefaults}>
            Restaurar sugeridas
          </Button>
        </div>
      </form>
    </Card>
  );
}
