// ─── Rounding Utility ──────────────────────────────────────────────────────
// Rounds to 2 decimal places to avoid floating-point precision errors
// Critical for financial calculations
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ─── Currency & Date Formatting ────────────────────────────────────────────
// These are now DYNAMIC and respect business settings (currency, date format)
// Re-exported from dynamicFormatters.ts
//
// Example:
//   formatCurrency(175000) → "₨ 1,75,000" (NPR) or "$ 175,000" (USD)
//   formatDate('2025-06-12') → "12 Jun 2025" (AD) or "29 जेष्ठ 2082" (BS)
//
export {
  formatCurrency,
  formatCurrencyDecimal,
  formatDate,
  formatDateTime,
} from './dynamicFormatters'

// ─── Legacy utilities ──────────────────────────────────────────────────────

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})

/**
 * Raw number formatted with lakh commas (no currency prefix).
 * 175000  →  "1,75,000"
 */
export function formatNumber(value: number): string {
  return CURRENCY_FORMATTER.format(Math.round(value))
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

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Truncate a string with an ellipsis. */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1) + '…'
}
