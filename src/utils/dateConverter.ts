import NepaliDate from 'nepali-date-converter'

interface BSDate {
  year: number
  month: number
  day: number
}

export function adToBS(date: Date | string): BSDate {
  const d = typeof date === 'string' ? new Date(date) : date
  const nepali = new NepaliDate(d)
  return {
    year: nepali.getYear(),
    month: nepali.getMonth() + 1, // library is 0-indexed
    day: nepali.getDate(),
  }
}

export function bsToAD(bsDate: BSDate): Date {
  const nepali = new NepaliDate(bsDate.year, bsDate.month - 1, bsDate.day)
  const raw = nepali.toJsDate() // local midnight
  
  // Return noon instead of midnight to prevent .toISOString() from shifting back a day
  // Nepal is UTC+5:45, so midnight converted to UTC goes back 5:45h (to prev day 18:15 UTC)
  // But noon converted to UTC goes back 5:45h (to same day 06:15 UTC) — correct date
  return new Date(raw.getFullYear(), raw.getMonth(), raw.getDate(), 12, 0, 0)
}

export function formatDateAsBS(date: Date | string | null | undefined): string {
  if (!date) return '—'
  try {
    const { year, month, day } = adToBS(date)
    const nepaliMonths = [
      'Baisakh', 'Jestha', 'Asad', 'Shrawn', 'Bhadra', 'Ashoj',
      'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra',
    ]
    return `${day} ${nepaliMonths[month - 1]} ${year}`
  } catch {
    return '—'
  }
}

export function formatDateAsAD(date: Date | string | null | undefined): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const day = String(d.getUTCDate()).padStart(2, '0')
    return `${day} ${monthNames[d.getUTCMonth()]} ${d.getUTCFullYear()}`
  } catch {
    return '—'
  }
}

export function getDaysInBS(year: number, month: number): number {
  try {
    // Create day 1 of NEXT month in BS, convert to AD, subtract 1 day in AD at noon (avoids timezone issues), convert back to BS
    const nextMonthYear = month === 12 ? year + 1 : year
    const nextMonthMonth = month === 12 ? 1 : month + 1

    const nextMonthDay1 = new NepaliDate(nextMonthYear, nextMonthMonth - 1, 1) // 0-indexed month
    const nextMonthDay1AD = nextMonthDay1.toJsDate()

    // Subtract exactly 1 day but normalize to noon to avoid UTC/timezone issues
    const lastDayAD = new Date(
      nextMonthDay1AD.getFullYear(),
      nextMonthDay1AD.getMonth(),
      nextMonthDay1AD.getDate() - 1,
      12, 0, 0  // noon — avoids timezone boundary issues
    )

    const lastDayBS = new NepaliDate(lastDayAD)
    return lastDayBS.getDate()
  } catch {
    return 30 // fallback to 30 if something goes wrong
  }
}

/**
 * Get month range display text based on calendar type
 * AD: "Apr 1 - Apr 30" for April 2025
 * BS: "Baishak 1 - Baishak 30" for Baishak 2082
 * 
 * @param year - Year in the selected calendar system
 * @param month - Month number (1-12)
 * @param calendarType - 'AD' or 'BS'
 * @returns Display string like "Apr 1 - Apr 30" or "Baishak 1 - Baishak 30"
 */
export function getMonthRangeDisplay(year: number, month: number, calendarType: 'AD' | 'BS'): string {
  const nepaliMonths = [
    'Baishak', 'Jestha', 'Asad', 'Shrawn', 'Bhadra', 'Ashoj',
    'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra',
  ]
  const adMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  if (calendarType === 'BS') {
    const endDay = getDaysInBS(year, month)
    const monthName = nepaliMonths[month - 1]
    return `${monthName} 1 - ${monthName} ${endDay} (${year} BS)`
  } else {
    // AD calendar
    const endDay = new Date(year, month, 0).getDate() // Get last day of the month
    const monthName = adMonths[month - 1]
    return `${monthName} 1 - ${monthName} ${endDay} (${year})`
  }
}

/**
 * Get start and end dates for a month in YYYY-MM-DD format
 * Useful for database queries and date filters
 * 
 * @param year - Year in the selected calendar system
 * @param month - Month number (1-12)
 * @param calendarType - 'AD' or 'BS'
 * @returns { start: "YYYY-MM-DD", end: "YYYY-MM-DD" }
 */
/**
 * Intelligently determine which year to use for a given month
 * When user selects a month without specifying year, we infer the most likely year
 * 
 * Logic:
 * - If selected month <= current month: use current BS year
 * - If selected month > current month: use next BS year
 * 
 * This assumes: if you select a future month, you mean next occurrence; if past/current, you mean current year
 */
export function getCorrectYearForMonth(month: number, calendarType: 'AD' | 'BS'): number {
  const today = new Date()
  
  if (calendarType === 'BS') {
    const bsToday = adToBS(today)
    const currentYear = bsToday.year
    const currentMonth = bsToday.month
    
    // If selected month <= current month, use current year (including future months in this year)
    if (month <= currentMonth) {
      return currentYear
    } else {
      // Selected month is in the future, use next year
      return currentYear + 1
    }
  } else {
    // AD calendar - straightforward
    return today.getFullYear()
  }
}

export function getMonthRangeDates(year: number, month: number, calendarType: 'AD' | 'BS'): { start: string; end: string } {
  if (calendarType === 'BS') {
    const endDay = getDaysInBS(year, month)

    const startAD = bsToAD({ year, month, day: 1 })
    const endAD = bsToAD({ year, month, day: endDay })

    // Use local date parts to avoid UTC shift. Don't use .toISOString() which converts to UTC.
    const toYMD = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    return { start: toYMD(startAD), end: toYMD(endAD) }
  } else {
    // AD calendar
    const startDate = new Date(year, month - 1, 1).toISOString().slice(0, 10)
    const endDate = new Date(year, month, 0).toISOString().slice(0, 10)
    return { start: startDate, end: endDate }
  }
}

/**
 * Get month range dates with intelligent year inference
 * Use this when you don't know which year the user means
 * 
 * @param month - Month number (1-12)
 * @param calendarType - 'AD' or 'BS'
 * @returns { start: "YYYY-MM-DD", end: "YYYY-MM-DD" }
 */
export function getMonthRangeDatesAuto(month: number, calendarType: 'AD' | 'BS'): { start: string; end: string } {
  const year = getCorrectYearForMonth(month, calendarType)
  return getMonthRangeDates(year, month, calendarType)
}
