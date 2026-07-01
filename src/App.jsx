import { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './components/Toast';
import { useIdleTimeout } from './hooks/useIdleTimeout';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Pacientes from './components/Pacientes';
import Citas from './components/Citas';
import Jornadas from './components/Jornadas';
import ProductosServicios from './components/ProductosServicios';
import Finanzas from './components/Finanzas';
import Settings from './components/Settings';
import AuthPage from './components/auth/AuthPage';
import OnboardingPage from './components/auth/OnboardingPage';
import { useAlerts } from './hooks/useTenantData';

// Landing page components
import SpineVideo from './components/landing/SpineVideo';
import Navbar from './components/landing/Navbar';
import HeroSection from './components/landing/HeroSection';
import ServicesSection from './components/landing/ServicesSection';
import AboutSection from './components/landing/AboutSection';
import JornadasSection from './components/landing/JornadasSection';
import TestimonialsSection from './components/landing/TestimonialsSection';
import ContactSection from './components/landing/ContactSection';
import WhatsAppFAB from './components/landing/WhatsAppFAB';
import LegalPage from './components/landing/LegalPage';
import PricingSection from './components/landing/PricingSection';

// Patient panel
import PatientApp from './components/patient/PatientApp';

// PWA UX
import { InstallPrompt, OfflineIndicator, UpdatePrompt } from './components/PWAComponents';

// SaaS Plan
import TrialBanner from './components/billing/TrialBanner';

function CRMApp() {
  const [activeModule, setActiveModule] = useState('dashboard');
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
      case 'pacientes': return <Pacientes />;
      case 'citas': return <Citas />;
      case 'jornadas': return <Jornadas />;
      case 'productos': return <ProductosServicios />;
      case 'finanzas': return <Finanzas />;
      case 'settings': return <Settings />;
      default: return <Dashboard onNavigate={setActiveModule} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-surface-container-low">
      <Sidebar activeModule={activeModule} onNavigate={setActiveModule} alerts={alerts} />
      <main className="flex-1 lg:ml-0 overflow-auto">
        <TrialBanner onUpgradeClick={goToPlan} />
        <div className="p-6 lg:p-8 max-w-6xl mx-auto">
          {renderModule()}
        </div>
      </main>
      {warningOpen && (
        <div className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            </div>
            <h3 className="text-lg font-bold text-on-surface mb-2">Su sesión va a expirar</h3>
            <p className="text-sm text-on-surface-variant mb-1">Por inactividad cerraremos su sesión en:</p>
            <p className="text-3xl font-bold text-primary mb-5">{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</p>
            <div className="flex gap-2">
              <button onClick={() => signOut()} className="flex-1 px-4 py-2 border border-outline-variant text-on-surface-variant rounded-lg text-sm font-medium hover:bg-surface-container-low">
                Cerrar sesión
              </button>
              <button onClick={dismiss} className="flex-1 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary-light">
                Sigo aquí
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LandingApp() {
  return (
    <div className="bg-background text-on-surface overflow-x-hidden antialiased">
      <SpineVideo />
      <Navbar />
      <div className="relative z-10">
        <HeroSection />
        <ServicesSection />
        <AboutSection />
        <JornadasSection />
        <TestimonialsSection />
        <PricingSection />
        <ContactSection />
      </div>
      <WhatsAppFAB />
    </div>
  );
}

function getViewFromHash() {
  const h = window.location.hash;
  if (h === '#crm') return 'crm';
  if (h === '#paciente' || h === '#patient') return 'patient';
  if (h === '#terms') return 'terms';
  if (h === '#privacy') return 'privacy';
  return 'landing';
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

  // Legal pages — públicas, accesibles desde cualquier estado
  if (view === 'terms') return <LegalPage doc="terms" onBack={goToLanding} />;
  if (view === 'privacy') return <LegalPage doc="privacy" onBack={goToLanding} />;

  // Patient panel — pública (auth propia vía OTP, independiente del CRM)
  if (view === 'patient') return <PatientApp onBack={goToLanding} />;

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
    <AuthProvider>
      <ToastProvider>
        <OfflineIndicator />
        <AppRouter />
        <UpdatePrompt />
        <InstallPrompt />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
