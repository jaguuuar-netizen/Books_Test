import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { Book } from '../../types/book';
import { 
  Sparkles, 
  BookOpen, 
  Plus, 
  Check, 
  RefreshCw, 
  Search, 
  SlidersHorizontal, 
  Star, 
  Compass, 
  Lock, 
  Cloud, 
  Bookmark, 
  ExternalLink,
  Flame,
  X,
  BookMarked
} from 'lucide-react';

export interface RecommendedBook {
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

interface RecommendationsViewProps {
  books: Book[];
  currentUser?: User | any | null;
  onOpenAuthModal?: () => void;
  onAddBookToLibrary: (newBook: Partial<Book>) => Promise<void>;
  onSelectBook?: (book: Book) => void;
}

const READING_MOODS = [
  { id: 'all', label: 'Любое настроение' },
  { id: 'Интеллектуальное и глубокое', label: '🧠 Глубокое' },
  { id: 'Захватывающее и динамичное', label: '⚡ Динамичное' },
  { id: 'Философское и созерцательное', label: '🌿 Философское' },
  { id: 'Тёмное, таинственное и напряжённое', label: '🕵️ Тёмное / Нуар' },
  { id: 'Вдохновляющее и жизнеутверждающее', label: '✨ Вдохновляющее' },
];

const CLIENT_GOLD_LIBRARY: RecommendedBook[] = [
  {
    id: 'client-rec-1',
    title: '1984',
    author: 'Джордж Оруэлл',
    genres: ['Антиутопия', 'Фантастика', 'Классика'],
    matchScore: 98,
    reason: 'Глубокое исследование природы власти, свободы слова и индивидуальности.',
    description: 'Мир Океании под контролем Старшего Брата, где бунт начинается с запретного дневника.',
    estimatedPages: 320,
    keyThemes: ['Свобода', 'Правда', 'Бунт'],
    coverColor: '#2C3E50',
  },
  {
    id: 'client-rec-2',
    title: 'Мастер и Маргарита',
    author: 'Михаил Булгаков',
    genres: ['Классика', 'Мистика', 'Философия'],
    matchScore: 99,
    reason: 'Непревзойденный шедевр мировой литературы о любви, преданности и воздаянии.',
    description: 'В Москве появляется свита Воланда, раскрывая тайные пороки горожан и возвеличивая верность.',
    estimatedPages: 480,
    keyThemes: ['Истина', 'Любовь', 'Справедливость'],
    coverColor: '#4A1521',
  },
  {
    id: 'client-rec-3',
    title: 'Цветы для Элджернона',
    author: 'Дэниел Киз',
    genres: ['Научная фантастика', 'Психология', 'Драма'],
    matchScore: 97,
    reason: 'Эмоционально мощная история о ценности доброты и человеческого сердца над чистым разумом.',
    description: 'Чарли Гордон проходит через уникальный эксперимент, заставляющий переосмыслить человеческие отношения.',
    estimatedPages: 320,
    keyThemes: ['Интеллект', 'Сочувствие', 'Одиночество'],
    coverColor: '#5C3D2E',
  },
  {
    id: 'client-rec-4',
    title: 'О дивный новый мир',
    author: 'Олдос Хаксли',
    genres: ['Антиутопия', 'Фантастика', 'Философия'],
    matchScore: 96,
    reason: 'Блестящее визионерское предупреждение о ловушках бездумного потребительства.',
    description: 'Идеальный механизированный мир, где стандартизировано всё — вплоть до человеческих эмоций.',
    estimatedPages: 288,
    keyThemes: ['Индивидуальность', 'Технологии', 'Смысл жизни'],
    coverColor: '#1B4965',
  },
  {
    id: 'client-rec-5',
    title: 'Дюна',
    author: 'Фрэнк Герберт',
    genres: ['Научная фантастика', 'Космоопера', 'Приключения'],
    matchScore: 96,
    reason: 'Эпическая сага об Арракисе, геополитике будущего и бремени избранности.',
    description: 'Юный Пол Атрейдес оказывается в центре борьбы за контроль над источником пряности во Вселенной.',
    estimatedPages: 704,
    keyThemes: ['Власть', 'Экология', 'Судьба'],
    coverColor: '#C47335',
  },
  {
    id: 'client-rec-6',
    title: 'Сто лет одиночества',
    author: 'Габриэль Гарсиа Маркес',
    genres: ['Магический реализм', 'Классика', 'Драма'],
    matchScore: 95,
    reason: 'Поэтичный и завораживающий эпос о бесконечном круговороте человеческих страстей.',
    description: 'Хроника семи поколений семьи Буэндиа в мифическом городке Макондо.',
    estimatedPages: 480,
    keyThemes: ['Семья', 'Одиночество', 'Время'],
    coverColor: '#B07D62',
  },
  {
    id: 'client-rec-7',
    title: 'Мы',
    author: 'Евгений Замятин',
    genres: ['Антиутопия', 'Фантастика', 'Классика'],
    matchScore: 94,
    reason: 'Краеугольный камень жанра антиутопии, написанный выразительным экспрессивным языком.',
    description: 'Строитель космического корабля «Интеграл» неожиданно для себя обнаруживает в душе зарождение любви.',
    estimatedPages: 224,
    keyThemes: ['Логика', 'Чувства', 'Свобода'],
    coverColor: '#34495E',
  },
  {
    id: 'client-rec-8',
    title: 'Убить пересмешника',
    author: 'Харпер Ли',
    genres: ['Классика', 'Драма', 'Воспитание'],
    matchScore: 95,
    reason: 'Трогательный роман о воспитании чести, совести и защите невинных.',
    description: 'Аттикус Финч берется защищать обвиненного Тома Робинсона, подавая пример своим детям.',
    estimatedPages: 416,
    keyThemes: ['Справедливость', 'Честность', 'Детство'],
    coverColor: '#2B580C',
  },
  {
    id: 'client-rec-9',
    title: '451° по Фаренгейту',
    author: 'Рэй Брэдбери',
    genres: ['Антиутопия', 'Фантастика', 'Философия'],
    matchScore: 95,
    reason: 'Вдохновенная ода книгам, живому человеческому общению и памяти поколений.',
    description: 'Гай Монтэг прозревает и решает спасти крупицы всемирной мудрости от сожжения.',
    estimatedPages: 256,
    keyThemes: ['Книги', 'Память', 'Пробуждение'],
    coverColor: '#873600',
  },
  {
    id: 'client-rec-10',
    title: 'Преступление и наказание',
    author: 'Фёдор Достоевский',
    genres: ['Классика', 'Психология', 'Философия'],
    matchScore: 97,
    reason: 'Грандиозный психологический роман об испытании совести и спасительной силе любви.',
    description: 'Раскольников решается переступить черту, но бремя содеянного оказывается тяжелее любых теорий.',
    estimatedPages: 576,
    keyThemes: ['Совесть', 'Гордыня', 'Искупление'],
    coverColor: '#1C2833',
  },
  {
    id: 'client-rec-11',
    title: 'Автостопом по галактике',
    author: 'Дуглас Адамс',
    genres: ['Фантастика', 'Юмор', 'Приключения'],
    matchScore: 92,
    reason: 'Легендарное чувство юмора, британская ирония и философский оптимизм.',
    description: 'Невероятные космические приключения Артура Дента с путеводителем и полотенцем.',
    estimatedPages: 320,
    keyThemes: ['Ирония', 'Космос', '42'],
    coverColor: '#117A65',
  },
  {
    id: 'client-rec-12',
    title: 'Мартин Иден',
    author: 'Джек Лондон',
    genres: ['Классика', 'Драма', 'Биография'],
    matchScore: 93,
    reason: 'Мощнейшая история железного упорства, самообразования и цены успеха.',
    description: 'Матрос поднимается из низов общества к вершинам литературного олимпа ради любви.',
    estimatedPages: 448,
    keyThemes: ['Труд', 'Воля', 'Разочарование'],
    coverColor: '#512E5F',
  },
  {
    id: 'client-rec-13',
    title: 'Sapiens. Краткая история человечества',
    author: 'Юваль Ной Харари',
    genres: ['Нон-фикшн', 'История', 'Наука'],
    matchScore: 94,
    reason: 'Увлекательный масштабный анализ происхождения человеческих идей и верований.',
    description: 'Как эволюция языка, мифов и денег сформировала современную цивилизацию.',
    estimatedPages: 512,
    keyThemes: ['Эволюция', 'Общество', 'Будущее'],
    coverColor: '#196F3D',
  },
  {
    id: 'client-rec-14',
    title: 'Маленький принц',
    author: 'Антуан де Сент-Экзюпери',
    genres: ['Классика', 'Притча', 'Философия'],
    matchScore: 96,
    reason: 'Бессмертная притча о дружбе, верности и умении видеть мир сердцем.',
    description: 'Встреча в пустыне Сахара с мальчиком с далекого астероида, любящим единственную розу.',
    estimatedPages: 112,
    keyThemes: ['Сердце', 'Дружба', 'Ответственность'],
    coverColor: '#B7950B',
  },
  {
    id: 'client-rec-15',
    title: 'Трудно быть богом',
    author: 'Аркадий и Борис Стругацкие',
    genres: ['Научная фантастика', 'Философия', 'Классика'],
    matchScore: 95,
    reason: 'Острая этическая драма о роли интеллигенции и сохранении гуманизма.',
    description: 'Землянин Румата на средневековой планете разрывается между долгом нейтралитета и состраданием.',
    estimatedPages: 256,
    keyThemes: ['Гуманизм', 'Совесть', 'История'],
    coverColor: '#641E16',
  },
  {
    id: 'client-rec-16',
    title: 'Пикник на обочине',
    author: 'Аркадий и Борис Стругацкие',
    genres: ['Научная фантастика', 'Приключения', 'Философия'],
    matchScore: 95,
    reason: 'Культовое произведение о таинственной Зоне и самом сокровенном человеческом желании.',
    description: 'Сталкер Рэдрик Шухарт ищет в Зоне Золотой шар: «Счастье для всех, даром, и пусть никто не уйдет обиженным!».',
    estimatedPages: 240,
    keyThemes: ['Судьба', 'Мечта', 'Выбор'],
    coverColor: '#212F3D',
  },
  {
    id: 'client-rec-17',
    title: 'Портрет Дориана Грея',
    author: 'Оскар Уайльд',
    genres: ['Классика', 'Мистика', 'Философия'],
    matchScore: 93,
    reason: 'Элегантное кружево афоризмов о цене вечной молодости и скрытых пороках.',
    description: 'Юный Дориан сохраняет неземную красоту, пока его портрет отражает растление души.',
    estimatedPages: 320,
    keyThemes: ['Искусство', 'Красота', 'Мораль'],
    coverColor: '#4A235A',
  },
  {
    id: 'client-rec-18',
    title: 'Три товарища',
    author: 'Эрих Мария Ремарк',
    genres: ['Классика', 'Драма', 'Романтика'],
    matchScore: 94,
    reason: 'Пронзительный роман о неподдельной дружбе и хрупком счастье.',
    description: 'История трех фронтовых друзей и трогательной любви Роберта и Пат.',
    estimatedPages: 480,
    keyThemes: ['Дружба', 'Любовь', 'Жизнь'],
    coverColor: '#145A32',
  },
  {
    id: 'client-rec-19',
    title: 'Шерлок Холмс. Собрание повестей',
    author: 'Артур Конан Дойл',
    genres: ['Детектив', 'Классика', 'Приключения'],
    matchScore: 93,
    reason: 'Эталон детективной логики, викторианской атмосферы и дружбы.',
    description: 'Гениальный сыщик с Бейкер-стрит расследует сложнейшие загадки Лондона.',
    estimatedPages: 560,
    keyThemes: ['Логика', 'Дедукция', 'Правосудие'],
    coverColor: '#34495E',
  },
  {
    id: 'client-rec-20',
    title: 'Атлант расправил плечи',
    author: 'Айн Рэнд',
    genres: ['Философия', 'Драма', 'Антиутопия'],
    matchScore: 90,
    reason: 'Масштабная философская антиутопия об энергии созидания и разуме.',
    description: 'Что случится с цивилизацией, если творцы и предприниматели откажутся нести мир на своих плечах?',
    estimatedPages: 1392,
    keyThemes: ['Разум', 'Творчество', 'Свобода'],
    coverColor: '#283747',
  },
];

function getClientFallbackRecommendations(
  userBooks: Book[],
  focusGenre?: string,
  mood?: string
): RecommendedBook[] {
  const existingTitles = new Set(userBooks.map((b) => b.title.toLowerCase().trim()));
  let list = CLIENT_GOLD_LIBRARY.filter((b) => !existingTitles.has(b.title.toLowerCase().trim()));

  if (focusGenre && focusGenre !== 'all') {
    const fLower = focusGenre.toLowerCase();
    list.sort((a, b) => {
      const aMatches = a.genres.some((g) => g.toLowerCase().includes(fLower));
      const bMatches = b.genres.some((g) => g.toLowerCase().includes(fLower));
      if (aMatches && !bMatches) return -1;
      if (!aMatches && bMatches) return 1;
      return b.matchScore - a.matchScore;
    });
  }

  return list.slice(0, 20);
}

export const RecommendationsView: React.FC<RecommendationsViewProps> = ({
  books,
  currentUser,
  onOpenAuthModal,
  onAddBookToLibrary,
  onSelectBook,
}) => {
  const [recommendations, setRecommendations] = useState<RecommendedBook[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [selectedMood, setSelectedMood] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);
  const [addedBookTitles, setAddedBookTitles] = useState<Set<string>>(new Set());
  const [addingTitle, setAddingTitle] = useState<string | null>(null);

  const storageKey = useMemo(() => {
    return currentUser?.uid ? `my_book_shelf_ai_recs_${currentUser.uid}` : 'my_book_shelf_ai_recs_guest';
  }, [currentUser]);

  // Load cached recommendations from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
            setRecommendations(parsed.recommendations);
            setLastGeneratedAt(parsed.generatedAt || null);
          }
        }
      } catch {}
    }
  }, [storageKey]);

  // Track which recommended books are already present in the user's library
  const libraryTitlesSet = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => set.add(b.title.toLowerCase().trim()));
    return set;
  }, [books]);

  // Generate recommendations via backend Gemini API with instant client fallback
  const handleGenerateRecommendations = async (overrideMood?: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    const activeMood = overrideMood !== undefined ? overrideMood : selectedMood;

    try {
      const response = await fetch('/api/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          books: books.map((b) => ({
            id: b.id,
            title: b.title,
            authors: b.authors,
            status: b.status,
            rating: b.rating,
            genres: b.genres,
            notes: b.notes,
            pages: b.pages,
          })),
          focusGenre: selectedGenre,
          mood: activeMood,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.recommendations) && data.recommendations.length > 0) {
          setRecommendations(data.recommendations);
          setLastGeneratedAt(data.generatedAt || new Date().toISOString());

          try {
            localStorage.setItem(
              storageKey,
              JSON.stringify({
                recommendations: data.recommendations,
                generatedAt: data.generatedAt || new Date().toISOString(),
              })
            );
          } catch {}
          return;
        }
      }

      // If server returned non-200 or empty, use graceful fallback
      console.warn('API returned non-OK status, activating curated literary engine');
      const fallbackList = getClientFallbackRecommendations(books, selectedGenre, activeMood);
      setRecommendations(fallbackList);
      const now = new Date().toISOString();
      setLastGeneratedAt(now);
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            recommendations: fallbackList,
            generatedAt: now,
          })
        );
      } catch {}
    } catch (err: any) {
      console.warn('Failed to fetch AI recommendations, activating curated literary engine:', err);
      const fallbackList = getClientFallbackRecommendations(books, selectedGenre, activeMood);
      setRecommendations(fallbackList);
      const now = new Date().toISOString();
      setLastGeneratedAt(now);
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            recommendations: fallbackList,
            generatedAt: now,
          })
        );
      } catch {}
    } finally {
      setIsLoading(false);
    }
  };

  // Add recommended book to user's library with 1 click
  const handleQuickAdd = async (rec: RecommendedBook) => {
    setAddingTitle(rec.title);
    try {
      await onAddBookToLibrary({
        title: rec.title,
        authors: [rec.author],
        status: 'reading',
        genres: rec.genres,
        pages: rec.estimatedPages,
        coverColor: rec.coverColor,
        notes: `Рекомендовано ИИ (${rec.matchScore}% совпадение):\n${rec.reason}`,
      });
      setAddedBookTitles((prev) => new Set(prev).add(rec.title));
    } catch (err) {
      console.error('Failed to add book to library:', err);
    } finally {
      setAddingTitle(null);
    }
  };

  // Extract unique genres across recommendations for filtering
  const recommendationGenres = useMemo(() => {
    const set = new Set<string>();
    recommendations.forEach((r) => r.genres.forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [recommendations]);

  // Filter recommendations based on search & genre
  const filteredRecommendations = useMemo(() => {
    return recommendations.filter((item) => {
      // Genre filter
      if (selectedGenre !== 'all' && !item.genres.includes(selectedGenre)) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesAuthor = item.author.toLowerCase().includes(q);
        const matchesReason = item.reason.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesTheme = item.keyThemes.some((t) => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesAuthor && !matchesReason && !matchesDesc && !matchesTheme) {
          return false;
        }
      }

      return true;
    });
  }, [recommendations, selectedGenre, searchQuery]);

  // Auth lock screen for unauthenticated visitors
  if (!currentUser) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 sm:py-24 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[#EFE9DF] flex items-center justify-center text-[#8A5A36] shadow-inner">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-display font-semibold text-[#24211D]">
          Персональные ИИ-рекомендации
        </h2>
        <p className="mt-3 text-sm sm:text-base text-[#6B6357] max-w-lg mx-auto leading-relaxed">
          Искусственный интеллект анализирует книги в вашей личной библиотеке, ваши оценки и заметки, чтобы подобрать персональный ТОП-20 книг, которые с наибольшей вероятностью вам понравятся.
        </p>
        <div className="mt-8 flex items-center justify-center">
          <button
            onClick={onOpenAuthModal}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-[#FAF8F5] bg-[#24211D] rounded-md hover:bg-[#3B342C] transition-colors shadow-sm"
          >
            <Cloud className="w-4 h-4 text-[#EFE9DF]" />
            <span>Войти через Google</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E8E2D8]">
        <div>
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-[#8A5A36]" />
            <h1 className="text-2xl sm:text-3xl font-display font-semibold text-[#24211D]">
              Персональные рекомендации
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[#6B6357]">
            ИИ подбирает персональный ТОП-20 книг на основе ваших прочитанных произведений, оценок и любимых жанров
          </p>
        </div>

        {/* Generate / Refresh button */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => handleGenerateRecommendations()}
            disabled={isLoading}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md shadow-xs transition-all ${
              isLoading
                ? 'bg-[#EFE9DF] text-[#7A7265] cursor-not-allowed'
                : 'bg-[#24211D] hover:bg-[#3B342C] text-[#FAF8F5] active:scale-98'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'ИИ подбирает книги...' : (recommendations.length > 0 ? 'Обновить ТОП-20' : 'Сгенерировать ТОП-20')}</span>
          </button>
        </div>
      </div>

      {/* Literary Taste Profile Banner */}
      <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-[#EFE9DF] border border-[#DDD5C7] flex items-center justify-center shrink-0 text-[#8A5A36]">
            <Compass className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A5A36] font-semibold bg-[#EAE2D5] px-2 py-0.5 rounded">
                Литературный радар
              </span>
              <span className="text-xs text-[#7A7265] font-mono">
                {books.length} {books.length === 1 ? 'книга в базе' : 'книг в базе'}
              </span>
            </div>
            <p className="text-xs text-[#3B342C] mt-1">
              {books.length > 0 ? (
                <>
                  Рекомендации строятся на основе ваших любимых авторов ({books.slice(0, 3).map((b) => b.authors[0]).filter(Boolean).join(', ')}) и оценок.
                </>
              ) : (
                'Добавьте свои прочитанные книги, чтобы ИИ мог изучить ваш литературный вкус еще точнее.'
              )}
            </p>
          </div>
        </div>

        {lastGeneratedAt && (
          <div className="text-[11px] font-mono text-[#8A8172] shrink-0 self-end md:self-center">
            Сформировано: {new Date(lastGeneratedAt).toLocaleDateString('ru-RU')}
          </div>
        )}
      </div>

      {/* Control Bar: Mood Selector, Genre Filter & Search */}
      <div className="space-y-2.5 bg-[#FAF8F5] p-3 sm:p-3.5 border border-[#E8E2D8] rounded-lg">
        {/* Mood selection row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
          <span className="text-[11px] text-[#7A7265] font-medium uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-[#8A5A36]" /> Настроение:
          </span>
          {READING_MOODS.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setSelectedMood(m.id);
                if (recommendations.length > 0) {
                  // User chose a new mood: trigger refresh with chosen mood
                  handleGenerateRecommendations(m.id);
                }
              }}
              className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap text-xs ${
                selectedMood === m.id
                  ? 'bg-[#24211D] text-[#FAF8F5] font-semibold shadow-xs'
                  : 'bg-[#EFE9DF] text-[#6B6357] hover:text-[#24211D]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Genre filters + Search bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-[#E8E2D8]">
          {/* Genre Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs scrollbar-none">
            <button
              onClick={() => setSelectedGenre('all')}
              className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap font-medium ${
                selectedGenre === 'all'
                  ? 'bg-[#24211D] text-[#FAF8F5]'
                  : 'bg-[#EFE9DF] text-[#6B6357] hover:text-[#24211D]'
              }`}
            >
              Все направления ({recommendations.length})
            </button>
            {recommendationGenres.map((g) => (
              <button
                key={g}
                onClick={() => setSelectedGenre(g)}
                className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${
                  selectedGenre === g
                    ? 'bg-[#24211D] text-[#FAF8F5] font-medium'
                    : 'bg-[#EFE9DF] text-[#6B6357] hover:text-[#24211D]'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-56 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A8172]" />
            <input
              type="text"
              placeholder="Поиск в ТОП-20..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#FAF8F5] border border-[#DDD5C7] rounded pl-8 pr-7 py-1 text-xs text-[#24211D] focus:outline-none focus:border-[#24211D]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8A8172] hover:text-[#24211D]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ERROR MESSAGE IF ANY */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center justify-between gap-3">
          <span>{errorMessage}</span>
          <button
            onClick={() => handleGenerateRecommendations()}
            className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded font-semibold text-xs transition-colors shrink-0"
          >
            Попробовать снова
          </button>
        </div>
      )}

      {/* LOADING STATE */}
      {isLoading ? (
        <div className="py-20 px-4 text-center border border-dashed border-[#DDD5C7] rounded-xl bg-[#F7F4EF] space-y-4 max-w-lg mx-auto my-8">
          <div className="w-12 h-12 rounded-full bg-[#EFE9DF] border border-[#D9CDB8] flex items-center justify-center mx-auto text-[#8A5A36]">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-base sm:text-lg text-[#24211D]">
              ИИ формирует персональный ТОП-20
            </h3>
            <p className="mt-1.5 text-xs text-[#6B6357] leading-relaxed">
              Анализируем ваши любимые произведения, любимых авторов, жанровые пересечения и ключевые темы...
            </p>
          </div>
          <div className="w-48 h-1.5 bg-[#EFE9DF] rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-[#8A5A36] rounded-full animate-indeterminate" />
          </div>
        </div>
      ) : recommendations.length === 0 ? (
        /* FIRST TIME EMPTY CALL TO ACTION */
        <div className="py-20 px-4 text-center border border-dashed border-[#DDD5C7] rounded-xl bg-[#F7F4EF] max-w-xl mx-auto my-8 shadow-xs space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-[#EFE9DF] border border-[#D9CDB8] flex items-center justify-center mx-auto text-[#8A5A36] shadow-sm">
            <Sparkles className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-xl text-[#24211D]">
              Готовы узнать свои идеальные книги?
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-[#6B6357] max-w-md mx-auto leading-relaxed">
              Нажмите кнопку ниже, и нейросеть мгновенно подберёт 20 шедевров мировой литературы, идеально резонирующих с вашим читательским дневником.
            </p>
          </div>
          <button
            onClick={() => handleGenerateRecommendations()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#24211D] hover:bg-[#3B342C] text-white rounded-lg font-semibold text-sm transition-all shadow-md active:scale-98"
          >
            <Sparkles className="w-4 h-4 text-amber-200" />
            <span>Сформировать персональный ТОП-20</span>
          </button>
        </div>
      ) : filteredRecommendations.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-[#DDD5C7] rounded-lg bg-[#F7F4EF]">
          <Search className="w-8 h-8 mx-auto text-[#8A8172] mb-3" />
          <h3 className="text-base font-display font-medium text-[#24211D]">
            Ни одна книга из ТОП-20 не подошла под выбранные фильтры
          </h3>
          <p className="mt-1 text-xs text-[#6B6357] max-w-sm mx-auto">
            Попробуйте выбрать другое направление или очистить поисковый запрос.
          </p>
          <button
            onClick={() => {
              setSelectedGenre('all');
              setSearchQuery('');
            }}
            className="mt-4 px-3 py-1.5 text-xs font-medium text-[#24211D] bg-[#EFE9DF] hover:bg-[#E4DCCE] rounded transition-colors"
          >
            Сбросить фильтры
          </button>
        </div>
      ) : (
        /* THE TOP 20 RECOMMENDATIONS CARDS */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {filteredRecommendations.map((book, idx) => {
            const isAlreadyInLibrary = libraryTitlesSet.has(book.title.toLowerCase().trim()) || addedBookTitles.has(book.title);
            const isAdding = addingTitle === book.title;

            return (
              <div
                key={book.id || idx}
                className="relative bg-[#FAF8F5] border border-[#E8E2D8] rounded-xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group overflow-hidden"
              >
                {/* Top Section: Rank, Title, Author, Match Score */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {/* Stylized Book Spine / Cover Mockup */}
                      <div 
                        className="w-11 h-16 sm:w-13 sm:h-18 rounded-[3px] shadow-md shrink-0 p-1.5 flex flex-col justify-between text-white relative overflow-hidden"
                        style={{ backgroundColor: book.coverColor }}
                      >
                        <div className="absolute top-0 left-0 bottom-0 w-1 bg-white/20" />
                        <span className="text-[7px] uppercase tracking-wider font-mono opacity-70 line-clamp-1">
                          {book.genres[0]}
                        </span>
                        <p className="text-[8px] font-serif font-bold line-clamp-2 leading-tight">
                          {book.title}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-[#8A5A36] bg-[#EFE9DF] px-1.5 py-0.5 rounded">
                            #{idx + 1} в топе
                          </span>
                          <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold">
                            {book.matchScore}% совпадение
                          </span>
                        </div>
                        <h3 className="font-display font-semibold text-base sm:text-lg text-[#24211D] mt-1 leading-snug">
                          {book.title}
                        </h3>
                        <p className="text-xs text-[#7A7265] mt-0.5 font-medium">
                          {book.author}
                        </p>
                      </div>
                    </div>

                    {/* Quick Add Button */}
                    <button
                      onClick={() => handleQuickAdd(book)}
                      disabled={isAlreadyInLibrary || isAdding}
                      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        isAlreadyInLibrary
                          ? 'bg-[#EBF3EC] text-[#204028] border border-[#CDE1CD] cursor-default'
                          : 'bg-[#24211D] hover:bg-[#3B342C] text-white shadow-xs active:scale-95'
                      }`}
                      title={isAlreadyInLibrary ? 'Книга уже есть в вашей библиотеке' : 'Добавить в список для чтения'}
                    >
                      {isAlreadyInLibrary ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="hidden sm:inline">В библиотеке</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>{isAdding ? '...' : '+ Читать'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Why it matches (Reason callout) */}
                  <div className="mt-3 p-2.5 rounded-lg bg-[#F5EFE6] border border-[#EAE0D2] text-xs text-[#4A3D2E] leading-relaxed">
                    <span className="font-semibold text-[#8A5A36] block mb-0.5">
                      💡 Почему вам понравится:
                    </span>
                    {book.reason}
                  </div>

                  {/* Description preview */}
                  <p className="mt-2.5 text-xs text-[#6B6357] leading-relaxed line-clamp-3">
                    {book.description}
                  </p>
                </div>

                {/* Bottom metadata tags */}
                <div className="mt-4 pt-3 border-t border-[#E8E2D8] flex items-center justify-between text-[11px] text-[#7A7265] font-mono">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {book.keyThemes.map((theme, tIdx) => (
                      <span key={tIdx} className="bg-[#EFE9DF] px-2 py-0.5 rounded text-[10px] text-[#5C5446]">
                        #{theme}
                      </span>
                    ))}
                  </div>

                  <span className="shrink-0 text-[#8A8172]">
                    ~{book.estimatedPages} стр.
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
