import React, { useState, useMemo, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Book } from '../../types/book';
import { BookCover } from '../common/BookCover';
import { 
  Search, 
  SlidersHorizontal, 
  Star, 
  Palette, 
  Lock, 
  Cloud, 
  X,
  Library,
  BookOpen
} from 'lucide-react';
import { 
  extractCoverColor, 
  getSpineFoil, 
  getLuminance, 
  getHueFromHex, 
  getFallbackSpineColor 
} from '../../utils/colorExtractor';

interface BookSpinesViewProps {
  books: Book[];
  onSelectBook: (book: Book) => void;
  onOpenAddModal: () => void;
  currentUser?: User | any | null;
  onOpenAuthModal?: () => void;
}

type WoodFinish = 'dark' | 'walnut' | 'light';
type SpineSortMode = 'recent' | 'author' | 'genre' | 'rainbow' | 'rating' | 'height' | 'pages' | 'status';

interface SpineStyleConfig {
  bg: string;
  foilClass: string;
  ribbonColor: string;
  headbandPattern: string;
  width: number;
  height: number;
  hue: number;
}

function getDeterministicNumber(str: string, max: number): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % max;
}

/**
 * Calculates spine geometry, authentic bookbinding colors derived from cover, and textures
 */
function getSpineConfig(
  book: Book, 
  coverColorOverride?: string, 
  isMobile: boolean = false
): SpineStyleConfig {
  const seed = `${book.id}_${book.title}_${book.authors?.[0] || ''}`;
  
  // 1. Spine thickness based on pages count
  const pages = book.pages || 320;
  let width = 38;
  if (pages <= 160) width = 28;
  else if (pages <= 260) width = 34;
  else if (pages <= 420) width = 42;
  else if (pages <= 650) width = 52;
  else if (pages <= 900) width = 64;
  else width = 76;

  // On mobile, keep widths tighter so they fit neatly in a single row without horizontal scroll
  if (isMobile) {
    if (pages <= 200) width = 32;
    else if (pages <= 400) width = 38;
    else if (pages <= 650) width = 44;
    else width = 50;
  }

  // 2. Height variation for realistic bookshelf (pocket book to deluxe encyclopedic hardcover)
  const heightSeed = getDeterministicNumber(`${seed}_h`, 36);
  const baseHeight = isMobile ? 180 : 215;
  const height = baseHeight + (isMobile ? Math.round(heightSeed * 0.75) : heightSeed);

  // 3. Color selection: prioritized by extracted cover color, book.coverColor, or deterministic tone
  let bg = coverColorOverride || book.coverColor;
  if (!bg) {
    bg = getFallbackSpineColor(seed);
  }

  const foilClass = getSpineFoil(bg);
  const hue = getHueFromHex(bg);
  const lum = getLuminance(bg);

  // Derive ribbon bookmark color (deep jewel tone contrasting with background)
  let ribbonColor = '#991B1B';
  if (hue >= 0 && hue < 40) ribbonColor = '#1E40AF'; // Red/Brown gets Blue ribbon
  else if (hue >= 40 && hue < 160) ribbonColor = '#991B1B'; // Green/Yellow gets Crimson ribbon
  else if (hue >= 160 && hue < 260) ribbonColor = '#B45309'; // Blue/Cyan gets Amber ribbon
  else ribbonColor = '#15803D'; // Purple/Magenta gets Emerald ribbon

  // Derive headband accent stripe
  const headbandPattern = lum > 0.4 ? '#475569' : '#F59E0B';

  return {
    bg,
    foilClass,
    ribbonColor,
    headbandPattern,
    width,
    height,
    hue,
  };
}

