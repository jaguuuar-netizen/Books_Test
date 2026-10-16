import { Book } from '../types/book';
import { normalizeRussianDate } from '../utils/date';

export { normalizeRussianDate } from '../utils/date';

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
  spreadsheetTitle: string;
  autoSync: boolean;
  lastSyncedAt: string | null;
  lastSyncCount?: number;
}

const STORAGE_KEY = 'mybookshelf_google_sheets_config';

export function loadGoogleSheetsConfig(): GoogleSheetsConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveGoogleSheetsConfig(config: GoogleSheetsConfig | null) {
  try {
    if (!config) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }
  } catch (err) {
    console.error('Failed to save Google Sheets config:', err);
  }
}

/**
 * Extracts spreadsheet ID from full URL or returns raw ID
 */
export function extractSpreadsheetId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  // Match standard docs.google.com/spreadsheets/d/<ID>/...
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  // If user pasted bare ID (alphanumeric, dashes, underscores, length >= 20)
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Headers for the Google Sheet
 */
export const SHEETS_HEADERS = [
  'Название',
  'Авторы',
  'Статус',
  'Оценка (1-5)',
  'Жанры',
  'Страниц',
  'Дата окончания',
  'Дата начала',
  'Часов чтения',
  'Издательство',
  'Год издания',
  'Серия',
  'Номер в серии',
  'Заметки и впечатления для ИИ',
  'ID книги',
  'Последнее обновление',
];

/**
 * Converts books array into 2D table array for Google Sheets
 */
export function booksToSheetRows(books: Book[]): (string | number)[][] {
  const rows: (string | number)[][] = [SHEETS_HEADERS];

  for (const b of books) {
    rows.push([
      b.title || '',
      b.authors ? b.authors.join('; ') : '',
      b.status === 'completed' ? 'Прочитана' : 'Читаю',
      b.rating !== undefined ? b.rating : '',
      b.genres ? b.genres.join('; ') : '',
      b.pages !== undefined ? b.pages : '',
      b.endDate || '',
      b.startDate || '',
      b.readingHours !== undefined ? b.readingHours : '',
      b.publisher || '',
      b.publishYear !== undefined ? b.publishYear : '',
      b.series || '',
      b.seriesNumber !== undefined ? b.seriesNumber : '',
      b.notes || '',
      b.id || '',
      b.updatedAt ? new Date(b.updatedAt).toLocaleString('ru-RU') : '',
    ]);
  }

  return rows;
}

/**
 * Creates a new Google Spreadsheet in user's Drive with styled header row
 */
export async function createGoogleSpreadsheet(
  accessToken: string,
  title = 'Моя книжная полка — Библиотека (My Book Shelf)',
  books: Book[] = []
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; title: string }> {
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
        locale: 'ru_RU',
      },
      sheets: [
        {
          properties: {
            title: 'Книги',
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const errorBody = await createRes.text();
    throw new Error(`Ошибка создания Google Таблицы (${createRes.status}): ${errorBody}`);
  }

  const createdData = await createRes.json();
  const spreadsheetId = createdData.spreadsheetId;
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Write books data if any
  await writeBooksToSpreadsheet(accessToken, spreadsheetId, books);

  // Apply styling to header row: dark header with bold white text
  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.14, green: 0.13, blue: 0.11 }, // #24211D
                  textFormat: {
                    foregroundColor: { red: 0.98, green: 0.97, blue: 0.96 }, // #FAF8F5
                    fontSize: 10,
                    bold: true,
                  },
                  horizontalAlignment: 'LEFT',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
            },
          },
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: 0,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: 16,
              },
            },
          },
        ],
      }),
    });
  } catch (styleErr) {
    console.warn('Could not style Google Sheet header, skipping:', styleErr);
  }

  return { spreadsheetId, spreadsheetUrl, title };
}

/**
 * Writes or overwrites books into an existing Google Spreadsheet
 */
