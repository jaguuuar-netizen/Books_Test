import React, { useState, useMemo } from 'react';
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
  Library
} from 'lucide-react';

interface BookSpinesViewProps {
  books: Book[];
  onSelectBook: (book: Book) => void;
  onOpenAddModal: () => void;
  currentUser?: User | null;
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

// Curated leather & cloth bookbinding palette
const BINDING_PALETTE = [
  { bg: '#561E20', foil: 'spine-gold-emboss', ribbon: '#991B1B', headband: '#C2410C', hue: 5 },    // Burgundy
  { bg: '#1B3526', foil: 'spine-gold-emboss', ribbon: '#166534', headband: '#15803D', hue: 140 },  // Forest Green
  { bg: '#182736', foil: 'spine-gold-emboss', ribbon: '#1E40AF', headband: '#3B82F6', hue: 210 },  // Navy
  { bg: '#6B3518', foil: 'spine-gold-emboss', ribbon: '#B45309', headband: '#D97706', hue: 25 },   // Saddle Leather
  { bg: '#352018', foil: 'spine-gold-emboss', ribbon: '#78350F', headband: '#92400E', hue: 30 },   // Dark Chestnut
  { bg: '#3B1B34', foil: 'spine-gold-emboss', ribbon: '#86198F', headband: '#A21CAF', hue: 305 },  // Aubergine Plum
  { bg: '#783520', foil: 'spine-gold-emboss', ribbon: '#C2410C', headband: '#EA580C', hue: 18 },   // Terracotta
  { bg: '#23272B', foil: 'spine-silver-emboss', ribbon: '#475569', headband: '#64748B', hue: 215 },// Charcoal Slate
  { bg: '#3C4229', foil: 'spine-gold-emboss', ribbon: '#4D7C0F', headband: '#65A30D', hue: 85 },   // Vintage Olive
  { bg: '#7A5E2E', foil: 'spine-gold-emboss', ribbon: '#CA8A04', headband: '#EAB308', hue: 45 },   // Antique Mustard
  { bg: '#1F343A', foil: 'spine-silver-emboss', ribbon: '#0E7490', headband: '#06B6D4', hue: 195 },// Prussian Blue
  { bg: '#631822', foil: 'spine-gold-emboss', ribbon: '#BE123C', headband: '#F43F5E', hue: 350 },  // Carmine Ruby
  { bg: '#2C3A2C', foil: 'spine-gold-emboss', ribbon: '#047857', headband: '#10B981', hue: 155 },  // Pine
  { bg: '#482818', foil: 'spine-gold-emboss', ribbon: '#9A3412', headband: '#C2410C', hue: 20 },   // Mocha
];

function getDeterministicNumber(str: string, max: number): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % max;
}

/**
 * Calculates spine geometry, authentic bookbinding colors, and textures based on book attributes
 */
