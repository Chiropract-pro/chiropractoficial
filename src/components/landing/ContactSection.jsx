import { motion } from 'framer-motion';
import { MapPin, Phone, Clock, Send } from 'lucide-react';
import { wa, clinic } from '../../lib/clinic';

export default function ContactSection() {
  return (
    <>
      <section id="contacto" className="py-24 bg-surface-container-low">
        <div className="container mx-auto px-8 max-w-7xl">
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm flex flex-col md:flex-row">
            {/* Map area */}
            <div className="flex-1 h-[400px] md:h-auto bg-surface-container-highest relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-surface-container flex items-center justify-center">
                <div className="bg-surface-container-lowest p-4 rounded-xl shadow-xl flex items-center gap-3">
                  <MapPin size={20} className="text-error fill-error" />
                  <span className="font-bold text-on-surface">{clinic.city}</span>
                </div>
              </div>
            </div>

            {/* Contact info */}
            <div className="flex-1 p-12 space-y-8">
              <h2 className="text-3xl font-bold text-on-surface">Contacto & Ubicación</h2>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <MapPin size={20} className="text-primary mt-1 shrink-0" />
                  <div>
                    <p className="font-bold text-on-surface">Dirección</p>
                    <p className="text-on-surface-variant text-sm">{clinic.address}<br />{clinic.addressLine2}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Phone size={20} className="text-primary mt-1 shrink-0" />
                  <div>
                    <p className="font-bold text-on-surface">Teléfono / WhatsApp</p>
                    <a href={wa.info()} target="_blank" rel="noopener noreferrer" className="text-on-surface-variant text-sm hover:text-primary transition-colors">{clinic.phoneDisplay}</a>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Clock size={20} className="text-primary mt-1 shrink-0" />
                  <div>
                    <p className="font-bold text-on-surface">Horarios de Atención</p>
                    <p className="text-on-surface-variant text-sm">{clinic.hours.weekdays}<br />{clinic.hours.saturday}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-4">
                <a
                  href={wa.schedule()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#25D366] text-white px-8 py-4 rounded-xl font-bold flex items-center gap-2 flex-1 justify-center active:scale-95 transition-transform"
                >
                  <Phone size={18} /> WhatsApp
                </a>
                <a
                  href="#hero"
                  className="clinical-gradient text-on-primary px-8 py-4 rounded-xl font-bold flex-1 text-center active:scale-95 transition-transform"
                >
                  Agendar
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-8">
        <div className="max-w-7xl mx-auto bg-primary rounded-[2.5rem] p-12 md:p-24 text-center text-on-primary relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary-container rounded-full blur-[120px] opacity-30 -mr-48 -mt-48" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-tertiary rounded-full blur-[120px] opacity-20 -ml-48 -mb-48" />
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="relative z-10"
          >
            <h2 className="text-4xl md:text-6xl font-extrabold mb-8">Comience su camino al bienestar</h2>
            <p className="text-xl opacity-90 mb-12 max-w-2xl mx-auto">Agenda hoy tu primera evaluación diagnóstica y descubre el potencial real de tu salud física.</p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <a
                href={wa.schedule()}
                target="_blank"
                rel="noopener noreferrer"
                className="px-10 py-5 bg-tertiary-fixed text-on-tertiary-fixed rounded-full font-extrabold text-lg shadow-2xl hover:scale-105 transition-transform"
              >
                Agendar Ajuste Ahora
              </a>
              <a
                href={wa.specialist()}
                target="_blank"
                rel="noopener noreferrer"
                className="px-10 py-5 border-2 border-on-primary text-on-primary rounded-full font-extrabold text-lg hover:bg-on-primary/10 transition-colors"
              >
                Hablar con un Especialista
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-outline-variant/20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 px-8 py-16 max-w-7xl mx-auto">
          <div className="space-y-6">
            <img src="/logos/v1-spine-mark.svg" alt="chiropract.co" className="h-10 w-auto" />
            <p className="text-sm text-on-surface-variant">Precisión clínica para la restauración del movimiento humano. Especialistas en salud espinal.</p>
          </div>
          <div>
            <h4 className="font-bold mb-6 text-on-surface">Recursos</h4>
            <ul className="space-y-4">
              <li><a className="text-sm text-on-surface-variant hover:text-primary transition-colors" href="#crm">Portal del Paciente</a></li>
              <li><a className="text-sm text-on-surface-variant hover:text-primary transition-colors" href="#privacy">Política de Privacidad</a></li>
              <li><a className="text-sm text-on-surface-variant hover:text-primary transition-colors" href="#terms">Términos de Servicio</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-6 text-on-surface">Servicios</h4>
            <ul className="space-y-4">
              <li><a className="text-sm text-on-surface-variant hover:text-primary transition-colors" href="#servicios">Ajuste Quiropráctico</a></li>
              <li><a className="text-sm text-on-surface-variant hover:text-primary transition-colors" href="#servicios">Rehabilitación Deportiva</a></li>
              <li><a className="text-sm text-on-surface-variant hover:text-primary transition-colors" href="#jornadas">Jornadas Itinerantes</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-6 text-on-surface">Newsletter</h4>
            <p className="text-sm text-on-surface-variant mb-4">Recibe consejos de salud y fechas de jornadas.</p>
            <div className="flex gap-2">
              <input className="bg-surface-container-lowest border border-outline-variant rounded-xl text-sm px-4 py-2 w-full focus:ring-2 focus:ring-primary focus:outline-none" placeholder="Tu email" type="email" />
              <button className="clinical-gradient text-on-primary p-2 rounded-xl">
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-8 py-8 border-t border-outline-variant/20 text-center">
          <p className="text-sm text-on-surface-variant">© {new Date().getFullYear()} {clinic.name}. Todos los derechos reservados.</p>
        </div>
      </footer>
    </>
  );
}
