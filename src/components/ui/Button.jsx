import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const VARIANTS = {
  primary: 'bg-primary text-on-primary hover:bg-primary-light shadow-pine',
  amber: 'amber-gradient text-on-accent shadow-amber',
  outline: 'border border-outline-variant text-on-surface bg-surface-container-lowest hover:bg-surface-container-low',
  ghost: 'text-on-surface-variant hover:text-primary hover:bg-surface-container-low',
  soft: 'bg-primary/10 text-primary hover:bg-primary/15',
  danger: 'bg-error text-on-error hover:opacity-90',
};

const SIZES = {
  sm: 'text-xs px-3 py-1.5 gap-1.5 rounded-lg',
  md: 'text-sm px-4 py-2.5 gap-2 rounded-xl',
  lg: 'text-base px-6 py-3.5 gap-2 rounded-xl',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  iconRight: IconRight,
  className,
  children,
  disabled,
  ...props
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 size={size === 'lg' ? 18 : 16} className="animate-spin" /> : Icon && <Icon size={size === 'lg' ? 18 : 16} />}
      {children}
      {IconRight && !loading && <IconRight size={size === 'lg' ? 18 : 16} />}
    </motion.button>
  );
}
