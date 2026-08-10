import { useState, useEffect, useCallback } from 'react';
import { MotionConfig } from 'framer-motion';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { isPasswordRecoveryPending, isSupabaseConfigured } from './lib/supabase';
import { isDemoMode } from './lib/demo';
import ErrorBoundary from './components/ErrorBoundary';
import SetupNotice from './components/SetupNotice';
import DemoBanner from './components/DemoBanner';
import { ToastProvider } from './components/Toast';
import { useIdleTimeout } from './hooks/useIdleTimeout';
import AppShell from './components/layout/AppShell';
import Dashboard from './components/Dashboard';
import Pacientes from './components/Pacientes';
import Conversaciones from './components/conversaciones/Conversaciones';
import Citas from './components/Citas';
import Jornadas from './components/Jornadas';
import ProductosServicios from './components/ProductosServicios';
import Finanzas from './components/Finanzas';
import Settings from './components/Settings';
import Reactivacion from './components/reactivacion/Reactivacion';
import AuthPage from './components/auth/AuthPage';
import OnboardingPage from './components/auth/OnboardingPage';
import ResetPasswordPage from './components/auth/ResetPasswordPage';
import { useAlerts } from './hooks/useTenantData';

// Landing page components (software-first)
import SpineVideo from './components/landing/SpineVideo';
import Navbar from './components/landing/Navbar';
import HeroSoftware from './components/landing/HeroSoftware';
import SoftwareFeatures from './components/landing/SoftwareFeatures';
import DirectoryTeaser from './components/landing/DirectoryTeaser';
import PricingSection from './components/landing/PricingSection';
import SoftwareFooter from './components/landing/SoftwareFooter';
import WhatsAppFAB from './components/landing/WhatsAppFAB';
import LegalPage from './components/landing/LegalPage';

// Patient panel
import PatientApp from './components/patient/PatientApp';

// Directorio de médicos + red profesional
import DirectoryPage from './components/directory/DirectoryPage';
import PractitionerProfilePage from './components/directory/PractitionerProfilePage';
import FeedPage from './components/social/FeedPage';

// PWA UX
import { InstallPrompt, OfflineIndicator, UpdatePrompt } from './components/PWAComponents';

// SaaS Plan
import TrialBanner from './components/billing/TrialBanner';

