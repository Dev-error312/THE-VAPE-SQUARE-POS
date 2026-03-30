// ─── Currency formatting ───────────────────────────────────────────────────
//
// Uses en-IN locale → produces Nepali/Indian lakh system:
//   175000  →  रु 1,75,000
//   24500   →  रु 24,500
//   1000    →  रु 1,000
//
const CURRENCY_FORMATTER = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})

const CURRENCY_FORMATTER_DECIMAL = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Primary currency display. Rounds to nearest rupee.
 * 175000  →  "रु 1,75,000"
 */
export function formatCurrency(amount: number): string {
  if (!isFinite(amount)) return 'रु 0'
  return 'रु ' + CURRENCY_FORMATTER.format(Math.round(amount))
}

/**
 * Currency with 2 decimal places — use only where paisa precision is needed.
 * 175000.50  →  "रु 1,75,000.50"
 */
export function formatCurrencyDecimal(amount: number): string {
  if (!isFinite(amount)) return 'रु 0.00'
  return 'रु ' + CURRENCY_FORMATTER_DECIMAL.format(amount)
}

/**
 * Raw number formatted with lakh commas (no currency prefix).
 * 175000  →  "1,75,000"
 */
export function formatNumber(value: number): string {
  return CURRENCY_FORMATTER.format(Math.round(value))
}

// ─── Date formatting ───────────────────────────────────────────────────────
//
// All dates use 'en-CA' locale internally (YYYY-MM-DD) so Supabase
// filters stay correct at UTC+5:45 (Nepal timezone).

/**
 * Short date: "12 Jun 2025"
 */
export function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return '—'
  try {
    return new Date(isoString).toLocaleDateString('en-US', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch {
    return '—'
  }
}

/**
 * Date + time: "12 Jun 2025, 02:30 PM"
 */
export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '—'
  try {
    return new Date(isoString).toLocaleString('en-US', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    })
  } catch {
    return '—'
  }
}

/**
 * Local YYYY-MM-DD string for today (Nepal-timezone-safe).
 * Use this when building Supabase date-range filter values.
 */
export function todayLocalISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * First day of current month as YYYY-MM-DD.
 */
export function monthStartLocalISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

// ─── Misc ──────────────────────────────────────────────────────────────────

/**
 * Generate a unique batch number.
 * Format: BAT-YYYYMMDD-XXXX (e.g. BAT-20260330-4821)
 */
export function generateBatchNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `BAT-${date}-${rand}`
}

/** Round a number to 2 decimal places (banker-safe). */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Truncate a string with an ellipsis. */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1) + '…'
}
