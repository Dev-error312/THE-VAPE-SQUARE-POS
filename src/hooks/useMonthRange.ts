import { useSettings } from './useSettings'
import { getMonthRangeDisplay, getMonthRangeDates, getMonthRangeDatesAuto, getCorrectYearForMonth, adToBS } from '../utils/dateConverter'

/**
 * Hook to get month range display and dates based on user's calendar preference
 * 
 * Usage:
 * const { getDisplayText, getDates } = useMonthRange()
 * 
 * // Get display text for April 2025 (automatically uses AD or BS)
 * const label = getDisplayText(2025, 4)  // "Apr 1 - Apr 30 (2025)" or "Jestha 1 - Jestha 31 (2082 BS)"
 * 
 * // Get dates for database queries
 * const { start, end } = getDates(2025, 4)  // { start: "2025-04-01", end: "2025-04-30" }
 * 
 * // Auto-detect year (useful when user selects month without year)
 * const { start, end } = getDatesAuto(4)  // Automatically uses current year if in/past month, next year if future month
 */
export function useMonthRange() {
  const { settings } = useSettings()
  const calendarType = (settings.date_format || 'AD') as 'AD' | 'BS'

  return {
    /**
     * Get display text for a month
     * @param year - Year in the calendar system being used
     * @param month - Month number (1-12)
     * @returns Display text like "Apr 1 - Apr 30 (2025)" or "Baishak 1 - Baishak 30 (2082 BS)"
     */
    getDisplayText: (year: number, month: number): string => {
      return getMonthRangeDisplay(year, month, calendarType)
    },

    /**
     * Get start and end dates for a month (always in YYYY-MM-DD format for queries)
     * @param year - Year in the calendar system being used
     * @param month - Month number (1-12)
     * @returns { start: "YYYY-MM-DD", end: "YYYY-MM-DD" }
     */
    getDates: (year: number, month: number): { start: string; end: string } => {
      return getMonthRangeDates(year, month, calendarType)
    },

    /**
     * Get dates for a month with automatic year inference
     * Use this when the user selects a month but doesn't specify year
     * 
     * Year logic:
     * - If month <= current month: uses current year
     * - If month > current month: uses next year
     * 
     * @param month - Month number (1-12)
     * @returns { start: "YYYY-MM-DD", end: "YYYY-MM-DD" }
     */
    getDatesAuto: (month: number): { start: string; end: string } => {
      return getMonthRangeDatesAuto(month, calendarType)
    },

    /**
     * Get the current month's range in the user's calendar preference
     * @returns { year, month, displayText, dates: { start, end } }
     */
    getCurrentMonthRange: () => {
      const today = new Date()
      let year = today.getFullYear()
      let month = today.getMonth() + 1

      if (calendarType === 'BS') {
        const bsToday = adToBS(today)
        year = bsToday.year
        month = bsToday.month
      }

      return {
        year,
        month,
        displayText: getMonthRangeDisplay(year, month, calendarType),
        dates: getMonthRangeDates(year, month, calendarType),
      }
    },

    /**
     * Get the correct year for a given month (useful for debugging/understanding year inference)
     */
    getCorrectYear: (month: number): number => {
      return getCorrectYearForMonth(month, calendarType)
    },

    /**
     * Get the calendar type being used
     */
    calendarType,
  }
}
