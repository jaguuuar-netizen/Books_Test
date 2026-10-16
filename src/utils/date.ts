/**
 * Date parsing and formatting utilities with strict Russian Day-First convention (ДД.ММ.ГГГГ).
 */

const RU_MONTHS: Record<string, string> = {
  'янв': '01',
  'фев': '02',
  'мар': '03',
  'апр': '04',
  'май': '05',
  'мая': '05',
  'июн': '06',
  'июл': '07',
  'авг': '08',
  'сен': '09',
  'окт': '10',
  'ноя': '11',
  'дек': '12',
};

/**
 * Normalizes any spreadsheet / CSV date string into standard ISO format: YYYY-MM-DD.
 * Strictly adheres to Russian / European day-first convention (ДД.ММ.ГГГГ or ДД/ММ/ГГГГ).
 */
export function normalizeRussianDate(raw?: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;

  // Handle Excel / Google Sheets numeric serial dates (e.g. 44870)
  if (typeof raw === 'number' && raw > 30000 && raw < 70000) {
    const utcDays = Math.floor(raw - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }

  const str = String(raw).trim().replace(/^['"]|['"]$/g, '');
  if (!str) return undefined;

  // Split off time if present (e.g. "05.11.2023 14:30:00" or "2023-11-05T12:00:00Z")
  const datePart = str.split(/[\sT]/)[0].trim();

  // 1. ISO format: YYYY-MM-DD or YYYY.MM.DD or YYYY/MM/DD
  const ymdMatch = datePart.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})$/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    let m = parseInt(ymdMatch[2], 10);
    let d = parseInt(ymdMatch[3], 10);
    // If month > 12 and day <= 12, user passed YYYY-DD-MM: swap
    if (m > 12 && d <= 12) {
      const tmp = m;
      m = d;
      d = tmp;
    }
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 2. Russian standard: DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY (DAY FIRST: DD, MM, YYYY)
  const dmyMatch = datePart.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2,4})$/);
  if (dmyMatch) {
    let d = parseInt(dmyMatch[1], 10);
    let m = parseInt(dmyMatch[2], 10);
    let y = dmyMatch[3];
    if (y.length === 2) {
      const numY = parseInt(y, 10);
      y = numY >= 50 ? `19${y}` : `20${y}`;
    }
    // If user provided a date where month > 12 but day <= 12, auto-correct (e.g. 11/25/2023)
    if (m > 12 && d <= 12) {
      const tmp = d;
      d = m;
      m = tmp;
    }
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 3. Textual month names: e.g. "5 ноября 2023" or "12 мая 2024"
  const textMatch = str.match(/^(\d{1,2})\s+([а-яёА-ЯЁ]+)\s+(\d{2,4})/i);
  if (textMatch) {
    const d = parseInt(textMatch[1], 10);
    const monthWord = textMatch[2].toLowerCase();
    let m: string | undefined;
    for (const [key, val] of Object.entries(RU_MONTHS)) {
      if (monthWord.startsWith(key)) {
        m = val;
        break;
      }
    }
    let y = textMatch[3];
    if (y.length === 2) {
      const numY = parseInt(y, 10);
      y = numY >= 50 ? `19${y}` : `20${y}`;
    }
    if (m && d >= 1 && d <= 31) {
      return `${y}-${m}-${String(d).padStart(2, '0')}`;
    }
  }

  return undefined;
}

/**
 * Formats ISO YYYY-MM-DD to Russian DD.MM.YYYY without timezone shifting
 */
export function formatDateRU(dateStr?: string): string {
  if (!dateStr) return '—';
  const norm = normalizeRussianDate(dateStr) || dateStr;
  const parts = norm.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}.${m.padStart(2, '0')}.${y}`;
  }
  return dateStr;
}

/**
 * Formats ISO YYYY-MM-DD to Russian long text (e.g. "5 ноября 2023 г.")
 */
export function formatLongDateRU(dateStr?: string): string {
  if (!dateStr) return '—';
  const norm = normalizeRussianDate(dateStr) || dateStr;
  const parts = norm.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const date = new Date(y, m, d);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
  }
  return dateStr;
}
