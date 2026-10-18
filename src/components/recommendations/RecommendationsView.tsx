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

  // Generate recommendations via backend Gemini API
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

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Ошибка сервера (${response.status})`);
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.recommendations) && data.recommendations.length > 0) {
        setRecommendations(data.recommendations);
        setLastGeneratedAt(data.generatedAt);

        // Cache in localStorage
        try {
          localStorage.setItem(
            storageKey,
            JSON.stringify({
              recommendations: data.recommendations,
              generatedAt: data.generatedAt,
            })
          );
        } catch {}
      } else {
        throw new Error('ИИ не вернул список книг. Попробуйте обновить запрос.');
      }
    } catch (err: any) {
      console.error('Failed to generate AI recommendations:', err);
      setErrorMessage(err.message || 'Не удалось получить рекомендации от ИИ. Проверьте соединение.');
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
