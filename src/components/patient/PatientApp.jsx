import { PatientAuthProvider, usePatientAuth } from '../../contexts/PatientAuthContext';
import PatientLogin from './PatientLogin';
import PatientHome from './PatientHome';

function PatientRouter({ onBack }) {
  const { session } = usePatientAuth();

  if (!session?.session_token) {
    return <PatientLogin onBack={onBack} />;
  }
  return <PatientHome />;
}

/**
 * Punto de entrada del Panel del Paciente.
 * Maneja su propio AuthProvider — independiente del CRM (que usa Supabase Auth).
 */
export default function PatientApp({ onBack }) {
  return (
    <PatientAuthProvider>
      <PatientRouter onBack={onBack} />
    </PatientAuthProvider>
  );
}
