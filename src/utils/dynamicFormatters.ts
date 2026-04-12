/**
 * Dynamic formatting utilities that respect business settings
 * Use these instead of the hardcoded utils/index.ts functions
 * 
 * These functions are designed to be used within functional components
 * where you have access to the useSettings() hook OR within a SettingsProvider context
 */

import { formatDateAsBS, formatDateAsAD } from './dateConverter'
import { notifySettingsChanged } from './settingsEvents'

interface FormattingOptions {
  dateFormat: 'AD' | 'BS'
  currency: 'NPR' | 'USD'
}

const CURRENCY_CONFIG = {
  NPR: {
    symbol: 'रु',
    locale: 'en-IN', // Nepali lakh system: 1,00,000
    position: 'prefix', // Symbol before amount
  },
  USD: {
    symbol: '$',
    locale: 'en-US', // US standard: 100,000
    position: 'prefix', // Symbol before amount
  },
} as const

/**
 * These context-aware wrapper functions automatically use settings from SettingsProvider
 * They should be used in most components throughout the app
 * Usage: Just call formatCurrency(175000) and it will use the right currency from settings
 */

let globalSettings: FormattingOptions | null = null

/**
 * Internal function to set global settings (called by SettingsProvider)
 * Also notifies all listeners that settings have changed
 */
export function setGlobalFormatSettings(settings: FormattingOptions) {
  globalSettings = settings
  // Notify all listeners so they can re-render with new settings
  notifySettingsChanged()
}

/**
 * Context-aware currency formatter
 * Automatically uses the business's selected currency
 */
export function formatCurrency(amount: number): string {
  if (!globalSettings) {
    // Fallback to NPR if settings not loaded yet
    return formatCurrencyDynamic(amount, { dateFormat: 'AD', currency: 'NPR' })
  }
  return formatCurrencyDynamic(amount, globalSettings)
}

/**
 * Context-aware decimal currency formatter
 * Automatically uses the business's selected currency
 */
export function formatCurrencyDecimal(amount: number): string {
  if (!globalSettings) {
    // Fallback to NPR if settings not loaded yet
    return formatCurrencyDecimalDynamic(amount, { dateFormat: 'AD', currency: 'NPR' })
  }
  return formatCurrencyDecimalDynamic(amount, globalSettings)
}

/**
 * Context-aware date formatter
 * Automatically uses the business's selected date format
 */
export function formatDate(isoString: string | Date | null | undefined): string {
  if (!globalSettings) {
    // Fallback to AD if settings not loaded yet
    return formatDateDynamic(isoString, { dateFormat: 'AD', currency: 'NPR' })
  }
  return formatDateDynamic(isoString, globalSettings)
}

/**
 * Context-aware date+time formatter
 * Automatically uses the business's selected date format
 */
export function formatDateTime(isoString: string | Date | null | undefined): string {
  if (!globalSettings) {
    // Fallback to AD if settings not loaded yet
    return formatDateTimeDynamic(isoString, { dateFormat: 'AD', currency: 'NPR' })
  }
  return formatDateTimeDynamic(isoString, globalSettings)
}

// ─── Core dynamic formatting functions (explicit options) ─────────────────────

/**
 * Format currency according to business settings
 * Respects the selected currency and uses appropriate locale formatting
 * 
 * Examples:
 * formatCurrencyDynamic(175000, { currency: 'NPR' }) → "रु 1,75,000"
 * formatCurrencyDynamic(175000, { currency: 'USD' }) → "$ 175,000"
 */
export function formatCurrencyDynamic(amount: number, options: FormattingOptions): string {
  if (!isFinite(amount)) {
    return `${CURRENCY_CONFIG[options.currency].symbol} 0`
  }

  const config = CURRENCY_CONFIG[options.currency]
  const formatter = new Intl.NumberFormat(config.locale, {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  })

  const formattedNumber = formatter.format(Math.round(amount))
  return `${config.symbol} ${formattedNumber}`
}

/**
 * Format currency with decimal places (for precise amounts)
 * 
 * Examples:
 * formatCurrencyDecimalDynamic(175000.50, { currency: 'NPR' }) → "रु 1,75,000.50"
 * formatCurrencyDecimalDynamic(175000.50, { currency: 'USD' }) → "$ 175,000.50"
 */
export function formatCurrencyDecimalDynamic(amount: number, options: FormattingOptions): string {
  if (!isFinite(amount)) {
    return `${CURRENCY_CONFIG[options.currency].symbol} 0.00`
  }

  const config = CURRENCY_CONFIG[options.currency]
  const formatter = new Intl.NumberFormat(config.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  const formattedNumber = formatter.format(amount)
  return `${config.symbol} ${formattedNumber}`
}

/**
 * Format date according to business settings
 * Automatically converts between AD and BS calendars
 * 
 * Examples:
 * formatDateDynamic('2025-06-12', { dateFormat: 'AD' }) → "12 Jun 2025"
 * formatDateDynamic('2025-06-12', { dateFormat: 'BS' }) → "29 जेष्ठ 2082"
 */
export function formatDateDynamic(
  isoString: string | Date | null | undefined,
  options: FormattingOptions
): string {
  if (!isoString) return '—'

  try {
    // Pass ISO string directly to formatDateAsBS to avoid timezone issues
    // formatDateAsBS handles both string and Date object parsing correctly
    if (options.dateFormat === 'BS') {
      return formatDateAsBS(isoString)
    } else {
      return formatDateAsAD(isoString)
    }
  } catch {
    return '—'
  }
}

/**
 * Format date with time according to business settings
 * 
 * Examples:
 * formatDateTimeDynamic('2025-06-12T14:30:00Z', { dateFormat: 'AD' }) → "12 Jun 2025, 02:30 PM"
 * formatDateTimeDynamic('2025-06-12T14:30:00Z', { dateFormat: 'BS' }) → "29 जेष्ठ 2082, 02:30 PM"
 */
export function formatDateTimeDynamic(
  isoString: string | Date | null | undefined,
  options: FormattingOptions
): string {
  if (!isoString) return '—'

  try {
    // Pass ISO string directly to avoid timezone issues
    const dateStr = options.dateFormat === 'BS' ? formatDateAsBS(isoString) : formatDateAsAD(isoString)
    
    // Parse time from Date object
    let date: Date
    if (typeof isoString === 'string') {
      date = new Date(isoString)
    } else {
      date = isoString
    }

    // Format time using UTC to match the date
    const hours = String(date.getUTCHours()).padStart(2, '0')
    const minutes = String(date.getUTCMinutes()).padStart(2, '0')
    const ampm = parseInt(hours, 10) >= 12 ? 'PM' : 'AM'
    const displayHours = String((parseInt(hours, 10) % 12) || 12).padStart(2, '0')
    const timeStr = `${displayHours}:${minutes} ${ampm}`

    return `${dateStr}, ${timeStr}`
  } catch {
    return '—'
  }
}

/**
 * Get currency symbol based on business settings
 */
export function getCurrencySymbol(currency: 'NPR' | 'USD'): string {
  return CURRENCY_CONFIG[currency].symbol
}

/**
 * Get locale string based on currency for other formatters
 */
export function getLocaleForCurrency(currency: 'NPR' | 'USD'): string {
  return CURRENCY_CONFIG[currency].locale
}
