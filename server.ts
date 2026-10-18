import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

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

// AI Book Recommendations API endpoint
app.post('/api/recommendations', async (req, res) => {
  try {
    const { books, focusGenre, mood } = req.body as { 
      books?: BookInput[]; 
      focusGenre?: string; 
      mood?: string;
    };

    const userBooks = Array.isArray(books) ? books : [];
    
    // Construct rich reader profile
    const completedBooks = userBooks.filter((b) => b.status === 'completed' || (b.rating && b.rating > 0));
    const highRatedBooks = userBooks.filter((b) => b.rating && b.rating >= 8);
    const existingTitles = userBooks.map((b) => b.title.toLowerCase().trim());

    let profileSummary = '';
    if (completedBooks.length > 0) {
      profileSummary += 'ПРОЧИТАННЫЕ КНИГИ И ОЦЕНКИ ПОЛЬЗОВАТЕЛЯ:\n';
      completedBooks.forEach((b) => {
        const ratingStr = b.rating ? ` [Оценка: ${b.rating}/10★]` : '';
        const genresStr = b.genres?.length ? ` (Жанры: ${b.genres.join(', ')})` : '';
        const notesStr = b.notes ? ` — Заметка: "${b.notes.slice(0, 100)}..."` : '';
        profileSummary += `• «${b.title}» — ${b.authors.join(', ')}${ratingStr}${genresStr}${notesStr}\n`;
      });
    }

    if (highRatedBooks.length > 0) {
      profileSummary += '\nЛЮБИМЫЕ КНИГИ С ВЫСШИМ БАЛЛОМ (8-10★):\n';
      highRatedBooks.forEach((b) => {
        profileSummary += `★ «${b.title}» (${b.authors.join(', ')})\n`;
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

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '[]';
    let recommendations = [];
    try {
      recommendations = JSON.parse(responseText);
    } catch {
      // In case wrapped in markdown code blocks
      const clean = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      recommendations = JSON.parse(clean);
    }

    if (!Array.isArray(recommendations)) {
      recommendations = [];
    }

    // Ensure valid IDs
    const normalized = recommendations.map((item: any, idx: number) => ({
      id: item.id || `rec-${Date.now()}-${idx + 1}`,
      title: String(item.title || 'Рекомендуемая книга'),
      author: String(item.author || 'Автор'),
      genres: Array.isArray(item.genres) ? item.genres : ['Художественная литература'],
      matchScore: typeof item.matchScore === 'number' ? Math.min(99, Math.max(70, Math.round(item.matchScore))) : 90 - idx,
      reason: String(item.reason || 'Отлично подходит под ваши читательские вкусы.'),
      description: String(item.description || 'Увлекательное произведение с глубоким смыслом.'),
      estimatedPages: typeof item.estimatedPages === 'number' ? item.estimatedPages : 380,
      keyThemes: Array.isArray(item.keyThemes) ? item.keyThemes : ['Литература'],
      coverColor: typeof item.coverColor === 'string' && item.coverColor.startsWith('#') ? item.coverColor : '#2C3E50',
    }));

    res.json({
      success: true,
      count: normalized.length,
      recommendations: normalized,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('AI Recommendations API error:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Не удалось сформировать рекомендации с помощью ИИ',
    });
  }
});

// Setup Vite in development or serve static in production
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

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT} [${isProd ? 'production' : 'development'}]`);
});
