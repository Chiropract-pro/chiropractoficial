import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * cn — el primitivo universal de clases (twMerge(clsx(...))).
 * Combina condicionales y resuelve conflictos de Tailwind sin sorpresas.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
