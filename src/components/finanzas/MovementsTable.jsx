import { useMemo } from 'react';
import { Receipt } from 'lucide-react';
import { formatCOP, formatDate } from '../../utils/format';
import { Card, EmptyState, SectionHeader } from '../ui/Card';

const CATEGORY_LABEL = {
  // Ingresos
  consulta: 'Consulta',
  seguimiento: 'Seguimiento',
  jornada: 'Jornada',
  producto: 'Producto',
  // Gastos
  arriendo: 'Arriendo',
  servicios: 'Servicios públicos',
  insumos: 'Insumos y materiales',
  nomina: 'Nómina y honorarios',
  mercadeo: 'Mercadeo',
  transporte: 'Transporte y jornadas',
  otro: 'Otro',
  // Vocabulario del esquema original: hay filas históricas que lo usan y sin
  // esto se veían como código crudo en la tabla.
  consultorio: 'Consultorio',
  marketing: 'Mercadeo',
  operational: 'Operación',
  other: 'Otro',
};

/**
 * Movimientos del periodo, uno por uno.
 *
 * Finanzas solo mostraba totales agregados: para cuadrar un mes había que
 * exportar el CSV y abrirlo por fuera. Esta tabla es el detalle que sostiene
 * las cifras de arriba, y suma exactamente lo mismo.
 */
export default function MovementsTable({ transactions, patients, periodLabel }) {
  const rows = useMemo(() => {
    const byId = new Map(patients.map((p) => [p.id, p.full_name]));
    return [...transactions]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .map((t) => ({
        id: t.id,
        date: t.date,
        category: CATEGORY_LABEL[t.category] || t.category || '—',
        description: t.description || '',
        patient: t.patient_id ? (byId.get(t.patient_id) || 'Paciente retirado') : '',
        amount: Number(t.amount) || 0,
        isIncome: t.type === 'income',
      }));
  }, [transactions, patients]);

  const total = rows.reduce((s, r) => s + (r.isIncome ? r.amount : -r.amount), 0);

  return (
    <Card>
      <SectionHeader
        icon={Receipt}
        title="Movimientos del periodo"
        hint={rows.length > 0 ? `${rows.length} ${rows.length === 1 ? 'movimiento' : 'movimientos'} · ${periodLabel}` : undefined}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Sin movimientos en este periodo"
          hint="Cambia el rango de fechas o registra un ingreso."
        />
      ) : (
        <>
          <div className="max-h-[420px] overflow-y-auto -mx-1 px-1">
            <table className="w-full text-[12.5px] border-collapse">
              <thead className="sticky top-0 bg-surface z-10">
                <tr className="text-left text-[10px] uppercase tracking-wide text-on-surface-variant">
                  <th scope="col" className="font-semibold py-2 pr-3">Fecha</th>
                  <th scope="col" className="font-semibold py-2 pr-3">Concepto</th>
                  <th scope="col" className="font-semibold py-2 pr-3 hidden sm:table-cell">Paciente</th>
                  <th scope="col" className="font-semibold py-2 text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-outline-variant/50">
                    <td className="py-2.5 pr-3 text-on-surface-variant whitespace-nowrap tnum">{formatDate(r.date)}</td>
                    <td className="py-2.5 pr-3 min-w-0">
                      <span className="text-on-surface font-medium">{r.category}</span>
                      {r.description && (
                        <span className="block text-[11px] text-on-surface-variant truncate max-w-[26ch] sm:max-w-[42ch]">
                          {r.description}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-on-surface-variant hidden sm:table-cell truncate max-w-[20ch]">
                      {r.patient || '—'}
                    </td>
                    <td className={`py-2.5 text-right font-display font-semibold tnum whitespace-nowrap ${r.isIncome ? 'text-on-surface' : 'text-danger'}`}>
                      {r.isIncome ? '' : '−'}{formatCOP(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 pt-3 mt-1 border-t-2 border-outline-variant">
            <span className="text-[12.5px] font-semibold text-on-surface">Total del periodo</span>
            <span className="font-display text-base font-semibold text-on-surface tnum">{formatCOP(total)}</span>
          </div>
        </>
      )}
    </Card>
  );
}
