import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getStoredSession, getMe, logout as apiLogout, saveSession } from '../lib/patientApi';

const PatientAuthContext = createContext({});

export const usePatientAuth = () => useContext(PatientAuthContext);

export function PatientAuthProvider({ children }) {
  const [session, setSession] = useState(() => getStoredSession());
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshDashboard = useCallback(
    async (currentSession) => {
      const tk = currentSession?.session_token || session?.session_token;
      if (!tk) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const data = await getMe(tk);
        setDashboard(data);
      } catch (e) {
        if (e.status === 401) {
          // Sesión expirada — limpiar todo
          setSession(null);
          setDashboard(null);
        } else {
          setError(e.message || 'No pudimos cargar tus datos');
        }
      } finally {
        setLoading(false);
      }
    },
    [session?.session_token],
  );

  useEffect(() => {
    refreshDashboard(session);
    // solo se ejecuta cuando cambia la sesión
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.session_token]);

  const onLoginSuccess = (newSession) => {
    saveSession(newSession);
    setSession(newSession);
  };

  const signOut = async () => {
    const tk = session?.session_token;
    setSession(null);
    setDashboard(null);
    if (tk) await apiLogout(tk);
  };

  const value = {
    session,
    dashboard,
    loading,
    error,
    onLoginSuccess,
    signOut,
    refresh: () => refreshDashboard(session),
  };

  return <PatientAuthContext.Provider value={value}>{children}</PatientAuthContext.Provider>;
}
