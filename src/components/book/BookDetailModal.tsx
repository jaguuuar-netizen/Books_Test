import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { Book } from '../../types/book';
import { BookCover } from '../common/BookCover';
import { formatDateRU } from '../../utils/date';
import { BookRecommendationsModal } from './BookRecommendationsModal';
import { 
  X, 
  Edit3, 
  Trash2, 
  CheckCircle, 
  Clock, 
  BookOpen, 
  Star, 
  Calendar, 
  Compass, 
  Building2, 
  RotateCcw,
  Gauge,
  Lock,
  Cloud,
  Sparkles
} from 'lucide-react';

interface BookDetailModalProps {
  book: Book | null;
  onClose: () => void;
  onEdit: (book: Book) => void;
  onDelete: (id: string) => void;
  onQuickComplete: (book: Book) => void;
  onRevertToReading: (book: Book) => void;
  currentUser?: User | null;
  onOpenAuthModal?: () => void;
  books?: Book[];
  onAddBookToLibrary?: (newBook: Partial<Book>) => Promise<void>;
  onSelectBook?: (book: Book) => void;
}

export const BookDetailModal: React.FC<BookDetailModalProps> = ({
  book,
  onClose,
  onEdit,
  onDelete,
  onQuickComplete,
  onRevertToReading,
  currentUser,
  onOpenAuthModal,
  books = [],
  onAddBookToLibrary,
  onSelectBook,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [showSimilarModal, setShowSimilarModal] = useState(false);

  if (!book) return null;

  // Reading speed calculation
  let pagesPerHour: number | null = null;
  let minutesPerPage: number | null = null;
  if (book.pages && book.readingHours && book.readingHours > 0) {
    pagesPerHour = Math.round(book.pages / book.readingHours);
    minutesPerPage = Math.round((book.readingHours * 60) / book.pages);
  }

  // Days spent
  let daysDiff: number | null = null;
  if (book.startDate && book.endDate) {
    const diff = Math.max(1, Math.round((new Date(book.endDate).getTime() - new Date(book.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1);
    daysDiff = diff;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div 
        className="relative w-full max-w-2xl bg-[#FAF8F5] border border-[#E8E2D8] rounded-lg shadow-xl overflow-hidden my-6 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E2D8] bg-[#F7F4EF]">
          <div className="flex items-center gap-2 text-xs font-mono text-[#7A7265] uppercase tracking-wider">
            <span>{book.status === 'completed' ? 'Прочитанная книга' : book.status === 'planned' ? 'В планах (Виш-лист)' : 'Сейчас читаю'}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSimilarModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#8A5A36] bg-[#F5EFE6] hover:bg-[#EFE7DA] border border-[#E0D5C1] hover:border-[#8A5A36] rounded-md transition-all shadow-2xs cursor-pointer active:scale-95"
              title="Найти похожие книги и рекомендации к этому произведению"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#8A5A36]" />
              <span>Рекомендации</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-[#7A7265] hover:text-[#24211D] hover:bg-[#EAE4DC] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notice for unauthorized visitors */}
        {!currentUser && (
          <div className="bg-[#FFF8E7] border-b border-[#E8DFCF] px-6 py-2.5 flex items-center justify-between gap-3 text-xs text-[#5C4828]">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-[#8A5A36] shrink-0" />
              <span>Режим просмотра. Чтобы менять статус, редактировать или удалять книгу, подключите Google Облако.</span>
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
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            {/* Book Cover */}
            <div className="mx-auto sm:mx-0 shrink-0">
              <BookCover book={book} size="lg" />
            </div>

            {/* Main Info */}
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-display font-semibold text-[#24211D] leading-tight">
                  {book.title}
                </h2>
                <p className="text-sm font-medium text-[#7A7265] mt-1">
                  {book.authors.join(', ')}
                </p>
                {book.series && (
                  <p className="text-xs text-[#8A8172] mt-0.5">
                    Серия: {book.series} {book.seriesNumber ? `(книга #${book.seriesNumber})` : ''}
                  </p>
                )}
              </div>

              {/* Rating */}
              {book.rating ? (
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex items-center gap-1 bg-[#F1EAE0] px-3 py-1 rounded text-sm font-mono font-semibold text-[#8A5A36] tabular-nums">
                    <Star className="w-4 h-4 fill-[#8A5A36] text-[#8A5A36]" />
                    <span>{book.rating} / 10</span>
                  </div>
                  <span className="text-xs text-[#7A7265]">
                    {book.rating >= 9 ? 'Шедевр' : book.rating >= 7 ? 'Отличная книга' : 'Хорошая книга'}
                  </span>
                </div>
              ) : book.status === 'reading' ? (
                <div className="pt-1">
                  <button
                    onClick={() => {
                      if (!currentUser) {
                        onClose();
                        onOpenAuthModal?.();
                        return;
                      }
                      onClose();
                      onQuickComplete(book);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#FAF8F5] bg-[#273B30] hover:bg-[#1E2D25] rounded transition-colors"
                  >
                    {!currentUser ? <Lock className="w-3.5 h-3.5 text-[#D1C7B7]" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    <span>Завершить чтение и оценить</span>
                  </button>
                </div>
              ) : null}

              {/* Genres without pills */}
              {book.genres && book.genres.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#6B6357]">
                  <span className="text-[#8A8172]">Жанры:</span>
                  {book.genres.map((g, idx) => (
                    <span key={g}>
                      <span className="text-[#24211D]">{g}</span>
                      {idx < book.genres.length - 1 && <span className="text-[#BBB] ml-1.5" aria-hidden="true">·</span>}
                    </span>
                  ))}
                </div>
              )}

              {/* Meta Grid */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#EFE9DF] text-xs">
                <div className="bg-[#FAF8F5] p-2 rounded border border-[#E8E2D8]">
                  <span className="text-[#8A8172] block text-[11px]">Страниц:</span>
                  <span className="font-mono tabular-nums font-semibold text-sm text-[#24211D]">
                    {book.pages ? `${book.pages} стр.` : '—'}
                  </span>
                </div>

                <div className="bg-[#FAF8F5] p-2 rounded border border-[#E8E2D8]">
                  <span className="text-[#8A5A36] font-medium flex items-center gap-1 text-[11px]">
                    <Clock className="w-3 h-3 text-[#8A5A36]" /> Время чтения:
                  </span>
                  <span className="font-mono tabular-nums font-bold text-sm text-[#24211D]">
                    {book.readingHours ? `${book.readingHours} ч.` : '—'}
                  </span>
                </div>

                <div className="bg-[#FAF8F5] p-2 rounded border border-[#E8E2D8]">
                  <span className="text-[#8A8172] block text-[11px]">Начало:</span>
                  <span className="font-mono tabular-nums text-xs text-[#24211D]">
                    {formatDateRU(book.startDate)}
                  </span>
                </div>

                <div className="bg-[#FAF8F5] p-2 rounded border border-[#E8E2D8]">
                  <span className="text-[#8A8172] block text-[11px]">Окончание:</span>
                  <span className="font-mono tabular-nums text-xs text-[#24211D]">
                    {formatDateRU(book.endDate)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Reading Speed Analytics Pill-free Box */}
          {(pagesPerHour || daysDiff) && (
            <div className="p-4 bg-[#F7F4EF] border border-[#E8E2D8] rounded-md grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {daysDiff && (
                <div>
                  <span className="text-[#8A8172] block text-[11px]">Дней чтения</span>
                  <span className="font-mono tabular-nums text-[#24211D] font-medium text-sm">
                    {daysDiff} {daysDiff === 1 ? 'день' : 'дней'}
                  </span>
                </div>
              )}
              {pagesPerHour && (
                <div>
                  <span className="text-[#8A8172] block text-[11px]">Скорость чтения</span>
                  <span className="font-mono tabular-nums text-[#24211D] font-medium text-sm">
                    {pagesPerHour} стр./час
                  </span>
                </div>
              )}
              {minutesPerPage && (
                <div>
                  <span className="text-[#8A8172] block text-[11px]">Темп</span>
                  <span className="font-mono tabular-nums text-[#24211D] font-medium text-sm">
                    ~{minutesPerPage} мин./стр.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* User Review / Notes */}
          {book.notes ? (
            <div className="space-y-1.5 pt-2 border-t border-[#EFE9DF]">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#7A7265]">
                Впечатления и заметки
              </h4>
              <p className="text-xs sm:text-sm text-[#38332D] leading-relaxed whitespace-pre-wrap font-sans bg-[#FAF8F5] p-3 border border-[#E8E2D8] rounded">
                {book.notes}
              </p>
            </div>
          ) : null}

          {/* Secondary Publishing Data */}
          <div className="pt-2 border-t border-[#EFE9DF] text-xs text-[#8A8172] grid grid-cols-2 sm:grid-cols-3 gap-2">
            {book.publisher && (
              <div>
                <span>Издательство: </span>
                <span className="text-[#24211D]">{book.publisher}</span>
              </div>
            )}
            {book.publishYear && (
              <div>
                <span>Год издания: </span>
                <span className="text-[#24211D] font-mono tabular-nums">{book.publishYear} г.</span>
              </div>
            )}
            {book.language && (
              <div>
                <span>Язык: </span>
                <span className="text-[#24211D]">{book.language}</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="px-6 py-4 bg-[#F7F4EF] border-t border-[#E8E2D8] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Delete button */}
            <button
              onClick={() => {
                if (!currentUser) {
                  onClose();
                  onOpenAuthModal?.();
                  return;
                }
                setShowDeleteConfirm(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-100 rounded transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Удалить</span>
            </button>

            {/* Revert to reading button if completed */}
            {book.status === 'completed' && (
              <button
                onClick={() => {
                  if (!currentUser) {
                    onClose();
                    onOpenAuthModal?.();
                    return;
                  }
                  setShowRevertConfirm(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#6B6357] hover:bg-[#EAE4DC] rounded transition-colors"
                title="Вернуть в статус 'Читаю'"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Вернуть в «Читаю»</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSimilarModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[#8A5A36] bg-[#F5EFE6] hover:bg-[#EFE7DA] border border-[#E0D5C1] hover:border-[#8A5A36] rounded transition-all shadow-2xs cursor-pointer active:scale-95"
              title="Подобрать похожие книги и рекомендации"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#8A5A36]" />
              <span>Похожие книги</span>
            </button>
            <button
              onClick={() => {
                if (!currentUser) {
                  onClose();
                  onOpenAuthModal?.();
                  return;
                }
                onClose();
                onEdit(book);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-[#24211D] bg-[#FAF8F5] border border-[#D1C7B7] hover:border-[#24211D] rounded transition-colors shadow-xs"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Редактировать</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-[#FAF8F5] bg-[#24211D] hover:bg-[#3B342C] rounded transition-colors"
            >
              Закрыть
            </button>
          </div>
        </div>

        {/* Delete Confirmation Overlay */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-20">
            <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-5 max-w-sm text-center shadow-lg space-y-4">
              <h4 className="font-display font-semibold text-base text-[#24211D]">
                Удалить «{book.title}»?
              </h4>
              <p className="text-xs text-[#6B6357]">
                Это действие нельзя будет отменить. Книга и её статистика будут удалены из библиотеки.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3.5 py-1.5 text-xs text-[#6B6357] hover:text-[#24211D]"
                >
                  Отмена
                </button>
                <button
                  onClick={() => {
                    onDelete(book.id);
                    onClose();
                  }}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-rose-700 hover:bg-rose-800 rounded transition-colors"
                >
                  Да, удалить
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Revert Status Confirmation Overlay */}
        {showRevertConfirm && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-20">
            <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-5 max-w-sm text-center shadow-lg space-y-4">
              <h4 className="font-display font-semibold text-base text-[#24211D]">
                Вернуть книгу в статус «Читаю»?
              </h4>
              <p className="text-xs text-[#6B6357]">
                Дата окончания и оценка будут сняты, так как книга снова станет активной.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setShowRevertConfirm(false)}
                  className="px-3.5 py-1.5 text-xs text-[#6B6357] hover:text-[#24211D]"
                >
                  Отмена
                </button>
                <button
                  onClick={() => {
                    onRevertToReading(book);
                    setShowRevertConfirm(false);
                    onClose();
                  }}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-[#24211D] hover:bg-[#3B342C] rounded transition-colors"
                >
                  Вернуть в чтение
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Book-Specific Recommendations Modal */}
        {showSimilarModal && (
          <BookRecommendationsModal
            targetBook={book}
            isOpen={showSimilarModal}
            onClose={() => setShowSimilarModal(false)}
            books={books}
            currentUser={currentUser}
            onOpenAuthModal={onOpenAuthModal}
            onAddBookToLibrary={async (newBook) => {
              if (onAddBookToLibrary) {
                await onAddBookToLibrary(newBook);
              }
            }}
            onSelectBook={onSelectBook}
          />
        )}
      </div>
    </div>
  );
};
