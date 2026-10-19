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

// Curated literary database for robust fallback recommendations
const CURATED_GOLD_LIBRARY: RecommendedBookItem[] = [
  {
    id: 'gold-1',
    title: '1984',
    author: 'Джордж Оруэлл',
    genres: ['Антиутопия', 'Фантастика', 'Классика'],
    matchScore: 97,
    reason: 'Фундаментальное исследование свободы мысли, пропаганды и человеческого достоинства.',
    description: 'Мир тотального контроля Старшего Брата, где даже тайные мысли караются Мыслепреступлением.',
    estimatedPages: 320,
    keyThemes: ['Свобода', 'Тоталитаризм', 'Бунт'],
    coverColor: '#2C3E50',
  },
  {
    id: 'gold-2',
    title: 'Мастер и Маргарита',
    author: 'Михаил Булгаков',
    genres: ['Классика', 'Мистика', 'Философия'],
    matchScore: 98,
    reason: 'Великий шедевр о вечной любви, человеческой совести и природе добра и зла.',
    description: 'Визит Воланда в советскую Москву переплетается с библейской историей Понтия Пилата и историей самоотверженной любви Маргариты.',
    estimatedPages: 480,
    keyThemes: ['Истина', 'Любовь', 'Справедливость'],
    coverColor: '#4A1521',
  },
  {
    id: 'gold-3',
    title: 'О дивный новый мир',
    author: 'Олдос Хаксли',
    genres: ['Антиутопия', 'Фантастика', 'Философия'],
    matchScore: 95,
    reason: 'Идеальное продолжение для любителей глубокой социальной фантастики и антиутопий.',
    description: 'Общество потребления без боли, страданий и... человеческой души, где счастье синтезируется в пробирках.',
    estimatedPages: 288,
    keyThemes: ['Потребление', 'Технологии', 'Индивидуальность'],
    coverColor: '#1B4965',
  },
  {
    id: 'gold-4',
    title: 'Цветы для Элджернона',
    author: 'Дэниел Киз',
    genres: ['Научная фантастика', 'Психология', 'Драма'],
    matchScore: 96,
    reason: 'Глубоко трогательная история об эволюции разума, одиночестве и цене гениальности.',
    description: 'Умственно отсталый уборщик Чарли соглашается на экспериментальную операцию, стремительно превосходя в интеллекте своих создателей.',
    estimatedPages: 320,
    keyThemes: ['Интеллект', 'Эмпатия', 'Одиночество'],
    coverColor: '#5C3D2E',
  },
  {
    id: 'gold-5',
    title: 'Сто лет одиночества',
    author: 'Габриэль Гарсиа Маркес',
    genres: ['Магический реализм', 'Классика', 'Драма'],
    matchScore: 94,
    reason: 'Магическая хроника поколений для ценителей поэтичного и масштабного литературного эпоса.',
    description: 'История семи поколений рода Буэндиа в затерянном среди болот городке Макондо, наполненная мистикой и страстями.',
    estimatedPages: 480,
    keyThemes: ['Судьба', 'Одиночество', 'Семья'],
    coverColor: '#B07D62',
  },
  {
    id: 'gold-6',
    title: 'Дюна',
    author: 'Фрэнк Герберт',
    genres: ['Научная фантастика', 'Космоопера', 'Приключения'],
    matchScore: 95,
    reason: 'Монументальная фантастическая сага об экологии, религии и борьбе за власть во Вселенной.',
    description: 'Песчаная планета Арракис таит в себе самое ценное вещество во Вселенной — пряность спайс, за контроль над которой разворачивается война.',
    estimatedPages: 704,
    keyThemes: ['Власть', 'Экология', 'Предназначение'],
    coverColor: '#C47335',
  },
  {
    id: 'gold-7',
    title: 'Убить пересмешника',
    author: 'Харпер Ли',
    genres: ['Классика', 'Драма', 'Воспитание'],
    matchScore: 93,
    reason: 'Теплая и мудрая книга о справедливости, сострадании и честности перед самим собой.',
    description: 'История взросления девочки Глазастика в маленьком южном городке и ее отца-адвоката, защищающего невиновного.',
    estimatedPages: 416,
    keyThemes: ['Честность', 'Справедливость', 'Детство'],
    coverColor: '#2B580C',
  },
  {
    id: 'gold-8',
    title: 'Мы',
    author: 'Евгений Замятин',
    genres: ['Антиутопия', 'Фантастика', 'Классика'],
    matchScore: 94,
    reason: 'Русская классика антиутопии, вдохновившая Оруэлла и Хаксли на их великие романы.',
    description: 'В Едином Государстве из стекла и стали у людей нет имен, только нумера, пока нумер Д-503 не открывает в себе душу.',
    estimatedPages: 224,
    keyThemes: ['Душа', 'Логика vs Чувства', 'Свобода'],
    coverColor: '#34495E',
  },
  {
    id: 'gold-9',
    title: '451° по Фаренгейту',
    author: 'Рэй Брэдбери',
    genres: ['Антиутопия', 'Фантастика', 'Философия'],
    matchScore: 95,
    reason: 'Гимн печатной книге, критическому мышлению и живому общению против пустого медиа-шума.',
    description: 'Гай Монтэг — пожарный, чья работа сжигать запрещенные книги, пока встреча со странной девушкой не меняет его жизнь.',
    estimatedPages: 256,
    keyThemes: ['Память', 'Книги', 'Пробуждение'],
    coverColor: '#873600',
  },
  {
    id: 'gold-10',
    title: 'Преступление и наказание',
    author: 'Фёдор Достоевский',
    genres: ['Классика', 'Психология', 'Философия'],
    matchScore: 96,
    reason: 'Непревзойденный психологический роман о границах человеческой воли и искуплении.',
    description: 'Студент Родион Раскольников решает проверить теорию об «обыкновенных» и «необыкновенных» людях, совершая роковой шаг.',
    estimatedPages: 576,
    keyThemes: ['Совесть', 'Гордыня', 'Воскресение души'],
    coverColor: '#1C2833',
  },
  {
    id: 'gold-11',
    title: 'Автостопом по галактике',
    author: 'Дуглас Адамс',
    genres: ['Фантастика', 'Юмор', 'Приключения'],
    matchScore: 91,
    reason: 'Остроумнейшая космическая комедия, дарящая отличное настроение и философскую иронию.',
    description: 'Землю сносят ради строительства гиперпространственного шоссе, а Артур Дент отправляется в путешествие по Галактике.',
    estimatedPages: 320,
    keyThemes: ['Ирония', 'Космос', 'Ответ 42'],
    coverColor: '#117A65',
  },
  {
    id: 'gold-12',
    title: 'Мартин Иден',
    author: 'Джек Лондон',
    genres: ['Классика', 'Драма', 'Биография'],
    matchScore: 92,
    reason: 'Мощнейшая мотивационная драма о несгибаемой силе воли, самообразовании и цене славы.',
    description: 'Простой матрос Мартин влюбляется в девушку из высшего общества и клянется стать выдающимся писателем вопреки всем преградам.',
    estimatedPages: 448,
    keyThemes: ['Труд', 'Успех', 'Разочарование'],
    coverColor: '#512E5F',
  },
  {
    id: 'gold-13',
    title: 'Гарри Поттер и философский камень',
    author: 'Дж. К. Роулинг',
    genres: ['Фэнтези', 'Приключения', 'Волшебство'],
    matchScore: 94,
    reason: 'Волшебная вселенная о дружбе, отваге и силе любви, покорившая сердца миллионов читателей.',
    description: 'Мальчик-сирота в свой одиннадцатый день рождения узнает, что он волшебник и приглашен на учебу в школу Хогвартс.',
    estimatedPages: 432,
    keyThemes: ['Дружба', 'Магия', 'Выбор'],
    coverColor: '#78281F',
  },
  {
    id: 'gold-14',
    title: 'Sapiens. Краткая история человечества',
    author: 'Юваль Ной Харари',
    genres: ['Нон-фикшн', 'История', 'Наука'],
    matchScore: 93,
    reason: 'Захватывающий взгляд на то, как невзрачный примат стал безраздельным властелином планеты Земля.',
    description: 'Когнитивная, аграрная и научная революции: как вера в общие мифы объединила человечество.',
    estimatedPages: 512,
    keyThemes: ['Эволюция', 'Общество', 'Будущее'],
    coverColor: '#196F3D',
  },
  {
    id: 'gold-15',
    title: 'Маленький принц',
    author: 'Антуан де Сент-Экзюпери',
    genres: ['Классика', 'Притча', 'Философия'],
    matchScore: 95,
    reason: 'Трогательная философская сказка-притча, напоминающая взрослым о самом главном.',
    description: 'Потерпевший крушение летчик встречает посреди Сахары златовласого мальчика с далекого астероида Б-612.',
    estimatedPages: 112,
    keyThemes: ['Сердце', 'Дружба', 'Ответственность'],
    coverColor: '#B7950B',
  },
  {
    id: 'gold-16',
    title: 'Атлант расправил плечи',
    author: 'Айн Рэнд',
    genres: ['Философия', 'Драма', 'Антиутопия'],
    matchScore: 89,
    reason: 'Масштабный манифест индивидуализма, созидательной мысли и рационального эгоизма.',
    description: 'Что произойдет с миром, если двигатели прогресса — творцы, изобретатели и промышленники — объявят забастовку?',
    estimatedPages: 1392,
    keyThemes: ['Разум', 'Творчество', 'Капитализм'],
    coverColor: '#283747',
  },
  {
    id: 'gold-17',
    title: 'Трудно быть богом',
    author: 'Аркадий и Борис Стругацкие',
    genres: ['Научная фантастика', 'Философия', 'Классика'],
    matchScore: 94,
    reason: 'Вершина советской философской фантастики о моральной ответственности прогрессоров.',
    description: 'Земной наблюдатель Антон на планете с глухим средневековьем пытается спасти ученых и поэтов от кровавой резни.',
    estimatedPages: 256,
    keyThemes: ['Гуманизм', 'История', 'Совесть'],
    coverColor: '#641E16',
  },
  {
    id: 'gold-18',
    title: 'Пикник на обочине',
    author: 'Аркадий и Борис Стругацкие',
    genres: ['Научная фантастика', 'Приключения', 'Философия'],
    matchScore: 95,
    reason: 'Культовый роман о Зоне Посещения и Золотом Шаре, исполняющем самые сокровенные желания.',
    description: 'Сталкер Рэдрик Шухарт рискует жизнью в смертельно опасной Зоне ради поиска артефактов иной цивилизации.',
    estimatedPages: 240,
    keyThemes: ['Желания', 'Счастье для всех', 'Опасность'],
    coverColor: '#212F3D',
  },
  {
    id: 'gold-19',
    title: 'Портрет Дориана Грея',
    author: 'Оскар Уайльд',
    genres: ['Классика', 'Мистика', 'Философия'],
    matchScore: 92,
    reason: 'Изящнейший роман об эстетике, гедонизме и необратимом разрушении человеческой души.',
    description: 'Прекрасный юноша Дориан заключает сделку: стареет и несет следы его пороков лишь живописный портрет на чердаке.',
    estimatedPages: 320,
    keyThemes: ['Красота', 'Мораль', 'Искусство'],
    coverColor: '#4A235A',
  },
  {
    id: 'gold-20',
    title: 'Три товарища',
    author: 'Эрих Мария Ремарк',
    genres: ['Классика', 'Драма', 'Романтика'],
    matchScore: 94,
    reason: 'Пронзительный гимн настоящей мужской дружбе и чистой любви на фоне потерянного поколения.',
    description: 'Трое фронтовых друзей держат автомастерскую в предвоенной Германии, пока Роберт не встречает неизлечимо больную Патрицию.',
    estimatedPages: 480,
    keyThemes: ['Дружба', 'Любовь', 'Жизнь'],
    coverColor: '#145A32',
  },
];

