import { Loader2 } from 'lucide-react';

export default function LoadingState({ message = 'Cargando...', size = 'md' }) {
  const sizeMap = { sm: 16, md: 24, lg: 32 };
  return (
    <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant">
      <Loader2 size={sizeMap[size]} className="animate-spin mb-3 text-primary" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-surface-container-low flex items-center justify-center mb-4">
          <Icon size={28} className="text-on-surface-variant/60" />
        </div>
      )}
      <p className="text-base font-semibold text-on-surface mb-1">{title}</p>
      {description && <p className="text-sm text-on-surface-variant max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
