const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Lunes de la semana a planear. Sábado y domingo apuntan al lunes siguiente. */
export function mondayFor(today: Date, weekOffset: number): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dow = d.getDay(); // 0 = domingo
  const delta = dow === 0 ? 1 : dow === 6 ? 2 : 1 - dow;
  d.setDate(d.getDate() + delta + weekOffset * 7);
  return toIsoDate(d);
}

export function addDays(iso: string, n: number): string {
  const d = fromIsoDate(iso);
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

export function weekDates(mondayIso: string): string[] {
  return [0, 1, 2, 3, 4].map((i) => addDays(mondayIso, i));
}

export function shortDate(iso: string): string {
  const d = fromIsoDate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function longDate(iso: string): string {
  const d = fromIsoDate(iso);
  return `${d.getDate()} de ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
