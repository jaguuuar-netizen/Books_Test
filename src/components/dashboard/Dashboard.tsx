import React from 'react';
import { User } from 'firebase/auth';
import { Book } from '../../types/book';
import { BookCover } from '../common/BookCover';
import { formatLongDateRU } from '../../utils/date';
import { Plus, Check, Clock, BookOpen, Star, Sparkles, Lock, Cloud } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardProps {
  books: Book[];
  onOpenAddModal: () => void;
  onSelectBook: (book: Book) => void;
  onGoToShelf: () => void;
  onQuickComplete: (book: Book) => void;
  onLoadDemo: () => void;
  currentUser?: User | null;
  onOpenAuthModal?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  books,
  onOpenAddModal,
  onSelectBook,
  onGoToShelf,
  onQuickComplete,
  onLoadDemo,
  currentUser,
  onOpenAuthModal,
}) => {
  const currentYear = new Date().getFullYear();

  // Metrics calculations
  const totalBooks = books.length;
  const completedBooks = books.filter((b) => b.status === 'completed');
  const readingBooks = books.filter((b) => b.status === 'reading');

  const totalPages = books.reduce((sum, b) => {
    // If completed or reading with recorded pages
    return sum + (b.pages || 0);
  }, 0);

  const totalHours = books.reduce((sum, b) => sum + (b.readingHours || 0), 0);

  const ratedBooks = completedBooks.filter((b) => typeof b.rating === 'number' && b.rating > 0);
  const avgRating = ratedBooks.length > 0
    ? (ratedBooks.reduce((sum, b) => sum + (b.rating || 0), 0) / ratedBooks.length).toFixed(1)
    : '—';

  const readThisYear = completedBooks.filter((b) => {
    if (!b.endDate) return false;
    return b.endDate.startsWith(String(currentYear));
  }).length;

  // Recently finished books (sorted by endDate desc, fallback updatedAt)
  const recentlyFinished = [...completedBooks].sort((a, b) => {
    const dateA = a.endDate || a.updatedAt;
    const dateB = b.endDate || b.updatedAt;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  }).slice(0, 5);

  // Dynamic statistics by year
  const yearCountsMap: Record<string, number> = {};
  for (const b of completedBooks) {
    if (b.endDate) {
      const yr = b.endDate.substring(0, 4);
      yearCountsMap[yr] = (yearCountsMap[yr] || 0) + 1;
    }
  }

  const yearlyChartData = Object.keys(yearCountsMap)
    .sort()
    .map((year) => ({
      year,
      books: yearCountsMap[year],
    }));

  // Empty state handling
  if (totalBooks === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 sm:py-24 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#EFE9DF] flex items-center justify-center text-[#5E3023]">
          <BookOpen className="w-8 h-8" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-display font-semibold text-[#24211D]">
          Ваша книжная полка пуста
        </h2>
        <p className="mt-3 text-base text-[#6B6357] max-w-lg mx-auto">
          Начните вести личный читательский дневник: отмечайте прочитанные книги, сохраняйте цитаты, выставляйте оценки и отслеживайте статистику.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onOpenAddModal}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-[#FAF8F5] bg-[#24211D] rounded-md hover:bg-[#3B342C] transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Добавить первую книгу
          </button>
          <button
            onClick={() => {
              if (!currentUser) {
                onOpenAuthModal?.();
                return;
              }
              onLoadDemo();
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-[#24211D] bg-[#EFE9DF] rounded-md hover:bg-[#E4DCCE] transition-colors"
          >
            <Sparkles className="w-4 h-4 text-[#8A5A36]" />
            Загрузить демо-библиотеку
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Editorial Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-[#E8E2D8]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-[#24211D]">
            Читательский дашборд
          </h1>
          <p className="mt-1 text-sm text-[#6B6357]">
            Обзор вашей личной библиотеки, текущих книг и темпа чтения
          </p>
        </div>
        <div className="text-xs text-[#8A8172] font-mono tabular-nums">
          Срез на {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Read-Only Banner for Unauthenticated Visitors */}
      {!currentUser && (
        <div className="bg-[#FFF8E7] border border-[#E8DFCF] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#5C4828]">
          <div className="flex items-start sm:items-center gap-2.5">
            <Lock className="w-4 h-4 text-[#8A5A36] shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-semibold text-[#24211D]">Книжная полка работает в режиме предварительного просмотра.</span>
              <p className="text-[11px] text-[#6B5A42] mt-0.5">
                Чтобы добавлять книги, сохранять прочитанное в облако и смотреть персональную статистику, авторизуйтесь через Google.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenAuthModal}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-[#24211D] hover:bg-[#3B342C] text-white rounded font-medium text-xs transition-colors shrink-0 shadow-xs"
          >
            <Cloud className="w-3.5 h-3.5 text-[#EFE9DF]" />
            <span>Подключить Google Облако</span>
          </button>
        </div>
      )}

      {/* Primary KPI Strips - Anti-slop, clean typography, tabular figures */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
        <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-4 flex flex-col justify-between">
          <span className="text-xs text-[#7A7265] uppercase tracking-wider font-sans">Всего книг</span>
          <span className="text-2xl sm:text-3xl font-semibold text-[#24211D] font-mono tabular-nums mt-2">
            {totalBooks}
          </span>
        </div>

        <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-4 flex flex-col justify-between">
          <span className="text-xs text-[#7A7265] uppercase tracking-wider font-sans">Прочитано</span>
          <span className="text-2xl sm:text-3xl font-semibold text-[#24211D] font-mono tabular-nums mt-2">
            {completedBooks.length}
          </span>
        </div>

        <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-4 flex flex-col justify-between">
          <span className="text-xs text-[#7A7265] uppercase tracking-wider font-sans">Сейчас читаю</span>
          <span className="text-2xl sm:text-3xl font-semibold text-[#8A5A36] font-mono tabular-nums mt-2">
            {readingBooks.length}
          </span>
        </div>

        <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-4 flex flex-col justify-between">
          <span className="text-xs text-[#7A7265] uppercase tracking-wider font-sans">Страниц</span>
          <span className="text-2xl sm:text-3xl font-semibold text-[#24211D] font-mono tabular-nums mt-2">
            {totalPages.toLocaleString('ru-RU')}
          </span>
        </div>

        <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-4 flex flex-col justify-between">
          <span className="text-xs text-[#7A7265] uppercase tracking-wider font-sans">Часов чтения</span>
          <span className="text-2xl sm:text-3xl font-semibold text-[#24211D] font-mono tabular-nums mt-2">
            {totalHours} ч.
          </span>
        </div>

        <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-4 flex flex-col justify-between">
          <span className="text-xs text-[#7A7265] uppercase tracking-wider font-sans">Ср. оценка</span>
          <span className="text-2xl sm:text-3xl font-semibold text-[#24211D] font-mono tabular-nums mt-2 flex items-baseline gap-1">
            {avgRating} <span className="text-xs text-[#8A8172] font-normal">/ 10</span>
          </span>
        </div>

        <div className="col-span-2 sm:col-span-2 lg:col-span-1 bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-4 flex flex-col justify-between">
          <span className="text-xs text-[#7A7265] uppercase tracking-wider font-sans">За {currentYear} г.</span>
          <span className="text-2xl sm:text-3xl font-semibold text-[#273B30] font-mono tabular-nums mt-2">
            {readThisYear}
          </span>
        </div>
      </div>

      {/* Section: Currently Reading */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-display font-semibold text-[#24211D]">
              Сейчас читаю
            </h2>
            <p className="text-xs text-[#7A7265]">
              Книги, находящиеся в активном процессе чтения
            </p>
          </div>
          {readingBooks.length > 0 && (
            <span className="text-xs text-[#7A7265] font-mono tabular-nums">
              {readingBooks.length} {readingBooks.length === 1 ? 'книга' : 'книги'}
            </span>
          )}
        </div>

        {readingBooks.length === 0 ? (
          <div className="p-6 rounded-md border border-dashed border-[#DDD5C7] bg-[#F7F4EF] text-center">
            <p className="text-sm text-[#7A7265]">
              Сейчас у вас нет книг в процессе чтения.
            </p>
            <button
              onClick={onOpenAddModal}
              className="mt-2 text-xs font-semibold text-[#24211D] hover:underline"
            >
              + Начать новую книгу
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {readingBooks.map((book) => {
              // Calculate days in reading
              let daysReading = 0;
              if (book.startDate) {
                const diffMs = Math.max(0, Date.now() - new Date(book.startDate).getTime());
                daysReading = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
              }

              return (
                <div
                  key={book.id}
                  className="group relative bg-[#FAF8F5] border border-[#E8E2D8] hover:border-[#D1C7B7] rounded-md p-4 transition-all duration-200 flex gap-4"
                >
                  <div
                    onClick={() => onSelectBook(book)}
                    className="cursor-pointer shrink-0"
                  >
                    <BookCover book={book} size="md" />
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h3
                        onClick={() => onSelectBook(book)}
                        className="font-display font-semibold text-[#24211D] text-base leading-snug line-clamp-2 cursor-pointer hover:text-[#5E3023] transition-colors"
                      >
                        {book.title}
                      </h3>
                      <p className="text-xs text-[#7A7265] mt-0.5 truncate">
                        {book.authors.join(', ')}
                      </p>

                      {/* Metadata without static pills */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#8A8172] mt-2 font-mono tabular-nums">
                        {book.pages && <span>{book.pages} стр.</span>}
                        {book.readingHours ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{book.readingHours} ч.</span>
                          </>
                        ) : null}
                        {daysReading > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{daysReading} дн. в процессе</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 mt-2 border-t border-[#EFE9DF] flex items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          if (!currentUser) {
                            onOpenAuthModal?.();
                            return;
                          }
                          onQuickComplete(book);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#273B30] bg-[#E9EFE9] hover:bg-[#DCE7DC] rounded transition-colors"
                        title={currentUser ? "Отметить как прочитанную" : "Требуется авторизация через Google"}
                      >
                        {!currentUser ? <Lock className="w-3.5 h-3.5 text-[#8A8172]" /> : <Check className="w-3.5 h-3.5" />}
                        <span>Завершить</span>
                      </button>

                      <button
                        onClick={() => onSelectBook(book)}
                        className="text-xs text-[#7A7265] hover:text-[#24211D] transition-colors underline-offset-2 hover:underline"
                      >
                        Подробнее
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Two-Column Split: Recently Finished + Yearly Reading Dynamics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Recently Finished (7 cols) */}
        <section className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-display font-semibold text-[#24211D]">
              Недавно прочитано
            </h2>
            <button
              onClick={onGoToShelf}
              className="text-xs text-[#7A7265] hover:text-[#24211D] font-medium transition-colors"
            >
              Вся библиотека →
            </button>
          </div>

          {recentlyFinished.length === 0 ? (
            <div className="p-6 rounded-md border border-[#E8E2D8] bg-[#F7F4EF] text-center text-xs text-[#7A7265]">
              Пока нет завершённых книг.
            </div>
          ) : (
            <div className="divide-y divide-[#EFE9DF] border border-[#E8E2D8] rounded-md bg-[#FAF8F5]">
              {recentlyFinished.map((book) => (
                <div
                  key={book.id}
                  onClick={() => onSelectBook(book)}
                  className="p-3.5 sm:p-4 flex items-center gap-4 hover:bg-[#F5F1E8]/50 cursor-pointer transition-colors"
                >
                  <BookCover book={book} size="sm" showSpineCrease={false} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="font-display font-medium text-sm text-[#24211D] truncate">
                        {book.title}
                      </h4>
                      {book.rating ? (
                        <div className="flex items-center gap-1 shrink-0 text-xs font-mono font-medium text-[#8A5A36] tabular-nums">
                          <Star className="w-3.5 h-3.5 fill-[#8A5A36] text-[#8A5A36]" />
                          <span>{book.rating}/10</span>
                        </div>
                      ) : null}
                    </div>

                    <p className="text-xs text-[#7A7265] truncate mt-0.5">
                      {book.authors.join(', ')}
                    </p>

                    <div className="flex items-center gap-2 text-[11px] text-[#8A8172] mt-1 font-mono tabular-nums">
                      {book.endDate && (
                        <span>
                          {formatLongDateRU(book.endDate)}
                        </span>
                      )}
                      {book.pages && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{book.pages} стр.</span>
                        </>
                      )}
                      {book.readingHours && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{book.readingHours} ч.</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Dynamics By Year (5 cols) */}
        <section className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-display font-semibold text-[#24211D]">
              Динамика по годам
            </h2>
            <span className="text-xs text-[#8A8172] font-mono tabular-nums">
              Прочитано книг
            </span>
          </div>

          <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-4 sm:p-5">
            {yearlyChartData.length === 0 ? (
              <p className="text-xs text-[#7A7265] text-center py-10">
                Завершите хотя бы одну книгу, чтобы увидеть график по годам.
              </p>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="year"
                      tick={{ fill: '#7A7265', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                      axisLine={{ stroke: '#E8E2D8' }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: '#7A7265', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                      axisLine={{ stroke: '#E8E2D8' }}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(val: any) => [
                        `${val ?? 0} ${val === 1 ? 'книга' : 'книг(и)'}`,
                        'Прочитано',
                      ]}
                      labelFormatter={(label) => `${label} год`}
                      contentStyle={{
                        backgroundColor: '#FAF8F5',
                        border: '1px solid #E8E2D8',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#24211D',
                      }}
                    />
                    <Bar
                      dataKey="books"
                      fill="#3B342C"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Mini Shelf Showcase */}
      <section className="space-y-4 pt-4 border-t border-[#E8E2D8]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-display font-semibold text-[#24211D]">
              Моя библиотека
            </h2>
            <p className="text-xs text-[#7A7265]">
              Быстрый взгляд на ваши книги
            </p>
          </div>
          <button
            onClick={onGoToShelf}
            className="text-xs text-[#24211D] font-medium hover:underline"
          >
            Открыть книжную полку ({totalBooks}) →
          </button>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4">
          {books.slice(0, 8).map((book) => (
            <div
              key={book.id}
              onClick={() => onSelectBook(book)}
              className="cursor-pointer group flex flex-col items-center text-center"
            >
              <BookCover book={book} size="md" className="mx-auto" />
              <h5 className="mt-2 text-xs font-medium text-[#24211D] line-clamp-1 group-hover:text-[#5E3023] transition-colors w-full">
                {book.title}
              </h5>
              <p className="text-[11px] text-[#7A7265] truncate w-full">
                {book.authors[0]}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