// Helper to generate curated fallback recommendations
function getCuratedRecommendations(existingTitles: string[], focusGenre?: string): RecommendedBookItem[] {
  const existingSet = new Set(existingTitles.map((t) => t.toLowerCase().trim()));
  
  // Filter out existing
  let pool = CURATED_GOLD_LIBRARY.filter((b) => !existingSet.has(b.title.toLowerCase().trim()));
  
  if (focusGenre && focusGenre !== 'all') {
    const genreLower = focusGenre.toLowerCase();
    pool.sort((a, b) => {
      const aMatches = a.genres.some((g) => g.toLowerCase().includes(genreLower));
      const bMatches = b.genres.some((g) => g.toLowerCase().includes(genreLower));
      if (aMatches && !bMatches) return -1;
      if (!aMatches && bMatches) return 1;
      return b.matchScore - a.matchScore;
    });
  }

  return pool.slice(0, 20);
}

// AI Book Recommendations API endpoint (Supports both GET and POST)
app.all('/api/recommendations', async (req, res) => {
  if (req.method === 'GET') {
    return res.json({
      success: true,
      message: 'AI Recommendations endpoint is healthy. Send a POST request with reader shelf data to receive recommendations.',
      sampleCount: CURATED_GOLD_LIBRARY.length,
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed. Please use POST to request recommendations.',
    });
  }

  const { books, focusGenre, mood } = (req.body || {}) as {
    books?: BookInput[];
    focusGenre?: string;
    mood?: string;
  };

  const userBooks = Array.isArray(books) ? books : [];
  const existingTitles = userBooks.map((b) => (b.title || '').toLowerCase().trim()).filter(Boolean);

  try {
    // Construct rich reader profile
    const completedBooks = userBooks.filter((b) => b.status === 'completed' || (b.rating && b.rating > 0));
    const highRatedBooks = userBooks.filter((b) => b.rating && b.rating >= 8);

    let profileSummary = '';
    if (completedBooks.length > 0) {
      profileSummary += 'ПРОЧИТАННЫЕ КНИГИ И ОЦЕНКИ ПОЛЬЗОВАТЕЛЯ:\n';
      completedBooks.slice(0, 30).forEach((b) => {
        const ratingStr = b.rating ? ` [Оценка: ${b.rating}/10★]` : '';
        const genresStr = b.genres?.length ? ` (Жанры: ${b.genres.join(', ')})` : '';
        profileSummary += `• «${b.title}» — ${b.authors?.join(', ') || 'Автор'}${ratingStr}${genresStr}\n`;
      });
    }

    if (highRatedBooks.length > 0) {
      profileSummary += '\nЛЮБИМЫЕ КНИГИ С ВЫСШИМ БАЛЛОМ (8-10★):\n';
      highRatedBooks.slice(0, 15).forEach((b) => {
        profileSummary += `★ «${b.title}» (${b.authors?.join(', ') || 'Автор'})\n`;
      });
    }

    let genreFocusStr = '';
    if (focusGenre && focusGenre !== 'all') {
      genreFocusStr = `\nОсобое пожелание: сделай акцент на жанре «${focusGenre}» или близких направлениях.\n`;
    }

    let moodStr = '';
    if (mood && mood !== 'all') {
      moodStr = `\nНастроение для чтения: ${mood}.\n`;
    }

    const prompt = `Ты — первоклассный литературный критик, эрудированный библиотекарь и рекомендательный алгоритм нового поколения.
Перед тобой профиль читателя и его личная библиотека:

${profileSummary || 'Библиотека читателя пока только формируется. Предложи универсальный золотой фонд выдающихся книг разных жанров.'}
${genreFocusStr}${moodStr}

Сформируй персональный ТОП-20 книг, которые с наибольшей вероятностью понравятся этому читателю.

ПРАВИЛА И КРИТЕРИИ:
1. Выдай РОВНО 20 уникальных книг в порядке релевантности (от наивысшей совместимости к высокой).
2. СТРОГО НЕ ВКЛЮЧАЙ книги, которые УЖЕ есть в библиотеке пользователя (названия: ${existingTitles.join(', ')}).
3. Персонализация: обоснование ("reason") должно четко и понятно объяснять, почему книга подойдет именно этому читателю с отсылкой к его оцененным книгам, авторам или темам.
4. Разнообразие: сочетай признанную классику, современные интеллектуальные бестселлеры и жанровые шедевры.
5. Для каждой книги подбери благородный hex-код переплета для обложки ("coverColor"), подходящий атмосфере книги.

Формат ответа: СТРОГО валидный JSON-массив из 20 объектов со следующими ключами:
[
  {
    "id": "rec-1",
    "title": "Название книги на русском языке",
    "author": "Имя Фамилия автора",
    "genres": ["Основной жанр", "Дополнительный жанр"],
    "matchScore": 98,
    "reason": "Персональная причина рекомендации для этого читателя (1-2 емких предложения)",
    "description": "Краткая интригующая аннотация сюжета и ключевых тем (2 предложения)",
    "estimatedPages": 450,
    "keyThemes": ["Тема1", "Тема2", "Тема3"],
    "coverColor": "#2C3E50"
  }
]`;

    // Fast generation using gemini-3.1-flash-lite
    // Wrap with timeout to guarantee swift response and prevent hanging
    const generateWithTimeout = async () => {
      const callPromise = ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI generation timeout after 15s')), 15000)
      );

      return (await Promise.race([callPromise, timeoutPromise])) as any;
    };

    let response: any = null;
    try {
      response = await generateWithTimeout();
    } catch (apiErr: any) {
      console.warn('Primary Gemini call error or timeout, trying fallback flash model:', apiErr?.message);
      try {
        response = await ai.models.generateContent({
          model: 'gemini-flash-latest',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });
      } catch (fallbackErr: any) {
        console.warn('Fallback Gemini call also failed, using curated literary engine:', fallbackErr?.message);
      }
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

    // If Gemini failed or returned empty, seamlessly provide curated recommendations
    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      console.info('Serving curated literary recommendations fallback');
      recommendations = getCuratedRecommendations(existingTitles, focusGenre);
    }

    // Ensure valid IDs and normalized structures
    const normalized = recommendations.map((item: any, idx: number) => ({
      id: item.id || `rec-${Date.now()}-${idx + 1}`,
      title: String(item.title || 'Рекомендуемая книга'),
      author: String(item.author || 'Автор'),
      genres: Array.isArray(item.genres) && item.genres.length > 0 ? item.genres : ['Художественная литература'],
      matchScore: typeof item.matchScore === 'number' ? Math.min(99, Math.max(70, Math.round(item.matchScore))) : Math.max(75, 96 - idx),
      reason: String(item.reason || 'Отлично подходит под ваши читательские вкусы и предпочтения.'),
      description: String(item.description || 'Увлекательное литературное произведение с глубоким смыслом.'),
      estimatedPages: typeof item.estimatedPages === 'number' ? item.estimatedPages : 380,
      keyThemes: Array.isArray(item.keyThemes) && item.keyThemes.length > 0 ? item.keyThemes : ['Литература'],
      coverColor: typeof item.coverColor === 'string' && item.coverColor.startsWith('#') ? item.coverColor : '#2C3E50',
    }));

    return res.json({
      success: true,
      count: normalized.length,
      recommendations: normalized,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('AI Recommendations API error:', error);
    // Even on unexpected error, provide curated recommendations so user NEVER experiences 500
    const fallbackList = getCuratedRecommendations(existingTitles, focusGenre);
    return res.json({
      success: true,
      isFallback: true,
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
      server: { middlewareMode: true },
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
