import React, { useState, useEffect } from 'react';
import { Book, BookStatus } from '../../types/book';
import { searchBooksOnline, SearchBookResult } from '../../services/bookSearch';
import { BookCover } from '../common/BookCover';
import { 
  X, 
  Search, 
  Upload, 
  Link as LinkIcon, 
  Star, 
  Check, 
  Palette, 
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface BookFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (book: Book) => void;
  initialBook?: Book | null;
  genresList: string[];
}

const PRESET_CLOTH_COLORS = [
  { name: 'Хвойный лес', value: '#273B30' },
  { name: 'Полночный синий', value: '#1C2A3A' },
  { name: 'Тёплый орех', value: '#3C241E' },
  { name: 'Бордо', value: '#542323' },
  { name: 'Графит', value: '#2C3539' },
  { name: 'Янтарь', value: '#7A4B1A' },
  { name: 'Глубокий тил', value: '#34444C' },
];

export const BookFormModal: React.FC<BookFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialBook,
  genresList,
}) => {
  // Form fields
  const [title, setTitle] = useState('');
  const [authorsInput, setAuthorsInput] = useState('');
  const [status, setStatus] = useState<BookStatus>('completed');
  const [rating, setRating] = useState<number>(8);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pages, setPages] = useState<string>('');
  const [readingHours, setReadingHours] = useState<string>('');
  const [coverUrl, setCoverUrl] = useState('');
  const [coverColor, setCoverColor] = useState('#273B30');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [newGenreInput, setNewGenreInput] = useState('');
  const [notes, setNotes] = useState('');
  const [series, setSeries] = useState('');
  const [seriesNumber, setSeriesNumber] = useState<string>('');
  const [publisher, setPublisher] = useState('');
  const [publishYear, setPublishYear] = useState<string>('');
  const [language, setLanguage] = useState('Русский');

  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [coverMode, setCoverMode] = useState<'search' | 'upload' | 'url' | 'color'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchBookResult[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (initialBook) {
      setTitle(initialBook.title);
      setAuthorsInput(initialBook.authors.join(', '));
      setStatus(initialBook.status);
      setRating(initialBook.rating || 8);
      setStartDate(initialBook.startDate || '');
      setEndDate(initialBook.endDate || '');
      setPages(initialBook.pages ? String(initialBook.pages) : '');
      setReadingHours(initialBook.readingHours ? String(initialBook.readingHours) : '');
      setCoverUrl(initialBook.coverUrl || '');
      setCoverColor(initialBook.coverColor || '#273B30');
      setSelectedGenres(initialBook.genres || []);
      setNotes(initialBook.notes || '');
      setSeries(initialBook.series || '');
      setSeriesNumber(initialBook.seriesNumber ? String(initialBook.seriesNumber) : '');
      setPublisher(initialBook.publisher || '');
      setPublishYear(initialBook.publishYear ? String(initialBook.publishYear) : '');
      setLanguage(initialBook.language || 'Русский');
      setShowAdvanced(Boolean(initialBook.series || initialBook.publisher || initialBook.publishYear));
    } else {
      // New book defaults
      setTitle('');
      setAuthorsInput('');
      setStatus('reading');
      setRating(8);
      setStartDate(todayStr);
      setEndDate('');
      setPages('');
      setReadingHours('');
      setCoverUrl('');
      setCoverColor('#273B30');
      setSelectedGenres(['Классическая литература']);
      setNotes('');
      setSeries('');
      setSeriesNumber('');
      setPublisher('');
      setPublishYear('');
      setLanguage('Русский');
      setShowAdvanced(false);
    }
    setSearchResults([]);
    setErrorMessage('');
  }, [initialBook, isOpen]);

  // Handle status toggle changes
  const handleStatusChange = (newStatus: BookStatus) => {
    setStatus(newStatus);
    if (newStatus === 'completed') {
      if (!endDate) {
        setEndDate(todayStr);
      }
      if (!startDate) {
        setStartDate(todayStr);
      }
    } else {
      // Switching to reading
      setEndDate('');
    }
  };

  // Online book search
  const handlePerformSearch = async () => {
    const q = searchQuery.trim() || `${title} ${authorsInput}`.trim();
    if (!q) return;
    setIsSearching(true);
    setErrorMessage('');
    try {
      const results = await searchBooksOnline(q);
      setSearchResults(results);
      if (results.length === 0) {
        setErrorMessage('Ничего не найдено в онлайн-каталогах. Вы можете загрузить обложку вручную или вставить ссылку.');
      }
    } catch {
      setErrorMessage('Не удалось выполнить поиск. Проверьте интернет-соединение.');
    } finally {
      setIsSearching(false);
    }
  };

  // Choose a search result
  const handleApplySearchResult = (res: SearchBookResult) => {
    if (!title) setTitle(res.title);
    if (!authorsInput && res.authors.length > 0) setAuthorsInput(res.authors.join(', '));
    if (res.coverUrl) setCoverUrl(res.coverUrl);
    if (res.pages && !pages) setPages(String(res.pages));
    if (res.publishYear && !publishYear) setPublishYear(String(res.publishYear));
    if (res.publisher && !publisher) setPublisher(res.publisher);
    if (res.genres && res.genres.length > 0 && selectedGenres.length === 0) {
      setSelectedGenres(res.genres);
    }
    setSearchResults([]);
  };

  // Image file upload & canvas compression
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize to standard book cover dimensions (max width 600px)
        const maxWidth = 600;
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setCoverUrl(compressedDataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Genre selection toggle
  const toggleGenre = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter((g) => g !== genre));
    } else {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  const handleAddNewGenre = () => {
    if (newGenreInput.trim() && !selectedGenres.includes(newGenreInput.trim())) {
      setSelectedGenres([...selectedGenres, newGenreInput.trim()]);
      setNewGenreInput('');
    }
  };

  // Form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Пожалуйста, укажите название книги');
      return;
    }

    const authors = authorsInput
      .split(/[,;\n]/)
      .map((a) => a.trim())
      .filter(Boolean);

    const parsedPages = pages ? Math.max(1, parseInt(pages, 10)) : undefined;
    const parsedHours = readingHours ? Math.max(0, parseFloat(readingHours)) : undefined;
    const parsedPublishYear = publishYear ? parseInt(publishYear, 10) : undefined;
    const parsedSeriesNum = seriesNumber ? parseInt(seriesNumber, 10) : undefined;

    const now = new Date().toISOString();

    const bookToSave: Book = {
      id: initialBook ? initialBook.id : `book-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: title.trim(),
      authors: authors.length > 0 ? authors : ['Неизвестный автор'],
      status,
      rating: status === 'completed' ? rating : undefined,
      startDate: startDate || undefined,
      endDate: status === 'completed' ? (endDate || todayStr) : undefined,
      pages: parsedPages,
      readingHours: parsedHours,
      coverUrl: coverUrl.trim() || undefined,
      coverColor,
      genres: selectedGenres.length > 0 ? selectedGenres : ['Другое'],
      notes: notes.trim() || undefined,
      series: series.trim() || undefined,
      seriesNumber: parsedSeriesNum,
      publisher: publisher.trim() || undefined,
      publishYear: parsedPublishYear,
      language: language.trim() || 'Русский',
      createdAt: initialBook ? initialBook.createdAt : now,
      updatedAt: now,
    };

    onSave(bookToSave);
    onClose();
  };

  // Mock book object for preview
  const previewBook: Book = {
    id: 'preview',
    title: title || 'Название книги',
    authors: authorsInput ? authorsInput.split(',').map((a) => a.trim()) : ['Автор'],
    status,
    rating,
    pages: pages ? parseInt(pages, 10) : undefined,
    coverUrl: coverUrl || undefined,
    coverColor,
    genres: selectedGenres,
    createdAt: '',
    updatedAt: '',
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div 
        className="relative w-full max-w-3xl bg-[#FAF8F5] border border-[#E8E2D8] rounded-lg shadow-xl overflow-hidden my-6 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E2D8] bg-[#F7F4EF]">
          <h2 className="font-display font-semibold text-lg text-[#24211D]">
            {initialBook ? 'Редактировать книгу' : 'Добавить новую книгу'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#7A7265] hover:text-[#24211D] hover:bg-[#EAE4DC] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1 text-xs">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Top Split: Form Inputs + Live Cover Preview */}
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Live Preview on Left */}
            <div className="flex flex-col items-center self-center md:self-start shrink-0">
              <BookCover book={previewBook} size="lg" />
              <span className="text-[11px] text-[#8A8172] mt-2">Предпросмотр на полке</span>
            </div>

            {/* Core Fields on Right */}
            <div className="flex-1 min-w-0 space-y-4 w-full">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-[#24211D] mb-1">
                  Название книги <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Например: Преступление и наказание"
                  className="w-full bg-[#FAF8F5] border border-[#DDD5C7] rounded px-3 py-2 text-sm text-[#24211D] focus:outline-none focus:border-[#24211D]"
                />
              </div>

              {/* Authors */}
              <div>
                <label className="block text-xs font-semibold text-[#24211D] mb-1">
                  Автор или авторы
                </label>
                <input
                  type="text"
                  value={authorsInput}
                  onChange={(e) => setAuthorsInput(e.target.value)}
                  placeholder="Например: Фёдор Достоевский (через запятую)"
                  className="w-full bg-[#FAF8F5] border border-[#DDD5C7] rounded px-3 py-2 text-xs text-[#24211D] focus:outline-none focus:border-[#24211D]"
                />
              </div>

              {/* Status Segmented Control */}
              <div>
                <label className="block text-xs font-semibold text-[#24211D] mb-1">
                  Статус чтения
                </label>
                <div className="flex items-center gap-2 p-1 bg-[#EFE9DF] rounded-md max-w-xs">
                  <button
                    type="button"
                    onClick={() => handleStatusChange('reading')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                      status === 'reading'
                        ? 'bg-[#FAF8F5] text-[#8A5A36] shadow-sm font-semibold'
                        : 'text-[#7A7265] hover:text-[#24211D]'
                    }`}
                  >
                    Сейчас читаю
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusChange('completed')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                      status === 'completed'
                        ? 'bg-[#FAF8F5] text-[#273B30] shadow-sm font-semibold'
                        : 'text-[#7A7265] hover:text-[#24211D]'
                    }`}
                  >
                    Прочитана
                  </button>
                </div>
              </div>

              {/* Rating (Available for completed books) */}
              {status === 'completed' && (
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-[#24211D]">
                      Оценка книги: <span className="font-mono tabular-nums text-sm font-bold text-[#8A5A36]">{rating} / 10</span>
                    </label>
                    <span className="text-[11px] text-[#7A7265]">
                      {rating === 10 ? 'Шедевр' : rating >= 8 ? 'Отлично' : rating >= 6 ? 'Хорошо' : 'Посредственно'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={`flex-1 py-1 text-center rounded font-mono text-xs transition-colors ${
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
              )}
            </div>
          </div>

          {/* Dates & Quantities Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-[#EFE9DF]">
            <div>
              <label className="block text-[11px] font-medium text-[#7A7265] mb-1">
                Дата начала
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#DDD5C7] rounded px-2.5 py-1.5 text-xs text-[#24211D] focus:outline-none focus:border-[#24211D]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#7A7265] mb-1">
                Дата окончания {status === 'reading' && <span className="text-[#8A8172]">(для прочитанных)</span>}
              </label>
              <input
                type="date"
                disabled={status === 'reading'}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none ${
                  status === 'reading'
                    ? 'bg-[#EAE4DC] text-[#A0988A] border-[#D1C7B7] cursor-not-allowed'
                    : 'bg-[#FAF8F5] text-[#24211D] border-[#DDD5C7] focus:border-[#24211D]'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#7A7265] mb-1">
                Количество страниц
              </label>
              <input
                type="number"
                min="1"
                value={pages}
                onChange={(e) => setPages(e.target.value)}
                placeholder="Напр. 350"
                className="w-full bg-[#FAF8F5] border border-[#DDD5C7] rounded px-2.5 py-1.5 text-xs text-[#24211D] focus:outline-none focus:border-[#24211D]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#7A7265] mb-1">
                Часов чтения
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={readingHours}
                onChange={(e) => setReadingHours(e.target.value)}
                placeholder="Напр. 12"
                className="w-full bg-[#FAF8F5] border border-[#DDD5C7] rounded px-2.5 py-1.5 text-xs text-[#24211D] focus:outline-none focus:border-[#24211D]"
              />
            </div>
          </div>

          {/* Book Cover Setup Tabs (Online Search, Upload, URL, Custom Color) */}
          <div className="space-y-3 pt-3 border-t border-[#EFE9DF]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#24211D]">
                Обложка книги
              </label>
              {coverUrl && (
                <button
                  type="button"
                  onClick={() => setCoverUrl('')}
                  className="text-[11px] text-rose-700 hover:underline"
                >
                  Удалить обложку
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#EFE9DF] rounded-md max-w-md">
              <button
                type="button"
                onClick={() => setCoverMode('search')}
                className={`flex-1 py-1 px-2 text-center rounded transition-colors ${
                  coverMode === 'search' ? 'bg-[#FAF8F5] text-[#24211D] font-medium shadow-sm' : 'text-[#7A7265]'
                }`}
              >
                Поиск онлайн
              </button>
              <button
                type="button"
                onClick={() => setCoverMode('upload')}
                className={`flex-1 py-1 px-2 text-center rounded transition-colors ${
                  coverMode === 'upload' ? 'bg-[#FAF8F5] text-[#24211D] font-medium shadow-sm' : 'text-[#7A7265]'
                }`}
              >
                Загрузить файл
              </button>
              <button
                type="button"
                onClick={() => setCoverMode('url')}
                className={`flex-1 py-1 px-2 text-center rounded transition-colors ${
                  coverMode === 'url' ? 'bg-[#FAF8F5] text-[#24211D] font-medium shadow-sm' : 'text-[#7A7265]'
                }`}
              >
                Ссылка
              </button>
              <button
                type="button"
                onClick={() => setCoverMode('color')}
                className={`flex-1 py-1 px-2 text-center rounded transition-colors ${
                  coverMode === 'color' ? 'bg-[#FAF8F5] text-[#24211D] font-medium shadow-sm' : 'text-[#7A7265]'
                }`}
              >
                Цвет переплета
              </button>
            </div>

            {/* Search Online Tab */}
            {coverMode === 'search' && (
              <div className="space-y-3 bg-[#F7F4EF] p-3.5 rounded-md border border-[#E8E2D8]">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={title || 'Введите название книги или автора...'}
                    className="flex-1 bg-[#FAF8F5] border border-[#DDD5C7] rounded px-3 py-1.5 text-xs text-[#24211D] focus:outline-none focus:border-[#24211D]"
                  />
                  <button
                    type="button"
                    onClick={handlePerformSearch}
                    disabled={isSearching}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#24211D] text-[#FAF8F5] rounded hover:bg-[#3B342C] transition-colors disabled:opacity-50"
                  >
                    {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    <span>Найти</span>
                  </button>
                </div>

                {searchResults.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pt-2">
                    {searchResults.map((res) => (
                      <div
                        key={res.id}
                        onClick={() => handleApplySearchResult(res)}
                        className="p-2 bg-[#FAF8F5] border border-[#DDD5C7] hover:border-[#24211D] rounded flex gap-2 cursor-pointer transition-colors"
                      >
                        {res.coverUrl ? (
                          <img
                            src={res.coverUrl}
                            alt=""
                            className="w-9 h-12 object-cover rounded-[1px] shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-12 bg-[#273B30] text-amber-100 text-[8px] flex items-center justify-center text-center p-0.5 rounded-[1px] shrink-0">
                            Книга
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[#24211D] truncate leading-tight">{res.title}</p>
                          <p className="text-[10px] text-[#7A7265] truncate mt-0.5">{res.authors.join(', ')}</p>
                          <span className="text-[9px] text-[#8A8172] font-mono">{res.publishYear || ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Upload File Tab */}
            {coverMode === 'upload' && (
              <div className="bg-[#F7F4EF] p-4 rounded-md border border-dashed border-[#DDD5C7] text-center">
                <input
                  type="file"
                  id="cover-file-upload"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="cover-file-upload"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#FAF8F5] border border-[#D1C7B7] hover:border-[#24211D] rounded cursor-pointer text-xs font-medium text-[#24211D] transition-colors"
                >
                  <Upload className="w-4 h-4 text-[#8A8172]" />
                  <span>Выбрать файл с устройства</span>
                </label>
                <p className="text-[10px] text-[#7A7265] mt-2">
                  Изображение автоматически оптимизируется и сохранится локально
                </p>
              </div>
            )}

            {/* Direct URL Tab */}
            {coverMode === 'url' && (
              <div className="bg-[#F7F4EF] p-3.5 rounded-md border border-[#E8E2D8]">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-[#8A8172] shrink-0" />
                  <input
                    type="url"
                    value={coverUrl}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    placeholder="https://example.com/cover.jpg"
                    className="flex-1 bg-[#FAF8F5] border border-[#DDD5C7] rounded px-3 py-1.5 text-xs text-[#24211D] focus:outline-none focus:border-[#24211D]"
                  />
                </div>
              </div>
            )}

            {/* Cloth Color Tab */}
            {coverMode === 'color' && (
              <div className="bg-[#F7F4EF] p-3.5 rounded-md border border-[#E8E2D8] space-y-2">
                <span className="text-[11px] text-[#7A7265] block">
                  Выберите цвет ткани переплета для генерации реалистичной обложки:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {PRESET_CLOTH_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCoverColor(c.value)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] transition-all border ${
                        coverColor === c.value
                          ? 'border-[#24211D] ring-1 ring-[#24211D] bg-[#FAF8F5]'
                          : 'border-[#DDD5C7] bg-[#FAF8F5]/80 hover:bg-[#FAF8F5]'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.value }} />
                      <span>{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Genres Selector */}
          <div className="space-y-2 pt-3 border-t border-[#EFE9DF]">
            <label className="block text-xs font-semibold text-[#24211D]">
              Жанры
            </label>
            <div className="flex flex-wrap gap-1.5">
              {genresList.map((g) => {
                const isSelected = selectedGenres.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGenre(g)}
                    className={`px-2.5 py-1 text-xs rounded transition-colors ${
                      isSelected
                        ? 'bg-[#24211D] text-[#FAF8F5] font-medium'
                        : 'bg-[#EFE9DF] text-[#6B6357] hover:bg-[#E4DCCE]'
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>

            {/* Add new custom genre inline */}
            <div className="flex items-center gap-2 pt-1 max-w-xs">
              <input
                type="text"
                value={newGenreInput}
                onChange={(e) => setNewGenreInput(e.target.value)}
                placeholder="Свой жанр..."
                className="flex-1 bg-[#FAF8F5] border border-[#DDD5C7] rounded px-2.5 py-1 text-xs text-[#24211D] focus:outline-none focus:border-[#24211D]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddNewGenre();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddNewGenre}
                className="px-2.5 py-1 bg-[#EFE9DF] hover:bg-[#E4DCCE] text-[#24211D] font-medium rounded text-xs transition-colors"
              >
                + Добавить
              </button>
            </div>
          </div>

          {/* Notes / Comment */}
          <div className="pt-3 border-t border-[#EFE9DF]">
            <label className="block text-xs font-semibold text-[#24211D] mb-1">
              Комментарий или личное впечатление
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Мысли после прочтения, ключевые идеи, цитаты..."
              className="w-full bg-[#FAF8F5] border border-[#DDD5C7] rounded p-2.5 text-xs text-[#24211D] focus:outline-none focus:border-[#24211D] leading-relaxed"
            />
          </div>

          {/* Collapsible Advanced Fields */}
          <div className="pt-2 border-t border-[#EFE9DF]">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs text-[#7A7265] hover:text-[#24211D] font-medium"
            >
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>{showAdvanced ? 'Скрыть дополнительные поля' : 'Показать серию, издательство, год публикации'}</span>
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3">
                <div>
                  <label className="block text-[11px] text-[#7A7265] mb-1">Серия книг</label>
                  <input
                    type="text"
                    value={series}
                    onChange={(e) => setSeries(e.target.value)}
                    placeholder="Напр. Властелин колец"
                    className="w-full bg-[#FAF8F5] border border-[#DDD5C7] rounded px-2.5 py-1.5 text-xs text-[#24211D]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#7A7265] mb-1">Номер в серии</label>
                  <input
                    type="number"
                    min="1"
                    value={seriesNumber}
                    onChange={(e) => setSeriesNumber(e.target.value)}
                    placeholder="Напр. 1"
                    className="w-full bg-[#FAF8F5] border border-[#DDD5C7] rounded px-2.5 py-1.5 text-xs text-[#24211D]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#7A7265] mb-1">Издательство</label>
                  <input
                    type="text"
                    value={publisher}
                    onChange={(e) => setPublisher(e.target.value)}
                    placeholder="Напр. АСТ, Эксмо"
                    className="w-full bg-[#FAF8F5] border border-[#DDD5C7] rounded px-2.5 py-1.5 text-xs text-[#24211D]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#7A7265] mb-1">Год публикации</label>
                  <input
                    type="number"
                    value={publishYear}
                    onChange={(e) => setPublishYear(e.target.value)}
                    placeholder="Напр. 1965"
                    className="w-full bg-[#FAF8F5] border border-[#DDD5C7] rounded px-2.5 py-1.5 text-xs text-[#24211D]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Modal Action Buttons */}
          <div className="pt-4 border-t border-[#E8E2D8] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#6B6357] hover:text-[#24211D] transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-[#FAF8F5] bg-[#24211D] hover:bg-[#3B342C] rounded-md transition-colors shadow-sm"
            >
              {initialBook ? 'Сохранить изменения' : 'Добавить книгу'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
