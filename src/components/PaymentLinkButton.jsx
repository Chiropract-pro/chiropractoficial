import { useState } from 'react';
import { CreditCard, Copy, Check, MessageCircle, Loader2, X } from 'lucide-react';
import { usePayments } from '../hooks/useTenantData';
import { formatCOP } from '../utils/format';
import { whatsappUrl } from '../lib/clinic';
import { userFriendlyError } from '../lib/logger';

/**
 * Botón reutilizable para generar un link de pago Wompi.
 * Props:
 *   amount, description (string), patientId, appointmentId, jornadaId,
 *   customerName, customerPhone, customerEmail
 *   className: tailwind extra
 */
export default function PaymentLinkButton({
  amount,
  description,
  patientId,
  appointmentId,
  jornadaId,
  customerName,
  customerPhone,
  customerEmail,
  className = '',
  label = 'Generar link de pago',
}) {
  const { createPaymentLink } = usePayments();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!amount || amount <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await createPaymentLink({
      amount,
      description,
      patientId,
      appointmentId,
      jornadaId,
      customerEmail,
      customerPhone,
    });
    setLoading(false);
    if (result.error) {
      setError(userFriendlyError(result.error));
      return;
    }
    setLink(result.data);
  };

  const handleCopy = () => {
    if (!link?.checkout_url) return;
    navigator.clipboard.writeText(link.checkout_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    if (!link?.checkout_url) return;
    const firstName = (customerName || '').split(' ')[0] || '';
    const message = `Hola ${firstName}, aquí le compartimos el link para pagar ${description || 'su servicio'}: ${link.checkout_url}\n\nTotal: ${formatCOP(amount)}\n\nUna vez confirmado el pago le enviaremos su recibo. — Equipo chiropract.co`;
    const phone = customerPhone || '';
    if (phone) {
      window.open(whatsappUrl(message).replace(/wa\.me\/\d+/, `wa.me/${phone.replace(/\D/g, '')}`), '_blank', 'noopener,noreferrer');
    } else {
      navigator.clipboard.writeText(message);
      alert('Mensaje copiado al portapapeles. Pégalo en el WhatsApp del paciente.');
    }
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setLink(null);
      setError(null);
    }, 200);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-light text-on-primary rounded-lg text-sm font-medium transition-colors ${className}`}
        type="button"
      >
        <CreditCard size={16} /> {label}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-outline-variant">
              <h3 className="font-semibold text-on-surface flex items-center gap-2">
                <CreditCard size={18} /> Link de pago Wompi
              </h3>
              <button onClick={handleClose} className="text-on-surface-variant hover:text-on-surface">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-surface-container-low rounded-lg p-3">
                <p className="text-xs text-on-surface-variant uppercase tracking-wide">Monto</p>
                <p className="text-2xl font-bold text-primary">{formatCOP(amount)}</p>
                {description && (
                  <p className="text-sm text-on-surface-variant mt-1">{description}</p>
                )}
                {customerName && (
                  <p className="text-xs text-on-surface-variant mt-2">Para: {customerName}</p>
                )}
              </div>

              {!link && !loading && (
                <button
                  onClick={handleGenerate}
                  className="w-full bg-primary hover:bg-primary-light text-on-primary py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
                >
                  <CreditCard size={18} /> Generar link
                </button>
              )}

              {loading && (
                <div className="flex items-center justify-center py-6 text-on-surface-variant">
                  <Loader2 size={20} className="animate-spin mr-2" /> Generando link...
                </div>
              )}

              {error && (
                <div className="bg-error-container/20 text-error border border-error/20 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {link && (
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-green-900 uppercase tracking-wide">Link generado</p>
                    <p className="text-xs text-green-800 break-all mt-1">{link.checkout_url}</p>
                    <p className="text-xs text-green-700 mt-2">Ref: {link.reference}</p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleCopy}
                      className="flex-1 flex items-center justify-center gap-2 py-2 border border-outline-variant rounded-lg text-sm hover:bg-surface-container-low"
                    >
                      {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                      {copied ? 'Copiado' : 'Copiar'}
                    </button>
                    <button
                      onClick={handleSendWhatsApp}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-lg text-sm font-medium"
                    >
                      <MessageCircle size={16} /> WhatsApp
                    </button>
                  </div>

                  <p className="text-xs text-on-surface-variant text-center">
                    El link expira en 24 horas. Cuando el paciente pague, se creará la venta automáticamente.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