function getSpineConfig(book: Book): SpineStyleConfig {
  const seed = `${book.id}_${book.title}_${book.authors?.[0] || ''}`;
  const palIdx = getDeterministicNumber(seed, BINDING_PALETTE.length);
  const palette = BINDING_PALETTE[palIdx];

  // Spine thickness based on pages count
  const pages = book.pages || 320;
  let width = 38;
  if (pages <= 160) width = 28;
  else if (pages <= 260) width = 34;
  else if (pages <= 420) width = 42;
  else if (pages <= 650) width = 52;
  else if (pages <= 900) width = 64;
  else width = 76;

  // Height variation for realistic bookshelf (pocket book to deluxe encyclopedic hardcover)
  const heightSeed = getDeterministicNumber(`${seed}_h`, 38);
  const height = 215 + heightSeed; // 215px to 253px

  // Color selection: if book has custom cover color, harmonize with it
  let bg = palette.bg;
  if (book.coverColor && book.coverColor.startsWith('#') && book.coverColor.length === 7) {
    bg = book.coverColor;
  }

  return {
    bg,
    foilClass: palette.foil,
    ribbonColor: palette.ribbon,
    headbandPattern: palette.headband,
    width,
    height,
    hue: palette.hue,
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
          const cfgA = getSpineConfig(a);
          const cfgB = getSpineConfig(b);
          return cfgA.hue - cfgB.hue;
        });
      case 'rating':
        return list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      case 'pages':
        return list.sort((a, b) => (b.pages || 0) - (a.pages || 0));
      case 'height':
        return list.sort((a, b) => {
          const cfgA = getSpineConfig(a);
          const cfgB = getSpineConfig(b);
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
  }, [filteredBooks, sortMode]);

  // Group books onto realistic bookcase shelves (approx 18-24 books per shelf)
  const shelves = useMemo(() => {
    if (sortMode === 'genre') {
      // Each genre gets its own titled shelf plank
      const map = new Map<string, Book[]>();
      sortedBooks.forEach((book) => {
        const primary = book.genres[0] || 'Другое';
        if (!map.has(primary)) map.set(primary, []);
        map.get(primary)!.push(book);
      });
      return Array.from(map.entries()).map(([genreName, shelfBooks]) => ({
        title: genreName,
        books: shelfBooks,
      }));
    }

    if (sortMode === 'status') {
      const reading = sortedBooks.filter((b) => b.status === 'reading');
      const completed = sortedBooks.filter((b) => b.status === 'completed');
      const result: { title: string; books: Book[] }[] = [];
      if (reading.length > 0) {
        result.push({ title: 'Сейчас читаю (В процессе)', books: reading });
      }
      // Chunk completed books by ~20
      const chunkSize = 20;
      for (let i = 0; i < completed.length; i += chunkSize) {
        const part = completed.slice(i, i + chunkSize);
        result.push({
          title: i === 0 && reading.length > 0 ? 'Прочитанные книги' : `Полка ${result.length + 1}`,
          books: part,
        });
      }
      return result;
    }

    // Default chunking by ~20 books per shelf
    const result: { title: string; books: Book[] }[] = [];
    const booksPerShelf = 20;
    for (let i = 0; i < sortedBooks.length; i += booksPerShelf) {
      result.push({
        title: `Полка ${result.length + 1}`,
        books: sortedBooks.slice(i, i + booksPerShelf),
      });
    }
    return result;
  }, [sortedBooks, sortMode]);

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header & Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E8E2D8]">
        <div>
          <div className="flex items-center gap-2.5">
            <Library className="w-6 h-6 text-[#8A5A36]" />
            <h1 className="text-2xl sm:text-3xl font-display font-semibold text-[#24211D]">
              Книжный шкаф
            </h1>
          </div>
          <p className="mt-1 text-sm text-[#6B6357]">
            Все ваши книги стоят на полках корешками к вам, как в настоящей домашней библиотеке
          </p>
        </div>

        {/* Literary Meter & Stats */}
        <div className="flex items-center gap-4 text-xs font-mono text-[#6B6357] bg-[#FAF8F5] border border-[#E8E2D8] px-3.5 py-2 rounded-md">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#24211D] text-sm">{books.length}</span>
            <span>{books.length === 1 ? 'том' : 'томов'}</span>
          </div>
          <span className="text-[#DDD5C7]">·</span>
          <div className="flex items-center gap-1.5" title="Суммарная толщина всех книг в домашней библиотеке">
            <span className="font-semibold text-[#8A5A36] text-sm">~{shelfMeters} м</span>
            <span>книжного ряда</span>
          </div>
          <span className="text-[#DDD5C7]">·</span>
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="font-semibold text-[#24211D] text-sm">{totalPagesCount.toLocaleString('ru-RU')}</span>
            <span>стр.</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Sorting, Wood Selector & Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#FAF8F5] p-3.5 border border-[#E8E2D8] rounded-lg">
        {/* Sorting controls */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
          <span className="text-xs font-medium text-[#7A7265] uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Расстановка:
          </span>

          <div className="flex items-center gap-1 shrink-0 bg-[#EFE9DF] p-0.5 rounded-md text-xs">
            <button
              onClick={() => handleSetSortMode('recent')}
              className={`px-2.5 py-1 rounded transition-colors ${
                sortMode === 'recent'
                  ? 'bg-[#FAF8F5] text-[#24211D] font-semibold shadow-xs'
                  : 'text-[#6B6357] hover:text-[#24211D]'
              }`}
            >
              Недавние
            </button>
            <button
              onClick={() => handleSetSortMode('author')}
              className={`px-2.5 py-1 rounded transition-colors ${
                sortMode === 'author'
                  ? 'bg-[#FAF8F5] text-[#24211D] font-semibold shadow-xs'
                  : 'text-[#6B6357] hover:text-[#24211D]'
              }`}
            >
              По авторам (А–Я)
            </button>
            <button
              onClick={() => handleSetSortMode('rainbow')}
              className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${
                sortMode === 'rainbow'
                  ? 'bg-[#FAF8F5] text-[#24211D] font-semibold shadow-xs'
                  : 'text-[#6B6357] hover:text-[#24211D]'
              }`}
              title="Красивый радужный градиент корешков"
            >
              <Palette className="w-3 h-3 text-[#8A5A36]" />
              <span>По цвету</span>
            </button>
            <button
              onClick={() => handleSetSortMode('genre')}
              className={`px-2.5 py-1 rounded transition-colors ${
                sortMode === 'genre'
                  ? 'bg-[#FAF8F5] text-[#24211D] font-semibold shadow-xs'
                  : 'text-[#6B6357] hover:text-[#24211D]'
              }`}
              title="Каждый жанр на отдельной полке"
            >
              По жанрам
            </button>
            <button
              onClick={() => handleSetSortMode('rating')}
              className={`px-2.5 py-1 rounded transition-colors ${
                sortMode === 'rating'
                  ? 'bg-[#FAF8F5] text-[#24211D] font-semibold shadow-xs'
                  : 'text-[#6B6357] hover:text-[#24211D]'
              }`}
            >
              ★ Рейтинг
            </button>
            <button
              onClick={() => handleSetSortMode('status')}
              className={`px-2.5 py-1 rounded transition-colors ${
                sortMode === 'status'
                  ? 'bg-[#FAF8F5] text-[#24211D] font-semibold shadow-xs'
                  : 'text-[#6B6357] hover:text-[#24211D]'
              }`}
            >
              Читаю сейчас
            </button>
          </div>
        </div>

        {/* Right side: Wood finish selector + search input */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Wood Selector */}
          <div className="flex items-center gap-1.5 bg-[#EFE9DF] p-1 rounded-md text-xs">
            <span className="text-[11px] text-[#7A7265] px-1 hidden sm:inline">Дерево:</span>
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
          <div className="relative w-44 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A8172]" />
            <input
              type="text"
              placeholder="Найти корешок..."
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
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
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
          <div className="py-20 px-4 text-center border border-dashed border-[#DDD5C7] rounded-lg bg-[#F7F4EF] max-w-md mx-auto my-6 shadow-xs">
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
          <div className="py-20 text-center border border-dashed border-[#DDD5C7] rounded-lg bg-[#F7F4EF]">
            <Library className="w-10 h-10 mx-auto text-[#8A8172] mb-3" />
            <h3 className="text-base font-display font-medium text-[#24211D]">
              На полках книжного шкафа пока пусто
            </h3>
            <p className="mt-1 text-xs text-[#6B6357] max-w-sm mx-auto">
              Добавьте книги в общую библиотеку, и они сразу появятся здесь в виде стоящих томов с тиснением корешков.
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
        /* THE BOOKCASE STRUCTURE */
        <div className={`relative rounded-xl border-4 ${woodClasses.case} p-2 sm:p-5 shadow-2xl transition-colors duration-300`}>
          {/* Top Crown Molding / Header Brass Plate */}
          <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-white/10 px-2 sm:px-4">
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-mono uppercase tracking-widest px-3 py-1 rounded-sm border shadow-inner font-semibold ${woodClasses.plate}`}>
                {currentUser?.displayName ? `Библиотека · ${currentUser.displayName}` : 'Домашняя библиотека'}
              </span>
            </div>

            <div className="text-[11px] text-white/50 font-mono hidden sm:block">
              {sortedBooks.length} стоящих томов
            </div>
          </div>

          {/* Shelves Column */}
          <div className="space-y-6 sm:space-y-8 pt-4">
            {shelves.map((shelf, shelfIdx) => (
              <div key={shelfIdx} className="relative">
                {/* Shelf Title / Brass Plate if genre or status */}
                {(sortMode === 'genre' || sortMode === 'status') && (
                  <div className="flex items-center gap-2 mb-2 px-2 sm:px-4">
                    <span className={`text-[10px] sm:text-xs font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-sm border shadow-xs ${woodClasses.plate}`}>
                      {shelf.title}
                    </span>
                    <span className="text-[10px] text-white/40 font-mono">
                      ({shelf.books.length})
                    </span>
                  </div>
                )}

                {/* Backboard & Book Spines Stage */}
                <div className={`relative ${woodClasses.backboard} rounded-t-sm pt-6 px-3 sm:px-6 shadow-inner flex items-end justify-start overflow-x-auto min-h-[290px]`}>
                  {/* Left Bookend Ornament */}
                  <div className="shrink-0 w-3 sm:w-5 h-44 bg-gradient-to-r from-amber-700/60 to-amber-900/80 rounded-l-sm border-r border-black/30 shadow-md self-end mb-0 hidden sm:block" title="Опора для книг" />

                  {/* Books Row */}
                  <div className="flex items-end justify-start gap-[2px] sm:gap-1.5 pb-0 px-1 sm:px-2 flex-nowrap">
                    {shelf.books.map((book) => {
                      const cfg = getSpineConfig(book);
                      const isHovered = hoveredBook?.id === book.id;
                      const isReading = book.status === 'reading';

                      return (
                        <div
                          key={book.id}
                          onClick={() => onSelectBook(book)}
                          onMouseEnter={() => setHoveredBook(book)}
                          onMouseLeave={() => setHoveredBook(null)}
                          className="group relative cursor-pointer transition-all duration-200 select-none shrink-0"
                          style={{
                            width: `${cfg.width}px`,
                            height: `${cfg.height}px`,
                            transform: isHovered ? 'translateY(-14px) scale(1.02)' : 'translateY(0)',
                            zIndex: isHovered ? 30 : 10,
                          }}
                        >
                          {/* Book Spine Body */}
                          <div
                            className="w-full h-full rounded-t-[3px] rounded-b-[1px] relative flex flex-col justify-between items-center py-2.5 overflow-hidden shadow-md group-hover:shadow-2xl transition-all"
                            style={{ backgroundColor: cfg.bg }}
                          >
                            {/* Headband at the top (Каптал) */}
                            <div 
                              className="absolute top-0 left-0 right-0 h-1.5 opacity-80" 
                              style={{ 
                                background: `repeating-linear-gradient(45deg, #FFF, #FFF 2px, ${cfg.headbandPattern} 2px, ${cfg.headbandPattern} 4px)` 
                              }} 
                            />

                            {/* 3D Cylindrical lighting gradient over the spine */}
                            <div className="spine-cylindrical-lighting absolute inset-0 rounded-t-[3px]" />

                            {/* Top Raised Band (Бинт) */}
                            <div className="spine-raised-band absolute top-5" />

                            {/* Author Name on Spine (Vertical or Horizontal) */}
                            <div className="relative z-10 w-full px-1 text-center mt-3">
                              {cfg.width >= 48 ? (
                                <p className={`text-[9px] font-sans font-semibold tracking-wider uppercase truncate ${cfg.foilClass}`}>
                                  {book.authors[0]?.split(' ').pop() || book.authors[0]}
                                </p>
                              ) : (
                                <p className={`text-[8px] font-sans tracking-wide uppercase truncate opacity-85 ${cfg.foilClass}`}>
                                  {book.authors[0]?.split(' ').pop() || ''}
                                </p>
                              )}
                            </div>

                            {/* Second Raised Band */}
                            <div className="spine-raised-band absolute top-12" />

                            {/* Book Title (Vertical Spine Typography) */}
                            <div className="relative z-10 flex-1 flex items-center justify-center my-2 max-h-[145px] overflow-hidden">
                              <span
                                className={`spine-vertical-text font-display font-semibold text-xs tracking-wide leading-tight line-clamp-1 max-h-[135px] ${cfg.foilClass}`}
                                style={{
                                  fontSize: cfg.width < 32 ? '10px' : '11.5px',
                                }}
                              >
                                {book.title}
                              </span>
                            </div>

                            {/* Third Raised Band */}
                            <div className="spine-raised-band absolute bottom-10" />

                            {/* Bottom Spine Details: Rating or Series or Pages */}
                            <div className="relative z-10 w-full px-1 text-center mb-0.5 flex flex-col items-center">
                              {book.rating ? (
                                <span className={`text-[9px] font-mono font-bold flex items-center justify-center gap-0.5 ${cfg.foilClass}`}>
                                  <Star className="w-2 h-2 fill-current" />
                                  <span>{book.rating}</span>
                                </span>
                              ) : (
                                <span className="text-[8px] font-mono text-white/50">
                                  {book.pages ? `${book.pages}p` : '•••'}
                                </span>
                              )}
                            </div>

                            {/* Bottom Raised Band */}
                            <div className="spine-raised-band absolute bottom-3" />
                          </div>

                          {/* Bookmark Ribbon (Ляссе) hanging down for active reading books */}
                          {isReading && (
                            <div
                              className="spine-ribbon absolute -bottom-3.5 left-1/2 -translate-x-1/2 w-2 h-4 rounded-b-xs transition-transform duration-200"
                              style={{ backgroundColor: cfg.ribbonColor }}
                              title="Книга в процессе чтения (Закладка-ляссе)"
                            />
                          )}

                          {/* Quick Floating Preview Tooltip on Hover */}
                          {isHovered && (
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

                  {/* Right Bookend Ornament */}
                  <div className="shrink-0 w-3 sm:w-5 h-44 bg-gradient-to-l from-amber-700/60 to-amber-900/80 rounded-r-sm border-l border-black/30 shadow-md self-end mb-0 hidden sm:block" title="Опора для книг" />
                </div>

                {/* Sturdy Wooden Shelf Board Underneath */}
                <div className={`w-full h-5 sm:h-6 ${woodClasses.plank} rounded-sm relative shadow-lg`}>
                  {/* Subtle woodgrain highlight along the top front edge */}
                  <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/30" />
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Kickboard Molding */}
          <div className="mt-6 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/40 font-mono px-3">
            <span>Классический книжный стеллаж</span>
            <span>Нажмите на любой корешок, чтобы открыть книгу</span>
          </div>
        </div>
      )}
    </div>
  );
};
