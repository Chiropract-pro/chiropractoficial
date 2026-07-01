import { useEffect, useRef, useState } from 'react';

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart'];

/**
 * Hook que muestra un modal de warning antes de cerrar sesión por inactividad.
 *
 * @param {() => void} onTimeout - Callback cuando expira (typically signOut)
 * @param {number} timeoutMs - Tiempo total hasta logout (default 30 min)
 * @param {number} warningMs - Tiempo antes del logout para mostrar warning (default 2 min)
 * @returns {{ warningOpen: boolean, secondsLeft: number, dismiss: () => void }}
 */
export function useIdleTimeout(onTimeout, timeoutMs = 30 * 60 * 1000, warningMs = 2 * 60 * 1000) {
  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(warningMs / 1000));

  const warningTimerRef = useRef(null);
  const logoutTimerRef = useRef(null);
  const countdownRef = useRef(null);
  const ignoreActivityRef = useRef(false); // mientras el modal está abierto, ignorar eventos para que no se reinicie

  const clearTimers = () => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const reset = () => {
    if (ignoreActivityRef.current) return;
    clearTimers();
    setWarningOpen(false);
    warningTimerRef.current = setTimeout(() => {
      setSecondsLeft(Math.floor(warningMs / 1000));
      setWarningOpen(true);
      ignoreActivityRef.current = true;

      countdownRef.current = setInterval(() => {
        setSecondsLeft((s) => Math.max(0, s - 1));
      }, 1000);

      logoutTimerRef.current = setTimeout(() => {
        onTimeout();
      }, warningMs);
    }, timeoutMs - warningMs);
  };

  const dismiss = () => {
    ignoreActivityRef.current = false;
    setWarningOpen(false);
    reset();
  };

  useEffect(() => {
    reset();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, reset, { passive: true }));
    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, reset));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onTimeout, timeoutMs, warningMs]);

  return { warningOpen, secondsLeft, dismiss };
}
