import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logger } from '../lib/logger';

/**
 * ErrorBoundary — la red que faltaba.
 *
 * Sin esto, cualquier excepción durante el render deja al usuario mirando una
 * pantalla en blanco, sin saber si el sistema se cayó o si su internet falló.
 * En un CRM médico eso es inaceptable: si algo se rompe, hay que decirlo y dar
 * una salida.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    logger.error('render crash', { message: error?.message, stack: info?.componentStack });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-dvh bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-error-container flex items-center justify-center mx-auto mb-5">
            <AlertTriangle size={26} className="text-error" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-on-surface">Algo se rompió</h1>
          <p className="text-sm text-on-surface-variant mt-2.5 leading-relaxed">
            La pantalla no pudo cargar. Tus datos están a salvo: nada se guardó a medias.
            Recarga para volver a intentarlo.
          </p>

          <div className="flex gap-2.5 mt-6">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-primary text-on-primary px-5 py-3 rounded-xl text-sm font-semibold hover:bg-primary-light transition-colors"
            >
              <RefreshCw size={16} /> Recargar
            </button>
            <button
              onClick={() => { window.location.hash = ''; window.location.reload(); }}
              className="flex-1 border border-outline-variant text-on-surface-variant px-5 py-3 rounded-xl text-sm font-semibold hover:bg-surface-container-low transition-colors"
            >
              Ir al inicio
            </button>
          </div>

          {import.meta.env.DEV && (
            <pre className="mt-6 text-left text-[11px] text-on-surface-variant bg-surface-container-low border border-outline-variant rounded-xl p-3.5 overflow-auto max-h-48 whitespace-pre-wrap">
              {String(this.state.error?.stack || this.state.error)}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
