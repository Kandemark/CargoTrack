/**
 * shared/utils/formatters.ts
 * Pure formatting helpers — no platform globals, usable in RN and web.
 */

// ─── Dates ────────────────────────────────────────────────────────────────────

/**
 * "12 Apr 2026"
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * "12 Apr 2026, 14:35"
 */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * "3 hours ago" / "2 days ago" / "just now"
 */
export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60)  return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

/**
 * Number of days until (positive) or past (negative) a date.
 */
export function daysUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

// ─── Weight ───────────────────────────────────────────────────────────────────

/**
 * "1 234.5 kg" / "2.5 t"
 */
export function formatWeight(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`
  return `${kg.toLocaleString('en-GB')} kg`
}

// ─── Numbers ─────────────────────────────────────────────────────────────────

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

export function formatRiskScore(score: number): string {
  return `${Math.round(score * 100)}%`
}

// ─── Tracking numbers ─────────────────────────────────────────────────────────

/** "CT-20240408-A7B2" → "A7B2" (short form for tight UI) */
export function shortTrackingNumber(tn: string): string {
  return tn.split('-').at(-1) ?? tn
}