function CRMApp() {
  const [activeModule, setActiveModule] = useState('dashboard');
  // Paciente a abrir al aterrizar en el módulo (lo fija la paleta ⌘K).
  const [focusPatient, setFocusPatient] = useState(null);
  const { alerts } = useAlerts();
  const { signOut } = useAuth();

  const goToPlan = useCallback(() => setActiveModule('settings'), []);

  const handleIdleLogout = useCallback(() => {
    signOut().catch(() => {});
  }, [signOut]);

  // Cierra sesión tras 30 min sin actividad, con warning a los 28 min (SEC-020)
  const { warningOpen, secondsLeft, dismiss } = useIdleTimeout(handleIdleLogout, 30 * 60 * 1000, 2 * 60 * 1000);

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard': return <Dashboard onNavigate={setActiveModule} />;
      case 'pacientes': return <Pacientes focusPatient={focusPatient} onFocusHandled={() => setFocusPatient(null)} />;
      case 'citas': return <Citas />;
      case 'reactivacion': return <Reactivacion />;
      case 'jornadas': return <Jornadas />;
      case 'productos': return <ProductosServicios />;
      case 'conversaciones': return <Conversaciones />;
      case 'finanzas': return <Finanzas />;
      case 'settings': return <Settings />;
      default: return <Dashboard onNavigate={setActiveModule} />;
    }
  };

  return (
    <>
      <AppShell
        activeModule={activeModule}
        onNavigate={setActiveModule}
        onOpenPatient={setFocusPatient}
        alertCount={alerts?.length || 0}
        banner={<><DemoBanner /><TrialBanner onUpgradeClick={goToPlan} /></>}
      >
        {renderModule()}
      </AppShell>
      {warningOpen && (
        <div className="fixed inset-0 bg-[#0b120f]/55 backdrop-blur-[2px] z-[10000] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-clinical-lg max-w-sm w-full p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-tertiary-container text-on-tertiary-container flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            </div>
            <h3 className="font-display text-lg font-semibold text-on-surface mb-2">Tu sesión va a expirar</h3>
            <p className="text-sm text-on-surface-variant mb-1">Por inactividad cerraremos tu sesión en:</p>
            <p className="font-display text-3xl font-semibold text-primary mb-5 tnum">{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</p>
            <div className="flex gap-2">
              <button onClick={() => signOut()} className="flex-1 px-4 py-2.5 border border-outline-variant text-on-surface-variant rounded-xl text-sm font-semibold hover:bg-surface-container-low transition-colors">
                Cerrar sesión
              </button>
              <button onClick={dismiss} className="flex-1 px-4 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:bg-primary-light transition-colors">
                Sigo aquí
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function LandingApp() {
  return (
    <div className="bg-background text-on-surface overflow-x-hidden antialiased">
      <SpineVideo />
      <Navbar />
      <div className="relative z-10">
        <HeroSoftware />
        <SoftwareFeatures />
        <DirectoryTeaser />
        <PricingSection />
        <SoftwareFooter />
      </div>
      <WhatsAppFAB />
    </div>
  );
}

function getViewFromHash() {
  const h = window.location.hash;
  // El flujo de recuperación manda SIEMPRE: supabase-js limpia el hash al detectar
  // la sesión, así que sin esta marca el usuario caía dentro de la app ya logueado
  // y nunca podía fijar su contraseña.
  if (isPasswordRecoveryPending()) return 'reset-password';
  if (h === '#crm') return 'crm';
  if (h === '#paciente' || h === '#patient') return 'patient';
  if (h.startsWith('#reset-password')) return 'reset-password';
  if (h === '#terms') return 'terms';
  if (h === '#privacy') return 'privacy';
  if (h === '#directorio' || h === '#medicos') return 'directory';
  if (h === '#comunidad' || h === '#red' || h === '#feed') return 'feed';
  if (h.startsWith('#dr/')) return 'practitioner';
  return 'landing';
}

// slug del médico desde el hash: #dr/miguel-diaz → 'miguel-diaz'
function getSlugFromHash() {
  const h = window.location.hash;
  return h.startsWith('#dr/') ? h.slice(4) : null;
}

function AppRouter() {
  const { user, tenant, profile, loading, tenantLoading } = useAuth();
  const [view, setView] = useState(getViewFromHash);

  useEffect(() => {
    const onHash = () => setView(getViewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const goToLanding = () => {
    window.location.hash = '';
    setView('landing');
  };

  // Los cortes de ruta van DESPUÉS de los hooks: un `return` antes del
  // useEffect rompe las reglas de hooks (se llamarían en distinto orden según
  // el modo) y React acaba desincronizando el estado.

  // Demostración: se entra directo al CRM con datos de ejemplo.
  if (isDemoMode()) return <CRMApp />;

  // Sin credenciales no hay nada que cargar: se explica en vez de mostrar
  // una pantalla en blanco.
  if (!isSupabaseConfigured) return <SetupNotice />;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full clinical-gradient flex items-center justify-center mx-auto mb-4 animate-pulse">
            <svg className="w-6 h-6 text-on-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3" />
            </svg>
          </div>
          <p className="text-on-surface-variant text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  // Reset password — flujo de recuperación (Supabase abre sesión temporal de recovery)
  if (view === 'reset-password') return <ResetPasswordPage onDone={goToLanding} />;

  // Legal pages — públicas, accesibles desde cualquier estado
  if (view === 'terms') return <LegalPage doc="terms" onBack={goToLanding} />;
  if (view === 'privacy') return <LegalPage doc="privacy" onBack={goToLanding} />;

  // Patient panel — pública (auth propia vía OTP, independiente del CRM)
  if (view === 'patient') return <PatientApp onBack={goToLanding} />;

  // Directorio de médicos + perfiles — públicos (no requieren sesión)
  if (view === 'directory') {
    return (
      <DirectoryPage
        onBack={goToLanding}
        onOpenProfile={(slug) => { window.location.hash = `#dr/${slug}`; }}
      />
    );
  }
  if (view === 'practitioner') {
    return (
      <PractitionerProfilePage
        slug={getSlugFromHash()}
        onBack={() => { window.location.hash = '#directorio'; }}
      />
    );
  }
  if (view === 'feed') return <FeedPage onBack={goToLanding} />;

  // Auth flow
  if (!user) {
    if (view === 'crm') return <AuthPage />;
    return <LandingApp />;
  }

  // Mientras carga el tenant del usuario logueado, mostrar loader (no flash de onboarding)
  if (tenantLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full clinical-gradient flex items-center justify-center mx-auto mb-4 animate-pulse">
            <svg className="w-6 h-6 text-on-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3" />
            </svg>
          </div>
          <p className="text-on-surface-variant text-sm">Cargando tu consultorio...</p>
        </div>
      </div>
    );
  }

  // El profile ya cargó. Si NO tiene default_tenant_id → ir a onboarding (real, no por bug).
  // Si tiene default_tenant_id pero el tenant es null → la consulta falló (RLS, deleted, etc.)
  if (!tenant) {
    if (profile?.default_tenant_id) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <p className="text-lg font-bold text-on-surface mb-2">No pudimos cargar tu consultorio</p>
            <p className="text-on-surface-variant text-sm mb-6">Verifica tu conexión a internet o intenta cerrar sesión y volver a entrar.</p>
            <button onClick={() => window.location.reload()} className="bg-primary hover:bg-primary-light text-on-primary px-6 py-3 rounded-lg font-medium">
              Reintentar
            </button>
          </div>
        </div>
      );
    }
    return <OnboardingPage />;
  }

  // User has tenant → CRM
  return <CRMApp />;
}

function App() {
  return (
    // reducedMotion="user": quien tenga activado "reducir movimiento" en su
    // sistema ve la interfaz sin desplazamientos. Regla dura de accesibilidad
    // en todo lo que se mueve.
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <ToastProvider>
            <OfflineIndicator />
            <AppRouter />
            <UpdatePrompt />
            <InstallPrompt />
          </ToastProvider>
        </AuthProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}

export default App;
