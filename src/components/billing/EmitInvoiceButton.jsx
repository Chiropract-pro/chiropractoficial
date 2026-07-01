import { useState } from 'react';
import { CheckCircle, ExternalLink, FileText, Loader2, AlertCircle } from 'lucide-react';
import { useBillingConfig } from '../../hooks/useBillingConfig';
import { useToast } from '../Toast';

/**
 * Botón para emitir factura electrónica DIAN para un sale.
 *
 * Props:
 *   - sale: { id, e_invoice_id, e_invoice_status, e_invoice_cufe, e_invoice_pdf_url, ... }
 *   - onEmitted: callback tras emitir exitosamente
 *   - compact: bool — versión pequeña sin texto
 */
export default function EmitInvoiceButton({ sale, onEmitted, compact = false }) {
  const { config, emitInvoice } = useBillingConfig();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  if (!sale) return null;

  // Estado: ya emitida y aceptada por DIAN
  if (sale.e_invoice_status === 'accepted' || sale.e_invoice_status === 'sent') {
    if (compact) {
      return (
        <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
          <CheckCircle size={11} />
          {sale.e_invoice_number || 'FE'}
        </span>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full font-semibold flex items-center gap-1">
          <CheckCircle size={12} />
          Facturada {sale.e_invoice_number}
        </span>
        {sale.e_invoice_pdf_url && (
          <a
            href={sale.e_invoice_pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-0.5"
          >
            PDF <ExternalLink size={10} />
          </a>
        )}
      </div>
    );
  }

  // Estado: error
  if (sale.e_invoice_status === 'error' || sale.e_invoice_status === 'rejected') {
    return (
      <button
        onClick={() => handleEmit()}
        disabled={loading}
        className="text-xs bg-red-50 text-red-700 hover:bg-red-100 px-2 py-1 rounded-full font-semibold flex items-center gap-1"
        title={sale.e_invoice_error || 'Falló — reintenta'}
      >
        {loading ? <Loader2 size={11} className="animate-spin" /> : <AlertCircle size={11} />}
        Reintentar
      </button>
    );
  }

  // Cuenta no configurada
  if (!config?.is_active) {
    if (compact) return null;
    return (
      <span className="text-[11px] text-on-surface-variant italic">
        Configura DIAN en Settings
      </span>
    );
  }

  async function handleEmit() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await emitInvoice(sale.id);
      toast.success(`Factura ${res.invoice_number || ''} emitida ✓`);
      onEmitted?.(res);
    } catch (e) {
      const msg = e.message || 'No se pudo emitir';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleEmit}
      disabled={loading}
      className={`text-xs bg-primary/10 text-primary hover:bg-primary/20 ${compact ? 'px-2 py-0.5' : 'px-2 py-1'} rounded-full font-semibold flex items-center gap-1 disabled:opacity-50`}
      title="Emitir factura electrónica DIAN"
    >
      {loading ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />}
      {compact ? 'FE' : 'Emitir factura'}
    </button>
  );
}
