import React, { useState, useMemo } from 'react';
import { Book } from '../../types/book';
import { BookCover } from '../common/BookCover';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle2, 
  BookOpen, 
  Star 
} from 'lucide-react';

interface CalendarViewProps {
  books: Book[];
  onSelectBook: (book: Book) => void;
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const WEEKDAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const CalendarView: React.FC<CalendarViewProps> = ({
  books,
  onSelectBook,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'calendar' | 'timeline'>('calendar');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDayString, setSelectedDayString] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDayString(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDayString(null);
  };

  // Build grid of days for the month
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    let startDayOfWeek = firstDayOfMonth.getDay() - 1; // 0 = Mon, 6 = Sun
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const daysInMonth = lastDayOfMonth.getDate();

    const days = [];
    // Padding before month starts
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ day, dayStr });
    }
    return days;
  }, [year, month]);

  // Index books by date
  const dateEventsMap = useMemo(() => {
    const map: Record<string, { started: Book[]; completed: Book[] }> = {};

    books.forEach((b) => {
      if (b.startDate) {
        if (!map[b.startDate]) map[b.startDate] = { started: [], completed: [] };
        map[b.startDate].started.push(b);
      }
      if (b.endDate) {
        if (!map[b.endDate]) map[b.endDate] = { started: [], completed: [] };
        map[b.endDate].completed.push(b);
      }
    });

    return map;
  }, [books]);

  // Books for selected day
  const selectedDayEvents = selectedDayString ? dateEventsMap[selectedDayString] : null;

  // Chronological Grouping by Year and Month for Timeline Tab
  const timelineGroups = useMemo(() => {
    const completed = books
      .filter((b) => b.status === 'completed' && b.endDate)
      .sort((a, b) => new Date(b.endDate!).getTime() - new Date(a.endDate!).getTime());

    const groups: { year: string; months: { monthName: string; books: Book[] }[] }[] = [];
    const yearMap: Record<string, Record<number, Book[]>> = {};

    completed.forEach((b) => {
      const parts = b.endDate!.split('-');
      const y = parts[0];
      const m = parseInt(parts[1], 10) - 1;
      if (!yearMap[y]) yearMap[y] = {};
      if (!yearMap[y][m]) yearMap[y][m] = [];
      yearMap[y][m].push(b);
    });

    Object.keys(yearMap)
      .sort((a, b) => b.localeCompare(a))
      .forEach((y) => {
        const monthsList = Object.keys(yearMap[y])
          .map((m) => parseInt(m, 10))
          .sort((a, b) => b - a)
          .map((m) => ({
            monthName: MONTH_NAMES[m],
            books: yearMap[y][m],
          }));

        groups.push({
          year: y,
          months: monthsList,
        });
      });

    return groups;
  }, [books]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E2D8]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-[#24211D]">
            Календарь и хронология чтения
          </h1>
          <p className="mt-1 text-sm text-[#6B6357]">
            Отслеживайте даты начала и завершения книг в календаре и хронологической ленте
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#EFE9DF] rounded-md self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab('calendar')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              activeSubTab === 'calendar'
                ? 'bg-[#FAF8F5] text-[#24211D] shadow-sm font-semibold'
                : 'text-[#7A7265] hover:text-[#24211D]'
            }`}
          >
            Сетка календаря
          </button>
          <button
            onClick={() => setActiveSubTab('timeline')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              activeSubTab === 'timeline'
                ? 'bg-[#FAF8F5] text-[#24211D] shadow-sm font-semibold'
                : 'text-[#7A7265] hover:text-[#24211D]'
            }`}
          >
            Хронология по годам
          </button>
        </div>
      </div>

      {activeSubTab === 'calendar' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Calendar Widget (7 cols) */}
          <div className="lg:col-span-8 bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-5 space-y-4">
            {/* Month Navigator */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E2D8]">
              <h2 className="font-display font-semibold text-lg text-[#24211D]">
                {MONTH_NAMES[month]} {year}
              </h2>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded text-[#7A7265] hover:text-[#24211D] hover:bg-[#EFE9DF] transition-colors"
                  title="Предыдущий месяц"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setCurrentDate(new Date());
                    setSelectedDayString(null);
                  }}
                  className="px-2.5 py-1 text-xs text-[#24211D] font-medium bg-[#EFE9DF] rounded hover:bg-[#E4DCCE] transition-colors"
                >
                  Сегодня
                </button>
                <button
                  onClick={handleNextMonth}
                  className="p-1.5 rounded text-[#7A7265] hover:text-[#24211D] hover:bg-[#EFE9DF] transition-colors"
                  title="Следующий месяц"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1 text-center font-sans text-xs font-semibold text-[#8A8172]">
              {WEEKDAY_NAMES.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Month Grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {calendarDays.map((item, idx) => {
                if (!item) {
                  return <div key={`empty-${idx}`} className="h-16 sm:h-20 bg-transparent" />;
                }

                const events = dateEventsMap[item.dayStr];
                const hasStarted = events?.started && events.started.length > 0;
                const hasCompleted = events?.completed && events.completed.length > 0;
                const isSelected = selectedDayString === item.dayStr;

                return (
                  <div
                    key={item.dayStr}
                    onClick={() => setSelectedDayString(item.dayStr)}
                    className={`h-16 sm:h-20 p-1.5 border rounded flex flex-col justify-between cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#24211D] bg-[#F1EAE0] ring-1 ring-[#24211D]'
                        : 'border-[#EFE9DF] bg-[#FAF8F5] hover:bg-[#F7F4EF]'
                    }`}
                  >
                    <span className="font-mono text-xs text-[#24211D] font-medium">
                      {item.day}
                    </span>

                    {/* Book Markers */}
                    <div className="space-y-0.5 overflow-hidden">
                      {hasCompleted && (
                        <div className="flex items-center gap-1 text-[9px] font-medium text-[#273B30] bg-[#E9EFE9] px-1 py-0.5 rounded truncate">
                          <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{events.completed[0].title}</span>
                        </div>
                      )}
                      {hasStarted && !hasCompleted && (
                        <div className="flex items-center gap-1 text-[9px] font-medium text-[#8A5A36] bg-[#F7EFE9] px-1 py-0.5 rounded truncate">
                          <BookOpen className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{events.started[0].title}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Day Event Drawer (4 cols) */}
          <div className="lg:col-span-4 bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-5 space-y-4">
            <h3 className="font-display font-semibold text-base text-[#24211D]">
              События дня
            </h3>

            {selectedDayString ? (
              <div className="space-y-3">
                <span className="text-xs font-mono text-[#8A8172] block">
                  {new Date(selectedDayString).toLocaleDateString('ru-RU', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>

                {selectedDayEvents && (selectedDayEvents.completed.length > 0 || selectedDayEvents.started.length > 0) ? (
                  <div className="space-y-3">
                    {selectedDayEvents.completed.map((b) => (
                      <div
                        key={b.id}
                        onClick={() => onSelectBook(b)}
                        className="p-3 bg-[#E9EFE9] rounded border border-[#CDE0CD] flex gap-3 cursor-pointer hover:bg-[#DFEADF] transition-colors"
                      >
                        <BookCover book={b} size="sm" showSpineCrease={false} />
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] uppercase font-semibold text-[#273B30] block">
                            Завершена книга
                          </span>
                          <h4 className="font-display font-medium text-xs text-[#24211D] truncate">
                            {b.title}
                          </h4>
                          <span className="text-[11px] text-[#7A7265] block truncate">{b.authors[0]}</span>
                          {b.rating && (
                            <span className="text-[10px] font-mono text-[#8A5A36] mt-1 block">
                              Оценка: {b.rating}/10
                            </span>
                          )}
                        </div>
                      </div>
                    ))}

                    {selectedDayEvents.started.map((b) => (
                      <div
                        key={b.id}
                        onClick={() => onSelectBook(b)}
                        className="p-3 bg-[#F7EFE9] rounded border border-[#EBDCD0] flex gap-3 cursor-pointer hover:bg-[#EFE4D7] transition-colors"
                      >
                        <BookCover book={b} size="sm" showSpineCrease={false} />
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] uppercase font-semibold text-[#8A5A36] block">
                            Начато чтение
                          </span>
                          <h4 className="font-display font-medium text-xs text-[#24211D] truncate">
                            {b.title}
                          </h4>
                          <span className="text-[11px] text-[#7A7265] block truncate">{b.authors[0]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#7A7265] py-4 text-center">
                    В этот день не зафиксировано начала или завершения чтения.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-[#7A7265] py-6 text-center">
                Выберите любую дату в сетке календаря, чтобы увидеть детали чтения.
              </p>
            )}
          </div>
        </div>
      ) : (
        /* Chronological Timeline by Year and Month */
        <div className="space-y-8">
          {timelineGroups.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-[#DDD5C7] rounded-md bg-[#F7F4EF]">
              <p className="text-sm text-[#7A7265]">
                Пока нет прочитанных книг с зафиксированными датами завершения.
              </p>
            </div>
          ) : (
            timelineGroups.map((group) => (
              <div key={group.year} className="space-y-4">
                <div className="sticky top-16 z-10 bg-[#FAF8F5]/90 backdrop-blur-xs py-2 border-b border-[#E8E2D8] flex items-baseline justify-between">
                  <h3 className="font-display font-bold text-xl text-[#24211D]">
                    {group.year} год
                  </h3>
                  <span className="text-xs font-mono text-[#8A8172] tabular-nums">
                    {group.months.reduce((sum, m) => sum + m.books.length, 0)} книг
                  </span>
                </div>

                <div className="space-y-6 pl-2 sm:pl-4 border-l-2 border-[#E8E2D8] ml-2">
                  {group.months.map((m) => (
                    <div key={m.monthName} className="space-y-3 relative">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#8A8172] -ml-[19px] sm:-ml-[27px] ring-4 ring-[#FAF8F5]" />
                        <h4 className="font-display font-medium text-sm text-[#5E3023]">
                          {m.monthName}
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {m.books.map((b) => (
                          <div
                            key={b.id}
                            onClick={() => onSelectBook(b)}
                            className="bg-[#FAF8F5] border border-[#E8E2D8] hover:border-[#D1C7B7] rounded-md p-3 flex gap-3 cursor-pointer transition-colors"
                          >
                            <BookCover book={b} size="sm" showSpineCrease={false} />
                            <div className="flex-1 min-w-0">
                              <h5 className="font-display font-medium text-xs text-[#24211D] truncate">
                                {b.title}
                              </h5>
                              <p className="text-[11px] text-[#7A7265] truncate">{b.authors[0]}</p>
                              <div className="flex items-center gap-2 text-[10px] text-[#8A8172] font-mono tabular-nums mt-1.5">
                                {b.rating && (
                                  <span className="text-[#8A5A36] font-semibold flex items-center gap-0.5">
                                    <Star className="w-2.5 h-2.5 fill-[#8A5A36]" />
                                    {b.rating}/10
                                  </span>
                                )}
                                {b.pages && <span>{b.pages} стр.</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
