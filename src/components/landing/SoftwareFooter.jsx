import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const goToCRM = () => { window.location.hash = 'crm'; };
const year = new Date().getFullYear();

export default function SoftwareFooter() {
  return (
    <>
      {/* CTA final */}
      <section id="contacto" className="py-24 px-6 sm:px-8">
        <div className="max-w-6xl mx-auto bg-primary rounded-[2.5rem] p-12 md:p-20 text-center text-on-primary relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary-container rounded-full blur-[120px] opacity-30 -mr-48 -mt-48" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-tertiary rounded-full blur-[120px] opacity-20 -ml-48 -mb-48" />
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: true }}
            className="relative z-10"
          >
            <h2 className="font-display text-4xl md:text-6xl font-semibold mb-6">Digitaliza tu consultorio hoy</h2>
            <p className="text-xl opacity-90 mb-10 max-w-2xl mx-auto">
              14 días gratis, sin tarjeta. Únete a los quiroprácticos que ya dejaron atrás el cuaderno.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={goToCRM}
                className="px-10 py-5 bg-tertiary-fixed text-on-tertiary-fixed rounded-full font-extrabold text-lg shadow-2xl hover:scale-105 transition-transform inline-flex items-center justify-center gap-2"
              >
                Empieza gratis <ArrowRight size={20} />
              </button>
              <a
                href="https://wa.me/573123824844?text=Hola,%20quiero%20info%20de%20chiropract.co"
                target="_blank" rel="noopener noreferrer"
                className="px-10 py-5 border-2 border-on-primary text-on-primary rounded-full font-extrabold text-lg hover:bg-on-primary/10 transition-colors"
              >
                Hablar con ventas
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-outline-variant/20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 px-8 py-16 max-w-7xl mx-auto">
          <div className="col-span-2 md:col-span-1 space-y-5">
            <img src="/logos/v1-spine-mark.svg" alt="chiropract.co" className="h-10 w-auto" />
            <p className="text-sm text-on-surface-variant max-w-xs">
              El sistema operativo del consultorio quiropráctico. Software + comunidad para especialistas en salud espinal de Latinoamérica.
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-5 text-on-surface">Producto</h4>
            <ul className="space-y-3">
              <li><a className="text-sm text-on-surface-variant hover:text-primary transition-colors" href="#producto">Funciones</a></li>
              <li><a className="text-sm text-on-surface-variant hover:text-primary transition-colors" href="#pricing">Precios</a></li>
              <li><a className="text-sm text-on-surface-variant hover:text-primary transition-colors" href="#crm">Ingresar / Registrarse</a></li>
              <li><a className="text-sm text-on-surface-variant hover:text-primary transition-colors" href="#paciente">Portal del paciente</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-5 text-on-surface">Comunidad</h4>
            <ul className="space-y-3">
              <li><a className="text-sm text-on-surface-variant hover:text-primary transition-colors" href="#directorio">Directorio de médicos</a></li>
              <li><a className="text-sm text-on-surface-variant hover:text-primary transition-colors" href="#medicos">Red profesional</a></li>
              <li><a className="text-sm text-on-surface-variant hover:text-primary transition-colors" href="#dr/miguel-diaz">Dr. Miguel Ángel Díaz</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-5 text-on-surface">Legal</h4>
            <ul className="space-y-3">
              <li><a className="text-sm text-on-surface-variant hover:text-primary transition-colors" href="#privacy">Política de privacidad</a></li>
              <li><a className="text-sm text-on-surface-variant hover:text-primary transition-colors" href="#terms">Términos de servicio</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-8 py-8 border-t border-outline-variant/20 text-center">
          <p className="text-sm text-on-surface-variant">© {year} chiropract.co · Hecho en Colombia 🇨🇴</p>
        </div>
      </footer>
    </>
  );
}
