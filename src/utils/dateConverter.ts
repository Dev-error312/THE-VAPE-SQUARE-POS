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
  return nepali.toJsDate()
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
  // Get the last day of the month by creating a date on day 1 of next month
  // then subtracting one day
  try {
    const nextMonth = month === 12 ? new NepaliDate(year + 1, 0, 1) : new NepaliDate(year, month, 1)
    const lastDayOfCurrentMonth = new NepaliDate(nextMonth.toJsDate().getTime() - 24 * 60 * 60 * 1000)
    return lastDayOfCurrentMonth.getDate()
  } catch {
    return 30 // fallback to 30 if something goes wrong
  }
}
