import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Parse CLI flags or env vars
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const hostIndex = args.indexOf('--host');

const PORT = portIndex !== -1 && args[portIndex + 1]
  ? parseInt(args[portIndex + 1], 10)
  : parseInt(process.env.PORT || '3000', 10);

const HOST = hostIndex !== -1 && args[hostIndex + 1]
  ? args[hostIndex + 1]
  : (process.env.HOST || '0.0.0.0');

const isProd = process.env.NODE_ENV === 'production';

// Enable CORS and OPTIONS handling
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));

// Initialize GoogleGenAI server-side with telemetry User-Agent header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface BookInput {
  id?: string;
  title: string;
  authors: string[];
  status?: string;
  rating?: number;
  genres?: string[];
  notes?: string;
  pages?: number;
}

interface RecommendedBookItem {
  id: string;
  title: string;
  author: string;
  genres: string[];
  matchScore: number;
  reason: string;
  description: string;
  estimatedPages: number;
  keyThemes: string[];
  coverColor: string;
}

import { TOP20_BY_CATEGORY, getTop20ForCategory, CuratedBook } from './src/data/curatedTop20';

interface BookInput {
  id?: string;
  title: string;
  authors: string[];
  status?: string;
  rating?: number;
  genres?: string[];
  notes?: string;
  pages?: number;
}

interface RecommendedBookItem {
  id: string;
  title: string;
  author: string;
  genres: string[];
  matchScore: number;
  reason: string;
  description: string;
  estimatedPages: number;
  keyThemes: string[];
  coverColor: string;
  isWishlist?: boolean;
}

// Strict keyword verification to prevent genre cross-contamination
const STRICT_GENRE_KEYWORDS: Record<string, string[]> = {
  'Детектив': ['детектив', 'триллер', 'расследование', 'криминал', 'сыщик', 'убийств', 'саспенс', 'нуар', 'маньяк', 'холмса', 'пуаро', 'следствие'],
  'Антиутопия': ['антиутопи', 'тоталитар', 'дистопи', 'оруэлл', 'замятин', 'хаксли', 'брэдбери', 'бунт против системы', 'диктатур'],
  'Фантастика': ['фантастик', 'космос', 'киберпанк', 'сай-фай', 'sci-fi', 'нф', 'космоопера', 'робот', 'пришельц', 'будущее'],
  'Фэнтези': ['фэнтези', 'маги', 'дракон', 'эльф', 'меч', 'толкин', 'сапковск', 'хогвартс', 'заклинани', 'ведьмак'],
  'Классика': ['классик', 'роман', 'толстой', 'достоевск', 'булгаков', 'драма', 'повесть'],
  'Психология': ['психолог', 'саморазвит', 'мозг', 'привычк', 'поведени', 'эмоци', 'мышлени', 'психотерапи'],
  'Нон-фикшн': ['нон-фикшн', 'наука', 'биографи', 'истори', 'научпоп', 'документал', 'эволюци', 'факты'],
  'Приключения': ['приключен', 'путешеств', 'остров', 'пират', 'экспедици', 'море', 'робинзонада', 'клад'],
  'Драма': ['драма', 'романтик', 'любов', 'чувств', 'трагеди', 'судьба', 'отношени'],
};

// Known cross-genre leaks to explicitly reject
const GENRE_DISALLOWED_MAP: Record<string, string[]> = {
  'Детектив': ['дюна', 'властелин колец', 'мы', 'солярис', 'гиперион', 'хоббит', 'ведьмак', 'гарри поттер', '1984', 'о дивный новый мир', 'скотный двор'],
  'Антиутопия': ['дюна', 'властелин колец', 'ведьмак', 'гарри поттер', 'дерево', 'хоббит', 'десять негритят', 'собака баскервилей'],
  'Фэнтези': ['дюна', '1984', 'мы', 'солярис', 'десять негритят', 'собака баскервилей', 'нейромант', 'sapiens'],
  'Фантастика': ['властелин колец', 'хоббит', 'ведьмак', 'гарри поттер', 'десять негритят', 'гордость и предубеждение'],
};