export async function writeBooksToSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  books: Book[]
): Promise<void> {
  const rows = booksToSheetRows(books);

  // 1. Clear previous content to avoid leftover stale rows if library shrunk
  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:Z10000:clear`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (clearErr) {
    console.warn('Could not clear sheet before writing, overwriting directly:', clearErr);
  }

  // 2. Write new rows
  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:P${rows.length}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: `A1:P${rows.length}`,
        majorDimension: 'ROWS',
        values: rows,
      }),
    }
  );

  if (!writeRes.ok) {
    const errorBody = await writeRes.text();
    throw new Error(`Ошибка записи в Google Таблицу (${writeRes.status}): ${errorBody}`);
  }
}

/**
 * Reads data rows from a Google Spreadsheet
 */
export async function readSpreadsheetRows(
  accessToken: string,
  spreadsheetId: string,
  range = 'A1:Z5000'
): Promise<any[][]> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Не удалось прочитать Google Таблицу (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  return data.values || [];
}

/**
 * Fetches spreadsheet info (title, sheets)
 */
export async function getSpreadsheetMetadata(accessToken: string, spreadsheetId: string) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Не удалось получить данные таблицы (${res.status})`);
  }
  return res.json();
}

/**
 * Parses 2D array of rows into Book objects by intelligently mapping columns
 */
