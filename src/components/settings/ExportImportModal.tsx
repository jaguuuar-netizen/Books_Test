import React, { useState } from 'react';
import { Book } from '../../types/book';
import { X, Download, Upload, FileSpreadsheet, Trash2, Sparkles, Check, AlertTriangle } from 'lucide-react';

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  books: Book[];
  genres: string[];
  onImportBooks: (importedBooks: Book[], mode: 'merge' | 'replace') => void;
  onResetToDemo: () => void;
  onClearLibrary: () => void;
}

export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  isOpen,
  onClose,
  books,
  genres,
  onImportBooks,
  onResetToDemo,
  onClearLibrary,
}) => {
  const [importPreview, setImportPreview] = useState<{
    books: Book[];
    newCount: number;
    duplicateCount: number;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  if (!isOpen) return null;

  // JSON Export
  const handleExportJSON = () => {
    const payload = {
      version: 1,
      appName: 'My Book Shelf',
      exportedAt: new Date().toISOString(),
      booksCount: books.length,
      genres,
      books,
    };
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `my-book-shelf-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // CSV Export for Excel & Google Sheets
  const handleExportCSV = () => {
    const headers = [
      'Название',
      'Авторы',
      'Статус',
      'Оценка',
      'Дата начала',
      'Дата окончания',
      'Страниц',
      'Часов чтения',
      'Жанры',
      'Издательство',
      'Год публикации',
      'Серия',
      'Номер в серии',
      'Заметки',
    ];

    const escapeCSV = (val: any) => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = books.map((b) => [
      escapeCSV(b.title),
      escapeCSV(b.authors.join('; ')),
      escapeCSV(b.status === 'completed' ? 'Прочитана' : 'Читаю'),
      escapeCSV(b.rating || ''),
      escapeCSV(b.startDate || ''),
      escapeCSV(b.endDate || ''),
      escapeCSV(b.pages || ''),
      escapeCSV(b.readingHours || ''),
      escapeCSV(b.genres.join('; ')),
      escapeCSV(b.publisher || ''),
      escapeCSV(b.publishYear || ''),
      escapeCSV(b.series || ''),
      escapeCSV(b.seriesNumber || ''),
      escapeCSV(b.notes || ''),
    ]);

    // UTF-8 BOM for Microsoft Excel Russian support
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `my-book-shelf-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // JSON File upload & validation
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        let importedList: Book[] = [];

        if (Array.isArray(parsed)) {
          importedList = parsed;
        } else if (parsed && Array.isArray(parsed.books)) {
          importedList = parsed.books;
        } else {
          throw new Error('Файл не содержит корректного списка книг');
        }

        // Validate basic structure
        const validBooks: Book[] = [];
        for (const b of importedList) {
          if (b && typeof b.title === 'string' && b.title.trim()) {
            validBooks.push({
              id: b.id || `book-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              title: b.title.trim(),
              authors: Array.isArray(b.authors) ? b.authors : ['Неизвестный автор'],
              status: b.status === 'completed' ? 'completed' : 'reading',
              rating: typeof b.rating === 'number' ? b.rating : undefined,
              startDate: b.startDate,
              endDate: b.endDate,
              pages: typeof b.pages === 'number' ? b.pages : undefined,
              readingHours: typeof b.readingHours === 'number' ? b.readingHours : undefined,
              coverUrl: b.coverUrl,
              coverColor: b.coverColor || '#273B30',
              genres: Array.isArray(b.genres) && b.genres.length > 0 ? b.genres : ['Другое'],
              notes: b.notes,
              series: b.series,
              seriesNumber: b.seriesNumber,
              publisher: b.publisher,
              publishYear: b.publishYear,
              language: b.language || 'Русский',
              createdAt: b.createdAt || new Date().toISOString(),
              updatedAt: b.updatedAt || new Date().toISOString(),
            });
          }
        }

        if (validBooks.length === 0) {
          throw new Error('В файле не найдено ни одной валидной записи книги');
        }

        // Detect duplicates with current library
        const existingKeys = new Set(
          books.map((b) => `${b.title.toLowerCase().trim()}::${(b.authors[0] || '').toLowerCase().trim()}`)
        );

        let dupes = 0;
        let newItems = 0;
        validBooks.forEach((b) => {
          const key = `${b.title.toLowerCase().trim()}::${(b.authors[0] || '').toLowerCase().trim()}`;
          if (existingKeys.has(key)) {
            dupes++;
          } else {
            newItems++;
          }
        });

        setImportPreview({
          books: validBooks,
          newCount: newItems,
          duplicateCount: dupes,
        });
      } catch (err: any) {
        setImportError(err.message || 'Ошибка чтения JSON-файла');
      }
    };
    reader.readAsText(file);
  };

  const handleApplyImport = (mode: 'merge' | 'replace') => {
    if (importPreview) {
      onImportBooks(importPreview.books, mode);
      setImportPreview(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div 
        className="relative w-full max-w-xl bg-[#FAF8F5] border border-[#E8E2D8] rounded-lg shadow-xl overflow-hidden my-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E2D8] bg-[#F7F4EF]">
          <h3 className="font-display font-semibold text-lg text-[#24211D]">
            Резервное копирование и данные
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#7A7265] hover:text-[#24211D] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 text-xs">
          {/* Export Section */}
          <div className="space-y-3">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-[#7A7265]">
              Экспорт данных
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleExportJSON}
                className="p-3 bg-[#FAF8F5] border border-[#DDD5C7] hover:border-[#24211D] rounded-md flex items-center gap-3 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded bg-[#EFE9DF] flex items-center justify-center text-[#24211D] shrink-0">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-[#24211D] block">Резервная копия (JSON)</span>
                  <span className="text-[11px] text-[#7A7265]">Полный снимок всей библиотеки</span>
                </div>
              </button>

              <button
                onClick={handleExportCSV}
                className="p-3 bg-[#FAF8F5] border border-[#DDD5C7] hover:border-[#24211D] rounded-md flex items-center gap-3 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded bg-[#EFE9DF] flex items-center justify-center text-[#273B30] shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-[#24211D] block">Таблица Excel (CSV)</span>
                  <span className="text-[11px] text-[#7A7265]">Для Google Sheets или Excel</span>
                </div>
              </button>
            </div>
          </div>

          {/* Import Section */}
          <div className="space-y-3 pt-4 border-t border-[#EFE9DF]">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-[#7A7265]">
              Импорт библиотеки из JSON
            </h4>

            {importError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs">
                {importError}
              </div>
            )}

            {!importPreview ? (
              <div className="bg-[#F7F4EF] p-4 rounded-md border border-dashed border-[#DDD5C7] text-center">
                <input
                  type="file"
                  id="import-json-file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="import-json-file"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#FAF8F5] border border-[#D1C7B7] hover:border-[#24211D] rounded cursor-pointer font-medium text-[#24211D] transition-colors"
                >
                  <Upload className="w-4 h-4 text-[#8A8172]" />
                  <span>Выбрать JSON-файл для импорта</span>
                </label>
                <p className="text-[10px] text-[#7A7265] mt-2">
                  Перед сохранением вы сможете проверить количество новых книг и дубликатов
                </p>
              </div>
            ) : (
              /* Import Preview & Duplicate Safeguards */
              <div className="p-4 bg-[#F7F4EF] border border-[#E8E2D8] rounded-md space-y-3">
                <div className="flex items-center gap-2 font-medium text-xs text-[#24211D]">
                  <Check className="w-4 h-4 text-[#273B30]" />
                  <span>Файл успешно проверен: {importPreview.books.length} книг</span>
                </div>

                <div className="text-[11px] text-[#7A7265] space-y-1">
                  <p>• Новых книг: <strong className="text-[#24211D] font-mono">{importPreview.newCount}</strong></p>
                  {importPreview.duplicateCount > 0 && (
                    <p className="text-amber-800 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Обнаружено совпадений с текущей библиотекой: <strong className="font-mono">{importPreview.duplicateCount}</strong></span>
                    </p>
                  )}
                </div>

                <div className="pt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => handleApplyImport('merge')}
                    className="px-3 py-1.5 font-medium text-white bg-[#24211D] hover:bg-[#3B342C] rounded transition-colors"
                  >
                    Объединить с библиотекой
                  </button>
                  <button
                    onClick={() => handleApplyImport('replace')}
                    className="px-3 py-1.5 font-medium text-rose-800 bg-rose-100 hover:bg-rose-200 rounded transition-colors"
                  >
                    Заменить библиотеку
                  </button>
                  <button
                    onClick={() => setImportPreview(null)}
                    className="px-3 py-1.5 text-[#6B6357] hover:text-[#24211D]"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Demo & Reset Actions */}
          <div className="space-y-3 pt-4 border-t border-[#EFE9DF]">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-[#7A7265]">
              Демо-данные и очистка
            </h4>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  onResetToDemo();
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF8F5] border border-[#DDD5C7] hover:border-[#24211D] rounded text-[#24211D] font-medium transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#8A5A36]" />
                <span>Загрузить эталонную демо-библиотеку</span>
              </button>

              <button
                onClick={() => setShowClearConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-rose-700 hover:bg-rose-50 rounded transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Очистить все книги</span>
              </button>
            </div>
          </div>
        </div>

        {/* Clear Confirmation Overlay */}
        {showClearConfirm && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-20">
            <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-5 max-w-sm text-center shadow-lg space-y-4">
              <h4 className="font-display font-semibold text-base text-[#24211D]">
                Очистить всю библиотеку?
              </h4>
              <p className="text-xs text-[#6B6357]">
                Все {books.length} книги будут безвозвратно удалены из хранилища браузера. Рекомендуется сначала скачать резервную копию JSON.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-3.5 py-1.5 text-xs text-[#6B6357] hover:text-[#24211D]"
                >
                  Отмена
                </button>
                <button
                  onClick={() => {
                    onClearLibrary();
                    setShowClearConfirm(false);
                    onClose();
                  }}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-rose-700 hover:bg-rose-800 rounded transition-colors"
                >
                  Да, очистить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