// AI Book Recommendations API endpoint
app.all('/api/recommendations', async (req, res) => {
  if (req.method === 'GET') {
    return res.json({
      success: true,
      message: 'AI Recommendations endpoint is healthy. Send a POST request with reader shelf data to receive recommendations.',
      categories: Object.keys(TOP20_BY_CATEGORY),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed. Please use POST to request recommendations.',
    });
  }

  const { books, focusGenre, mood, excludedTitles } = (req.body || {}) as {
    books?: BookInput[];
    focusGenre?: string;
    mood?: string;
    excludedTitles?: string[];
  };

  const userBooks = Array.isArray(books) ? books : [];
  
  // 1. Separate user books into distinct reader signals:
  // - Wishlist books: status === 'planned' (books the reader actively dreams to read!)
  // - Reading books: status === 'reading'
  // - Completed books: status === 'completed' (books already finished)
  const wishlistBooks = userBooks.filter((b) => b.status === 'planned');
  const readingBooks = userBooks.filter((b) => b.status === 'reading');
  const completedBooks = userBooks.filter(
    (b) => b.status === 'completed' || (typeof b.rating === 'number' && b.rating > 0)
  );

  // Exclude ONLY already completed books and explicitly dismissed books
  // DO NOT exclude wishlist books! The user wants to see relevant wishlist books in recommendations!
  const completedTitles = completedBooks.map((b) => (b.title || '').toLowerCase().trim()).filter(Boolean);
  const dismissedTitles = Array.isArray(excludedTitles) ? excludedTitles.map((t) => (t || '').toLowerCase().trim()).filter(Boolean) : [];
  const allExcluded = Array.from(new Set([...completedTitles, ...dismissedTitles]));

  const wishlistTitlesSet = new Set(wishlistBooks.map((b) => (b.title || '').toLowerCase().trim()));

  try {
    // 2. Build rich reader taste profile directly anchored on their Wishlist and reading history
    let profileSummary = 'ПРОФИЛЬ ЧИТАТЕЛЯ И СТРУКТУРА ЕГО ПОЛКИ:\n';

    if (wishlistBooks.length > 0) {
      profileSummary += '\n🎯 ВИШ-ЛИСТ (КНИГИ В ПЛАНАХ К ПРОЧТЕНИЮ — ГЛАВНЫЙ ОРИЕНТИР ВКУСА):\n';
      wishlistBooks.slice(0, 15).forEach((b) => {
        const genresStr = b.genres?.length ? ` [Жанры: ${b.genres.join(', ')}]` : '';
        const notesStr = b.notes ? ` — Заметка: "${b.notes.slice(0, 80)}"` : '';
        profileSummary += `• «${b.title}» — ${b.authors?.join(', ') || 'Автор'}${genresStr}${notesStr}\n`;
      });
      profileSummary += 'ВНИМАНИЕ: Пользователь сам выбрал эти книги и хочет их прочитать! Если книга из виш-листа идеально подходит к выбранной категории, ЕЁ МОЖНО И НУЖНО РЕКОМЕНДОВАТЬ с пометкой "isWishlist": true. Остальные рекомендации должны быть максимально близки по духу, темам и стилю к книгам из его виш-листа!\n';
    }

    if (readingBooks.length > 0) {
      profileSummary += '\n📖 СЕЙЧАС ЧИТАЕТ:\n';
      readingBooks.slice(0, 5).forEach((b) => {
        const genresStr = b.genres?.length ? ` [Жанры: ${b.genres.join(', ')}]` : '';
        profileSummary += `• «${b.title}» — ${b.authors?.join(', ') || 'Автор'}${genresStr}\n`;
      });
    }

    if (completedBooks.length > 0) {
      profileSummary += '\n★ УЖЕ ПРОЧИТАННЫЕ КНИГИ И ОЦЕНКИ (НЕ РЕКОМЕНДОВАТЬ ПОВТОРНО):\n';
      completedBooks.slice(0, 20).forEach((b) => {
        const ratingStr = b.rating ? ` [${b.rating}/10★]` : '';
        const genresStr = b.genres?.length ? ` (${b.genres.join(', ')})` : '';
        profileSummary += `• «${b.title}» — ${b.authors?.join(', ') || 'Автор'}${ratingStr}${genresStr}\n`;
      });
    }

    // 3. Category Directive with strict genre integrity rules
    let genreDirective = '';
    if (focusGenre && focusGenre !== 'all') {
      genreDirective = `\nЦЕЛЕВАЯ КАТЕГОРИЯ: «${focusGenre}».
СТРОЖАЙШИЕ ПРАВИЛА ЖАНРОВОЙ ЧИСТОТЫ:
1. ВСЕ 20 РЕКОМЕНДАЦИЙ ДОЛЖНЫ БЫТЬ 100% В ЖАНРЕ «${focusGenre}»!
2. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО СМЕШИВАТЬ ЖАНРЫ:
   - Если «Детектив»: ТОЛЬКО детективы, триллеры и расследования (Агата Кристи, Конан Дойл, Стиг Ларссон, Ю Несбё, Гиллиан Флинн, Томас Харрис, Умберто Эко, Деннис Лихэйн, Жоэль Диккер, Пола Хокинс, Тана Френч, Кэйго Хигасино, Роберт Гэлбрейт).
     КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО помещать в детективы научную фантастику вроде «Дюны», фэнтези вроде «Властелина колец» или классику вроде «Мы»!
   - Если «Антиутопия»: ТОЛЬКО антиутопии и мрачные социальные предостережения (1984, О дивный новый мир, Мы, 451° по Фаренгейту, Скотный двор, Рассказ служанки, Заводной апельсин, Дорога, Повелитель мух, Слепота, Бойня номер пять, Мечтают ли андроиды об электроовцах?).
   - Если «Фэнтези»: ТОЛЬКО классическое и темное фэнтези (Толкин, Мартин, Сапковский, Сандерсон, Ротфусс, Гейман, Пратчетт, Ле Гуин, Хобб, Аберкромби).
   - Если «Фантастика»: ТОЛЬКО научная фантастика, космооперы и киберпанк (Герберт, Азимов, Кларк, Лем, Стругацкие, Симмонс, Лю Цысинь, Гибсон, Вейр).
   - Если «Психология»: ТОЛЬКО книги по психологии и осознанности (Франкл, Канеман, Чиксентмихайи, Клир, Чалдини, Талеб, Гоулман).
`;
    }

    let moodStr = '';
    if (mood && mood !== 'all') {
      moodStr = `\nЖелаемое настроение: ${mood}.\n`;
    }

    const prompt = `Ты — эрудированный литературный критик, библиотекарь мирового уровня и персональный рекомендательный сервис.
Перед тобой подробная библиотека пользователя с его виш-листом и прочитанными книгами:

${profileSummary}
${genreDirective}${moodStr}

Сформируй персональный ТОП-20 книг, которые с наибольшей вероятностью понравятся этому читателю.

ПРАВИЛА И КРИТЕРИИ:
1. Выдай РОВНО 20 уникальных книг строго под читателя.
2. ЖАНРОВОЕ СООТВЕТСТВИЕ: ${focusGenre && focusGenre !== 'all' ? `Все 20 книг ДОЛЖНЫ строго принадлежать к категории «${focusGenre}»!` : 'Сбалансированный срез лучших шедевров разных направлений под вкус читателя.'}
3. СВЯЗЬ С ВИШ-ЛИСТОМ: книги из виш-листа читателя, подходящие к категории, могут быть включены с флагом "isWishlist": true и максимальным рейтингом совпадения (98-99%). Остальные рекомендации должны быть логическим продолжением вкуса его виш-листа!
4. ИСКЛЮЧИТЬ книги, которые читатель УЖЕ прочитал (status: completed) или скрыл ("Не рекомендовать"): [${allExcluded.join(', ') || 'нет'}].
5. В поле "reason" четко объясни, почему книга идеально подойдет читателю, ссылаясь на его вкусы и виш-лист.

Формат ответа: СТРОГО валидный JSON-массив из 20 объектов:
[
  {
    "id": "rec-1",
    "title": "Название книги на русском языке",
    "author": "Имя Фамилия автора",
    "genres": ["Основной жанр", "Дополнительный жанр"],
    "matchScore": 98,
    "reason": "Персональная причина рекомендации для этого читателя (1-2 емких предложения)",
    "description": "Краткая интригующая аннотация сюжета (2 предложения)",
    "estimatedPages": 450,
    "keyThemes": ["Тема1", "Тема2", "Тема3"],
    "coverColor": "#2C3E50",
    "isWishlist": false
  }
]`;

    // Fast generation using gemini-3.1-flash-lite
    let response: any = null;
    try {
      const callPromise = ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI generation timeout after 12s')), 12000)
      );

      response = await Promise.race([callPromise, timeoutPromise]);
    } catch (apiErr: any) {
      console.warn('Gemini call error or timeout, activating curated literary engine:', apiErr?.message);
    }

    let recommendations: any[] = [];
    if (response && response.text) {
      const responseText = response.text.trim();
      try {
        recommendations = JSON.parse(responseText);
      } catch {
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            recommendations = JSON.parse(jsonMatch[0]);
          } catch (e) {
            console.error('Failed to parse regex-extracted JSON:', e);
          }
        }
      }
    }

    // 4. Strict Genre Quality Check & Validation
    const disallowedTitles = focusGenre ? (GENRE_DISALLOWED_MAP[focusGenre] || []) : [];
    const targetKeywords = focusGenre ? (STRICT_GENRE_KEYWORDS[focusGenre] || []) : [];

    // Filter out hallucinations, excluded books, and genre contaminants
    let filteredRecs = (Array.isArray(recommendations) ? recommendations : []).filter((item: any) => {
      const titleLower = String(item.title || '').toLowerCase().trim();
      if (!titleLower) return false;

      // Check if excluded (completed or dismissed)
      if (allExcluded.includes(titleLower)) return false;

      // Check if explicitly disallowed for this genre (e.g. Dune in Detectives)
      if (disallowedTitles.some((bad) => titleLower.includes(bad))) {
        console.warn(`[Quality Guard] Rejected cross-genre book «${item.title}» from category «${focusGenre}»`);
        return false;
      }

      // If category is specific (e.g. Детектив), ensure at least one genre or keyword aligns
      if (focusGenre && focusGenre !== 'all' && targetKeywords.length > 0) {
        const itemGenres = (Array.isArray(item.genres) ? item.genres : []).map((g: any) => String(g).toLowerCase());
        const hasGenreMatch = itemGenres.some((g: string) => targetKeywords.some((k) => g.includes(k)));
        const reasonLower = String(item.reason || '').toLowerCase();
        const descLower = String(item.description || '').toLowerCase();
        const hasContentMatch = targetKeywords.some((k) => reasonLower.includes(k) || descLower.includes(k));

        if (!hasGenreMatch && !hasContentMatch) {
          console.warn(`[Quality Guard] Rejected non-matching book «${item.title}» (genres: ${itemGenres.join(', ')}) from category «${focusGenre}»`);
          return false;
        }
      }

      return true;
    });

    // Prepend matching wishlist books at the very front of recommendations
    const matchingWishlist = wishlistBooks.filter((wb) => {
      const t = (wb.title || '').toLowerCase().trim();
      if (!t || allExcluded.includes(t)) return false;
      const disallowed = focusGenre ? (GENRE_DISALLOWED_MAP[focusGenre] || []) : [];
      if (disallowed.some((bad) => t.includes(bad))) return false;
      if (!focusGenre || focusGenre === 'all') return true;
      const curated = TOP20_BY_CATEGORY[focusGenre] || [];
      if (curated.some((c) => c.title.toLowerCase().trim() === t)) return true;
      const keywords = STRICT_GENRE_KEYWORDS[focusGenre] || [focusGenre.toLowerCase()];
      const bGenres = (wb.genres || []).map((g) => g.toLowerCase());
      return bGenres.some((g) => keywords.some((k) => g.includes(k)));
    });

    const finalRecs: any[] = [];
    const usedTitles = new Set<string>();

    matchingWishlist.forEach((wb, idx) => {
      const t = (wb.title || '').toLowerCase().trim();
      if (!usedTitles.has(t)) {
        usedTitles.add(t);
        finalRecs.push({
          id: wb.id || `wish-${idx}`,
          title: wb.title,
          author: (wb.authors && wb.authors.length > 0) ? wb.authors.join(', ') : 'Автор',
          genres: wb.genres && wb.genres.length > 0 ? wb.genres : [focusGenre && focusGenre !== 'all' ? focusGenre : 'Художественная литература'],
          matchScore: 99,
          reason: `🎯 Из вашего виш-листа! Вы запланировали эту книгу — рекомендуем взяться за неё в категории «${focusGenre && focusGenre !== 'all' ? focusGenre : 'Главный ТОП-20'}».`,
          description: wb.notes ? `Ваша заметка: «${wb.notes}»` : 'Книга из вашего персонального списка «Хочу прочитать». Наивысший приоритет к чтению.',
          estimatedPages: wb.pages || 350,
          keyThemes: wb.genres && wb.genres.length > 0 ? wb.genres : ['Виш-лист'],
          coverColor: '#8A5A36',
          isWishlist: true,
        });
      }
    });

    // Add validated AI recommendations
    for (const r of filteredRecs) {
      if (finalRecs.length >= 20) break;
      const t = String(r.title || '').toLowerCase().trim();
      if (!usedTitles.has(t) && !allExcluded.includes(t)) {
        usedTitles.add(t);
        finalRecs.push(r);
      }
    }

    // Fill remaining up to 20 strictly from curatedTop20
    const curatedTop20 = getTop20ForCategory(focusGenre || 'all', allExcluded);
    for (const curated of curatedTop20) {
      if (finalRecs.length >= 20) break;
      const cTitleLower = curated.title.toLowerCase().trim();
      if (!usedTitles.has(cTitleLower) && !allExcluded.includes(cTitleLower)) {
        usedTitles.add(cTitleLower);
        finalRecs.push({
          ...curated,
          isWishlist: wishlistTitlesSet.has(cTitleLower),
        });
      }
    }

    // Normalize final list
    const normalized = finalRecs.slice(0, 20).map((item: any, idx: number) => {
      const title = String(item.title || 'Рекомендуемая книга');
      const titleLower = title.toLowerCase().trim();
      const isFromWishlist = item.isWishlist || wishlistTitlesSet.has(titleLower);

      return {
        id: item.id || `rec-${Date.now()}-${idx + 1}`,
        title,
        author: String(item.author || 'Автор'),
        genres: Array.isArray(item.genres) && item.genres.length > 0 ? item.genres : [focusGenre && focusGenre !== 'all' ? focusGenre : 'Художественная литература'],
        matchScore: typeof item.matchScore === 'number' 
          ? Math.min(99, Math.max(70, Math.round(item.matchScore))) 
          : (isFromWishlist ? 99 : Math.max(75, 96 - idx)),
        reason: isFromWishlist
          ? `Книга уже в вашем виш-листе! Рекомендуем взяться за неё в первую очередь в категории «${focusGenre && focusGenre !== 'all' ? focusGenre : 'Художественная литература'}».`
          : String(item.reason || 'Отлично подходит под ваши читательские вкусы и виш-лист.'),
        description: String(item.description || 'Увлекательное литературное произведение с глубоким смыслом.'),
        estimatedPages: typeof item.estimatedPages === 'number' ? item.estimatedPages : 380,
        keyThemes: Array.isArray(item.keyThemes) && item.keyThemes.length > 0 ? item.keyThemes : ['Литература'],
        coverColor: typeof item.coverColor === 'string' && item.coverColor.startsWith('#') ? item.coverColor : '#2C3E50',
        isWishlist: isFromWishlist,
      };
    });

    return res.json({
      success: true,
      category: focusGenre || 'all',
      count: normalized.length,
      recommendations: normalized,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('AI Recommendations API error:', error);
    const fallbackList = getTop20ForCategory(focusGenre || 'all', allExcluded).map((item, idx) => ({
      ...item,
      isWishlist: wishlistTitlesSet.has(item.title.toLowerCase().trim()),
    }));

    return res.json({
      success: true,
      isFallback: true,
      category: focusGenre || 'all',
      count: fallbackList.length,
      recommendations: fallbackList,
      generatedAt: new Date().toISOString(),
    });
  }
});

// Setup Vite in development or serve static in production
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server is running at http://${HOST}:${PORT} [${isProd ? 'production' : 'development'}]`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
