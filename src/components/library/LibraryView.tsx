import React, { useState, useMemo } from 'react';
import { User } from 'firebase/auth';
import { Book, ViewMode, SortField, SortOrder, BookFilter } from '../../types/book';
import { BookCover } from '../common/BookCover';
import { formatDateRU } from '../../utils/date';
import { 
  Search, 
  SlidersHorizontal, 
  LayoutGrid, 
  Grid, 
  List, 
  ArrowUpDown, 
  Star, 
  Plus, 
  X,
  BookOpen,
  FilterX,
  Clock,
  Lock,
  Cloud
} from 'lucide-react';

interface LibraryViewProps {
  books: Book[];
  onSelectBook: (book: Book) => void;
  onOpenAddModal: () => void;
  genresList: string[];
  currentUser?: User | null;
  onOpenAuthModal?: () => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  books,
  onSelectBook,
  onOpenAddModal,
  genresList,
  currentUser,
  onOpenAuthModal,
}) => {
  // Persisted view mode: remembers user preference; defaults to 'grid' (плитка) on mobile
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('my_book_shelf_view_mode') as ViewMode | null;
        if (saved && (saved === 'shelf' || saved === 'grid' || saved === 'list')) {
          return saved;
        }
        // Mobile screens: default to 'grid' (плитка без пролистывания)
        if (window.innerWidth < 768) {
          return 'grid';
        }
      } catch {}
    }
    return 'shelf';
  });

  const handleSetViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('my_book_shelf_view_mode', mode);
      } catch {}
    }
  };
  const [activeTab, setActiveTab] = useState<'all' | 'reading' | 'planned' | 'completed'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Filters state
  const [filters, setFilters] = useState<BookFilter>({
    searchQuery: '',
    status: 'all',
    genre: '',
    author: '',
    ratingGroup: 'all',
    readYear: 'all',
    publishYear: 'all',
  });

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('endDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Extract unique authors, read years, publish years for dropdowns
  const authorsList = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => b.authors.forEach((a) => set.add(a)));
    return Array.from(set).sort();
  }, [books]);

  const readYearsList = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      if (b.endDate) {
        set.add(b.endDate.substring(0, 4));
      }
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [books]);

  const publishYearsList = useMemo(() => {
    const set = new Set<number>();
    books.forEach((b) => {
      if (b.publishYear) set.add(b.publishYear);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [books]);

  // Filter and sort logic
  const filteredAndSortedBooks = useMemo(() => {
    return books
      .filter((book) => {
        // Tab filter
        if (activeTab === 'reading' && book.status !== 'reading') return false;
        if (activeTab === 'planned' && book.status !== 'planned') return false;
        if (activeTab === 'completed' && book.status !== 'completed') return false;

        // Search query (title and author)
        if (filters.searchQuery.trim()) {
          const q = filters.searchQuery.toLowerCase().trim();
          const titleMatch = book.title.toLowerCase().includes(q);
          const authorMatch = book.authors.some((a) => a.toLowerCase().includes(q));
          if (!titleMatch && !authorMatch) return false;
        }

        // Secondary status filter if tab is 'all'
        if (filters.status !== 'all' && book.status !== filters.status) {
          return false;
        }

        // Genre filter
        if (filters.genre && !book.genres.includes(filters.genre)) {
          return false;
        }

        // Author filter
        if (filters.author && !book.authors.includes(filters.author)) {
          return false;
        }

        // Rating group filter
        if (filters.ratingGroup !== 'all') {
          if (!book.rating) return false;
          if (filters.ratingGroup === 'high' && (book.rating < 9 || book.rating > 10)) return false;
          if (filters.ratingGroup === 'medium' && (book.rating < 7 || book.rating > 8)) return false;
          if (filters.ratingGroup === 'low' && book.rating >= 7) return false;
        }

        // Read year
        if (filters.readYear !== 'all') {
          if (!book.endDate || !book.endDate.startsWith(filters.readYear)) return false;
        }

        // Publish year
        if (filters.publishYear !== 'all') {
          if (book.publishYear !== parseInt(filters.publishYear, 10)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let valA: string | number | undefined;
        let valB: string | number | undefined;

        switch (sortField) {
          case 'title':
            valA = a.title.toLowerCase();
            valB = b.title.toLowerCase();
            break;
          case 'author':
            valA = (a.authors[0] || '').toLowerCase();
            valB = (b.authors[0] || '').toLowerCase();
            break;
          case 'rating':
            valA = a.rating ?? -1;
            valB = b.rating ?? -1;
            break;
          case 'pages':
            valA = a.pages ?? 0;
            valB = b.pages ?? 0;
            break;
          case 'readingHours':
            valA = a.readingHours ?? 0;
            valB = b.readingHours ?? 0;
            break;
          case 'startDate':
            valA = a.startDate ? new Date(a.startDate).getTime() : 0;
            valB = b.startDate ? new Date(b.startDate).getTime() : 0;
            break;
          case 'endDate':
            valA = a.endDate ? new Date(a.endDate).getTime() : 0;
            valB = b.endDate ? new Date(b.endDate).getTime() : 0;
            break;
          case 'createdAt':
          default:
            valA = new Date(a.createdAt).getTime();
            valB = new Date(b.createdAt).getTime();
            break;
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }

        const numA = Number(valA);
        const numB = Number(valB);
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      });
  }, [books, activeTab, filters, sortField, sortOrder]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.genre) count++;
    if (filters.author) count++;
    if (filters.ratingGroup !== 'all') count++;
    if (filters.readYear !== 'all') count++;
    if (filters.publishYear !== 'all') count++;
    return count;
  }, [filters]);

  const resetFilters = () => {
    setFilters({
      searchQuery: '',
      status: 'all',
      genre: '',
      author: '',
      ratingGroup: 'all',
      readYear: 'all',
      publishYear: 'all',
    });
  };

  // Group books into shelves of ~6 books each for 'shelf' view
  const shelves = useMemo(() => {
    const result: Book[][] = [];
    const booksPerShelf = 6;
    for (let i = 0; i < filteredAndSortedBooks.length; i += booksPerShelf) {
      result.push(filteredAndSortedBooks.slice(i, i + booksPerShelf));
    }
    return result;
  }, [filteredAndSortedBooks]);

  // Strict Privacy: Unauthenticated users cannot view another user's library
  if (!currentUser) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="py-20 px-4 text-center border border-dashed border-[#DDD5C7] rounded-xl bg-[#F7F4EF] max-w-md mx-auto shadow-xs">
          <div className="w-12 h-12 rounded-full bg-[#EFE9DF] flex items-center justify-center mx-auto mb-3 text-[#8A5A36]">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-display font-semibold text-[#24211D]">
            Личная библиотека
          </h3>
          <p className="mt-2 text-xs text-[#6B6357] leading-relaxed">
            Каждый читатель видит только свою библиотеку. Войдите через Google, чтобы открыть ваши книги и синхронизировать их между компьютером и телефоном.
          </p>
          <button
            onClick={onOpenAuthModal}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-[#24211D] hover:bg-[#3B342C] text-white rounded-md font-medium text-xs transition-colors shadow-xs"
          >
            <Cloud className="w-4 h-4 text-[#EFE9DF]" />
            <span>Войти через Google</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Title & Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E2D8]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-[#24211D]">
            Моя библиотека
          </h1>
          <p className="mt-1 text-sm text-[#6B6357]">
            {filteredAndSortedBooks.length}{' '}
            {filteredAndSortedBooks.length === 1 ? 'книга' : 'книг'}
            {activeTab !== 'all' && (
              <span> · {activeTab === 'reading' ? 'в процессе чтения' : 'прочитано'}</span>
            )}
          </p>
        </div>

        {/* View Mode Switcher (Shelf, Grid, List) */}
        <div className="flex items-center gap-1 p-1 bg-[#EFE9DF] rounded-md shrink-0">
          <button
            onClick={() => handleSetViewMode('shelf')}
            title="Книжная полка на деревянных ярусах"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors ${
              viewMode === 'shelf'
                ? 'bg-[#FAF8F5] text-[#24211D] shadow-xs font-semibold'
                : 'text-[#7A7265] hover:text-[#24211D]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Полка</span>
          </button>
          <button
            onClick={() => handleSetViewMode('grid')}
            title="Плитка (компактная сетка без пролистывания)"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors ${
              viewMode === 'grid'
                ? 'bg-[#FAF8F5] text-[#24211D] shadow-xs font-semibold'
                : 'text-[#7A7265] hover:text-[#24211D]'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Плитка</span>
          </button>
          <button
            onClick={() => handleSetViewMode('list')}
            title="Табличный список"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors ${
              viewMode === 'list'
                ? 'bg-[#FAF8F5] text-[#24211D] shadow-xs font-semibold'
                : 'text-[#7A7265] hover:text-[#24211D]'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Список</span>
          </button>
        </div>
      </div>

      {/* Primary Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Tabs (All, Reading, Planned, Completed) */}
        <div className="flex items-center gap-1 p-1 bg-[#EFE9DF] rounded-md self-start overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'all'
                ? 'bg-[#FAF8F5] text-[#24211D] shadow-sm font-semibold'
                : 'text-[#7A7265] hover:text-[#24211D]'
            }`}
          >
            Все ({books.length})
          </button>
          <button
            onClick={() => setActiveTab('reading')}
            className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'reading'
                ? 'bg-[#FAF8F5] text-[#24211D] shadow-sm font-semibold'
                : 'text-[#7A7265] hover:text-[#24211D]'
            }`}
          >
            Читаю ({books.filter((b) => b.status === 'reading').length})
          </button>
          <button
            onClick={() => setActiveTab('planned')}
            className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'planned'
                ? 'bg-[#FAF8F5] text-[#24211D] shadow-sm font-semibold'
                : 'text-[#7A7265] hover:text-[#24211D]'
            }`}
            title="В планах / Виш-лист"
          >
            В планах<span className="hidden sm:inline"> / Виш-лист</span> ({books.filter((b) => b.status === 'planned').length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'completed'
                ? 'bg-[#FAF8F5] text-[#24211D] shadow-sm font-semibold'
                : 'text-[#7A7265] hover:text-[#24211D]'
            }`}
          >
            Прочитано ({books.filter((b) => b.status === 'completed').length})
          </button>
        </div>

        {/* Search & Filter & Sort Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Live Search */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8172]" />
            <input
              type="text"
              value={filters.searchQuery}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              placeholder="Поиск по названию или автору..."
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-[#FAF8F5] border border-[#E8E2D8] rounded-md text-[#24211D] placeholder:text-[#8A8172] focus:outline-none focus:border-[#24211D]"
            />
            {filters.searchQuery && (
              <button
                onClick={() => setFilters({ ...filters, searchQuery: '' })}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8A8172] hover:text-[#24211D]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Toggle Filter Panel Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'bg-[#24211D] text-[#FAF8F5] border-[#24211D]'
                : 'bg-[#FAF8F5] text-[#6B6357] border-[#E8E2D8] hover:border-[#D1C7B7]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Фильтры</span>
            {activeFilterCount > 0 && (
              <span className="font-mono text-[10px] ml-0.5">({activeFilterCount})</span>
            )}
          </button>

          {/* Sort Selector */}
          <div className="flex items-center gap-1 bg-[#FAF8F5] border border-[#E8E2D8] rounded-md px-2 py-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#8A8172]" />
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="bg-transparent text-xs text-[#24211D] focus:outline-none cursor-pointer pr-1"
            >
              <option value="endDate">По дате окончания</option>
              <option value="startDate">По дате начала</option>
              <option value="title">По названию</option>
              <option value="author">По автору</option>
              <option value="rating">По оценке</option>
              <option value="pages">По страницам</option>
              <option value="readingHours">По часам чтения</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="text-[11px] font-mono text-[#8A8172] hover:text-[#24211D] pl-1 border-l border-[#E8E2D8]"
              title={sortOrder === 'asc' ? 'По возрастанию' : 'По убыванию'}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Advanced Filter Strip */}
      {showFilters && (
        <div className="p-4 bg-[#F7F4EF] border border-[#E8E2D8] rounded-md grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          {/* Genre Filter */}
          <div>
            <label className="block text-[11px] font-medium text-[#7A7265] mb-1">Жанр</label>
            <select
              value={filters.genre}
              onChange={(e) => setFilters({ ...filters, genre: e.target.value })}
              className="w-full bg-[#FAF8F5] border border-[#DDD5C7] rounded px-2.5 py-1.5 text-xs text-[#24211D] focus:outline-none focus:border-[#24211D]"
            >
              <option value="">Все жанры</option>
              {genresList.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Author Filter */}
          <div>
            <label className="block text-[11px] font-medium text-[#7A7265] mb-1">Автор</label>
            <select
              value={filters.author}
              onChange={(e) => setFilters({ ...filters, author: e.target.value })}
              className="w-full bg-[#FAF8F5] border border-[#DDD5C7] rounded px-2.5 py-1.5 text-xs text-[#24211D] focus:outline-none focus:border-[#24211D]"
            >
              <option value="">Все авторы</option>
              {authorsList.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Rating Group Filter */}
          <div>
            <label className="block text-[11px] font-medium text-[#7A7265] mb-1">Оценка</label>
            <select
              value={filters.ratingGroup}
              onChange={(e) => setFilters({ ...filters, ratingGroup: e.target.value as any })}
              className="w-full bg-[#FAF8F5] border border-[#DDD5C7] rounded px-2.5 py-1.5 text-xs text-[#24211D] focus:outline-none focus:border-[#24211D]"
            >
              <option value="all">Любая оценка</option>
              <option value="high">Высокая (9–10)</option>
              <option value="medium">Хорошая (7–8)</option>
              <option value="low">Средняя (≤ 6)</option>
            </select>
          </div>

          {/* Read Year Filter */}
          <div>
            <label className="block text-[11px] font-medium text-[#7A7265] mb-1">Год прочтения</label>
            <select
              value={filters.readYear}
              onChange={(e) => setFilters({ ...filters, readYear: e.target.value })}
              className="w-full bg-[#FAF8F5] border border-[#DDD5C7] rounded px-2.5 py-1.5 text-xs text-[#24211D] focus:outline-none focus:border-[#24211D]"
            >
              <option value="all">Все годы</option>
              {readYearsList.map((yr) => (
                <option key={yr} value={yr}>{yr} год</option>
              ))}
            </select>
          </div>

          {/* Publish Year Filter */}
          <div>
            <label className="block text-[11px] font-medium text-[#7A7265] mb-1">Год публикации</label>
            <div className="flex gap-1.5">
              <select
                value={filters.publishYear}
                onChange={(e) => setFilters({ ...filters, publishYear: e.target.value })}
                className="w-full bg-[#FAF8F5] border border-[#DDD5C7] rounded px-2.5 py-1.5 text-xs text-[#24211D] focus:outline-none focus:border-[#24211D]"
              >
                <option value="all">Все годы</option>
                {publishYearsList.map((yr) => (
                  <option key={yr} value={String(yr)}>{yr} г.</option>
                ))}
              </select>
              {activeFilterCount > 0 && (
                <button
                  onClick={resetFilters}
                  title="Сбросить фильтры"
                  className="px-2 py-1 bg-[#EFE9DF] hover:bg-[#E4DCCE] rounded text-[#7A7265] hover:text-[#24211D] transition-colors"
                >
                  <FilterX className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Viewport Content according to ViewMode */}
      {books.length === 0 ? (
        !currentUser ? (
          /* Unauthenticated visitor empty state: each reader only sees their own library */
          <div className="py-16 px-4 text-center border border-dashed border-[#DDD5C7] rounded-md bg-[#F7F4EF] max-w-md mx-auto my-6">
            <div className="w-12 h-12 rounded-full bg-[#EFE9DF] flex items-center justify-center mx-auto mb-3 text-[#8A5A36]">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-display font-semibold text-[#24211D]">
              Личная библиотека
            </h3>
            <p className="mt-2 text-xs text-[#6B6357] leading-relaxed">
              Каждый читатель видит только свои книги. Войдите через Google, чтобы открыть свою персональную библиотеку и синхронизировать её между компьютером и телефоном.
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
          /* Authenticated user empty library */
          <div className="py-16 text-center border border-dashed border-[#DDD5C7] rounded-md bg-[#F7F4EF]">
            <BookOpen className="w-8 h-8 mx-auto text-[#8A8172] mb-3" />
            <h3 className="text-base font-display font-medium text-[#24211D]">
              В вашей библиотеке пока нет книг
            </h3>
            <p className="mt-1 text-xs text-[#6B6357] max-w-sm mx-auto">
              Нажмите кнопку ниже, чтобы добавить свою первую прочитанную книгу в личную библиотеку.
            </p>
            <button
              onClick={onOpenAddModal}
              className="mt-4 px-4 py-2 text-xs font-medium text-white bg-[#24211D] hover:bg-[#3B342C] rounded-md transition-colors shadow-xs"
            >
              + Добавить первую книгу
            </button>
          </div>
        )
      ) : filteredAndSortedBooks.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-[#DDD5C7] rounded-md bg-[#F7F4EF]">
          <BookOpen className="w-8 h-8 mx-auto text-[#8A8172] mb-3" />
          <h3 className="text-base font-display font-medium text-[#24211D]">
            Книги не найдены
          </h3>
          <p className="mt-1 text-xs text-[#6B6357] max-w-sm mx-auto">
            Попробуйте изменить параметры поиска или сбросить фильтры.
          </p>
          {(activeFilterCount > 0 || filters.searchQuery) && (
            <button
              onClick={resetFilters}
              className="mt-4 px-3 py-1.5 text-xs font-medium text-[#24211D] bg-[#EFE9DF] hover:bg-[#E4DCCE] rounded transition-colors"
            >
              Сбросить все фильтры
            </button>
          )}
        </div>
      ) : viewMode === 'shelf' ? (
        /* MODE 1: Physical Bookshelf with Wooden Planks & Depth */
        <div className="space-y-10 py-4">
          {shelves.map((shelf, shelfIdx) => (
            <div key={shelfIdx} className="relative">
              {/* Books on the shelf: wraps responsively or scrolls neatly with high-contrast hours */}
              <div className="flex items-end justify-start flex-wrap sm:flex-nowrap gap-3 sm:gap-6 md:gap-8 px-2 sm:px-8 pb-1 pt-4">
                {shelf.map((book) => (
                  <div
                    key={book.id}
                    onClick={() => onSelectBook(book)}
                    className="cursor-pointer group flex flex-col items-center shrink-0 w-24 sm:w-32 transition-transform duration-200"
                  >
                    <div className="relative">
                      <BookCover book={book} size="md" className="group-hover:scale-105 transition-transform" />
                      {book.rating && (
                        <div className="absolute top-1 right-1 bg-[#24211D]/90 text-amber-200 text-[10px] font-mono px-1 py-0.5 rounded shadow-xs flex items-center gap-0.5 tabular-nums">
                          <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                          <span>{book.rating}</span>
                        </div>
                      )}
                      {book.readingHours ? (
                        <div className="absolute top-1 left-1 bg-[#24211D]/90 text-amber-100 text-[10px] font-mono px-1 py-0.5 rounded shadow-xs flex items-center gap-1 tabular-nums">
                          <Clock className="w-2.5 h-2.5 text-amber-300" />
                          <span>{book.readingHours}ч</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-2 text-center w-full px-1">
                      <h4 className="font-display font-medium text-xs text-[#24211D] line-clamp-1 group-hover:text-[#5E3023] transition-colors">
                        {book.title}
                      </h4>
                      <p className="text-[10px] text-[#7A7265] truncate">
                        {book.authors[0]}
                      </p>
                      {book.readingHours ? (
                        <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-mono font-medium text-[#4A3828] bg-[#EFE9DF] px-1 py-0.2 rounded">
                          <Clock className="w-2.5 h-2.5 text-[#8A5A36]" />
                          <span>{book.readingHours} ч.</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {/* Wooden Shelf Board underneath */}
              <div className="w-full h-4 sm:h-5 shelf-wood rounded-sm relative mt-1 shadow-xs" />
            </div>
          ))}
        </div>
      ) : viewMode === 'grid' ? (
        /* MODE 2: Compact High-Density Grid (Плитка без пролистывания) */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-6">
          {filteredAndSortedBooks.map((book) => (
            <div
              key={book.id}
              onClick={() => onSelectBook(book)}
              className="group cursor-pointer bg-[#FAF8F5] border border-[#E8E2D8] hover:border-[#D1C7B7] rounded-md p-2.5 sm:p-3 flex flex-col justify-between transition-all shadow-2xs"
            >
              <div className="mx-auto relative">
                <BookCover book={book} size="md" />
                {book.readingHours ? (
                  <div className="absolute top-1 left-1 bg-[#24211D]/90 text-amber-100 text-[10px] font-mono px-1.5 py-0.5 rounded shadow-xs flex items-center gap-1 tabular-nums">
                    <Clock className="w-2.5 h-2.5 text-amber-300" />
                    <span>{book.readingHours} ч.</span>
                  </div>
                ) : null}
              </div>

              <div className="mt-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-[11px] text-[#8A5A36] font-mono tabular-nums mb-1">
                  {book.rating ? (
                    <>
                      <Star className="w-3 h-3 fill-[#8A5A36] text-[#8A5A36]" />
                      <span>{book.rating}/10</span>
                    </>
                  ) : (
                    <span className="text-[#8A8172] text-[10px]">В процессе</span>
                  )}
                </div>

                <h4 className="font-display font-semibold text-xs sm:text-sm text-[#24211D] line-clamp-2 leading-snug group-hover:text-[#5E3023] transition-colors">
                  {book.title}
                </h4>
                <p className="text-[11px] text-[#7A7265] truncate mt-0.5">
                  {book.authors.join(', ')}
                </p>

                <div className="mt-2 pt-2 border-t border-[#EFE9DF] text-[11px] text-[#6B6357] font-mono tabular-nums flex items-center justify-center gap-1.5 flex-wrap">
                  {book.pages && <span>{book.pages} стр.</span>}
                  {book.readingHours ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-[#3D2C1E] bg-[#EFE9DF] px-1.5 py-0.5 rounded border border-[#E2D9CC]">
                      <Clock className="w-3 h-3 text-[#8A5A36]" />
                      {book.readingHours} ч.
                    </span>
                  ) : null}
                  {book.publishYear && !book.readingHours && (
                    <span>{book.publishYear} г.</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* MODE 3: Detailed Compact List */
        <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8E2D8] bg-[#F7F4EF] text-[#7A7265] uppercase text-[10px] tracking-wider font-sans">
                  <th className="py-2.5 px-3 w-12 text-center">Обложка</th>
                  <th className="py-2.5 px-3 font-semibold">Название</th>
                  <th className="py-2.5 px-3 font-semibold">Автор</th>
                  <th className="py-2.5 px-3 font-semibold">Статус</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Оценка</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Стр.</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Часы</th>
                  <th className="py-2.5 px-3 font-semibold">Даты</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE9DF]">
                {filteredAndSortedBooks.map((book) => (
                  <tr
                    key={book.id}
                    onClick={() => onSelectBook(book)}
                    className="hover:bg-[#F5F1E8]/60 cursor-pointer transition-colors"
                  >
                    <td className="py-2 px-3 text-center">
                      <div className="inline-block">
                        <BookCover book={book} size="sm" showSpineCrease={false} />
                      </div>
                    </td>
                    <td className="py-2 px-3 font-display font-medium text-[#24211D] max-w-xs truncate">
                      {book.title}
                    </td>
                    <td className="py-2 px-3 text-[#6B6357] max-w-[140px] truncate">
                      {book.authors.join(', ')}
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-[11px] text-[#6B6357]">
                        {book.status === 'completed' ? 'Прочитана' : book.status === 'planned' ? 'В планах' : 'Читаю'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-medium tabular-nums text-[#8A5A36]">
                      {book.rating ? `${book.rating}/10` : '—'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-[#6B6357]">
                      {book.pages || '—'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-[#6B6357]">
                      {book.readingHours ? `${book.readingHours} ч.` : '—'}
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px] tabular-nums text-[#8A8172]">
                      {book.endDate ? formatDateRU(book.endDate) : (book.startDate ? formatDateRU(book.startDate) : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
