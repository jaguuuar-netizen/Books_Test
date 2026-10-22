import React, { useState, useMemo } from 'react';
import { Book, AuthorStat, GenreStat } from '../../types/book';
import { BookCover } from '../common/BookCover';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';
import { 
  Star, 
  Clock, 
  BookOpen, 
  Award, 
  TrendingUp, 
  User, 
  Calendar, 
  Layers, 
  Combine, 
  X,
  ChevronRight
} from 'lucide-react';

interface StatisticsViewProps {
  books: Book[];
  onSelectBook: (book: Book) => void;
  onMergeAuthors: (oldName: string, targetName: string) => void;
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const PIE_COLORS = [
  '#273B30', '#3C241E', '#1C2A3A', '#8A5A36', 
  '#542323', '#4A5B4C', '#6B5B3E', '#34444C',
  '#7C3E2D', '#3B3A5A', '#526B54', '#8C7262'
];

export const StatisticsView: React.FC<StatisticsViewProps> = ({
  books,
  onSelectBook,
  onMergeAuthors,
}) => {
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [authorSortBy, setAuthorSortBy] = useState<'count' | 'rating' | 'pages'>('count');
  const [selectedAuthor, setSelectedAuthor] = useState<AuthorStat | null>(null);
  const [selectedGenreName, setSelectedGenreName] = useState<string | null>(null);

  // Author merge modal state
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeSource, setMergeSource] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');

  const completedBooks = useMemo(() => {
    return books.filter((b) => b.status === 'completed');
  }, [books]);

