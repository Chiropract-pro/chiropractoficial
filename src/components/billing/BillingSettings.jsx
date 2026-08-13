import { useEffect, useState } from 'react';
import {
  AlertCircle, AlertTriangle, CheckCircle, ExternalLink, FileText,
  Info, Loader2, RefreshCcw, Save, Shield, Zap,
} from 'lucide-react';
import { useBillingConfig } from '../../hooks/useBillingConfig';
import { useToast } from '../Toast';
import { userFriendlyError } from '../../lib/logger';

const ID_TYPES = [
  { value: 'NIT', label: 'NIT (empresa)' },
  { value: 'CC', label: 'Cédula de Ciudadanía' },
  { value: 'CE', label: 'Cédula de Extranjería' },
  { value: 'TI', label: 'Tarjeta de Identidad' },
  { value: 'PA', label: 'Pasaporte' },
  { value: 'PEP', label: 'Permiso Especial de Permanencia' },
];


/**
 * Proveedores de facturación electrónica.
 *
 * `conectado` dice la verdad: solo Alegra tiene conector probado de punta a
 * punta (probar credenciales y emitir). Con los demás se puede dejar la
 * configuración guardada, pero la emisión todavía no sale de aquí, y la
 * pantalla lo dice en vez de aparentar que funciona.
 */
const PROVEEDORES = {
  alegra: {
    nombre: 'Alegra',
    sitio: 'https://www.alegra.com',
    conectado: true,
    resumen: 'El más usado por consultorios pequeños en Colombia.',
    campoUsuario: 'Email de tu cuenta Alegra',
    campoToken: 'Token de Alegra',
    dondeSacarlo: 'En Alegra → Configuración → API → Token de Alegra, copia tu email y token.',
  },
  qount: {
    nombre: 'qount',
    sitio: 'https://qount.co',
    conectado: false,
    resumen: 'El servicio contable de Invent Agency: contabilidad y DIAN en el mismo lugar.',
    campoUsuario: 'Correo de tu cuenta qount',
    campoToken: 'Llave de API de qount',
    dondeSacarlo: 'En qount → Ajustes → Integraciones, genera una llave de API.',
  },
  siigo: {
    nombre: 'Siigo',
    sitio: 'https://www.siigo.com',
    conectado: false,
    resumen: 'Para consultorios que ya llevan su contabilidad en Siigo.',
    campoUsuario: 'Usuario de Siigo',
    campoToken: 'Access key de Siigo',
    dondeSacarlo: 'En Siigo → Configuración → API, genera tu access key.',
  },
  factus: {
    nombre: 'Factus',
    sitio: 'https://factus.com.co',
    conectado: false,
    resumen: 'Proveedor tecnológico autorizado, enfocado en emisión.',
    campoUsuario: 'Correo de tu cuenta Factus',
    campoToken: 'Token de Factus',
    dondeSacarlo: 'En Factus → Perfil → Credenciales de API.',
  },
  manual: {
    nombre: 'Sin facturación electrónica',
    conectado: true,
    resumen: 'Las ventas y los recibos se registran igual; simplemente no se emite factura a la DIAN.',
  },
};

const EMPTY = {
  provider: 'alegra',
  api_email: '',
  api_token: '',
  resolution_id: '',
  test_mode: true,
  business_name: '',
  business_id: '',
  business_id_type: 'NIT',
  business_address: '',
  business_city: '',
  is_active: false,
};

