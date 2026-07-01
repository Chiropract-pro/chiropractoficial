import { useState, useEffect } from 'react';
import { Menu, X, LogIn, User as UserIcon } from 'lucide-react';
import { wa, clinic } from '../../lib/clinic';

const navLinks = [
  { label: 'Servicios', href: '#servicios' },
  { label: 'Jornadas', href: '#jornadas' },
  { label: 'Dr. Díaz', href: '#about' },
  { label: 'Contacto', href: '#contacto' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const goToCRM = () => {
    window.location.hash = 'crm';
  };

  const goToPatient = () => {
    window.location.hash = 'paciente';
  };

  useEffect(() => {
    const handleScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(h > 0 ? window.scrollY / h : 0);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <div className="fixed top-0 left-0 right-0 h-[2px] z-50">
        <div
          className="h-full bg-gradient-to-r from-primary to-primary-fixed-dim transition-[width] duration-100"
          style={{ width: `${scrollProgress * 100}%` }}
        />
      </div>

      <nav className="fixed top-0 w-full z-40 glass-nav shadow-sm">
        <div className="flex justify-between items-center px-8 py-4 max-w-7xl mx-auto">
          <a href="#hero" className="flex items-center" aria-label={clinic.name}>
            <img src="/logos/v1-spine-mark.svg" alt="chiropract.co" className="h-9 w-auto" />
          </a>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors tracking-tight"
              >
                {link.label}
              </a>
            ))}
            <a
              href={wa.schedule()}
              target="_blank"
              rel="noopener noreferrer"
              className="clinical-gradient text-on-primary px-6 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 active:scale-95 transition-all"
            >
              Agendar Cita
            </a>
            <button
              onClick={goToPatient}
              className="flex items-center gap-1.5 text-sm font-medium text-on-surface-variant hover:text-primary transition-colors"
              title="Acceso para pacientes"
            >
              <UserIcon size={16} /> Soy paciente
            </button>
            <button
              onClick={goToCRM}
              className="flex items-center gap-1.5 text-sm font-medium text-on-surface-variant hover:text-primary transition-colors"
            >
              <LogIn size={16} /> CRM
            </button>
          </div>

          <button className="md:hidden text-on-surface" onClick={() => setOpen(!open)}>
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {open && (
          <div className="md:hidden glass-nav border-t border-outline-variant/20 px-8 py-4 space-y-3">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="block text-on-surface-variant hover:text-primary py-2 text-sm font-medium"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <button
              onClick={() => { setOpen(false); goToPatient(); }}
              className="flex items-center gap-1.5 py-2 text-sm font-medium text-on-surface-variant hover:text-primary"
            >
              <UserIcon size={16} /> Soy paciente
            </button>
            <button
              onClick={() => { setOpen(false); goToCRM(); }}
              className="flex items-center gap-1.5 py-2 text-sm font-medium text-on-surface-variant hover:text-primary"
            >
              <LogIn size={16} /> CRM
            </button>
          </div>
        )}
      </nav>
    </>
  );
}
