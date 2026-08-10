import { useAuth } from '../../contexts/AuthContext';
import { manualPara, NOMBRE_DEL_ROL } from '../../lib/manual';
import Ayuda from './Ayuda';

/**
 * El manual dentro del CRM, resuelto según el rol de quien entró.
 *
 * Recepción ve el día a día; el dueño ve además la configuración —tarifas,
 * equipo, facturación y plan—. Mostrarle a la recepcionista cómo cambiar el
 * plan de suscripción solo sirve para que lo cambie sin querer.
 */
export default function AyudaCRM() {
  const { membership } = useAuth();
  const rol = membership?.role || 'receptionist';

  return (
    <Ayuda
      manual={manualPara(rol)}
      etiquetaRol={NOMBRE_DEL_ROL[rol] || 'Equipo'}
    />
  );
}
