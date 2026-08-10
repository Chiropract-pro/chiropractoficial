import { useEffect, useState } from 'react';
import { CreditCard, Copy, Check, MessageCircle, Loader2, X, AlertTriangle } from 'lucide-react';
import { usePayments, DEFAULT_PAYMENT_PROVIDER } from '../hooks/useTenantData';
import { formatCOP } from '../utils/format';
import { whatsappLink } from '../utils/phone';
import { userFriendlyError } from '../lib/logger';

/**
 * Botón de cobro: genera el link de pago y lo manda al paciente.
 *
 * El monto y el concepto son EDITABLES. Antes venían fijos desde quien
 * invocaba el botón, así que solo se podía cobrar el saldo exacto de un
 * deudor: no había forma de cobrarle a un paciente que llega sin deuda, ni de
 * recibir un abono parcial. Ahora se puede cobrar cualquier monto a cualquiera.
 */
export default function PaymentLinkButton({ className = '', label = 'Generar link de pago', ...props }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-light text-on-primary rounded-lg text-sm font-medium transition-colors ${className}`}
        type="button"
      >
        <CreditCard size={16} /> {label}
      </button>
      {/* El diálogo se monta de cero en cada apertura: así el monto, el
          concepto y el link anterior se reinician solos, sin efectos. */}
      {open && <PaymentDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * Nota sobre el diálogo: usa su propia capa en vez del componente Modal porque
 * este botón vive DENTRO de otros modales (la ficha del paciente, por ejemplo),
 * y anidar el Modal genera conflictos de foco y de bloqueo de scroll.
 */
function PaymentDialog({
  amount,
  description,
  patientId,
  appointmentId,
  jornadaId,
  customerName,
  customerPhone,
  customerEmail,
  provider = DEFAULT_PAYMENT_PROVIDER,
  onClose,
}) {
  const providerName = provider === 'wompi' ? 'Wompi' : 'Bold';
  const { createPaymentLink } = usePayments();
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState('');
  const [amountStr, setAmountStr] = useState(amount ? String(Math.round(Number(amount))) : '');
  const [concept, setConcept] = useState(description || '');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const numericAmount = Number(amountStr);
  const amountValid = Number.isFinite(numericAmount) && numericAmount > 0;
  const wa = link?.checkout_url
    ? whatsappLink(customerPhone, buildMessage(customerName, concept, link.checkout_url, numericAmount))
    : null;

  const handleGenerate = async () => {
    if (!amountValid) {
      setError('Escribe un monto mayor a cero.');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await createPaymentLink({
      amount: Math.round(numericAmount),
      description: concept || 'Servicio',
      patientId,
      appointmentId,
      jornadaId,
      customerEmail,
      customerPhone,
      provider,
    });
    setLoading(false);
    if (result.error) {
      setError(userFriendlyError(result.error));
      return;
    }
    setLink(result.data);
  };

  const handleCopy = async (text, msg) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setNote(msg || '');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('El navegador no permitió copiar. Selecciona el link y cópialo a mano.');
    }
  };

  const handleSendWhatsApp = () => {
    if (!link?.checkout_url) return;
    if (wa) {
      window.open(wa, '_blank', 'noopener,noreferrer');
      return;
    }
    // Sin teléfono registrado no hay a quién abrirle el chat: se deja el
    // mensaje listo para pegar y se dice con todas las letras.
    handleCopy(
      buildMessage(customerName, concept, link.checkout_url, numericAmount),
      'Este paciente no tiene celular registrado. Copiamos el mensaje completo: pégalo en su chat.',
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Generar link de pago"
      >
        <div className="flex items-center justify-between p-5 border-b border-outline-variant sticky top-0 bg-surface-container-lowest">
          <h3 className="font-semibold text-on-surface flex items-center gap-2">
            <CreditCard size={18} /> Cobrar con {providerName}
          </h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {customerName && (
            <p className="text-[13px] text-on-surface-variant">
              Cobrando a <span className="font-semibold text-on-surface">{customerName}</span>
              {customerPhone ? ` · ${customerPhone}` : ''}
            </p>
          )}

          {!link && (
            <>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Monto a cobrar</span>
                <input
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value.replace(/[^\d]/g, ''))}
                  inputMode="numeric"
                  autoFocus
                  placeholder="175000"
                  className="mt-1 w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-xl font-display font-semibold text-on-surface tnum focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <span className="block text-[11px] text-on-surface-variant mt-1">
                  {amountValid ? formatCOP(numericAmount) : 'Escribe el valor sin puntos ni comas'}
                </span>
              </label>

              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Concepto</span>
                <input
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="Consulta quiropráctica"
                  className="mt-1 w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <span className="block text-[11px] text-on-surface-variant mt-1">Es lo que el paciente verá al pagar.</span>
              </label>

              {!customerPhone && (
                <p className="flex items-start gap-2 text-[11.5px] text-[#a85b32] bg-[#f6e7db]/70 border border-warning/30 rounded-lg px-3 py-2">
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  Este paciente no tiene celular registrado. Podrás generar el link y copiarlo, pero no enviarlo por WhatsApp desde aquí.
                </p>
              )}

              <button
                onClick={handleGenerate}
                disabled={!amountValid || loading}
                className="w-full bg-primary hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed text-on-primary py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                {loading
                  ? <><Loader2 size={18} className="animate-spin" /> Generando link…</>
                  : <><CreditCard size={18} /> Generar link {amountValid ? `· ${formatCOP(numericAmount)}` : ''}</>}
              </button>
            </>
          )}

          {error && (
            <div className="bg-error-container/20 text-error border border-error/20 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {link && (
            <div className="space-y-3">
              <div className="bg-[#e0efe8]/70 border border-success/25 rounded-lg p-3">
                <p className="text-xs font-semibold text-[#1f6b52] uppercase tracking-wide">
                  Link listo · {formatCOP(numericAmount)}
                </p>
                <p className="text-xs text-[#1f6b52] break-all mt-1">{link.checkout_url}</p>
                <p className="text-xs text-[#1f6b52] mt-2">Ref: {link.reference}</p>
              </div>

              {note && (
                <p className="text-[11.5px] text-[#a85b32] bg-[#f6e7db]/70 border border-warning/30 rounded-lg px-3 py-2">
                  {note}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleCopy(link.checkout_url, 'Link copiado.')}
                  className="flex-1 flex items-center justify-center gap-2 py-2 border border-outline-variant rounded-lg text-sm hover:bg-surface-container-low"
                >
                  {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
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
                El link expira en 24 horas. Cuando el paciente pague, se registra la venta sola.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildMessage(customerName, concept, url, amount) {
  const firstName = (customerName || '').split(' ')[0] || '';
  const saludo = firstName ? `Hola ${firstName}, ` : 'Hola, ';
  return `${saludo}le compartimos el link para pagar ${concept || 'su servicio'}: ${url}\n\nTotal: ${formatCOP(amount)}\n\nApenas se confirme el pago le enviamos el recibo. — Equipo chiropract.co`;
}