export const BookSpinesView: React.FC<BookSpinesViewProps> = ({
  books,
  onSelectBook,
  onOpenAddModal,
  currentUser,
  onOpenAuthModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [sortMode, setSortMode] = useState<SpineSortMode>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('my_book_shelf_spines_sort') as SpineSortMode;
        if (saved) return saved;
      } catch {}
    }
    return 'recent';
  });

  const [woodFinish, setWoodFinish] = useState<WoodFinish>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('my_book_shelf_wood_finish') as WoodFinish;
        if (saved) return saved;
      } catch {}
    }
    return 'dark';
  });

  const [hoveredBook, setHoveredBook] = useState<Book | null>(null);

  // Mobile detection for 0-horizontal-scroll layout
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 640;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Extracted cover colors mapped by book.id
  const [coverColors, setCoverColors] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (typeof window !== 'undefined') {
      books.forEach((b) => {
        if (b.coverColor) {
          initial[b.id] = b.coverColor;
        } else if (b.coverUrl) {
          try {
            const cached = localStorage.getItem(`spine_col_${encodeURIComponent(b.coverUrl)}`);
            if (cached) initial[b.id] = cached;
          } catch {}
        }
      });
    }
    return initial;
  });

  // Extract cover colors for books with coverUrl in the background
  useEffect(() => {
    let isMounted = true;
    books.forEach(async (book) => {
      if (coverColors[book.id]) return;
      if (book.coverColor) {
        setCoverColors((prev) => ({ ...prev, [book.id]: book.coverColor! }));
        return;
      }
      if (book.coverUrl) {
        try {
          const color = await extractCoverColor(book.coverUrl, `${book.id}_${book.title}`);
          if (isMounted && color) {
            setCoverColors((prev) => {
              if (prev[book.id] === color) return prev;
              return { ...prev, [book.id]: color };
            });
          }
        } catch {}
      }
    });
    return () => {
      isMounted = false;
    };
  }, [books]);

  const handleSetSortMode = (mode: SpineSortMode) => {
    setSortMode(mode);
    try {
      localStorage.setItem('my_book_shelf_spines_sort', mode);
    } catch {}
  };

  const handleSetWoodFinish = (finish: WoodFinish) => {
    setWoodFinish(finish);
    try {
      localStorage.setItem('my_book_shelf_wood_finish', finish);
    } catch {}
  };

  // Extract all unique genres for filter bar
  const genresList = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => b.genres.forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [books]);

  // Filtered books based on search & genre
  const filteredBooks = useMemo(() => {
    return books.filter((b) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        b.title.toLowerCase().includes(q) ||
        b.authors.some((a) => a.toLowerCase().includes(q)) ||
        (b.series && b.series.toLowerCase().includes(q))
      );
      const matchesGenre = selectedGenre === 'all' || b.genres.includes(selectedGenre);
      return matchesSearch && matchesGenre;
    });
  }, [books, searchQuery, selectedGenre]);

  // Sort books according to chosen arrangement mode
  const sortedBooks = useMemo(() => {
    const list = [...filteredBooks];
    switch (sortMode) {
      case 'author':
        return list.sort((a, b) => {
          const authorA = a.authors[0] || '';
          const authorB = b.authors[0] || '';
          return authorA.localeCompare(authorB, 'ru');
        });
      case 'rainbow':
        return list.sort((a, b) => {
          const colorA = coverColors[a.id] || a.coverColor || getFallbackSpineColor(`${a.id}_${a.title}`);
          const colorB = coverColors[b.id] || b.coverColor || getFallbackSpineColor(`${b.id}_${b.title}`);
          const hueA = getHueFromHex(colorA);
          const hueB = getHueFromHex(colorB);
          return hueA - hueB;
        });
      case 'rating':
        return list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      case 'pages':
        return list.sort((a, b) => (b.pages || 0) - (a.pages || 0));
      case 'height':
        return list.sort((a, b) => {
          const cfgA = getSpineConfig(a, coverColors[a.id], isMobile);
          const cfgB = getSpineConfig(b, coverColors[b.id], isMobile);
          return cfgB.height - cfgA.height;
        });
      case 'status':
        return list.sort((a, b) => {
          if (a.status === 'reading' && b.status !== 'reading') return -1;
          if (a.status !== 'reading' && b.status === 'reading') return 1;
          return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
        });
      case 'recent':
      default:
        return list.sort((a, b) => {
          const timeA = new Date(a.updatedAt || a.createdAt).getTime();
          const timeB = new Date(b.updatedAt || b.createdAt).getTime();
          return timeB - timeA;
        });
    }
  }, [filteredBooks, sortMode, coverColors, isMobile]);

  // Group books onto realistic bookcase shelves
  // CRITICAL: On mobile, chunk by 6-8 books so each shelf fits 100% width WITHOUT horizontal scroll!
  const shelves = useMemo(() => {
    const mobileChunkSize = 7; // Perfectly fits 360px - 430px mobile screens without any horizontal scroll
    const desktopChunkSize = 18;
    const chunkSize = isMobile ? mobileChunkSize : desktopChunkSize;

    if (sortMode === 'genre') {
      // Group by genre
      const map = new Map<string, Book[]>();
      sortedBooks.forEach((book) => {
        const primary = book.genres[0] || 'Другое';
        if (!map.has(primary)) map.set(primary, []);
        map.get(primary)!.push(book);
      });

      const result: { title: string; books: Book[] }[] = [];
      Array.from(map.entries()).forEach(([genreName, genreBooks]) => {
        // If genre has more books than one shelf row can hold on mobile, chunk across tiers
        for (let i = 0; i < genreBooks.length; i += chunkSize) {
          result.push({
            title: i === 0 ? genreName : `${genreName} (продолжение)`,
            books: genreBooks.slice(i, i + chunkSize),
          });
        }
      });
      return result;
    }

    if (sortMode === 'status') {
      const reading = sortedBooks.filter((b) => b.status === 'reading');
      const completed = sortedBooks.filter((b) => b.status === 'completed');
      const result: { title: string; books: Book[] }[] = [];
      
      // Reading shelf tiers
      for (let i = 0; i < reading.length; i += chunkSize) {
        result.push({
          title: i === 0 ? 'Сейчас читаю (В процессе)' : 'Сейчас читаю (продолжение)',
          books: reading.slice(i, i + chunkSize),
        });
      }

      // Completed shelf tiers
      for (let i = 0; i < completed.length; i += chunkSize) {
        result.push({
          title: i === 0 && reading.length > 0 ? 'Прочитанные книги' : `Полка ${result.length + 1}`,
          books: completed.slice(i, i + chunkSize),
        });
      }
      return result;
    }

    // Default sequential chunking
    const result: { title: string; books: Book[] }[] = [];
    for (let i = 0; i < sortedBooks.length; i += chunkSize) {
      result.push({
        title: `Полка ${result.length + 1}`,
        books: sortedBooks.slice(i, i + chunkSize),
      });
    }
    return result;
  }, [sortedBooks, sortMode, isMobile]);

  // Total literary shelf metrics
  const totalThicknessMm = useMemo(() => {
    return books.reduce((acc, b) => {
      const pages = b.pages || 320;
      // standard paper thickness ~ 0.09mm per sheet (2 pages) + 4mm cover boards
      const mm = Math.round((pages / 2) * 0.09 + 4);
      return acc + mm;
    }, 0);
  }, [books]);

  const shelfMeters = (totalThicknessMm / 1000).toFixed(1);
  const totalPagesCount = books.reduce((acc, b) => acc + (b.pages || 0), 0);

  // Wood classes mapping
  const woodClasses = {
    dark: {
      case: 'bookcase-wood-dark border-[#1A1410]',
      plank: 'shelf-plank-dark',
      plate: 'bg-amber-900/60 border-amber-700/60 text-amber-200',
      backboard: 'bg-[#191410]',
      wall: 'bg-[#2A211A] border-[#18130E]',
    },
    walnut: {
      case: 'bookcase-wood-walnut border-[#2E1B10]',
      plank: 'shelf-plank-walnut',
      plate: 'bg-amber-800/70 border-amber-600/70 text-amber-100',
      backboard: 'bg-[#2B180E]',
      wall: 'bg-[#402616] border-[#22140A]',
    },
    light: {
      case: 'bookcase-wood-light border-[#C2B49D]',
      plank: 'shelf-plank-light',
      plate: 'bg-[#E5DAC6] border-[#B8A68B] text-[#4A3B2C]',
      backboard: 'bg-[#EAE1D1]',
      wall: 'bg-[#DDD1BC] border-[#BDB09A]',
    },
  }[woodFinish];

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
      {/* Top Header & Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-[#E8E2D8]">
        <div>
          <div className="flex items-center gap-2 sm:gap-2.5">
            <Library className="w-5 h-5 sm:w-6 sm:h-6 text-[#8A5A36]" />
            <h1 className="text-xl sm:text-3xl font-display font-semibold text-[#24211D]">
              Книжный шкаф
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[#6B6357]">
            Цвета корешков адаптированы под обложки книг. Стоят на полках, как в настоящей домашней библиотеке.
          </p>
        </div>

        {/* Literary Meter & Stats */}
        <div className="flex items-center gap-3 sm:gap-4 text-xs font-mono text-[#6B6357] bg-[#FAF8F5] border border-[#E8E2D8] px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-md self-start md:self-auto">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#24211D] text-xs sm:text-sm">{books.length}</span>
            <span>{books.length === 1 ? 'том' : 'томов'}</span>
          </div>
          <span className="text-[#DDD5C7]">·</span>
          <div className="flex items-center gap-1.5" title="Суммарная толщина всех книг в домашней библиотеке">
            <span className="font-semibold text-[#8A5A36] text-xs sm:text-sm">~{shelfMeters} м</span>
            <span>ряда</span>
          </div>
          <span className="text-[#DDD5C7]">·</span>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#24211D] text-xs sm:text-sm">{totalPagesCount.toLocaleString('ru-RU')}</span>
            <span>стр.</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Sorting, Wood Selector & Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#FAF8F5] p-2.5 sm:p-3.5 border border-[#E8E2D8] rounded-lg">
        {/* Sorting controls */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none text-xs">
          <span className="text-[11px] font-medium text-[#7A7265] uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Сортировка:
          </span>

          <div className="flex items-center gap-1 shrink-0 bg-[#EFE9DF] p-0.5 rounded-md">
            <button
              onClick={() => handleSetSortMode('recent')}
              className={`px-2 py-1 rounded transition-colors ${
                sortMode === 'recent'
                  ? 'bg-[#FAF8F5] text-[#24211D] font-semibold shadow-xs'
                  : 'text-[#6B6357] hover:text-[#24211D]'
              }`}
            >
              Недавние
            </button>
            <button
              onClick={() => handleSetSortMode('rainbow')}
              className={`px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                sortMode === 'rainbow'
                  ? 'bg-[#FAF8F5] text-[#24211D] font-semibold shadow-xs'
                  : 'text-[#6B6357] hover:text-[#24211D]'
              }`}
              title="Красивый градиент по цветам обложек"
            >
              <Palette className="w-3 h-3 text-[#8A5A36]" />
              <span>По цвету</span>
            </button>
            <button
              onClick={() => handleSetSortMode('author')}
              className={`px-2 py-1 rounded transition-colors ${
                sortMode === 'author'
                  ? 'bg-[#FAF8F5] text-[#24211D] font-semibold shadow-xs'
                  : 'text-[#6B6357] hover:text-[#24211D]'
              }`}
            >
              А–Я
            </button>
            <button
              onClick={() => handleSetSortMode('genre')}
              className={`px-2 py-1 rounded transition-colors ${
                sortMode === 'genre'
                  ? 'bg-[#FAF8F5] text-[#24211D] font-semibold shadow-xs'
                  : 'text-[#6B6357] hover:text-[#24211D]'
              }`}
            >
              Жанры
            </button>
            <button
              onClick={() => handleSetSortMode('rating')}
              className={`px-2 py-1 rounded transition-colors ${
                sortMode === 'rating'
                  ? 'bg-[#FAF8F5] text-[#24211D] font-semibold shadow-xs'
                  : 'text-[#6B6357] hover:text-[#24211D]'
              }`}
            >
              ★ Рейтинг
            </button>
            <button
              onClick={() => handleSetSortMode('status')}
              className={`px-2 py-1 rounded transition-colors ${
                sortMode === 'status'
                  ? 'bg-[#FAF8F5] text-[#24211D] font-semibold shadow-xs'
                  : 'text-[#6B6357] hover:text-[#24211D]'
              }`}
            >
              Читаю
            </button>
          </div>
        </div>

        {/* Right side: Wood finish selector + search input */}
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
          {/* Wood Selector */}
          <div className="flex items-center gap-1.5 bg-[#EFE9DF] p-1 rounded-md text-xs">
            <span className="text-[11px] text-[#7A7265] px-1">Дерево:</span>
            <button
              onClick={() => handleSetWoodFinish('dark')}
              title="Тёмный дуб"
              className={`w-5 h-5 rounded-sm border transition-all ${
                woodFinish === 'dark' ? 'ring-2 ring-[#8A5A36] scale-110 border-white' : 'border-[#1A1410] opacity-75'
              }`}
              style={{ background: '#2A211A' }}
            />
            <button
              onClick={() => handleSetWoodFinish('walnut')}
              title="Благородный орех"
              className={`w-5 h-5 rounded-sm border transition-all ${
                woodFinish === 'walnut' ? 'ring-2 ring-[#8A5A36] scale-110 border-white' : 'border-[#321E10] opacity-75'
              }`}
              style={{ background: '#4D301C' }}
            />
            <button
              onClick={() => handleSetWoodFinish('light')}
              title="Светлый ясень"
              className={`w-5 h-5 rounded-sm border transition-all ${
                woodFinish === 'light' ? 'ring-2 ring-[#8A5A36] scale-110 border-white' : 'border-[#C8BAA0] opacity-75'
              }`}
              style={{ background: '#D6C8AF' }}
            />
          </div>

          {/* Quick Search on Shelf */}
          <div className="relative w-36 sm:w-52">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A8172]" />
            <input
              type="text"
              placeholder="Найти книгу..."
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

      {/* Genre pills quick filter (if books exist) */}
      {genresList.length > 0 && sortMode !== 'genre' && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
          <button
            onClick={() => setSelectedGenre('all')}
            className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${
              selectedGenre === 'all'
                ? 'bg-[#24211D] text-[#FAF8F5] font-medium'
                : 'bg-[#EFE9DF] text-[#6B6357] hover:text-[#24211D]'
            }`}
          >
            Все жанры ({books.length})
          </button>
          {genresList.map((genre) => {
            const count = books.filter((b) => b.genres.includes(genre)).length;
            return (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${
                  selectedGenre === genre
                    ? 'bg-[#24211D] text-[#FAF8F5] font-medium'
                    : 'bg-[#EFE9DF] text-[#6B6357] hover:text-[#24211D]'
                }`}
              >
                {genre} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* EMPTY STATES */}
      {books.length === 0 ? (
        !currentUser ? (
          <div className="py-16 sm:py-20 px-4 text-center border border-dashed border-[#DDD5C7] rounded-lg bg-[#F7F4EF] max-w-md mx-auto my-6 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-[#EFE9DF] flex items-center justify-center mx-auto mb-3 text-[#8A5A36]">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-display font-semibold text-[#24211D]">
              Персональный книжный шкаф
            </h3>
            <p className="mt-2 text-xs text-[#6B6357] leading-relaxed">
              Книги расставляются на полках автоматически из вашей личной библиотеки. Войдите через Google, чтобы увидеть свой книжный шкаф.
            </p>
            <button
              onClick={onOpenAuthModal}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-[#24211D] hover:bg-[#3B342C] text-white rounded-md font-medium text-xs transition-colors shadow-xs"
            >
              <Cloud className="w-4 h-4 text-[#EFE9DF]" />
              <span>Войти через Google</span>
            </button>
          </div>
        ) : (
          <div className="py-16 sm:py-20 text-center border border-dashed border-[#DDD5C7] rounded-lg bg-[#F7F4EF]">
            <Library className="w-10 h-10 mx-auto text-[#8A8172] mb-3" />
            <h3 className="text-base font-display font-medium text-[#24211D]">
              На полках книжного шкафа пока пусто
            </h3>
            <p className="mt-1 text-xs text-[#6B6357] max-w-sm mx-auto">
              Добавьте книги в общую библиотеку, и они сразу появятся здесь в виде стоящих томов с тиснением корешков, адаптированных под цвет обложек.
            </p>
            <button
              onClick={onOpenAddModal}
              className="mt-4 px-4 py-2 text-xs font-medium text-white bg-[#24211D] hover:bg-[#3B342C] rounded-md transition-colors shadow-xs"
            >
              + Поставить первую книгу
            </button>
          </div>
        )
      ) : filteredBooks.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-[#DDD5C7] rounded-md bg-[#F7F4EF]">
          <Search className="w-8 h-8 mx-auto text-[#8A8172] mb-3" />
          <h3 className="text-base font-display font-medium text-[#24211D]">
            Ни один корешок не подошёл под фильтры
          </h3>
          <p className="mt-1 text-xs text-[#6B6357] max-w-sm mx-auto">
            Попробуйте изменить поисковый запрос или сбросить выбранный жанр.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedGenre('all');
            }}
            className="mt-4 px-3 py-1.5 text-xs font-medium text-[#24211D] bg-[#EFE9DF] hover:bg-[#E4DCCE] rounded transition-colors"
          >
            Сбросить фильтры
          </button>
        </div>
      ) : (
        /* THE BOOKCASE STRUCTURE: Absolutely NO horizontal scroll on mobile! */
        <div className={`relative rounded-xl border-2 sm:border-4 ${woodClasses.case} p-2 sm:p-5 shadow-2xl transition-colors duration-300 overflow-hidden`}>
          {/* Top Crown Molding / Header Brass Plate */}
          <div className="flex items-center justify-between pb-2.5 sm:pb-4 border-b border-white/10 px-1 sm:px-4">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] sm:text-[11px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-sm border shadow-inner font-semibold ${woodClasses.plate}`}>
                {currentUser?.displayName ? `Библиотека · ${currentUser.displayName}` : 'Домашняя библиотека'}
              </span>
            </div>

            <div className="text-[10px] sm:text-[11px] text-white/50 font-mono">
              {sortedBooks.length} стоящих томов
            </div>
          </div>

          {/* Shelves Column */}
          <div className="space-y-4 sm:space-y-7 pt-3 sm:pt-4">
            {shelves.map((shelf, shelfIdx) => (
              <div key={shelfIdx} className="relative w-full">
                {/* Shelf Title / Brass Plate if genre or status */}
                {(sortMode === 'genre' || sortMode === 'status') && (
                  <div className="flex items-center gap-2 mb-1.5 px-1 sm:px-3">
                    <span className={`text-[10px] sm:text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded-sm border shadow-xs ${woodClasses.plate}`}>
                      {shelf.title}
                    </span>
                    <span className="text-[10px] text-white/40 font-mono">
                      ({shelf.books.length})
                    </span>
                  </div>
                )}

                {/* Backboard & Book Spines Stage: 
                    On mobile, width is 100%, flex items-end, justify-between, NO overflow-x-auto! */}
                <div 
                  className={`relative ${woodClasses.backboard} rounded-t-sm pt-4 sm:pt-6 px-1.5 sm:px-4 shadow-inner flex items-end w-full overflow-hidden ${
                    isMobile ? 'min-h-[225px]' : 'min-h-[285px]'
                  }`}
                >
                  {/* Left Bookend Ornament (Desktop only) */}
                  <div className="shrink-0 w-3 sm:w-4 h-40 bg-gradient-to-r from-amber-700/60 to-amber-900/80 rounded-l-sm border-r border-black/30 shadow-md self-end mb-0 hidden sm:block" title="Опора для книг" />

                  {/* Books Row: 
                      On mobile, flex-1 justify-between with flex-wrap: false, perfectly spaced across the exact device width! */}
                  <div className="w-full flex items-end justify-between sm:justify-start gap-[2px] sm:gap-1.5 pb-0 px-0.5 sm:px-2 flex-nowrap">
                    {shelf.books.map((book) => {
                      const spineColor = coverColors[book.id];
                      const cfg = getSpineConfig(book, spineColor, isMobile);
                      const isHovered = hoveredBook?.id === book.id;
                      const isReading = book.status === 'reading';

                      return (
                        <div
                          key={book.id}
                          onClick={() => onSelectBook(book)}
                          onMouseEnter={() => !isMobile && setHoveredBook(book)}
                          onMouseLeave={() => !isMobile && setHoveredBook(null)}
                          className="group relative cursor-pointer transition-all duration-200 select-none shrink-0"
                          style={{
                            width: isMobile ? `calc((100% - ${(shelf.books.length - 1) * 2}px) / ${shelf.books.length})` : `${cfg.width}px`,
                            minWidth: isMobile ? '28px' : '28px',
                            maxWidth: isMobile ? '56px' : '76px',
                            height: `${cfg.height}px`,
                            transform: isHovered ? 'translateY(-12px) scale(1.02)' : 'translateY(0)',
                            zIndex: isHovered ? 30 : 10,
                          }}
                        >
                          {/* Book Spine Body */}
                          <div
                            className="w-full h-full rounded-t-[3px] rounded-b-[1px] relative flex flex-col justify-between items-center py-2 sm:py-2.5 overflow-hidden shadow-md group-hover:shadow-2xl transition-all"
                            style={{ backgroundColor: cfg.bg }}
                          >
                            {/* Headband at the top (Каптал) */}
                            <div 
                              className="absolute top-0 left-0 right-0 h-1 sm:h-1.5 opacity-80" 
                              style={{ 
                                background: `repeating-linear-gradient(45deg, #FFF, #FFF 2px, ${cfg.headbandPattern} 2px, ${cfg.headbandPattern} 4px)` 
                              }} 
                            />

                            {/* 3D Cylindrical lighting gradient over the spine */}
                            <div className="spine-cylindrical-lighting absolute inset-0 rounded-t-[3px]" />

                            {/* Top Raised Band (Бинт) */}
                            <div className="spine-raised-band absolute top-3 sm:top-5" />

                            {/* Author Name on Spine */}
                            <div className="relative z-10 w-full px-0.5 sm:px-1 text-center mt-2 sm:mt-3">
                              <p className={`text-[7px] sm:text-[9px] font-sans font-semibold tracking-wider uppercase truncate ${cfg.foilClass}`}>
                                {book.authors[0]?.split(' ').pop() || book.authors[0]}
                              </p>
                            </div>

                            {/* Second Raised Band */}
                            <div className="spine-raised-band absolute top-8 sm:top-12" />

                            {/* Book Title (Vertical Spine Typography) */}
                            <div className="relative z-10 flex-1 flex items-center justify-center my-1 sm:my-2 max-h-[120px] sm:max-h-[145px] overflow-hidden">
                              <span
                                className={`spine-vertical-text font-display font-semibold tracking-wide leading-tight line-clamp-1 ${cfg.foilClass}`}
                                style={{
                                  fontSize: isMobile ? '9.5px' : (cfg.width < 32 ? '10px' : '11.5px'),
                                  maxHeight: isMobile ? '110px' : '135px',
                                }}
                              >
                                {book.title}
                              </span>
                            </div>

                            {/* Third Raised Band */}
                            <div className="spine-raised-band absolute bottom-7 sm:bottom-10" />

                            {/* Bottom Spine Details: Rating or Series or Pages */}
                            <div className="relative z-10 w-full px-0.5 sm:px-1 text-center mb-0.5 flex flex-col items-center">
                              {book.rating ? (
                                <span className={`text-[8px] sm:text-[9px] font-mono font-bold flex items-center justify-center gap-0.5 ${cfg.foilClass}`}>
                                  <Star className="w-1.5 h-1.5 sm:w-2 sm:h-2 fill-current" />
                                  <span>{book.rating}</span>
                                </span>
                              ) : (
                                <span className="text-[7px] sm:text-[8px] font-mono opacity-60">
                                  {book.pages ? `${book.pages}p` : '•••'}
                                </span>
                              )}
                            </div>

                            {/* Bottom Raised Band */}
                            <div className="spine-raised-band absolute bottom-2 sm:bottom-3" />
                          </div>

                          {/* Bookmark Ribbon (Ляссе) hanging down for active reading books */}
                          {isReading && (
                            <div
                              className="spine-ribbon absolute -bottom-3 sm:-bottom-3.5 left-1/2 -translate-x-1/2 w-1.5 sm:w-2 h-3.5 sm:h-4 rounded-b-xs transition-transform duration-200"
                              style={{ backgroundColor: cfg.ribbonColor }}
                              title="Книга в процессе чтения (Закладка-ляссе)"
                            />
                          )}

                          {/* Quick Floating Preview Tooltip on Hover (Desktop) */}
                          {isHovered && !isMobile && (
                            <div 
                              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 p-3 bg-[#FAF8F5] border border-[#DDD5C7] rounded-md shadow-2xl z-50 pointer-events-none transition-all animate-in fade-in zoom-in-95 duration-150"
                              style={{ color: '#24211D' }}
                            >
                              <div className="flex gap-2.5 items-start">
                                <div className="shrink-0 w-10">
                                  <BookCover book={book} size="sm" showSpineCrease={false} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-display font-semibold text-xs leading-snug line-clamp-2 text-[#24211D]">
                                    {book.title}
                                  </h4>
                                  <p className="text-[10px] text-[#7A7265] truncate mt-0.5">
                                    {book.authors.join(', ')}
                                  </p>
                                  <div className="mt-1.5 flex items-center gap-2 text-[10px] font-mono text-[#8A5A36]">
                                    {book.rating ? (
                                      <span className="font-bold flex items-center gap-0.5">
                                        <Star className="w-2.5 h-2.5 fill-current text-[#8A5A36]" />
                                        {book.rating}/10
                                      </span>
                                    ) : (
                                      <span className="text-[#8A8172]">В процессе</span>
                                    )}
                                    {book.pages && <span>· {book.pages} стр.</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="mt-2 pt-1.5 border-t border-[#EFE9DF] text-[9px] text-[#7A7265] flex items-center justify-between">
                                <span>{isReading ? '📖 Читаю сейчас' : '✓ Прочитано'}</span>
                                <span className="text-[#8A5A36] font-medium flex items-center">Открыть →</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Right Bookend Ornament (Desktop only) */}
                  <div className="shrink-0 w-3 sm:w-4 h-40 bg-gradient-to-l from-amber-700/60 to-amber-900/80 rounded-r-sm border-l border-black/30 shadow-md self-end mb-0 hidden sm:block" title="Опора для книг" />
                </div>

                {/* Sturdy Wooden Shelf Board Underneath */}
                <div className={`w-full h-4 sm:h-6 ${woodClasses.plank} rounded-sm relative shadow-lg`}>
                  {/* Subtle woodgrain highlight along the top front edge */}
                  <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/30" />
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Kickboard Molding */}
          <div className="mt-4 sm:mt-6 pt-2.5 sm:pt-3 border-t border-white/10 flex items-center justify-between text-[10px] sm:text-xs text-white/40 font-mono px-2 sm:px-3">
            <span>Классический книжный стеллаж</span>
            <span>Нажмите на корешок, чтобы открыть книгу</span>
          </div>
        </div>
      )}
    </div>
  );
};
