import React, { useState } from 'react';
import { Book } from '../../types/book';
import { BookCover } from '../common/BookCover';
import { X, Star, Check } from 'lucide-react';

interface QuickCompleteModalProps {
  book: Book | null;
  onClose: () => void;
  onComplete: (updatedBook: Book) => void;
}

export const QuickCompleteModal: React.FC<QuickCompleteModalProps> = ({
  book,
  onClose,
  onComplete,
}) => {
  if (!book) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  const [endDate, setEndDate] = useState(todayStr);
  const [rating, setRating] = useState<number>(book.rating || 9);
  const [readingHours, setReadingHours] = useState<string>(
    book.readingHours ? String(book.readingHours) : ''
  );
  const [notes, setNotes] = useState(book.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Book = {
      ...book,
      status: 'completed',
      endDate: endDate || todayStr,
      rating,
      readingHours: readingHours ? parseFloat(readingHours) : book.readingHours,
      notes: notes.trim() || book.notes,
      updatedAt: new Date().toISOString(),
    };
    onComplete(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div 
        className="relative w-full max-w-lg bg-[#FAF8F5] border border-[#E8E2D8] rounded-lg shadow-xl overflow-hidden my-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E2D8] bg-[#F7F4EF]">
          <h3 className="font-display font-semibold text-base text-[#24211D]">
            Завершить чтение
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#7A7265] hover:text-[#24211D] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
          <div className="flex items-center gap-4">
            <BookCover book={book} size="sm" showSpineCrease={false} />
            <div>
              <h4 className="font-display font-semibold text-sm text-[#24211D] line-clamp-1">
                {book.title}
              </h4>
              <p className="text-xs text-[#7A7265]">{book.authors.join(', ')}</p>
            </div>
          </div>

          {/* Rating */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-[#24211D]">
                Ваша оценка: <span className="font-mono text-sm font-bold text-[#8A5A36]">{rating} / 10</span>
              </label>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`flex-1 py-1.5 text-center rounded font-mono text-xs transition-colors ${
                    rating >= star
                      ? 'bg-[#8A5A36] text-white font-semibold'
                      : 'bg-[#EFE9DF] text-[#7A7265] hover:bg-[#E4DCCE]'
                  }`}
                >
                  {star}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#7A7265] mb-1">Дата окончания</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#DDD5C7] rounded px-2.5 py-1.5 text-xs text-[#24211D]"
              />
            </div>
            <div>
              <label className="block text-[#7A7265] mb-1">Затрачено часов</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={readingHours}
                onChange={(e) => setReadingHours(e.target.value)}
                placeholder="Напр. 15"
                className="w-full bg-[#FAF8F5] border border-[#DDD5C7] rounded px-2.5 py-1.5 text-xs text-[#24211D]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#7A7265] mb-1">Итоговое впечатление (опционально)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Коротко о книге..."
              className="w-full bg-[#FAF8F5] border border-[#DDD5C7] rounded p-2 text-xs text-[#24211D]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8E2D8]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-[#6B6357] hover:text-[#24211D]"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 font-semibold text-white bg-[#273B30] hover:bg-[#1E2D25] rounded transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Сохранить в прочитанные</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
