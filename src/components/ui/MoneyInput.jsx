import { Input } from './Field';

const soloDigitos = (v) => String(v ?? '').replace(/[^\d]/g, '');
const conSeparadores = (v) => {
  const d = soloDigitos(v);
  return d ? Number(d).toLocaleString('es-CO') : '';
};

/**
 * Campo de dinero en pesos.
 *
 * Los formularios pedían el precio como número pelado —«165000»— y ponían el
 * valor de verdad en una línea gris debajo. Nadie lee cifras sin puntos: se
 * confunde 165000 con 1650000 y se cobra diez veces de más. Aquí el peso se ve
 * dentro del campo y los miles se separan mientras se escribe.
 *
 * Hacia afuera el valor sigue siendo una cadena de dígitos: quien lo usa no
 * tiene que deshacer ningún formato.
 */
export default function MoneyInput({ value, onChange, className = '', ...props }) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[15px] pointer-events-none"
      >
        $
      </span>
      <Input
        value={conSeparadores(value)}
        onChange={(e) => onChange(soloDigitos(e.target.value))}
        inputMode="numeric"
        className={`pl-7 tnum text-[15px] font-medium ${className}`}
        {...props}
      />
    </div>
  );
}
