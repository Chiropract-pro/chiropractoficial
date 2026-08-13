import { Input } from './Field';

/**
 * Campo de lugar: sugiere los conocidos, pero acepta cualquiera.
 *
 * Antes era una lista cerrada de cinco municipios. Si el doctor atendía en un
 * sitio nuevo —una finca, un salón comunal, otra ciudad— no había forma de
 * escribirlo: tocaba meterlo en las notas y el lugar quedaba fuera de los
 * reportes. Ahora se escribe libre y las sugerencias salen de lo ya usado, así
 * que un lugar nuevo se convierte solo en sugerencia para la próxima vez.
 */
export default function PlaceInput({ name, options = [], ...props }) {
  const listId = `lugares-${name}`;
  // Sin duplicados y sin vacíos: las sugerencias vienen mezcladas de la lista
  // base y de lo que ya está guardado en la base de datos.
  const sugerencias = [...new Set(options.filter(Boolean))];

  return (
    <>
      <Input name={name} list={listId} autoComplete="off" {...props} />
      <datalist id={listId}>
        {sugerencias.map((o) => <option key={o} value={o} />)}
      </datalist>
    </>
  );
}