export default function BillingSettings() {
  const { config, loading, save, testConnection } = useBillingConfig();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok, account_name, numerations[] }
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    if (config) {
      setForm({
        ...EMPTY,
        ...config,
        api_token: '', // No prellenar token (security: avoid leaking si abre devtools)
      });
    } else {
      setForm(EMPTY);
    }
  }, [config]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const prov = PROVEEDORES[form.provider] || PROVEEDORES.alegra;
  const sinFacturacion = form.provider === 'manual';

  const handleSave = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      // Si el usuario no escribió un nuevo token, no lo sobreescribas
      const payload = { ...form };
      if (!payload.api_token) payload.api_token = null; // RPC trata null como "mantener actual"

      await save(payload);
      toast.success('Configuración guardada');
    } catch (e) {
      toast.error(userFriendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Si el usuario escribió un nuevo token, probar con ese (sin guardar todavía)
      const overrides = {};
      if (form.api_email) overrides.api_email = form.api_email;
      if (form.api_token) overrides.api_token = form.api_token;

      const res = await testConnection(overrides);
      setTestResult(res);
      if (res.ok) toast.success(`Conectado a ${prov.nombre}: ${res.account_name || ''}`);
    } catch (e) {
      setTestResult({ ok: false, error: e.message });
      toast.error(userFriendlyError(e));
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-clinical border border-outline-variant p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg clinical-gradient flex items-center justify-center text-on-primary">
          <FileText size={20} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-on-surface">Facturación electrónica DIAN</h3>
          <p className="text-sm text-on-surface-variant">
            Elige tu proveedor y conecta la cuenta con la que emites a la DIAN.
          </p>
        </div>
      </div>

      {/* Estado actual */}
      {config && (
        <div className={`rounded-xl p-4 border flex items-start gap-3 ${
          config.is_active && config.last_test_ok
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : config.last_test_ok === false
            ? 'bg-[#f6e7db]/70 border-warning/30 text-[#a85b32]'
            : 'bg-[#e0e9f1]/70 border-info/25 text-[#3a5a78]'
        }`}>
          {config.is_active && config.last_test_ok ? <CheckCircle size={18} className="mt-0.5 flex-shrink-0" />
            : config.last_test_ok === false ? <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
            : <Info size={18} className="mt-0.5 flex-shrink-0" />}
          <div className="text-sm flex-1">
            {config.is_active && config.last_test_ok && (
              <>
                <p className="font-semibold">Facturación electrónica activa</p>
                <p className="text-xs mt-0.5">
                  {config.test_mode ? 'Modo prueba (sandbox)' : 'Modo producción — emite facturas reales a DIAN'}
                  {config.last_test_at && ` · Último test: ${new Date(config.last_test_at).toLocaleString('es-CO')}`}
                </p>
              </>
            )}
            {config.last_test_ok === false && (
              <>
                <p className="font-semibold">Las credenciales fallaron en el último test</p>
                {config.last_test_error && (
                  <p className="text-xs mt-1 opacity-80 line-clamp-2">{config.last_test_error}</p>
                )}
              </>
            )}
            {config.last_test_ok === null && (
              <p className="font-semibold">Configura y prueba tu cuenta para activar</p>
            )}
          </div>
        </div>
      )}

      {/* Proveedor */}
      <div>
        <h4 className="text-sm font-bold text-on-surface mb-3">¿Con quién facturas?</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {Object.entries(PROVEEDORES).map(([clave, p]) => (
            <button
              key={clave}
              type="button"
              onClick={() => update('provider', clave)}
              className={`text-left rounded-xl border p-3.5 transition-colors ${
                form.provider === clave
                  ? 'border-primary bg-primary/5'
                  : 'border-outline-variant hover:bg-surface-container-low'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="font-semibold text-on-surface text-sm">{p.nombre}</span>
                {!p.conectado && (
                  <span className="text-[9.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                    Conector en camino
                  </span>
                )}
              </span>
              <span className="block text-[11.5px] text-on-surface-variant mt-1 leading-snug">{p.resumen}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Ayuda del proveedor elegido */}
      {!sinFacturacion && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-on-surface space-y-2">
          <p className="font-semibold flex items-center gap-1.5">
            <Shield size={14} className="text-primary" /> Antes de empezar con {prov.nombre}
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-xs text-on-surface-variant">
            <li>
              Ten una cuenta en{' '}
              <a href={prov.sitio} target="_blank" rel="noopener noreferrer" className="text-primary font-medium inline-flex items-center gap-0.5">
                {prov.nombre} <ExternalLink size={10} />
              </a>{' '}con <b>facturación electrónica</b> activada ante la DIAN (se hace una sola vez).
            </li>
            <li>{prov.dondeSacarlo}</li>
            <li>Pega los datos abajo, prueba la conexión y elige la numeración DIAN.</li>
          </ol>
          {!prov.conectado && (
            <p className="flex items-start gap-2 text-[11.5px] text-[#a85b32] bg-[#f6e7db]/70 border border-warning/30 rounded-lg px-3 py-2 mt-1">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              Puedes dejar la configuración de {prov.nombre} guardada, pero la emisión automática
              todavía no sale desde aquí — hoy solo está conectada con Alegra. Mientras tanto las
              ventas se registran igual y la factura se emite desde {prov.nombre}.
            </p>
          )}
        </div>
      )}

      {sinFacturacion && (
        <p className="bg-surface-container-low border border-outline-variant rounded-xl p-4 text-[13px] text-on-surface-variant leading-relaxed">
          Sin facturación electrónica el sistema funciona completo: se cobra, se registra la venta
          y el paciente recibe su recibo. Lo único que no ocurre es la emisión a la DIAN.
        </p>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        {/* Credenciales del proveedor */}
        <div className={sinFacturacion ? 'hidden' : ''}>
          <h4 className="text-sm font-bold text-on-surface mb-3">Credenciales de {prov.nombre}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={prov.campoUsuario}
              type="email"
              value={form.api_email}
              onChange={(v) => update('api_email', v)}
              placeholder="cuenta@chiropract.co"
            />
            <Input
              label={prov.campoToken}
              type={showToken ? 'text' : 'password'}
              value={form.api_token}
              onChange={(v) => update('api_token', v)}
              placeholder={config?.api_email ? '••••••• (token guardado)' : 'pega tu token aquí'}
              hint={config?.api_email && !form.api_token ? 'Deja vacío para conservar el token actual' : undefined}
              suffix={
                <button type="button" onClick={() => setShowToken(!showToken)} className="text-xs text-primary px-2">
                  {showToken ? 'Ocultar' : 'Mostrar'}
                </button>
              }
            />
          </div>

          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !prov.conectado || (!form.api_email && !config?.api_email)}
              title={prov.conectado ? undefined : `Todavía no hay conector para ${prov.nombre}`}
              className="flex items-center gap-1.5 text-sm bg-surface-container-low hover:bg-surface-container border border-outline-variant text-on-surface px-4 py-2 rounded-lg font-medium disabled:opacity-50"
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
              Probar conexión
            </button>
          </div>

          {/* Resultado del test */}
          {testResult && (
            <div className={`mt-3 rounded-lg p-3 border text-sm ${
              testResult.ok
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-[#f6ddd3]/70 border-danger/25 text-[#a03a22]'
            }`}>
              {testResult.ok ? (
                <>
                  <p className="font-semibold flex items-center gap-1">
                    <CheckCircle size={14} /> Conectado: {testResult.account_name || `Cuenta ${prov.nombre}`}
                  </p>
                  {testResult.numerations?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold uppercase tracking-wide mb-1">Numeraciones DIAN disponibles:</p>
                      <ul className="text-xs space-y-0.5">
                        {testResult.numerations.map((n) => (
                          <li key={n.id} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => update('resolution_id', n.id)}
                              className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                                form.resolution_id === n.id ? 'bg-emerald-200 font-bold' : 'bg-emerald-100 hover:bg-emerald-200'
                              }`}
                            >
                              {form.resolution_id === n.id ? '✓' : 'Usar'}
                            </button>
                            <span>
                              <b>{n.prefix}</b> · {n.name} · próximo #{n.nextNumber}
                              {n.isElectronic && <span className="ml-1 text-emerald-700">📡 e-invoice</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="font-semibold flex items-center gap-1">
                  <AlertCircle size={14} /> {testResult.error || 'Falló la conexión'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Datos del emisor */}
        <div>
          <h4 className="text-sm font-bold text-on-surface mb-3">Datos del emisor (tu consultorio)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Razón social / Nombre comercial"
              value={form.business_name}
              onChange={(v) => update('business_name', v)}
              placeholder="Quiropraxia chiropract.co"
            />
            <div className="grid grid-cols-3 gap-2">
              <Select
                label="Tipo doc"
                value={form.business_id_type}
                onChange={(v) => update('business_id_type', v)}
                options={ID_TYPES}
              />
              <div className="col-span-2">
                <Input
                  label="Número (NIT/CC)"
                  value={form.business_id}
                  onChange={(v) => update('business_id', v)}
                  placeholder="900123456-7"
                />
              </div>
            </div>
            <Input
              label="Dirección"
              value={form.business_address}
              onChange={(v) => update('business_address', v)}
              placeholder="Calle 100 # 15-30"
            />
            <Input
              label="Ciudad"
              value={form.business_city}
              onChange={(v) => update('business_city', v)}
              placeholder="Bogotá"
            />
          </div>
        </div>

        {/* Numeración DIAN + modo */}
        <div className={sinFacturacion ? 'hidden' : ''}>
          <h4 className="text-sm font-bold text-on-surface mb-3">Configuración DIAN</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="ID de numeración DIAN"
              value={form.resolution_id}
              onChange={(v) => update('resolution_id', v)}
              placeholder="123456 (lo seleccionas tras probar conexión)"
              hint="Click en 'Usar' arriba tras probar conexión"
            />
            <div>
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-1">
                Modo
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => update('test_mode', true)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                    form.test_mode
                      ? 'bg-[#f6e7db] border-warning/40 text-[#a85b32]'
                      : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  🧪 Pruebas
                </button>
                <button
                  type="button"
                  onClick={() => update('test_mode', false)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                    !form.test_mode
                      ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                      : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  🚀 Producción
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Activar */}
        <div className="bg-surface-container-low rounded-xl p-4 flex items-start gap-3">
          <input
            type="checkbox"
            id="is_active"
            checked={form.is_active}
            onChange={(e) => update('is_active', e.target.checked)}
            className="mt-1"
          />
          <label htmlFor="is_active" className="text-sm cursor-pointer">
            <span className="font-semibold text-on-surface flex items-center gap-1.5">
              <Zap size={14} /> Activar facturación electrónica
            </span>
            <span className="text-xs text-on-surface-variant block mt-0.5">
              Cuando esté activa, podrás emitir facturas DIAN desde el módulo Finanzas.
              {form.test_mode && ' En modo Pruebas, no se cobra ni se reporta a DIAN real.'}
            </span>
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 clinical-gradient text-on-primary px-6 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar configuración
          </button>
        </div>
      </form>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder, hint, suffix }) {
  return (
    <div>
      <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-1">{label}</span>
      <div className="relative">
        <input
          type={type}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
        />
        {suffix && <div className="absolute right-1 top-1/2 -translate-y-1/2">{suffix}</div>}
      </div>
      {hint && <p className="text-[11px] text-on-surface-variant mt-1">{hint}</p>}
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
