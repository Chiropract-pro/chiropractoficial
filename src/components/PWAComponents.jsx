// PWA UX components: offline indicator, update prompt, install prompt.
// Se montan globalmente en App.jsx.

import { useEffect, useState } from 'react';
import { Download, RefreshCw, WifiOff, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const INSTALL_DISMISSED_KEY = 'chiropract.install_dismissed';

// =============================================================================
// OfflineIndicator — banner sticky cuando se pierde conexión
// =============================================================================
export function OfflineIndicator() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[10001] bg-amber-500 text-white text-sm font-medium py-1.5 px-4 flex items-center justify-center gap-2 shadow-md">
      <WifiOff size={14} />
      <span>Sin conexión — viendo datos guardados</span>
    </div>
  );
}

// =============================================================================
// UpdatePrompt — toast al detectar nueva versión del SW
// =============================================================================
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // Re-check actualización cada hora
      if (registration) {
        setInterval(() => registration.update(), 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('SW registration failed', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[10000] bg-surface-container-lowest border border-outline-variant shadow-2xl rounded-xl p-4 max-w-sm flex items-start gap-3 animate-in slide-in-from-bottom">
      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
        <RefreshCw size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-on-surface">Nueva versión disponible</p>
        <p className="text-xs text-on-surface-variant mt-0.5">Recarga para aplicar las últimas mejoras.</p>
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => updateServiceWorker(true)}
            className="text-xs bg-primary text-on-primary px-3 py-1.5 rounded-lg font-bold hover:opacity-90"
          >
            Recargar
          </button>
          <button
            onClick={() => setNeedRefresh(false)}
            className="text-xs text-on-surface-variant hover:text-on-surface px-3 py-1.5"
          >
            Después
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// InstallPrompt — captura beforeinstallprompt y muestra CTA
// =============================================================================
export function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(INSTALL_DISMISSED_KEY);
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) {
      // No mostrar por 7 días tras dismiss
      return;
    }

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferred(e);
      // Pequeño delay para no chocar con onboarding
      setTimeout(() => setShown(true), 8000);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // Detectar si ya está instalada (standalone display mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return; // ya instalada
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  if (!shown || !deferred) return null;

  const handleInstall = async () => {
    deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    setShown(false);
    if (choice.outcome === 'dismissed') {
      localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
    }
  };

  const handleDismiss = () => {
    setShown(false);
    localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-[9990] bg-surface-container-lowest border border-outline-variant shadow-2xl rounded-xl p-4 flex items-start gap-3 animate-in slide-in-from-bottom">
      <div className="w-9 h-9 rounded-lg clinical-gradient text-on-primary flex items-center justify-center flex-shrink-0">
        <Download size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-on-surface">Instala chiropract.co</p>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Acceso rápido como app, funciona en jornadas sin internet.
        </p>
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleInstall}
            className="text-xs clinical-gradient text-on-primary px-3 py-1.5 rounded-lg font-bold"
          >
            Instalar
          </button>
          <button
            onClick={handleDismiss}
            className="text-xs text-on-surface-variant hover:text-on-surface px-3 py-1.5"
          >
            No, gracias
          </button>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        className="text-on-surface-variant/60 hover:text-on-surface flex-shrink-0"
        title="Cerrar"
      >
        <X size={16} />
      </button>
    </div>
  );
}
