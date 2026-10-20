import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User } from 'firebase/auth';
import { Book } from '../../types/book';
import { getCuratedSimilarBooks, CuratedBook } from '../../data/curatedTop20';
import { 
  X, 
  Sparkles, 
  EyeOff, 
  Plus, 
  Check, 
  RotateCcw, 
  BookOpen, 
  RefreshCw, 
  Lock, 
  Cloud 
} from 'lucide-react';

export interface SimilarRecommendedBook {
  id: string;
  title: string;
  author: string;
  genres: string[];
  matchScore: number;
  similarityReason: string;
  description: string;
  estimatedPages: number;
  keyThemes: string[];
  coverColor: string;
  isWishlist?: boolean;
}

interface BookRecommendationsModalProps {
  targetBook: Book | null;
  isOpen: boolean;
  onClose: () => void;
  books: Book[];
  currentUser?: User | null;
  onOpenAuthModal?: () => void;
  onAddBookToLibrary: (newBook: Partial<Book>) => Promise<void>;
  onSelectBook?: (book: Book) => void;
}

export const BookRecommendationsModal: React.FC<BookRecommendationsModalProps> = ({
  targetBook,
  isOpen,
  onClose,
  books,
  currentUser,
  onOpenAuthModal,
  onAddBookToLibrary,
  onSelectBook,
}) => {
  const [recommendations, setRecommendations] = useState<SimilarRecommendedBook[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quick actions
  const [addedBookTitles, setAddedBookTitles] = useState<Set<string>>(new Set());
  const [addingTitle, setAddingTitle] = useState<string | null>(null);

  // Dismissed books
  const userPrefix = useMemo(() => {
    return currentUser?.uid ? `uid_${currentUser.uid}` : 'guest';
  }, [currentUser]);

  const dismissedStorageKey = useMemo(() => {
    return `my_book_shelf_dismissed_recs_${userPrefix}`;
  }, [userPrefix]);

  const [dismissedTitles, setDismissedTitles] = useState<string[]>([]);
  const [lastDismissedNotice, setLastDismissedNotice] = useState<{ title: string; timer?: any } | null>(null);

  // Load dismissed books
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(dismissedStorageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setDismissedTitles(parsed.map((item: any) => (typeof item === 'string' ? item : item.title).toLowerCase().trim()));
          }
        }
      } catch (e) {
        console.warn('Failed to parse dismissed titles in BookRecommendationsModal:', e);
      }
    }
  }, [dismissedStorageKey]);

  // Library maps
  const userWishlistMap = useMemo(() => {
    const map = new Map<string, Book>();
    books.forEach((b) => {
      if (b.status === 'planned') {
        map.set(b.title.toLowerCase().trim(), b);
      }
    });
    return map;
  }, [books]);

  const userCompletedTitles = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      if (b.status === 'completed') {
        set.add(b.title.toLowerCase().trim());
      }
    });
    return set;
  }, [books]);

  const userReadingTitles = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      if (b.status === 'reading') {
        set.add(b.title.toLowerCase().trim());
      }
    });
    return set;
  }, [books]);

  // Wishlist books similar to the target book (same author or overlapping genres)
  const matchingWishlistBooks = useMemo(() => {
    if (!targetBook) return [];
    const targetTitleLower = targetBook.title.toLowerCase().trim();
    const targetAuthors = targetBook.authors.map((a) => a.toLowerCase().trim());
    const targetGenres = (targetBook.genres || []).map((g) => g.toLowerCase().trim());

    return books.filter((b) => {
      if (b.status !== 'planned') return false;
      const t = b.title.toLowerCase().trim();
      if (t === targetTitleLower) return false;
      if (dismissedTitles.includes(t)) return false;

      // Author match
      if (b.authors.some((a) => targetAuthors.some((ta) => ta.includes(a.toLowerCase()) || a.toLowerCase().includes(ta)))) {
        return true;
      }
      // Genre match
      if (b.genres && b.genres.some((g) => targetGenres.some((tg) => tg.includes(g.toLowerCase()) || g.toLowerCase().includes(tg)))) {
        return true;
      }
      return false;
    });
  }, [targetBook, books, dismissedTitles]);

  // Fetch or generate recommendations for this book
  const fetchSimilarRecommendations = useCallback(async () => {
    if (!targetBook) return;
    setIsLoading(true);
    setErrorMessage(null);

    const completed = Array.from(userCompletedTitles);
    const allExcluded = Array.from(new Set([targetBook.title.toLowerCase().trim(), ...completed, ...dismissedTitles]));

    try {
      const response = await fetch('/api/book-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book: {
            title: targetBook.title,
            authors: targetBook.authors,
            genres: targetBook.genres,
            notes: targetBook.notes,
          },
          userBooks: books.map((b) => ({
            id: b.id,
            title: b.title,
            authors: b.authors,
            status: b.status,
            genres: b.genres,
            notes: b.notes,
          })),
          excludedTitles: allExcluded,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.recommendations) && data.recommendations.length > 0) {
          const clean = data.recommendations.filter(
            (r: SimilarRecommendedBook) => !dismissedTitles.includes(r.title.toLowerCase().trim())
          );
          setRecommendations(clean);
          return;
        }
      }

      // Offline / fallback to curated literary similarity
      console.warn('API returned non-OK or failed, using curated similar books fallback');
      const curated = getCuratedSimilarBooks(
        { title: targetBook.title, authors: targetBook.authors, genres: targetBook.genres },
        allExcluded
      );
      setRecommendations(curated.map((c) => ({
        ...c,
        isWishlist: userWishlistMap.has(c.title.toLowerCase().trim()),
      })));
    } catch (err: any) {
      console.warn('Failed to fetch AI book recommendations, using curated fallback:', err);
      const curated = getCuratedSimilarBooks(
        { title: targetBook.title, authors: targetBook.authors, genres: targetBook.genres },
        allExcluded
      );
      setRecommendations(curated.map((c) => ({
        ...c,
        isWishlist: userWishlistMap.has(c.title.toLowerCase().trim()),
      })));
    } finally {
      setIsLoading(false);
    }
  }, [targetBook, books, userCompletedTitles, dismissedTitles, userWishlistMap]);

  // Load recommendations whenever modal opens for a new book
  useEffect(() => {
    if (isOpen && targetBook) {
      fetchSimilarRecommendations();
    }
  }, [isOpen, targetBook?.id]);

  // Handle dismiss book ("Не рекомендовать")
  const handleDismissBook = (bookToDismiss: SimilarRecommendedBook) => {
    const titleLower = bookToDismiss.title.toLowerCase().trim();
    const updated = Array.from(new Set([...dismissedTitles, titleLower]));
    setDismissedTitles(updated);

    // Save to storage
    try {
      const raw = localStorage.getItem(dismissedStorageKey);
      let existingList: any[] = [];
      if (raw) existingList = JSON.parse(raw);
      if (!existingList.some((item) => (typeof item === 'string' ? item : item.title).toLowerCase().trim() === titleLower)) {
        existingList.push({
          title: bookToDismiss.title,
          author: bookToDismiss.author,
          dismissedAt: new Date().toISOString(),
        });
        localStorage.setItem(dismissedStorageKey, JSON.stringify(existingList));
      }
    } catch (e) {
      console.warn('Failed to save dismissed book:', e);
    }

    // Remove from active list
    setRecommendations((prev) => prev.filter((r) => r.title.toLowerCase().trim() !== titleLower));

    // Toast
    if (lastDismissedNotice?.timer) clearTimeout(lastDismissedNotice.timer);
    const timer = setTimeout(() => setLastDismissedNotice(null), 6000);
    setLastDismissedNotice({ title: bookToDismiss.title, timer });
  };

  // Restore dismissed book
  const handleRestoreBook = (titleToRestore: string) => {
    const titleLower = titleToRestore.toLowerCase().trim();
    const nextList = dismissedTitles.filter((t) => t !== titleLower);
    setDismissedTitles(nextList);

    try {
      const raw = localStorage.getItem(dismissedStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const filtered = parsed.filter((item: any) => (typeof item === 'string' ? item : item.title).toLowerCase().trim() !== titleLower);
        localStorage.setItem(dismissedStorageKey, JSON.stringify(filtered));
      }
    } catch {}

    setLastDismissedNotice(null);
    fetchSimilarRecommendations();
  };

  // Quick Add / Start Reading
  const handleQuickAdd = async (rec: SimilarRecommendedBook, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentUser) {
      onOpenAuthModal?.();
      return;
    }

    setAddingTitle(rec.title);
    try {
      const existingWishlist = userWishlistMap.get(rec.title.toLowerCase().trim());
      await onAddBookToLibrary({
        id: existingWishlist ? existingWishlist.id : undefined,
        title: rec.title,
        authors: existingWishlist?.authors?.length ? existingWishlist.authors : [rec.author],
        status: existingWishlist ? 'reading' : 'planned',
        genres: rec.genres,
        pages: rec.estimatedPages,
        coverColor: rec.coverColor,
        startDate: existingWishlist ? new Date().toISOString().split('T')[0] : undefined,
        notes: existingWishlist?.notes 
          ? `${existingWishlist.notes}\n[Начато из рекомендаций к книге «${targetBook?.title}»]`
          : `Похоже на «${targetBook?.title}» (${rec.matchScore}% совпадение):\n${rec.similarityReason}`,
      });
      setAddedBookTitles((prev) => new Set(prev).add(rec.title));
    } catch (err) {
      console.error('Failed to add book to library:', err);
    } finally {
      setAddingTitle(null);
    }
  };

  // Quick start reading from wishlist
  const handleStartReadingWishlist = async (wb: Book, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentUser) {
      onOpenAuthModal?.();
      return;
    }

    setAddingTitle(wb.title);
    try {
      await onAddBookToLibrary({
        id: wb.id,
        title: wb.title,
        authors: wb.authors,
        status: 'reading',
        genres: wb.genres,
        pages: wb.pages,
        coverColor: wb.coverColor,
        startDate: new Date().toISOString().split('T')[0],
      });
      setAddedBookTitles((prev) => new Set(prev).add(wb.title));
    } catch (err) {
      console.error('Failed to start reading wishlist book:', err);
    } finally {
      setAddingTitle(null);
    }
  };

  if (!isOpen || !targetBook) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div 
        className="relative w-full max-w-3xl bg-[#FAF8F5] border border-[#DDD5C7] rounded-xl shadow-2xl overflow-hidden my-6 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#E8E2D8] bg-[#F7F4EF]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#EAE2D5] border border-[#D9CDB8] flex items-center justify-center text-[#8A5A36] shrink-0 shadow-2xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-display font-semibold text-[#24211D] truncate">
                  Что почитать похожего на «{targetBook.title}»
                </h3>
              </div>
              <p className="text-xs text-[#7A7265] truncate">
                {targetBook.authors.join(', ')} • {targetBook.genres?.join(', ') || 'Художественная литература'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => fetchSimilarRecommendations()}
              disabled={isLoading}
              className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-medium text-[#6B6357] hover:text-[#24211D] hover:bg-[#EAE4DC] border border-transparent hover:border-[#DDD5C7] rounded-md transition-colors flex items-center gap-1.5"
              title="Обновить подборку похожих книг"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#8A5A36]' : ''}`} />
              <span className="hidden sm:inline">Обновить</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#7A7265] hover:text-[#24211D] hover:bg-[#EAE4DC] transition-colors"
              title="Закрыть рекомендации"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Undo Toast for "Не рекомендовать" */}
        {lastDismissedNotice && (
          <div className="px-5 py-2.5 bg-[#24211D] text-[#FAF8F5] text-xs flex items-center justify-between gap-3 shadow-md animate-in fade-in duration-200">
            <div className="flex items-center gap-2 truncate">
              <EyeOff className="w-4 h-4 text-amber-300 shrink-0" />
              <span className="truncate">
                Книга <strong>«{lastDismissedNotice.title}»</strong> скрыта и больше не появится в рекомендациях.
              </span>
            </div>
            <button
              onClick={() => handleRestoreBook(lastDismissedNotice.title)}
              className="px-2.5 py-1 bg-[#3B342C] hover:bg-[#4E453A] text-amber-200 rounded font-semibold text-xs transition-colors shrink-0 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Отменить</span>
            </button>
          </div>
        )}

        {/* Notice for unauthorized visitors */}
        {!currentUser && (
          <div className="bg-[#FFF8E7] border-b border-[#E8DFCF] px-6 py-2.5 flex items-center justify-between gap-3 text-xs text-[#5C4828]">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-[#8A5A36] shrink-0" />
              <span>Войдите через Google, чтобы добавлять найденные книги в личный виш-лист.</span>
            </div>
            <button
              onClick={() => {
                onClose();
                onOpenAuthModal?.();
              }}
              className="inline-flex items-center gap-1 font-semibold text-[#8A5A36] hover:text-[#5E3023] underline shrink-0 whitespace-nowrap"
            >
              <Cloud className="w-3 h-3" />
              <span>Войти</span>
            </button>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Wishlist Spotlight if user already has matching planned books */}
          {matchingWishlistBooks.length > 0 && (
            <div className="bg-gradient-to-r from-amber-50/90 via-[#FAF6EE] to-[#F5EFE6] border border-amber-200 rounded-xl p-3.5 sm:p-4 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">⭐</span>
                  <h4 className="font-display font-semibold text-xs sm:text-sm text-[#24211D]">
                    Уже есть в вашем виш-листе схожее с «{targetBook.title}» ({matchingWishlistBooks.length})
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded font-semibold hidden sm:inline">
                  В ваших планах
                </span>
              </div>
              <p className="text-[11px] text-[#6B6357]">
                Вы уже запланировали эти книги — возможно, самое время взяться за одну из них:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {matchingWishlistBooks.map((wb) => {
                  const isAddingWb = addingTitle === wb.title;
                  return (
                    <div
                      key={wb.id}
                      className="p-2.5 bg-white/95 border border-amber-200 rounded-lg flex items-center justify-between gap-2 shadow-2xs hover:border-amber-300 transition-colors"
                    >
                      <div className="min-w-0">
                        <h5 className="font-semibold text-xs text-[#24211D] truncate">
                          «{wb.title}»
                        </h5>
                        <p className="text-[11px] text-[#7A7265] truncate">
                          {wb.authors?.join(', ') || 'Автор'}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleStartReadingWishlist(wb, e)}
                        disabled={isAddingWb}
                        className="px-2.5 py-1 text-xs font-semibold text-white bg-[#8A5A36] hover:bg-[#6F4729] rounded flex items-center gap-1 shrink-0 shadow-2xs active:scale-95 transition-all"
                        title="Начать читать эту книгу из виш-листа"
                      >
                        <BookOpen className="w-3 h-3 text-amber-200" />
                        <span>{isAddingWb ? '...' : 'Начать'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading ? (
            <div className="py-16 text-center border border-dashed border-[#DDD5C7] rounded-xl bg-[#F7F4EF] space-y-3.5 max-w-md mx-auto my-4">
              <div className="w-10 h-10 rounded-full bg-[#EAE2D5] border border-[#D9CDB8] flex items-center justify-center mx-auto text-[#8A5A36]">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="font-display font-semibold text-sm sm:text-base text-[#24211D]">
                  Подбираем книги со схожей атмосферой...
                </h4>
                <p className="mt-1 text-xs text-[#7A7265] leading-relaxed max-w-xs mx-auto">
                  Анализируем авторский стиль, ключевые темы и настроение книги «{targetBook.title}»
                </p>
              </div>
              <div className="w-40 h-1.5 bg-[#EAE2D5] rounded-full mx-auto overflow-hidden">
                <div className="h-full bg-[#8A5A36] rounded-full animate-indeterminate" />
              </div>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="py-14 text-center border border-dashed border-[#DDD5C7] rounded-xl bg-[#F7F4EF] space-y-3 max-w-md mx-auto my-4">
              <span className="text-2xl">📚</span>
              <h4 className="font-display font-medium text-sm text-[#24211D]">
                Все похожие книги уже добавлены в библиотеку или скрыты
              </h4>
              <p className="text-xs text-[#7A7265] max-w-xs mx-auto">
                Вы можете обновить подборку через ИИ или открыть общие рекомендации в верхнем меню.
              </p>
              <button
                onClick={() => fetchSimilarRecommendations()}
                className="mt-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#24211D] hover:bg-[#3B342C] rounded transition-colors"
              >
                Сгенерировать другие варианты
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendations.map((rec, idx) => {
                const titleKey = rec.title.toLowerCase().trim();
                const isWishlist = rec.isWishlist || userWishlistMap.has(titleKey);
                const isCompleted = userCompletedTitles.has(titleKey);
                const isReading = userReadingTitles.has(titleKey);
                const isAddedNow = addedBookTitles.has(rec.title);
                const isAdding = addingTitle === rec.title;

                return (
                  <div
                    key={rec.id || idx}
                    className={`relative rounded-xl p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group overflow-hidden border ${
                      isWishlist
                        ? 'bg-[#FAF7F0] border-amber-300 ring-1 ring-amber-200/60 hover:border-amber-400'
                        : 'bg-[#FAF8F5] border-[#E8E2D8] hover:border-[#C4B7A5]'
                    }`}
                  >
                    <div>
                      {/* Top row with cover, title & actions */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          {/* Book spine mockup */}
                          <div 
                            className="w-10 h-15 rounded-[3px] shadow-sm shrink-0 p-1.5 flex flex-col justify-between text-white relative overflow-hidden"
                            style={{ backgroundColor: rec.coverColor }}
                          >
                            <div className="absolute top-0 left-0 bottom-0 w-1 bg-white/20" />
                            <span className="text-[6.5px] uppercase tracking-wider font-mono opacity-70 line-clamp-1">
                              {rec.genres[0]}
                            </span>
                            <p className="text-[7.5px] font-serif font-bold line-clamp-2 leading-tight">
                              {rec.title}
                            </p>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold">
                                {rec.matchScore}% сходство
                              </span>
                              {isWishlist && (
                                <span className="text-[9.5px] font-mono font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-2xs">
                                  <span>⭐</span> В виш-листе
                                </span>
                              )}
                            </div>
                            <h4 className="font-display font-semibold text-sm sm:text-base text-[#24211D] mt-1 leading-snug truncate">
                              {rec.title}
                            </h4>
                            <p className="text-xs text-[#7A7265] mt-0.5 font-medium truncate">
                              {rec.author}
                            </p>
                          </div>
                        </div>

                        {/* Dismiss & Quick Action Buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* "Не рекомендовать" Button */}
                          <button
                            onClick={() => handleDismissBook(rec)}
                            className="p-1.5 text-[#8A8172] hover:text-rose-700 hover:bg-rose-50 border border-[#E8E2D8] hover:border-rose-200 rounded-md text-xs font-medium transition-colors"
                            title="Больше не рекомендовать эту книгу"
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick Action Button */}
                          {isWishlist ? (
                            <button
                              onClick={(e) => handleQuickAdd(rec, e)}
                              disabled={isAdding}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-[#8A5A36] hover:bg-[#6F4729] text-white shadow-xs active:scale-95 transition-all"
                              title="Начать читать книгу из вашего виш-листа"
                            >
                              <BookOpen className="w-3.5 h-3.5 text-amber-200" />
                              <span>{isAdding ? '...' : 'Начать'}</span>
                            </button>
                          ) : isReading || isAddedNow ? (
                            <div className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                              <span className="hidden sm:inline">Читаю</span>
                            </div>
                          ) : isCompleted ? (
                            <div className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="hidden sm:inline">Прочитано</span>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => handleQuickAdd(rec, e)}
                              disabled={isAdding}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-[#24211D] hover:bg-[#3B342C] text-white shadow-xs active:scale-95 transition-all"
                              title="Добавить в виш-лист (Хочу прочитать)"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>{isAdding ? '...' : '+ В виш-лист'}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Similarity Connection Callout */}
                      <div className="mt-2.5 p-2 rounded-lg bg-[#F5EFE6] border border-[#EAE0D2] text-xs text-[#4A3D2E] leading-relaxed">
                        <span className="font-semibold text-[#8A5A36] block mb-0.5 text-[11px]">
                          💡 Чем похожа на «{targetBook.title}»:
                        </span>
                        {rec.similarityReason}
                      </div>

                      {/* Plot teaser */}
                      <p className="mt-2 text-xs text-[#6B6357] leading-relaxed line-clamp-2">
                        {rec.description}
                      </p>
                    </div>

                    {/* Metadata footer */}
                    <div className="mt-3 pt-2.5 border-t border-[#E8E2D8] flex items-center justify-between text-[10px] text-[#7A7265] font-mono">
                      <div className="flex items-center gap-1 flex-wrap">
                        {rec.genres.slice(0, 2).map((g, gIdx) => (
                          <span key={gIdx} className="bg-[#EFE9DF] px-1.5 py-0.5 rounded text-[#5C5446]">
                            {g}
                          </span>
                        ))}
                      </div>
                      <span className="shrink-0 text-[#8A8172]">
                        ~{rec.estimatedPages} стр.
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-[#F7F4EF] border-t border-[#E8E2D8] flex items-center justify-between gap-3 text-xs">
          <span className="text-[#7A7265] text-[11px] hidden sm:inline">
            Рекомендации подобраны персонально на основе книги «{targetBook.title}»
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-[#FAF8F5] bg-[#24211D] hover:bg-[#3B342C] rounded transition-colors ml-auto shadow-xs"
          >
            Вернуться к книге
          </button>
        </div>
      </div>
    </div>
  );
};
