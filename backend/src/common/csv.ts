const escape = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const s =
    value instanceof Date ? value.toISOString() : typeof value === 'object' ? JSON.stringify(value) : String(value as string | number | boolean);
  // Neutralise spreadsheet formula injection.
  // Purely numeric values such as "+919848012345" or "-500" cannot form a formula.
  const dangerous = /^[=@\t\r]/.test(s) || (/^[+-]/.test(s) && !/^[+-][\d\s.]*$/.test(s));
  const safe = dangerous ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(escape).join(',')).join('\r\n') + '\r\n';
}
