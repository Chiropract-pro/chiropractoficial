import { useCallback, useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import SidebarNav from './SidebarNav';
import MobileNav from './MobileNav';
import Topbar from './Topbar';
import CommandPalette from './CommandPalette';

const COLLAPSE_KEY = 'chiro_nav_collapsed';

/**
 * AppShell — el marco del CRM.
 *
 * Tres disposiciones reales, no una sola encogida:
 *  · ≥1024px  sidebar fijo (expandido o riel, la elección se recuerda) +
 *             contenido fluido hasta 1560px.
 *  · 768–1023 sin sidebar fijo: cajón lateral + barra inferior. Es el tamaño
 *             de la tablet en el consultorio, donde el pulgar manda.
 *  · <768px   barra inferior de 5 destinos, hojas inferiores para los
 *             formularios y contenido a ancho completo.
 */
export default function AppShell({ activeModule, onNavigate, onOpenPatient, alertCount = 0, banner, children }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const toggleCollapse = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* modo privado */ }
      return next;
    });
  }, []);

  // ⌘K / Ctrl+K abre la paleta desde cualquier pantalla.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Al navegar se cierra el cajón; y el contenido vuelve arriba (en móvil, sin
  // esto se aterrizaba a media pantalla del módulo anterior).
  const navigate = useCallback((id) => {
    onNavigate(id);
    setDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [onNavigate]);

  return (
    <div className="min-h-dvh bg-background">
      {/* Sidebar fijo — solo escritorio */}
      <aside
        className={cn(
          'hidden lg:block fixed inset-y-0 left-0 z-40 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          collapsed ? 'w-[76px]' : 'w-[264px]',
        )}
      >
        <SidebarNav
          activeModule={activeModule}
          onNavigate={navigate}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          alertCount={alertCount}
        />
      </aside>

      {/* Cajón — móvil y tablet. Sin AnimatePresence: ver ui/Modal.jsx. */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Velo y cajón nacen en su estado final: si el navegador no ejecuta
              la animación, el menú aparece de golpe pero aparece. Antes podía
              quedarse fuera de pantalla y el botón "Más" parecía no hacer nada. */}
          <div
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-[#0b120f]/50 backdrop-blur-[2px]"
          />
          <div className="absolute inset-y-0 left-0 w-[min(84vw,300px)] shadow-clinical-lg">
            <SidebarNav activeModule={activeModule} onNavigate={navigate} alertCount={alertCount} />
          </div>
        </div>
      )}

      {/* Columna de contenido */}
      <div
        className={cn(
          'transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          collapsed ? 'lg:pl-[76px]' : 'lg:pl-[264px]',
        )}
      >
        <Topbar
          activeModule={activeModule}
          onOpenDrawer={() => setDrawerOpen(true)}
          onOpenSearch={() => setPaletteOpen(true)}
          alertCount={alertCount}
          onAlertsClick={() => navigate('dashboard')}
        />

        {banner}

        <main className="px-4 sm:px-6 lg:px-8 xl:px-10 pt-5 sm:pt-6 pb-24 lg:pb-12">
          <div className="mx-auto w-full max-w-[1560px]">{children}</div>
        </main>
      </div>

      <MobileNav activeModule={activeModule} onNavigate={navigate} onOpenDrawer={() => setDrawerOpen(true)} />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={navigate}
        onOpenPatient={(p) => { onNavigate('pacientes'); onOpenPatient?.(p); }}
      />
    </div>
  );
}
