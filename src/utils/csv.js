// Helpers para exportar arrays de objetos a CSV y descargarlos.

function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function toCsv(rows, columns) {
  // columns: [{ key, label, format?(value, row) }]
  const headers = columns.map((c) => escapeCsv(c.label || c.key)).join(',');
  const lines = rows.map((r) =>
    columns.map((c) => {
      const v = c.format ? c.format(r[c.key], r) : r[c.key];
      return escapeCsv(v);
    }).join(',')
  );
  // BOM para que Excel reconozca UTF-8
  return '﻿' + [headers, ...lines].join('\n');
}

export function downloadCsv(filename, rows, columns) {
  const csv = toCsv(rows, columns);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