export function parseSheetRowsToBooks(rows: any[][]): Book[] {
  if (!rows || rows.length < 2) {
    return [];
  }

  const headers = rows[0].map((h) => String(h || '').toLowerCase().trim());

  // Helper to find column index matching several aliases
  const findCol = (...aliases: string[]) => {
    return headers.findIndex((h) => aliases.some((a) => h.includes(a)));
  };

  const colTitle = findCol('название', 'title', 'книга', 'наименование', 'произведение');
  const colAuthor = findCol('автор', 'author', 'создатель', 'писатель');
  const colStatus = findCol('статус', 'status', 'прочтен', 'состояние');
  const colRating = findCol('оценка', 'рейтинг', 'rating', 'балл', 'звезд', 'score');
  const colGenres = findCol('жанр', 'genre', 'категори', 'тег');
  const colPages = findCol('страниц', 'страниц', 'pages', 'объем', 'page');
  const colEndDate = findCol('окончани', 'прочитано', 'end', 'заверш', 'finished');
  const colStartDate = findCol('начал', 'start', 'начат');
  const colHours = findCol('часов', 'время чтения', 'reading hours', 'hours');
  const colPublisher = findCol('издательств', 'publisher');
  const colYear = findCol('год', 'year');
  const colSeries = findCol('сери', 'цикл', 'series');
  const colSeriesNum = findCol('номер', 'номер в серии', 'том');
  const colNotes = findCol('заметк', 'впечатлени', 'отзыв', 'рецензи', 'notes', 'review', 'комментар');
  const colId = findCol('id', 'идентификатор');

  const books: Book[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    // Determine title
    let title = '';
    if (colTitle >= 0 && row[colTitle]) {
      title = String(row[colTitle]).trim();
    } else if (row[0]) {
      title = String(row[0]).trim();
    }

    if (!title) continue; // Skip empty rows

    // Determine author
    let authors: string[] = ['Неизвестный автор'];
    if (colAuthor >= 0 && row[colAuthor]) {
      const rawAuthor = String(row[colAuthor]).trim();
      const splitAuthors = rawAuthor
        .split(/[;,]/)
        .map((a) => a.trim())
        .filter(Boolean);
      if (splitAuthors.length > 0) {
        authors = splitAuthors;
      }
    }

    // Determine status
    let status: 'reading' | 'completed' = 'completed';
    if (colStatus >= 0 && row[colStatus]) {
      const val = String(row[colStatus]).toLowerCase().trim();
      if (
        val.includes('чита') ||
        val.includes('reading') ||
        val.includes('прогресс') ||
        val.includes('процесс')
      ) {
        status = 'reading';
      }
    }

    // Determine rating (10-point scale: 1 to 10)
    let rating: number | undefined;
    if (colRating >= 0 && row[colRating] !== undefined && row[colRating] !== '') {
      const rawRating = String(row[colRating]).replace(',', '.');
      const numMatch = rawRating.match(/(\d+(\.\d+)?)/);
      if (numMatch) {
        const parsed = parseFloat(numMatch[1]);
        if (!isNaN(parsed) && parsed > 0) {
          rating = Math.min(10, Math.max(1, Math.round(parsed)));
        }
      }
    }

    // Determine genres
    let genres: string[] = ['Другое'];
    if (colGenres >= 0 && row[colGenres]) {
      const raw = String(row[colGenres]);
      const parsedGenres = raw
        .split(/[;,]/)
        .map((g) => g.trim())
        .filter(Boolean);
      if (parsedGenres.length > 0) {
        genres = parsedGenres;
      }
    }

    // Determine pages
    let pages: number | undefined;
    if (colPages >= 0 && row[colPages]) {
      const p = parseInt(String(row[colPages]).replace(/\D/g, ''), 10);
      if (!isNaN(p) && p > 0) pages = p;
    }

    // Determine hours
    let readingHours: number | undefined;
    if (colHours >= 0 && row[colHours]) {
      const h = parseFloat(String(row[colHours]).replace(',', '.'));
      if (!isNaN(h) && h >= 0) readingHours = h;
    }

    // Dates (strictly parse Day-First format: DD.MM.YYYY into standard ISO YYYY-MM-DD)
    const endDate = colEndDate >= 0 ? normalizeRussianDate(row[colEndDate]) : undefined;
    const startDate = colStartDate >= 0 ? normalizeRussianDate(row[colStartDate]) : undefined;

    // Metadata
    const publisher = colPublisher >= 0 && row[colPublisher] ? String(row[colPublisher]).trim() : undefined;
    let publishYear: number | undefined;
    if (colYear >= 0 && row[colYear]) {
      const y = parseInt(String(row[colYear]).replace(/\D/g, ''), 10);
      if (!isNaN(y) && y > 1000 && y < 2100) publishYear = y;
    }
    const series = colSeries >= 0 && row[colSeries] ? String(row[colSeries]).trim() : undefined;
    let seriesNumber: number | undefined;
    if (colSeriesNum >= 0 && row[colSeriesNum]) {
      const sn = parseInt(String(row[colSeriesNum]).replace(/\D/g, ''), 10);
      if (!isNaN(sn) && sn > 0) seriesNumber = sn;
    }
    const notes = colNotes >= 0 && row[colNotes] ? String(row[colNotes]).trim() : undefined;

    // Guaranteed unique safe ID per row
    let id = `book-${Date.now()}-${r}-${Math.random().toString(36).substring(2, 8)}`;
    if (colId >= 0 && row[colId]) {
      const rawId = String(row[colId]).trim();
      if (rawId && /^[a-zA-Z0-9_\-]{3,100}$/.test(rawId)) {
        id = rawId;
      }
    }

    books.push({
      id,
      title,
      authors,
      status,
      rating,
      genres,
      pages,
      readingHours,
      startDate,
      endDate: status === 'completed' && !endDate ? new Date().toISOString().split('T')[0] : endDate,
      publisher,
      publishYear,
      series,
      seriesNumber,
      notes,
      coverColor: '#273B30',
      language: 'Русский',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return books;
}

/**
 * Robust RFC 4180 CSV parser supporting semicolons, commas, tabs, quotes, and newlines
 */
export function parseCSV(text: string): string[][] {
  // Strip BOM if present
  let cleanText = text;
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.slice(1);
  }

  // Detect delimiter: comma, semicolon, or tab
  const firstLine = cleanText.split('\n')[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  let delimiter = ',';
  if (semicolonCount > commaCount && semicolonCount > tabCount) {
    delimiter = ';';
  } else if (tabCount > commaCount && tabCount > semicolonCount) {
    delimiter = '\t';
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i++;
      } else {
        // Toggle quotes
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n
      }
      currentRow.push(currentField);
      currentField = '';
      if (currentRow.some((f) => f.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  // Final field & row
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((f) => f.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parses CSV string directly to Books
 */
export function parseCSVToBooks(csvText: string): Book[] {
  const rows = parseCSV(csvText);
  return parseSheetRowsToBooks(rows);
}

/**
 * Generates structured AI prompt with library stats, top books, genres, and notes
 * for direct consultation with ChatGPT / Claude / Gemini
 */
export function generateAIPrompt(books: Book[], sheetUrl?: string): string {
  const completedBooks = books.filter((b) => b.status === 'completed');
  const readingBooks = books.filter((b) => b.status === 'reading');
  const ratedHigh = completedBooks.filter((b) => (b.rating || 0) >= 9);
  const ratedGood = completedBooks.filter((b) => (b.rating || 0) >= 7 && (b.rating || 0) < 9);

  // Frequency of genres
  const genreCount: Record<string, number> = {};
  books.forEach((b) => {
    b.genres.forEach((g) => {
      genreCount[g] = (genreCount[g] || 0) + 1;
    });
  });
  const topGenres = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([g, c]) => `${g} (${c})`)
    .join(', ');

  let prompt = `Привет! Ты — мой персональный литературный советник и книжный куратор.
Проанализируй мою личную библиотеку прочитанных книг и порекомендуй, что мне почитать дальше.

📊 ОБЩАЯ СТАТИСТИКА ЧТЕНИЯ:
• Всего книг в библиотеке: ${books.length}
• Прочитано: ${completedBooks.length}
• Сейчас читаю: ${readingBooks.length}
• Любимые жанры: ${topGenres || 'Не указаны'}
${sheetUrl ? `• Полная Google Таблица с моей библиотекой: ${sheetUrl}\n` : ''}
`;

  if (ratedHigh.length > 0) {
    prompt += `\n⭐ МОИ ЛЮБИМЫЕ КНИГИ (ОЦЕНКА 9–10 ИЗ 10):\n`;
    ratedHigh.slice(0, 15).forEach((b) => {
      prompt += `• «${b.title}» — ${b.authors.join(', ')} [${b.genres.join(', ')}] — ${b.rating}/10★`;
      if (b.notes) {
        prompt += `\n  Мои впечатления: "${b.notes.trim()}"`;
      }
      prompt += '\n';
    });
  }

  if (ratedGood.length > 0) {
    prompt += `\n👍 ХОРОШИЕ КНИГИ (ОЦЕНКА 7–8 ИЗ 10):\n`;
    ratedGood.slice(0, 8).forEach((b) => {
      prompt += `• «${b.title}» — ${b.authors.join(', ')} [${b.genres.join(', ')}] — ${b.rating}/10★\n`;
    });
  }

  if (readingBooks.length > 0) {
    prompt += `\n📖 СЕЙЧАС В ПРОЦЕССЕ ЧТЕНИЯ:\n`;
    readingBooks.forEach((b) => {
      prompt += `• «${b.title}» — ${b.authors.join(', ')}\n`;
    });
  }

  prompt += `
🎯 ЗАДАЧА ДЛЯ ТЕБЯ:
1. Выдели ключевые паттерны в моих литературных вкусах (темы, настроение, стиль повествования).
2. Порекомендуй 5–7 конкретных книг, которые с высокой вероятностью понравятся мне на основе моих оценок 9–10/10 и заметок.
3. Для каждой книги кратко поясни:
   - Почему именно она мне подойдёт (к каким из прочитанных мной книг она ближе всего).
   - Жанр и о чём сюжет в 2 предложениях.
   - Чем она цепляет.
4. Не предлагай книги, которые уже есть в моём списке выше.`;

  return prompt;
}