  // Available completed years
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    completedBooks.forEach((b) => {
      if (b.endDate) years.add(b.endDate.substring(0, 4));
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [completedBooks]);

  // Filtered books for the selected year scope
  const scopedBooks = useMemo(() => {
    if (selectedYear === 'all') return completedBooks;
    return completedBooks.filter((b) => b.endDate && b.endDate.startsWith(selectedYear));
  }, [completedBooks, selectedYear]);

  // General metrics for the current scope
  const totalReadCount = scopedBooks.length;
  const totalPages = scopedBooks.reduce((sum, b) => sum + (b.pages || 0), 0);
  const totalHours = scopedBooks.reduce((sum, b) => sum + (b.readingHours || 0), 0);

  const ratedBooks = scopedBooks.filter((b) => typeof b.rating === 'number' && b.rating > 0);
  const avgRating = ratedBooks.length > 0
    ? (ratedBooks.reduce((sum, b) => sum + (b.rating || 0), 0) / ratedBooks.length).toFixed(1)
    : '—';

  const avgPagesPerBook = totalReadCount > 0 ? Math.round(totalPages / totalReadCount) : 0;
  const avgHoursPerBook = totalReadCount > 0 ? (totalHours / totalReadCount).toFixed(1) : '0';

  // Dynamics: Books per year
  const yearlyStats = useMemo(() => {
    const map: Record<string, { year: string; books: number; pages: number; hours: number; totalRating: number; ratedCount: number }> = {};
    completedBooks.forEach((b) => {
      if (!b.endDate) return;
      const yr = b.endDate.substring(0, 4);
      if (!map[yr]) {
        map[yr] = { year: yr, books: 0, pages: 0, hours: 0, totalRating: 0, ratedCount: 0 };
      }
      map[yr].books += 1;
      map[yr].pages += b.pages || 0;
      map[yr].hours += b.readingHours || 0;
      if (b.rating) {
        map[yr].totalRating += b.rating;
        map[yr].ratedCount += 1;
      }
    });

    return Object.values(map)
      .sort((a, b) => a.year.localeCompare(b.year))
      .map((item) => ({
        ...item,
        avgRating: item.ratedCount > 0 ? +(item.totalRating / item.ratedCount).toFixed(1) : 0,
      }));
  }, [completedBooks]);

  // Most productive year
  const mostProductiveYear = useMemo(() => {
    if (yearlyStats.length === 0) return null;
    return [...yearlyStats].sort((a, b) => b.books - a.books)[0];
  }, [yearlyStats]);

  // Dynamics: Books per month (for the selected year or all-time aggregated)
  const monthlyStats = useMemo(() => {
    const monthCounts = new Array(12).fill(0).map((_, i) => ({
      monthIdx: i,
      monthName: MONTH_NAMES[i],
      books: 0,
      pages: 0,
    }));

    scopedBooks.forEach((b) => {
      if (!b.endDate) return;
      const parts = b.endDate.split('-');
      if (parts.length >= 2) {
        const mIdx = parseInt(parts[1], 10) - 1;
        if (mIdx >= 0 && mIdx < 12) {
          monthCounts[mIdx].books += 1;
          monthCounts[mIdx].pages += b.pages || 0;
        }
      }
    });

    return monthCounts;
  }, [scopedBooks]);

  const mostProductiveMonth = useMemo(() => {
    const sorted = [...monthlyStats].sort((a, b) => b.books - a.books);
    if (sorted[0] && sorted[0].books > 0) return sorted[0];
    return null;
  }, [monthlyStats]);

  // Author rankings
  const authorStats: AuthorStat[] = useMemo(() => {
    const map: Record<string, AuthorStat> = {};
    completedBooks.forEach((b) => {
      b.authors.forEach((author) => {
        const cleanName = author.trim();
        if (!cleanName) return;
        if (!map[cleanName]) {
          map[cleanName] = {
            name: cleanName,
            booksCount: 0,
            completedCount: 0,
            totalPages: 0,
            totalHours: 0,
            avgRating: 0,
            books: [],
          };
        }
        map[cleanName].booksCount += 1;
        map[cleanName].completedCount += 1;
        map[cleanName].totalPages += b.pages || 0;
        map[cleanName].totalHours += b.readingHours || 0;
        map[cleanName].books.push(b);
      });
    });

    return Object.values(map)
      .map((stat) => {
        const rated = stat.books.filter((b) => b.rating);
        const avg = rated.length > 0
          ? rated.reduce((s, b) => s + (b.rating || 0), 0) / rated.length
          : 0;
        return {
          ...stat,
          avgRating: +avg.toFixed(1),
        };
      })
      .sort((a, b) => {
        if (authorSortBy === 'rating') return b.avgRating - a.avgRating;
        if (authorSortBy === 'pages') return b.totalPages - a.totalPages;
        return b.completedCount - a.completedCount;
      });
  }, [completedBooks, authorSortBy]);

  // Genre breakdown
  const genreStats: GenreStat[] = useMemo(() => {
    const map: Record<string, { count: number; totalPages: number; totalHours: number; totalRating: number; ratedCount: number }> = {};
    completedBooks.forEach((b) => {
      b.genres.forEach((genre) => {
        const gName = genre.trim();
        if (!gName) return;
        if (!map[gName]) {
          map[gName] = { count: 0, totalPages: 0, totalHours: 0, totalRating: 0, ratedCount: 0 };
        }
        map[gName].count += 1;
        map[gName].totalPages += b.pages || 0;
        map[gName].totalHours += b.readingHours || 0;
        if (b.rating) {
          map[gName].totalRating += b.rating;
          map[gName].ratedCount += 1;
        }
      });
    });

    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        count: data.count,
        totalPages: data.totalPages,
        totalHours: data.totalHours,
        avgRating: data.ratedCount > 0 ? +(data.totalRating / data.ratedCount).toFixed(1) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [completedBooks]);

  // Additional Insights / Superlatives
  const superlatives = useMemo(() => {
    if (completedBooks.length === 0) return null;

    const sortedByRating = [...completedBooks].filter((b) => b.rating).sort((a, b) => (b.rating || 0) - (a.rating || 0));
    const highestRated = sortedByRating[0];
    const lowestRated = sortedByRating[sortedByRating.length - 1];

    const sortedByPages = [...completedBooks].filter((b) => b.pages).sort((a, b) => (b.pages || 0) - (a.pages || 0));
    const longestBook = sortedByPages[0];
    const shortestBook = sortedByPages[sortedByPages.length - 1];

    // Fastest read (highest pages per hour)
    const withPace = [...completedBooks].filter((b) => b.pages && b.readingHours && b.readingHours > 0);
    const fastestRead = withPace.sort((a, b) => {
      const paceA = (a.pages || 0) / (a.readingHours || 1);
      const paceB = (b.pages || 0) / (b.readingHours || 1);
      return paceB - paceA;
    })[0];

    // Rating distribution 1 to 10
    const ratingDistribution = new Array(10).fill(0).map((_, i) => ({
      score: i + 1,
      count: completedBooks.filter((b) => b.rating === i + 1).length,
    }));

    const masterpieceCount = completedBooks.filter((b) => b.rating && b.rating >= 9).length;

    // Favorite genre (needs >= 2 books)
    const favoriteGenre = genreStats.find((g) => g.count >= 2);

    // Most read author
    const topAuthor = authorStats.length > 0 && authorStats[0].completedCount >= 2 ? authorStats[0] : null;

    return {
      highestRated,
      lowestRated,
      longestBook,
      shortestBook,
      fastestRead,
      ratingDistribution,
      masterpieceCount,
      favoriteGenre,
      topAuthor,
    };
  }, [completedBooks, genreStats, authorStats]);

  // Selected genre books
  const booksInSelectedGenre = useMemo(() => {
    if (!selectedGenreName) return [];
    return completedBooks.filter((b) => b.genres.includes(selectedGenreName));
  }, [completedBooks, selectedGenreName]);

  const handleExecuteMerge = () => {
    if (mergeSource && mergeTarget && mergeSource !== mergeTarget) {
      onMergeAuthors(mergeSource, mergeTarget);
      setIsMergeModalOpen(false);
      setMergeSource('');
      setMergeTarget('');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Editorial Title & Year Scope Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E2D8]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-[#24211D]">
            Читательская статистика
          </h1>
          <p className="mt-1 text-sm text-[#6B6357]">
            Глубокая аналитика прочитанных книг, продуктивности, жанров и авторов
          </p>
        </div>

        {/* Year Scope Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#7A7265]">Период:</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-[#FAF8F5] border border-[#E8E2D8] rounded px-3 py-1.5 text-xs text-[#24211D] font-medium focus:outline-none focus:border-[#24211D]"
          >
            <option value="all">За всё время</option>
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>{yr} год</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Aggregate Strip for selected scope */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
        <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-4 flex flex-col justify-between">
          <span className="text-[11px] text-[#7A7265] uppercase tracking-wider">Прочитано</span>
          <span className="text-2xl sm:text-3xl font-semibold font-mono tabular-nums text-[#24211D] mt-2">
            {totalReadCount}
          </span>
        </div>

        <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-4 flex flex-col justify-between">
          <span className="text-[11px] text-[#7A7265] uppercase tracking-wider">Всего страниц</span>
          <span className="text-2xl sm:text-3xl font-semibold font-mono tabular-nums text-[#24211D] mt-2">
            {totalPages.toLocaleString('ru-RU')}
          </span>
        </div>

        <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-4 flex flex-col justify-between shadow-2xs">
          <span className="text-[11px] font-semibold text-[#8A5A36] uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#8A5A36]" /> Часов чтения
          </span>
          <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-[#24211D] mt-2">
            {totalHours} <span className="text-sm font-sans font-medium text-[#7A7265]">ч.</span>
          </span>
        </div>

        <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-4 flex flex-col justify-between">
          <span className="text-[11px] text-[#7A7265] uppercase tracking-wider">Ср. оценка</span>
          <span className="text-2xl sm:text-3xl font-semibold font-mono tabular-nums text-[#8A5A36] mt-2">
            {avgRating}
          </span>
        </div>

        <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-4 flex flex-col justify-between">
          <span className="text-[11px] text-[#7A7265] uppercase tracking-wider">Стр. на книгу</span>
          <span className="text-2xl sm:text-3xl font-semibold font-mono tabular-nums text-[#24211D] mt-2">
            {avgPagesPerBook}
          </span>
        </div>

        <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-4 flex flex-col justify-between shadow-2xs">
          <span className="text-[11px] font-semibold text-[#8A5A36] uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#8A5A36]" /> Часов на книгу
          </span>
          <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-[#24211D] mt-2">
            {avgHoursPerBook} <span className="text-sm font-sans font-medium text-[#7A7265]">ч.</span>
          </span>
        </div>

        <div className="col-span-2 sm:col-span-2 lg:col-span-1 bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-4 flex flex-col justify-between">
          <span className="text-[11px] text-[#7A7265] uppercase tracking-wider">Оценка 9–10</span>
          <span className="text-2xl sm:text-3xl font-semibold font-mono tabular-nums text-[#273B30] mt-2">
            {superlatives?.masterpieceCount || 0}
          </span>
        </div>
      </div>

      {/* Dynamics Charts: Yearly and Monthly */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Books Read by Year */}
        <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-semibold text-base text-[#24211D]">
                Динамика чтения по годам
              </h3>
              <p className="text-xs text-[#7A7265]">Количество прочитанных книг по годам</p>
            </div>
            {mostProductiveYear && (
              <span className="text-xs font-mono tabular-nums text-[#8A5A36]">
                Пик: {mostProductiveYear.year} г. ({mostProductiveYear.books} кн.)
              </span>
            )}
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearlyStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="year" tick={{ fill: '#7A7265', fontSize: 12, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={{ stroke: '#E8E2D8' }} />
                <YAxis allowDecimals={false} tick={{ fill: '#7A7265', fontSize: 11, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={{ stroke: '#E8E2D8' }} />
                <Tooltip
                  formatter={(val: any) => [`${val ?? 0} книг`, 'Прочитано']}
                  labelFormatter={(l) => `${l} год`}
                  contentStyle={{ backgroundColor: '#FAF8F5', border: '1px solid #E8E2D8', borderRadius: '4px', fontSize: '12px' }}
                />
                <Bar dataKey="books" fill="#24211D" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Breakdown in Current Scope */}
        <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-semibold text-base text-[#24211D]">
                Распределение по месяцам
              </h3>
              <p className="text-xs text-[#7A7265]">
                {selectedYear === 'all' ? 'За все годы' : `За ${selectedYear} год`}
              </p>
            </div>
            {mostProductiveMonth && (
              <span className="text-xs font-mono tabular-nums text-[#273B30]">
                Лучший месяц: {mostProductiveMonth.monthName} ({mostProductiveMonth.books} кн.)
              </span>
            )}
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="monthName"
                  tickFormatter={(val) => val.substring(0, 3)}
                  tick={{ fill: '#7A7265', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E8E2D8' }}
                />
                <YAxis allowDecimals={false} tick={{ fill: '#7A7265', fontSize: 11, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={{ stroke: '#E8E2D8' }} />
                <Tooltip
                  formatter={(val: any) => [`${val ?? 0} книг`, 'Прочитано']}
                  contentStyle={{ backgroundColor: '#FAF8F5', border: '1px solid #E8E2D8', borderRadius: '4px', fontSize: '12px' }}
                />
                <Bar dataKey="books" fill="#8A5A36" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Genres Analytics Section with Clickable Breakdown */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-display font-semibold text-[#24211D]">
              Статистика по жанрам
            </h2>
            <p className="text-xs text-[#7A7265]">
              Нажмите на жанр, чтобы увидеть список прочитанных книг
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Donut Chart (5 cols) */}
          <div className="lg:col-span-5 bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-5 flex flex-col items-center">
            <h4 className="text-xs font-semibold text-[#7A7265] uppercase tracking-wider mb-2 self-start">
              Доля жанров
            </h4>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genreStats.slice(0, 8)}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {genreStats.slice(0, 8).map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      `${val ?? 0} книг`,
                      name ?? 'Жанр',
                    ]}
                    contentStyle={{ backgroundColor: '#FAF8F5', border: '1px solid #E8E2D8', borderRadius: '4px', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table / Genre List with avg rating & hours (7 cols) */}
          <div className="lg:col-span-7 bg-[#FAF8F5] border border-[#E8E2D8] rounded-md overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[340px]">
              <thead>
                <tr className="bg-[#F7F4EF] border-b border-[#E8E2D8] text-[#7A7265] uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-4 font-semibold">Жанр</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Книг</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Ср. оценка</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Стр.</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Часы</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE9DF]">
                {genreStats.map((g) => (
                  <tr
                    key={g.name}
                    onClick={() => setSelectedGenreName(selectedGenreName === g.name ? null : g.name)}
                    className={`hover:bg-[#F5F1E8] cursor-pointer transition-colors ${
                      selectedGenreName === g.name ? 'bg-[#EAE4DC]/70 font-medium' : ''
                    }`}
                  >
                    <td className="py-2 px-4 text-[#24211D] font-medium flex items-center justify-between">
                      <span>{g.name}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-[#8A8172]" />
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-[#24211D] font-semibold">
                      {g.count}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-[#8A5A36]">
                      {g.avgRating > 0 ? `${g.avgRating} / 10` : '—'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-[#6B6357]">
                      {g.totalPages.toLocaleString('ru-RU')}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-[#6B6357]">
                      {g.totalHours} ч.
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Genre Books Drawer / Filter view */}
        {selectedGenreName && (
          <div className="p-4 bg-[#F7F4EF] border border-[#E8E2D8] rounded-md space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-display font-semibold text-sm text-[#24211D]">
                Книги в жанре «{selectedGenreName}» ({booksInSelectedGenre.length})
              </h4>
              <button
                onClick={() => setSelectedGenreName(null)}
                className="text-xs text-[#7A7265] hover:text-[#24211D]"
              >
                Закрыть ×
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {booksInSelectedGenre.map((b) => (
                <div
                  key={b.id}
                  onClick={() => onSelectBook(b)}
                  className="cursor-pointer group flex flex-col items-center text-center bg-[#FAF8F5] p-2 rounded border border-[#E8E2D8] hover:border-[#D1C7B7]"
                >
                  <BookCover book={b} size="sm" showSpineCrease={false} />
                  <span className="text-[11px] font-medium text-[#24211D] line-clamp-1 mt-1.5 w-full">
                    {b.title}
                  </span>
                  <span className="text-[10px] text-[#7A7265] truncate w-full">{b.authors[0]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Author Ranking & Merge Tool */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-display font-semibold text-[#24211D]">
              Рейтинг авторов
            </h2>
            <p className="text-xs text-[#7A7265]">
              Нажмите на автора для просмотра его книг и личной статистики
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-[#EFE9DF] rounded text-xs">
              <button
                onClick={() => setAuthorSortBy('count')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  authorSortBy === 'count' ? 'bg-[#FAF8F5] text-[#24211D] font-medium shadow-xs' : 'text-[#7A7265]'
                }`}
              >
                По книгам
              </button>
              <button
                onClick={() => setAuthorSortBy('rating')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  authorSortBy === 'rating' ? 'bg-[#FAF8F5] text-[#24211D] font-medium shadow-xs' : 'text-[#7A7265]'
                }`}
              >
                По оценке
              </button>
              <button
                onClick={() => setAuthorSortBy('pages')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  authorSortBy === 'pages' ? 'bg-[#FAF8F5] text-[#24211D] font-medium shadow-xs' : 'text-[#7A7265]'
                }`}
              >
                По страницам
              </button>
            </div>

            <button
              onClick={() => setIsMergeModalOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-[#FAF8F5] border border-[#DDD5C7] rounded hover:border-[#24211D] transition-colors"
              title="Объединить дублирующиеся имена авторов"
            >
              <Combine className="w-3.5 h-3.5 text-[#8A8172]" />
              <span>Объединить дубли</span>
            </button>
          </div>
        </div>

        {/* Author Table */}
        <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-md overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[340px]">
            <thead>
              <tr className="bg-[#F7F4EF] border-b border-[#E8E2D8] text-[#7A7265] uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-4 font-semibold">Автор</th>
                <th className="py-2.5 px-3 font-semibold text-right">Прочитано книг</th>
                <th className="py-2.5 px-3 font-semibold text-right">Средняя оценка</th>
                <th className="py-2.5 px-3 font-semibold text-right">Всего страниц</th>
                <th className="py-2.5 px-3 font-semibold text-right">Часов</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE9DF]">
              {authorStats.map((auth) => (
                <tr
                  key={auth.name}
                  onClick={() => setSelectedAuthor(auth)}
                  className="hover:bg-[#F5F1E8] cursor-pointer transition-colors"
                >
                  <td className="py-2.5 px-4 text-[#24211D] font-medium flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-[#8A8172]" />
                    <span>{auth.name}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#24211D] font-semibold">
                    {auth.completedCount}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#8A5A36]">
                    {auth.avgRating > 0 ? `${auth.avgRating} / 10` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#6B6357]">
                    {auth.totalPages.toLocaleString('ru-RU')}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#6B6357]">
                    {auth.totalHours} ч.
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Ratings Distribution & Superlative Records */}
      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-display font-semibold text-[#24211D]">
          Рекорды и распределение оценок
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Rating Histogram (1 to 10) (7 cols) */}
          <div className="lg:col-span-7 bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-5 space-y-3">
            <h4 className="text-xs font-semibold text-[#7A7265] uppercase tracking-wider">
              Распределение оценок от 1 до 10
            </h4>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={superlatives?.ratingDistribution || []} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="score" tick={{ fill: '#7A7265', fontSize: 11, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={{ stroke: '#E8E2D8' }} />
                  <YAxis allowDecimals={false} tick={{ fill: '#7A7265', fontSize: 11, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={{ stroke: '#E8E2D8' }} />
                  <Tooltip
                    formatter={(val: any) => [`${val ?? 0} книг`, 'Количество']}
                    labelFormatter={(l) => `Оценка: ${l}/10`}
                    contentStyle={{ backgroundColor: '#FAF8F5', border: '1px solid #E8E2D8', borderRadius: '4px', fontSize: '12px' }}
                  />
                  <Bar dataKey="count" fill="#8A5A36" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Superlative Highlights Cards (5 cols) */}
          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Longest book */}
            <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-3.5 flex flex-col justify-between">
              <span className="text-[11px] text-[#7A7265] uppercase tracking-wider">Самая длинная</span>
              {superlatives?.longestBook ? (
                <div className="mt-2 cursor-pointer" onClick={() => onSelectBook(superlatives.longestBook)}>
                  <p className="font-display font-semibold text-sm text-[#24211D] line-clamp-1">
                    {superlatives.longestBook.title}
                  </p>
                  <p className="text-[11px] text-[#7A7265] font-mono tabular-nums mt-0.5">
                    {superlatives.longestBook.pages} страниц
                  </p>
                </div>
              ) : (
                <span className="text-xs text-[#8A8172] mt-2">—</span>
              )}
            </div>

            {/* Shortest book */}
            <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-3.5 flex flex-col justify-between">
              <span className="text-[11px] text-[#7A7265] uppercase tracking-wider">Самая короткая</span>
              {superlatives?.shortestBook ? (
                <div className="mt-2 cursor-pointer" onClick={() => onSelectBook(superlatives.shortestBook)}>
                  <p className="font-display font-semibold text-sm text-[#24211D] line-clamp-1">
                    {superlatives.shortestBook.title}
                  </p>
                  <p className="text-[11px] text-[#7A7265] font-mono tabular-nums mt-0.5">
                    {superlatives.shortestBook.pages} страниц
                  </p>
                </div>
              ) : (
                <span className="text-xs text-[#8A8172] mt-2">—</span>
              )}
            </div>

            {/* Fastest read */}
            <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-3.5 flex flex-col justify-between">
              <span className="text-[11px] text-[#7A7265] uppercase tracking-wider">Самая быстрая</span>
              {superlatives?.fastestRead ? (
                <div className="mt-2 cursor-pointer" onClick={() => onSelectBook(superlatives.fastestRead)}>
                  <p className="font-display font-semibold text-sm text-[#24211D] line-clamp-1">
                    {superlatives.fastestRead.title}
                  </p>
                  <p className="text-[11px] text-[#7A7265] font-mono tabular-nums mt-0.5">
                    ~{Math.round((superlatives.fastestRead.pages || 0) / (superlatives.fastestRead.readingHours || 1))} стр./час
                  </p>
                </div>
              ) : (
                <span className="text-xs text-[#8A8172] mt-2">—</span>
              )}
            </div>

            {/* Favorite genre */}
            <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-3.5 flex flex-col justify-between">
              <span className="text-[11px] text-[#7A7265] uppercase tracking-wider">Любимый жанр</span>
              {superlatives?.favoriteGenre ? (
                <div className="mt-2">
                  <p className="font-display font-semibold text-sm text-[#24211D]">
                    {superlatives.favoriteGenre.name}
                  </p>
                  <p className="text-[11px] text-[#7A7265] font-mono tabular-nums mt-0.5">
                    {superlatives.favoriteGenre.count} кн. · {superlatives.favoriteGenre.avgRating}/10
                  </p>
                </div>
              ) : (
                <p className="text-[10px] text-[#8A8172] mt-2 leading-tight">
                  Недостаточно данных (требуется от 2-х прочитанных книг в одном жанре)
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Author Detail Modal */}
      {selectedAuthor && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E2D8]">
              <h3 className="font-display font-semibold text-lg text-[#24211D]">
                {selectedAuthor.name}
              </h3>
              <button
                onClick={() => setSelectedAuthor(null)}
                className="p-1 rounded text-[#7A7265] hover:text-[#24211D]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Author summary metrics */}
            <div className="grid grid-cols-4 gap-2 text-center py-2 bg-[#F7F4EF] rounded border border-[#E8E2D8] text-xs">
              <div>
                <span className="text-[10px] text-[#7A7265] block">Книг</span>
                <span className="font-mono font-semibold text-[#24211D]">{selectedAuthor.completedCount}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#7A7265] block">Ср. оценка</span>
                <span className="font-mono font-semibold text-[#8A5A36]">{selectedAuthor.avgRating}/10</span>
              </div>
              <div>
                <span className="text-[10px] text-[#7A7265] block">Страниц</span>
                <span className="font-mono text-[#24211D]">{selectedAuthor.totalPages}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#7A7265] block">Часов</span>
                <span className="font-mono text-[#24211D]">{selectedAuthor.totalHours} ч.</span>
              </div>
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-[#7A7265]">
                Книги в библиотеке
              </h5>
              <div className="divide-y divide-[#EFE9DF] max-h-60 overflow-y-auto">
                {selectedAuthor.books.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => {
                      setSelectedAuthor(null);
                      onSelectBook(b);
                    }}
                    className="py-2 px-1 flex items-center justify-between gap-2 hover:bg-[#F5F1E8] cursor-pointer rounded"
                  >
                    <span className="font-display font-medium text-xs text-[#24211D] truncate">
                      {b.title}
                    </span>
                    <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-[#8A5A36]">
                      {b.rating ? `${b.rating}/10` : 'Читаю'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-[#E8E2D8] flex justify-end">
              <button
                onClick={() => setSelectedAuthor(null)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#24211D] hover:bg-[#3B342C] rounded"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Author Merge Modal */}
      {isMergeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E2D8]">
              <h3 className="font-display font-semibold text-base text-[#24211D]">
                Объединение авторов
              </h3>
              <button
                onClick={() => setIsMergeModalOpen(false)}
                className="p-1 rounded text-[#7A7265] hover:text-[#24211D]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#6B6357]">
              Если один и тот же автор записан по-разному (например, «Ф. М. Достоевский» и «Фёдор Достоевский»), выберите исходное имя и каноническое имя для объединения.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#7A7265] mb-1 font-medium">Исходное имя (будет заменено):</label>
                <select
                  value={mergeSource}
                  onChange={(e) => setMergeSource(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#DDD5C7] rounded px-3 py-1.5 text-xs text-[#24211D]"
                >
                  <option value="">Выберите автора...</option>
                  {authorStats.map((a) => (
                    <option key={a.name} value={a.name}>{a.name} ({a.completedCount} кн.)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#7A7265] mb-1 font-medium">Целевое каноническое имя:</label>
                <input
                  type="text"
                  value={mergeTarget}
                  onChange={(e) => setMergeTarget(e.target.value)}
                  placeholder="Например: Фёдор Достоевский"
                  className="w-full bg-[#FAF8F5] border border-[#DDD5C7] rounded px-3 py-1.5 text-xs text-[#24211D]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#E8E2D8] flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsMergeModalOpen(false)}
                className="px-3.5 py-1.5 text-[#6B6357] hover:text-[#24211D]"
              >
                Отмена
              </button>
              <button
                disabled={!mergeSource || !mergeTarget.trim() || mergeSource === mergeTarget.trim()}
                onClick={handleExecuteMerge}
                className="px-4 py-1.5 font-semibold text-white bg-[#24211D] hover:bg-[#3B342C] rounded disabled:opacity-50"
              >
                Объединить записи
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
