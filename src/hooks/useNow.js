import { useEffect, useState } from 'react';

/**
 * Reloj estable para el render.
 *
 * Llamar `Date.now()` dentro de un render o de un useMemo es impuro: el
 * compilador de React lo rechaza, y con razón — dos renders seguidos darían
 * resultados distintos sin que ningún dato haya cambiado. Aquí el tiempo entra
 * como estado, así que es una dependencia más.
 *
 * De paso resuelve algo que igual hacía falta: la cuenta atrás de la ventana de
 * 24 h de WhatsApp tiene que avanzar sola, sin recargar la página.
 */
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
