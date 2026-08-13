import { useState } from 'react';
import { AtSign, Eye, EyeOff, KeyRound, LogOut, Save, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { isDemoMode } from '../../lib/demo';
import { NOMBRE_DEL_ROL } from '../../lib/manual';
import { userFriendlyError } from '../../lib/logger';
import { cn } from '../../lib/utils';
import { useToast } from '../Toast';
import Button from '../ui/Button';
import { Card, SectionHeader } from '../ui/Card';
import { Field, FormGrid, Input } from '../ui/Field';

const DEMO = isDemoMode();

// La membresía de ejemplo no trae fecha de ingreso (vive en el contexto de
// auth, no en los datos de demostración). Sin esto la línea del rol se queda a
// medias justo en la pantalla que se le enseña al cliente. En un consultorio
// real la fecha sale de `tenant_memberships.accepted_at`, que el RPC que crea
// el consultorio siempre llena.
const INGRESO_DEMO = '2026-02-03';

/** «julio de 2026» — el mes y el año bastan para dar contexto; el día sobra. */
function mesYAnio(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('es-CO', {
    month: 'long', year: 'numeric', timeZone: 'America/Bogota',
  }).format(d);
}

/**
 * El monograma se saca del nombre SIN el título: «Dr. Miguel Ángel Díaz» da
 * «MÁ», no «DM». Es el mismo criterio del avatar del menú lateral — dos
 * monogramas distintos para la misma persona se leen como un error.
 */
function iniciales(nombre) {
  return (nombre || 'U')
    .replace(/^(dr|dra)\.?\s+/i, '')
    .trim()
    .split(/\s+/)
    .map((p) => p[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Supabase contesta en inglés y con detalles que no le sirven a nadie. Se
 * traducen los casos que la gente sí se encuentra al cambiar su contraseña.
 */
function mensajeDeClave(err) {
  const m = err?.message || '';
  if (/different from the old/i.test(m)) return 'La contraseña nueva tiene que ser distinta a la actual.';
  if (/at least|too short|length/i.test(m)) return 'La contraseña es muy corta.';
  if (/weak|pwned|compromised/i.test(m)) return 'Esa contraseña es fácil de adivinar. Elige otra.';
  if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
  if (/session|jwt|token|expired/i.test(m)) return 'Tu sesión venció. Vuelve a entrar e inténtalo otra vez.';
  return 'No se pudo cambiar la contraseña. Inténtalo de nuevo.';
}

/**
 * Retrato: la foto del perfil si la hay, y si no el monograma.
 *
 * NO hay botón para subir la foto a propósito: el único bucket de Storage del
 * proyecto es `clinical-files` (privado, para historias clínicas). Sin un
 * bucket de avatares, un botón de subir sería un adorno que falla al pulsarlo.
 * `profiles.avatar_url` sí existe, así que la foto que ya esté guardada se
 * muestra — y si el enlace se rompe, se cae al monograma sin dejar el hueco.
 */
function Retrato({ nombre, foto }) {
  const [rota, setRota] = useState(false);
  const base = 'w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-2xl flex-shrink-0 ring-1 ring-on-primary/20';

  if (foto && !rota) {
    return (
      <img
        src={foto}
        alt={`Foto de ${nombre}`}
        onError={() => setRota(true)}
        className={cn(base, 'object-cover bg-surface-container-high')}
      />
    );
  }
  return (
    <span className={cn(base, 'amber-gradient flex items-center justify-center font-display text-2xl font-semibold text-on-tertiary-fixed')}>
      {iniciales(nombre)}
    </span>
  );
}

/** Campo de contraseña con el ojo para verla: escribir a ciegas dos veces seguidas es la causa número uno de «no me deja». */
function ClaveInput({ value, onChange, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-10"
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar la contraseña' : 'Ver la contraseña'}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-on-surface transition-colors"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

/**
 * Mi perfil.
 *
 * Antes esto era un avatar de 56px, el nombre, el correo y dos campos sueltos:
 * no decía quién eres dentro del consultorio ni dejaba hacer lo único que de
 * verdad se busca aquí — cambiar la contraseña y salir. Ahora son tres bloques:
 * quién eres (identidad + rol + correo de entrada), tus datos y tu seguridad.
 */
export default function PerfilTab() {
  const { user, profile, tenant, membership, updateProfile, signOut } = useAuth();
  const toast = useToast();

  const [datos, setDatos] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
  });
  const [guardando, setGuardando] = useState(false);

  // El encabezado muestra lo ÚLTIMO GUARDADO, no lo que se está escribiendo:
  // el nombre no debe cambiar arriba hasta que el cambio sea real. Se recuerda
  // aquí porque en demostración el perfil del contexto nunca se actualiza.
  const [nombreGuardado, setNombreGuardado] = useState(profile?.full_name || '');

  const [clave, setClave] = useState('');
  const [repite, setRepite] = useState('');
  const [cambiando, setCambiando] = useState(false);
  const [confirmaSalida, setConfirmaSalida] = useState(false);

  const nombre = nombreGuardado || 'Usuario';
  // `profiles` no tiene columna `email`: el correo real vive en la sesión de
  // auth. Leerlo solo del perfil (como se hacía) dejaba la línea VACÍA a todo
  // usuario de verdad; el de ejemplo sí lo trae, así que la demo lo tapaba.
  const correo = user?.email || profile?.email || 'Sin correo registrado';
  const rol = NOMBRE_DEL_ROL[membership?.role] || 'Miembro del equipo';
  const desde = mesYAnio(membership?.accepted_at || membership?.created_at || (DEMO ? INGRESO_DEMO : null));
  const foto = typeof profile?.avatar_url === 'string' ? profile.avatar_url.trim() : '';
  const noCoinciden = repite.length > 0 && clave !== repite;

  const guardarDatos = async (e) => {
    e.preventDefault();
    const limpio = datos.full_name.trim();
    if (!limpio) {
      toast.error('Tu nombre no puede quedar vacío.');
      return;
    }
    setGuardando(true);
    try {
      // En demostración no hay base que tocar: `updateProfile` mandaría un
      // UPDATE con el id de ejemplo y devolvería un 400 en plena presentación.
      if (!DEMO) await updateProfile?.({ full_name: limpio, phone: datos.phone.trim() || null });
      setNombreGuardado(limpio);
      toast.success(DEMO ? 'Listo. En la demostración el cambio no se guarda.' : 'Tu perfil quedó actualizado.');
    } catch (err) {
      toast.error(userFriendlyError(err));
    } finally {
      setGuardando(false);
    }
  };

  const cambiarClave = async (e) => {
    e.preventDefault();
    if (clave.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (clave !== repite) {
      toast.error('Las dos contraseñas no coinciden.');
      return;
    }
    if (DEMO) {
      toast.info('En la demostración no se cambian contraseñas.');
      setClave('');
      setRepite('');
      return;
    }
    setCambiando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: clave });
      if (error) throw error;
      setClave('');
      setRepite('');
      toast.success('Tu contraseña quedó cambiada.');
    } catch (err) {
      toast.error(mensajeDeClave(err));
    } finally {
      setCambiando(false);
    }
  };

  // En demostración NO se puede llamar a `signOut`: el enrutador entra al CRM
  // por el hash antes de mirar si hay usuario, así que cerrar sesión dejaba la
  // demo en pie pero sin consultorio ni datos, y sin forma de volver. Salir de
  // la demostración es lo que corresponde ahí.
  const salir = () => {
    if (DEMO) { window.location.hash = ''; return; }
    signOut?.();
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <Card tone="pine" className="p-5 sm:p-6">
        <div className="flex items-start gap-4 sm:gap-5">
          <Retrato nombre={nombre} foto={foto} />
          <div className="min-w-0 flex-1">
            <p className="kicker truncate">{tenant?.name || 'Tu consultorio'}</p>
            {/* El nombre se parte en dos líneas antes que recortarse: en un
                teléfono, «Dr. Miguel Ángel …» con puntos suspensivos es lo
                último que uno quiere leer al abrir su propio perfil. */}
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-on-primary mt-1 leading-tight break-words">
              {nombre}
            </h2>
            <p className="text-[13px] text-on-primary/65 mt-1.5">
              <span className="font-semibold text-on-primary/90">{rol}</span>
              {desde && <> · desde {desde}</>}
            </p>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-on-primary/15 flex items-start gap-3">
          <AtSign size={16} className="text-tertiary-fixed-dim flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-on-primary truncate">{correo}</p>
            <p className="text-[11.5px] text-on-primary/55 mt-0.5">
              Con este correo entras al sistema. No se cambia desde esta pantalla.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeader icon={User} title="Tus datos" hint="Así te ve el resto del equipo" />
        <form onSubmit={guardarDatos} className="space-y-4">
          <FormGrid>
            <Field label="Nombre completo" required hint="Aparece en el equipo y en las invitaciones que envías.">
              <Input
                value={datos.full_name}
                onChange={(e) => setDatos({ ...datos, full_name: e.target.value })}
                placeholder="Dr. Miguel Ángel Díaz"
                autoComplete="name"
              />
            </Field>
            <Field label="Teléfono" hint="Es el número al que te busca tu equipo.">
              <Input
                value={datos.phone}
                onChange={(e) => setDatos({ ...datos, phone: e.target.value })}
                placeholder="310 123 4567"
                type="tel"
                autoComplete="tel"
              />
            </Field>
          </FormGrid>
          <Button type="submit" icon={Save} loading={guardando}>Guardar cambios</Button>
        </form>
      </Card>

      <Card>
        <SectionHeader icon={ShieldCheck} title="Seguridad" hint="Tu contraseña y tu sesión" />
        <form onSubmit={cambiarClave} className="space-y-4">
          <FormGrid>
            <Field label="Nueva contraseña" hint="Mínimo 8 caracteres">
              <ClaveInput value={clave} onChange={setClave} placeholder="••••••••" autoComplete="new-password" />
            </Field>
            <Field label="Repite la contraseña" error={noCoinciden ? 'Las dos contraseñas no coinciden.' : undefined}>
              <ClaveInput value={repite} onChange={setRepite} placeholder="••••••••" autoComplete="new-password" />
            </Field>
          </FormGrid>
          <Button type="submit" icon={KeyRound} loading={cambiando}>Cambiar contraseña</Button>
        </form>

        <div className="mt-5 pt-4 hairline flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-on-surface">
              {DEMO ? 'Salir de la demostración' : 'Cerrar sesión'}
            </p>
            <p className="text-[11.5px] text-on-surface-variant mt-0.5 max-w-sm">
              {DEMO
                ? 'Vuelves a la página de inicio. El consultorio de ejemplo queda como está.'
                : 'Sales en este dispositivo. El sistema también cierra tu sesión solo tras 30 minutos sin actividad.'}
            </p>
          </div>
          {confirmaSalida ? (
            <div className="flex items-center gap-2">
              <Button variant="danger" size="sm" onClick={salir}>Sí, salir</Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmaSalida(false)}>Cancelar</Button>
            </div>
          ) : (
            <Button variant="outline" icon={LogOut} onClick={() => setConfirmaSalida(true)}>
              {DEMO ? 'Salir' : 'Cerrar sesión'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
