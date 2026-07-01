import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext({ toast: () => {} });

export const useToast = () => useContext(ToastContext);

let nextId = 1;

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const toast = useCallback((message, options = {}) => {
    const id = nextId++;
    const item = {
      id,
      message,
      type: options.type || 'info', // 'success' | 'error' | 'info'
      duration: options.duration ?? 4000,
    };
    setItems((prev) => [...prev, item]);
    if (item.duration > 0) {
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), item.duration);
    }
  }, []);

  const dismiss = (id) => setItems((prev) => prev.filter((x) => x.id !== id));

  const helpers = {
    success: (msg, opts) => toast(msg, { ...opts, type: 'success' }),
    error: (msg, opts) => toast(msg, { ...opts, type: 'error' }),
    info: (msg, opts) => toast(msg, { ...opts, type: 'info' }),
    toast,
  };

  return (
    <ToastContext.Provider value={helpers}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none">
        {items.map((it) => (
          <ToastItem key={it.id} item={it} onClose={() => dismiss(it.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ item, onClose }) {
  const styles = {
    success: 'bg-green-50 border-green-200 text-green-900',
    error: 'bg-red-50 border-red-200 text-red-900',
    info: 'bg-surface-container-lowest border-outline-variant text-on-surface',
  };
  const Icon = item.type === 'success' ? CheckCircle : item.type === 'error' ? AlertCircle : Info;
  const iconColor = item.type === 'success' ? 'text-green-600' : item.type === 'error' ? 'text-red-600' : 'text-primary';

  return (
    <div className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg ${styles[item.type]} animate-in slide-in-from-right`}>
      <Icon size={18} className={`flex-shrink-0 mt-0.5 ${iconColor}`} />
      <p className="text-sm flex-1">{item.message}</p>
      <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface flex-shrink-0">
        <X size={16} />
      </button>
    </div>
  );
}
