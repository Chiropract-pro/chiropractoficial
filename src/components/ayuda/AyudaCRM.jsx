import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { bibliotecaPara, MANUALES, NOMBRE_DEL_ROL, ROL_A_MANUAL } from '../../lib/manual';
import BibliotecaManuales from './BibliotecaManuales';
import Ayuda from './Ayuda';

/**
 * El manual dentro del CRM. Se entra por una biblioteca de tarjetas y no
 * directo al documento: el dueño necesita poder abrir también el manual de su
 * equipo y el del paciente para saber qué les llega.
 *
 * Recepción no ve el del administrador —tarifas, facturación, plan, alta de
 * usuarios—: enseñarle cómo cambiar el plan de suscripción solo sirve para que
 * lo cambie sin querer.
 */
export default function AyudaCRM() {
  const { membership } = useAuth();
  const rol = membership?.role || 'receptionist';
  const disponibles = bibliotecaPara(rol);
  const [abierto, setAbierto] = useState(null);

  if (abierto && MANUALES[abierto]) {
    const esElSuyo = ROL_A_MANUAL[rol] === abierto;
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setAbierto(null)}
          data-sin-imprimir
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <ArrowLeft size={14} /> Todos los manuales
        </button>
        <Ayuda
          manual={MANUALES[abierto]}
          etiquetaRol={esElSuyo ? (NOMBRE_DEL_ROL[rol] || 'Equipo') : undefined}
        />
      </div>
    );
  }

  return (
    <BibliotecaManuales
      manuales={disponibles}
      onAbrir={setAbierto}
      titulo="Manuales"
      subtitulo="Cada rol usa pantallas distintas, así que cada uno tiene el suyo."
    />
  );
}
