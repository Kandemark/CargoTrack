/**
 * The API returns lists either bare or as a page ({ results: [...] }).
 * Screens read both through this, so a paged list never shows as empty.
 */
export function listOf<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  const results = (data as { results?: unknown } | null)?.results
  return Array.isArray(results) ? (results as T[]) : []
}

/** "KES 212,000" — amounts are whole shillings unless cents matter. */
export function money(amount: string | number | null | undefined, currency = 'KES'): string {
  const n = Number(amount ?? 0)
  const digits = Math.abs(n) < 100 && n % 1 !== 0 ? 2 : 0
  return `${currency} ${n.toLocaleString('en-KE', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

/** "12 Mar 2026" without the time. */
export function day(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}
