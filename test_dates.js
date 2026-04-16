const NepaliDate = require('nepali-date-converter').default;

function adToBS(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const nepali = new NepaliDate(d);
  return {
    year: nepali.getYear(),
    month: nepali.getMonth() + 1,
    day: nepali.getDate(),
  };
}

function formatDateAsBS(date) {
  if (!date) return '—';
  try {
    const { year, month, day } = adToBS(date);
    const nepaliMonths = [
      'Baisakh', 'Jestha', 'Asad', 'Shrawn', 'Bhadra', 'Ashoj',
      'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra',
    ];
    return `${day} ${nepaliMonths[month - 1]} ${year}`;
  } catch {
    return '—';
  }
}

// Test the boundary dates
console.log('--- Boundary Date Formatting ---');
console.log('Chaitra 30, 2082 BS (April 12, 2026 AD):', formatDateAsBS('2026-04-12'));
console.log('Baishak 1, 2083 BS (April 13, 2026 AD):', formatDateAsBS('2026-04-13'));
console.log('Baishak 30, 2083 BS (May 12, 2026 AD):', formatDateAsBS('2026-05-12'));
console.log('Baishak 31, 2083 BS (May 13, 2026 AD):', formatDateAsBS('2026-05-13'));
console.log('Jestha 1, 2083 BS (May 14, 2026 AD):', formatDateAsBS('2026-05-14'));

// Check what conversion says
const dateCheck = adToBS('2026-04-13');
console.log('\n2026-04-13 converts to:', dateCheck);
const dateCheck2 = adToBS('2026-04-12');
console.log('2026-04-12 converts to:', dateCheck2);
