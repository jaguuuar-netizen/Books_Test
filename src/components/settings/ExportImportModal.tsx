import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Book } from '../../types/book';
import { 
  X, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  Trash2, 
  Sparkles, 
  Check, 
  AlertTriangle, 
  ExternalLink, 
  RefreshCw, 
  Copy, 
  FileText, 
  Bot, 
  CheckCircle2, 
  Table, 
  Unlink, 
  Link as LinkIcon,
  Lock,
  Cloud
} from 'lucide-react';
import { 
  GoogleSheetsConfig, 
  loadGoogleSheetsConfig, 
  saveGoogleSheetsConfig, 
  createGoogleSpreadsheet, 
  writeBooksToSpreadsheet, 
  readSpreadsheetRows, 
  parseSheetRowsToBooks, 
  parseCSVToBooks, 
  extractSpreadsheetId, 
  generateAIPrompt,
  getSpreadsheetMetadata
} from '../../services/googleSheets';
import { getAccessToken, requestGoogleAccessToken } from '../../services/firebase';
import { normalizeRussianDate, formatDateRU } from '../../utils/date';

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  books: Book[];
  genres: string[];
  onImportBooks: (importedBooks: Book[], mode: 'merge' | 'replace') => void;
  onResetToDemo: () => void;
  onClearLibrary: () => void;
  onSheetsConfigChange?: (config: GoogleSheetsConfig | null) => void;
  currentUser?: User | null;
  onOpenAuthModal?: () => void;
}

type TabType = 'sheets' | 'import' | 'backup';

export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  isOpen,
  onClose,
  books,
  genres,
  onImportBooks,
  onResetToDemo,
  onClearLibrary,
  onSheetsConfigChange,
  currentUser,
  onOpenAuthModal,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('sheets');

  // Google Sheets state
  const [sheetsConfig, setSheetsConfig] = useState<GoogleSheetsConfig | null>(() => loadGoogleSheetsConfig());
  const [isSheetsBusy, setIsSheetsBusy] = useState(false);
  const [sheetsMessage, setSheetsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [customSheetUrl, setCustomSheetUrl] = useState('');
  const [showConnectUrlInput, setShowConnectUrlInput] = useState(false);

  // Destructive confirmation modal for Google Sheets overwrite
  const [pendingSheetsAction, setPendingSheetsAction] = useState<{
    type: 'export_now' | 'create_and_export' | 'connect_and_export';
    targetId?: string;
    targetTitle?: string;
  } | null>(null);

  // AI Prompt copy status
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  // Import preview state
  const [importPreview, setImportPreview] = useState<{
    sourceName: string;
    books: Book[];
    newCount: number;
    duplicateCount: number;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [importSheetUrl, setImportSheetUrl] = useState('');

  // Sync state with parent
  useEffect(() => {
    if (!isOpen) return;
    const config = loadGoogleSheetsConfig();
    setSheetsConfig(config);
  }, [isOpen]);

  if (!isOpen) return null;

  // --- GOOGLE SHEETS ACTIONS ---

  const handleCreateNewSheetClick = () => {
    setSheetsMessage(null);
    setPendingSheetsAction({
      type: 'create_and_export',
      targetTitle: 'Моя книжная полка — Библиотека',
    });
  };

  const handleExportNowClick = () => {
    if (!sheetsConfig) return;
    setSheetsMessage(null);
    setPendingSheetsAction({
      type: 'export_now',
      targetId: sheetsConfig.spreadsheetId,
      targetTitle: sheetsConfig.spreadsheetTitle,
    });
  };

  const handleConnectExistingSheetClick = () => {
    const id = extractSpreadsheetId(customSheetUrl);
    if (!id) {
      setSheetsMessage({
        type: 'error',
        text: 'Пожалуйста, введите корректную ссылку на Google Таблицу (например: https://docs.google.com/spreadsheets/d/.../edit)',
      });
      return;
    }
    setSheetsMessage(null);
    setPendingSheetsAction({
      type: 'connect_and_export',
      targetId: id,
      targetTitle: 'Указанная таблица Google Sheets',
    });
  };

  const executeConfirmedSheetsAction = async () => {
    if (!pendingSheetsAction) return;
    const action = pendingSheetsAction;
    setPendingSheetsAction(null);
    setIsSheetsBusy(true);
    setSheetsMessage(null);

    try {
      // 1. Ensure access token
      let token = await getAccessToken();
      if (!token) {
        token = await requestGoogleAccessToken();
      }

      if (action.type === 'create_and_export') {
        const result = await createGoogleSpreadsheet(token, 'Моя книжная полка — Библиотека', books);
        const newConfig: GoogleSheetsConfig = {
          spreadsheetId: result.spreadsheetId,
          spreadsheetUrl: result.spreadsheetUrl,
          spreadsheetTitle: result.title,
          autoSync: true,
          lastSyncedAt: new Date().toISOString(),
          lastSyncCount: books.length,
        };
        saveGoogleSheetsConfig(newConfig);
        setSheetsConfig(newConfig);
        if (onSheetsConfigChange) onSheetsConfigChange(newConfig);
        setSheetsMessage({
          type: 'success',
          text: `Google Таблица успешно создана! Выгружено книг: ${books.length}. Теперь библиотека может синхронизироваться автоматически.`,
        });
      } else if (action.type === 'export_now' && action.targetId) {
        await writeBooksToSpreadsheet(token, action.targetId, books);
        const updatedConfig: GoogleSheetsConfig = {
          ...(sheetsConfig || {
            spreadsheetId: action.targetId,
            spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${action.targetId}/edit`,
            spreadsheetTitle: action.targetTitle || 'Google Таблица',
            autoSync: true,
          }),
          lastSyncedAt: new Date().toISOString(),
          lastSyncCount: books.length,
        };
        saveGoogleSheetsConfig(updatedConfig);
        setSheetsConfig(updatedConfig);
        if (onSheetsConfigChange) onSheetsConfigChange(updatedConfig);
        setSheetsMessage({
          type: 'success',
          text: `Таблица успешно обновлена! Выгружено книг: ${books.length}.`,
        });
      } else if (action.type === 'connect_and_export' && action.targetId) {
        // Fetch metadata to get real title if possible
        let title = 'Google Таблица';
        try {
          const meta = await getSpreadsheetMetadata(token, action.targetId);
          if (meta?.properties?.title) {
            title = meta.properties.title;
          }
        } catch {
          // fallback
        }

        await writeBooksToSpreadsheet(token, action.targetId, books);
        const newConfig: GoogleSheetsConfig = {
          spreadsheetId: action.targetId,
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${action.targetId}/edit`,
          spreadsheetTitle: title,
          autoSync: true,
          lastSyncedAt: new Date().toISOString(),
          lastSyncCount: books.length,
        };
        saveGoogleSheetsConfig(newConfig);
        setSheetsConfig(newConfig);
        if (onSheetsConfigChange) onSheetsConfigChange(newConfig);
        setShowConnectUrlInput(false);
        setCustomSheetUrl('');
        setSheetsMessage({
          type: 'success',
          text: `Таблица «${title}» успешно подключена и обновлена! Выгружено книг: ${books.length}.`,
        });
      }
    } catch (err: any) {
      console.error('Sheets operation failed:', err);
      setSheetsMessage({
        type: 'error',
        text: err.message || 'Ошибка взаимодействия с Google Таблицами. Проверьте подключение к аккаунту Google.',
      });
    } finally {
      setIsSheetsBusy(false);
    }
  };

  const handleToggleAutoSync = () => {
    if (!sheetsConfig) return;
    const updated: GoogleSheetsConfig = {
      ...sheetsConfig,
      autoSync: !sheetsConfig.autoSync,
    };
    saveGoogleSheetsConfig(updated);
    setSheetsConfig(updated);
    if (onSheetsConfigChange) onSheetsConfigChange(updated);
  };

  const handleDisconnectSheet = () => {
    saveGoogleSheetsConfig(null);
    setSheetsConfig(null);
    if (onSheetsConfigChange) onSheetsConfigChange(null);
    setSheetsMessage({
      type: 'success',
      text: 'Синхронизация с Google Таблицей отключена.',
    });
  };

  // Import from connected Google Sheet
  const handleImportFromConnectedSheet = async () => {
    if (!sheetsConfig) return;
    setIsSheetsBusy(true);
    setImportError(null);
    try {
      // 1. Attempt direct CSV export first (zero popups if sheet has link sharing)
      try {
        const res = await fetch(`https://docs.google.com/spreadsheets/d/${sheetsConfig.spreadsheetId}/export?format=csv`);
        if (res.ok) {
          const csvText = await res.text();
          const parsedBooks = parseCSVToBooks(csvText);
          if (parsedBooks.length > 0) {
            evaluateImportPreview(parsedBooks, sheetsConfig.spreadsheetTitle || 'Google Sheets');
            setActiveTab('import');
            return;
          }
        }
      } catch {
        // Fall through to authenticated API read
      }

      let token = await getAccessToken();
      if (!token) {
        token = await requestGoogleAccessToken();
      }
      const rows = await readSpreadsheetRows(token, sheetsConfig.spreadsheetId, 'A1:P2000');
      const parsedBooks = parseSheetRowsToBooks(rows);
      if (parsedBooks.length === 0) {
        throw new Error('В Google Таблице не найдено книг или заголовки столбцов не распознаны.');
      }
      evaluateImportPreview(parsedBooks, sheetsConfig.spreadsheetTitle || 'Google Sheets');
      setActiveTab('import');
    } catch (err: any) {
      setImportError(err.message || 'Ошибка импорта из Google Таблицы');
    } finally {
      setIsSheetsBusy(false);
    }
  };

  // Import from external URL Google Sheet
  const handleImportFromUrl = async () => {
    const id = extractSpreadsheetId(importSheetUrl);
    if (!id) {
      setImportError('Пожалуйста, укажите валидную ссылку на Google Таблицу (например: https://docs.google.com/spreadsheets/d/.../edit)');
      return;
    }

    setIsSheetsBusy(true);
    setImportError(null);
    try {
      // 1. Try instant direct read first (works for any sheet with link sharing enabled)
      try {
        const res = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv`);
        if (res.ok) {
          const csvText = await res.text();
          const parsedBooks = parseCSVToBooks(csvText);
          if (parsedBooks.length > 0) {
            evaluateImportPreview(parsedBooks, 'Google Таблица');
            return;
          }
        }
      } catch {
        // Fall through to Sheets API
      }

      // 2. Private sheet: use cached token or request permission if needed
      let token = await getAccessToken();
      if (!token) {
        token = await requestGoogleAccessToken();
      }

      const rows = await readSpreadsheetRows(token, id, 'A1:P2000');
      const parsedBooks = parseSheetRowsToBooks(rows);
      if (parsedBooks.length === 0) {
        throw new Error('В таблице не найдено корректных записей книг.');
      }
      evaluateImportPreview(parsedBooks, 'Google Таблица');
    } catch (err: any) {
      setImportError(err.message || 'Не удалось прочитать таблицу. Убедитесь, что таблица доступна по ссылке или разрешен доступ к Google Таблицам.');
    } finally {
      setIsSheetsBusy(false);
    }
  };

  // --- CSV & JSON FILE IMPORT ---

  const evaluateImportPreview = (incoming: Book[], sourceName: string) => {
    const existingKeys = new Set(
      books.map((b) => `${b.title.toLowerCase().trim()}::${(b.authors[0] || '').toLowerCase().trim()}`)
    );

    let dupes = 0;
    let newItems = 0;
    incoming.forEach((b) => {
      const key = `${b.title.toLowerCase().trim()}::${(b.authors[0] || '').toLowerCase().trim()}`;
      if (existingKeys.has(key)) {
        dupes++;
      } else {
        newItems++;
      }
    });

    setImportPreview({
      sourceName,
      books: incoming,
      newCount: newItems,
      duplicateCount: dupes,
    });
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCSVToBooks(text);
        if (parsed.length === 0) {
          throw new Error('В CSV-файле не найдено строк с книгами или не распознана структура таблицы.');
        }
        evaluateImportPreview(parsed, file.name);
      } catch (err: any) {
        setImportError(err.message || 'Ошибка парсинга CSV');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleJsonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        const validBooks: Book[] = [];
        for (const b of importedList) {
          if (b && typeof b.title === 'string' && b.title.trim()) {
            validBooks.push({
              id: b.id || `book-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              title: b.title.trim(),
              authors: Array.isArray(b.authors) ? b.authors : ['Неизвестный автор'],
              status: b.status === 'completed' ? 'completed' : 'reading',
              rating: typeof b.rating === 'number' ? b.rating : undefined,
              startDate: normalizeRussianDate(b.startDate) || b.startDate,
              endDate: normalizeRussianDate(b.endDate) || b.endDate,
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
          throw new Error('В файле не найдено ни одной валидной книги');
        }

        evaluateImportPreview(validBooks, file.name);
      } catch (err: any) {
        setImportError(err.message || 'Ошибка чтения JSON-файла');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleApplyImport = (mode: 'merge' | 'replace') => {
    if (!currentUser) {
      onClose();
      onOpenAuthModal?.();
      return;
    }
    if (importPreview) {
      onImportBooks(importPreview.books, mode);
      setImportPreview(null);
      onClose();
    }
  };

  // --- EXPORT DOWNLOADS ---

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

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `my-book-shelf-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Copy AI Prompt
  const handleCopyAIPrompt = async () => {
    const prompt = generateAIPrompt(books, sheetsConfig?.spreadsheetUrl);
    await navigator.clipboard.writeText(prompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div 
        className="relative w-full max-w-2xl bg-[#FAF8F5] border border-[#E8E2D8] rounded-xl shadow-2xl overflow-hidden my-4 sm:my-6 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E2D8] bg-[#F7F4EF] shrink-0">
          <div>
            <h3 className="font-display font-semibold text-lg text-[#24211D]">
              Данные, Google Таблицы и ИИ
            </h3>
            <p className="text-xs text-[#7A7265] mt-0.5">
              Синхронизация с таблицами, рекомендации нейросетей и импорт
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[#7A7265] hover:text-[#24211D] hover:bg-[#EAE4DC] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center border-b border-[#E8E2D8] bg-[#FAF8F5] px-6 text-xs font-medium shrink-0">
          <button
            onClick={() => setActiveTab('sheets')}
            className={`py-3 px-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'sheets'
                ? 'border-[#273B30] text-[#273B30] font-semibold'
                : 'border-transparent text-[#7A7265] hover:text-[#24211D]'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Google Таблицы & ИИ</span>
            {sheetsConfig && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('import')}
            className={`py-3 px-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'import'
                ? 'border-[#273B30] text-[#273B30] font-semibold'
                : 'border-transparent text-[#7A7265] hover:text-[#24211D]'
            }`}
          >
            <Upload className="w-4 h-4 text-[#8A5A36]" />
            <span>Импорт (CSV и Sheets)</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`py-3 px-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'backup'
                ? 'border-[#273B30] text-[#273B30] font-semibold'
                : 'border-transparent text-[#7A7265] hover:text-[#24211D]'
            }`}
          >
            <Table className="w-4 h-4 text-[#6B6357]" />
            <span>Резервные копии</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 space-y-6 text-xs overflow-y-auto flex-1">
          {/* TAB 1: GOOGLE SHEETS & AI */}
          {activeTab === 'sheets' && (
            <div className="space-y-6">
              {sheetsMessage && (
                <div
                  className={`p-3.5 rounded-lg border flex items-start gap-2.5 text-xs ${
                    sheetsMessage.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  {sheetsMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span className="flex-1">{sheetsMessage.text}</span>
                </div>
              )}

              {/* Connected Sheet Card */}
              {sheetsConfig ? (
                <div className="bg-[#F7F4EF] border border-[#DDD5C7] rounded-xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-800 shrink-0">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm text-[#24211D]">
                            {sheetsConfig.spreadsheetTitle || 'Google Таблица подключена'}
                          </h4>
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-semibold rounded-full">
                            Подключено
                          </span>
                        </div>
                        <a
                          href={sheetsConfig.spreadsheetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-emerald-800 hover:text-emerald-900 hover:underline mt-1 font-medium"
                        >
                          <span>Открыть таблицу в Google Sheets</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={handleExportNowClick}
                        disabled={isSheetsBusy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#24211D] text-white hover:bg-[#3B342C] rounded-lg font-medium transition-colors shadow-xs disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSheetsBusy ? 'animate-spin' : ''}`} />
                        <span>Выгрузить сейчас</span>
                      </button>

                      <button
                        onClick={handleDisconnectSheet}
                        disabled={isSheetsBusy}
                        className="p-1.5 text-[#7A7265] hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Отключить таблицу"
                      >
                        <Unlink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Auto-Sync Toggle & Sync Info */}
                  <div className="pt-3 border-t border-[#E8E2D8] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={sheetsConfig.autoSync}
                        onChange={handleToggleAutoSync}
                        className="w-4 h-4 text-emerald-700 rounded border-[#C7BEAF] focus:ring-emerald-600"
                      />
                      <span className="text-[#24211D] font-medium">
                        Автоматически обновлять Google Таблицу при добавлении/изменении книг
                      </span>
                    </label>

                    <span className="text-[11px] text-[#7A7265]">
                      {sheetsConfig.lastSyncedAt
                        ? `Обновлено: ${new Date(sheetsConfig.lastSyncedAt).toLocaleTimeString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}`
                        : 'Ещё не выгружалось'}
                    </span>
                  </div>

                  {/* Quick Action: Import from this sheet */}
                  <div className="pt-2 flex items-center justify-end">
                    <button
                      onClick={handleImportFromConnectedSheet}
                      disabled={isSheetsBusy}
                      className="text-xs text-[#5E3023] hover:text-[#24211D] font-medium underline flex items-center gap-1"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Импортировать книги обратно из этой Google Таблицы</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* No Sheet Connected Yet: Setup Prompts */
                <div className="bg-[#F7F4EF] border border-[#DDD5C7] rounded-xl p-5 space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 shrink-0">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-display font-semibold text-base text-[#24211D]">
                        Автоматическая выгрузка в Google Sheets
                      </h4>
                      <p className="text-xs text-[#6B6357] leading-relaxed">
                        Подключите Google Таблицу, чтобы вся библиотека (названия, авторы, оценки 1–5, жанры и ваши заметки) автоматически хранилась в облачной таблице. Это позволяет легко делиться списком с нейросетями для подбора новых книг!
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={handleCreateNewSheetClick}
                      disabled={isSheetsBusy}
                      className="p-3.5 bg-[#FAF8F5] border border-[#C7BEAF] hover:border-[#24211D] rounded-xl flex items-center gap-3 transition-colors text-left group shadow-xs disabled:opacity-50"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-semibold text-xs text-[#24211D] block">
                          Создать новую Google Таблицу
                        </span>
                        <span className="text-[11px] text-[#7A7265] block mt-0.5">
                          Автоматически в 1 клик со стильным форматированием
                        </span>
                      </div>
                    </button>

                    <button
                      onClick={() => setShowConnectUrlInput(!showConnectUrlInput)}
                      disabled={isSheetsBusy}
                      className="p-3.5 bg-[#FAF8F5] border border-[#C7BEAF] hover:border-[#24211D] rounded-xl flex items-center gap-3 transition-colors text-left group shadow-xs disabled:opacity-50"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#EFE9DF] text-[#5E3023] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <LinkIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-semibold text-xs text-[#24211D] block">
                          Подключить существующую таблицу
                        </span>
                        <span className="text-[11px] text-[#7A7265] block mt-0.5">
                          Вставить ссылку на вашу личную таблицу Google
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Connect by URL Form */}
                  {showConnectUrlInput && (
                    <div className="p-4 bg-[#FAF8F5] border border-[#D1C7B7] rounded-lg space-y-3 pt-3">
                      <label className="block text-xs font-semibold text-[#24211D]">
                        Ссылка на Google Таблицу:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customSheetUrl}
                          onChange={(e) => setCustomSheetUrl(e.target.value)}
                          placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0.../edit"
                          className="flex-1 px-3 py-2 text-xs bg-white border border-[#D1C7B7] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#24211D]"
                        />
                        <button
                          onClick={handleConnectExistingSheetClick}
                          disabled={isSheetsBusy || !customSheetUrl.trim()}
                          className="px-4 py-2 bg-[#24211D] text-white rounded-md text-xs font-medium hover:bg-[#3B342C] transition-colors whitespace-nowrap disabled:opacity-50"
                        >
                          Подключить
                        </button>
                      </div>
                      <p className="text-[10px] text-[#7A7265]">
                        Убедитесь, что ваш Google-аккаунт имеет доступ к этой таблице.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* AI Recommendation Assistant Card */}
              <div className="bg-[#F4F6F4] border border-[#D1E0D1] rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-800 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-display font-semibold text-sm text-[#1B3522]">
                        Советы от ИИ: что почитать дальше?
                      </h4>
                      <p className="text-xs text-[#3E5C44] mt-0.5 leading-relaxed">
                        Мы сформировали персональный промпт на основе ваших любимых книг (оценки 9–10/10, любимые жанры и личные заметки). Скопируйте его и отправьте любой нейросети!
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleCopyAIPrompt}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-semibold text-xs transition-all shadow-xs shrink-0 ${
                      copiedPrompt
                        ? 'bg-emerald-700 text-white ring-2 ring-emerald-500'
                        : 'bg-[#1B3522] text-white hover:bg-[#274830]'
                    }`}
                  >
                    {copiedPrompt ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Скопировано!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Скопировать промпт для ИИ</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-[#3E5C44] pt-1">
                  <button
                    onClick={() => setShowPromptPreview(!showPromptPreview)}
                    className="hover:underline flex items-center gap-1 font-medium text-[11px]"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>{showPromptPreview ? 'Скрыть текст промпта' : 'Посмотреть текст промпта'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#55775C]">Открыть нейросеть:</span>
                    <a
                      href="https://chatgpt.com"
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-1 bg-white border border-[#C5D9C5] rounded text-[10px] font-medium text-[#1B3522] hover:bg-emerald-50 transition-colors"
                    >
                      ChatGPT
                    </a>
                    <a
                      href="https://gemini.google.com"
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-1 bg-white border border-[#C5D9C5] rounded text-[10px] font-medium text-[#1B3522] hover:bg-emerald-50 transition-colors"
                    >
                      Gemini
                    </a>
                    <a
                      href="https://claude.ai"
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-1 bg-white border border-[#C5D9C5] rounded text-[10px] font-medium text-[#1B3522] hover:bg-emerald-50 transition-colors"
                    >
                      Claude
                    </a>
                  </div>
                </div>

                {showPromptPreview && (
                  <div className="mt-3 p-3 bg-white/90 border border-[#C5D9C5] rounded-lg text-[11px] font-mono text-[#24211D] max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
                    {generateAIPrompt(books, sheetsConfig?.spreadsheetUrl)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: IMPORT (CSV & GOOGLE SHEETS) */}
          {activeTab === 'import' && (
            <div className="space-y-6">
              {!currentUser && (
                <div className="bg-[#FFF8E7] border border-[#E8DFCF] rounded-lg p-3.5 flex items-center justify-between gap-3 text-xs text-[#5C4828]">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#8A5A36] shrink-0" />
                    <span>Импорт книг доступен после авторизации в Google Облаке, чтобы книги надежно сохранились.</span>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenAuthModal?.();
                    }}
                    className="inline-flex items-center gap-1 font-semibold text-[#8A5A36] hover:text-[#5E3023] underline shrink-0 whitespace-nowrap"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Войти</span>
                  </button>
                </div>
              )}

              {importError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Step 1: Choose Source if no preview */}
              {!importPreview ? (
                <div className="space-y-4">
                  {/* CSV File Upload Card */}
                  <div className="bg-[#F7F4EF] p-5 rounded-xl border border-[#DDD5C7] space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#EFE9DF] text-[#24211D] flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-800" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-xs text-[#24211D]">
                          Импорт из файла таблицы (CSV)
                        </h4>
                        <p className="text-[11px] text-[#7A7265] mt-0.5">
                          Поддерживаются таблицы из Google Sheets, Microsoft Excel, LiveLib, Goodreads или Notion.
                        </p>
                      </div>
                    </div>

                    <div className="pt-2">
                      <input
                        type="file"
                        id="csv-import-file"
                        accept=".csv,text/csv"
                        onChange={handleCsvFileUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="csv-import-file"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#FAF8F5] border border-[#C7BEAF] hover:border-[#24211D] rounded-lg cursor-pointer font-medium text-xs text-[#24211D] transition-colors shadow-xs"
                      >
                        <Upload className="w-4 h-4 text-[#8A5A36]" />
                        <span>Выбрать CSV-файл на диске</span>
                      </label>
                    </div>
                  </div>

                  {/* Direct Google Sheet Link Import */}
                  <div className="bg-[#F7F4EF] p-5 rounded-xl border border-[#DDD5C7] space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200">
                        <LinkIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-xs text-[#24211D]">
                          Импорт по прямой ссылке на Google Таблицу
                        </h4>
                        <p className="text-[11px] text-[#7A7265] mt-0.5">
                          Вставьте ссылку на любую Google Таблицу, содержащую список книг.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <input
                        type="text"
                        value={importSheetUrl}
                        onChange={(e) => setImportSheetUrl(e.target.value)}
                        placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                        className="flex-1 px-3 py-2 text-xs bg-white border border-[#D1C7B7] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#24211D]"
                      />
                      <button
                        onClick={handleImportFromUrl}
                        disabled={isSheetsBusy || !importSheetUrl.trim()}
                        className="px-4 py-2 bg-[#24211D] text-white rounded-lg text-xs font-medium hover:bg-[#3B342C] transition-colors whitespace-nowrap disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {isSheetsBusy && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        <span>Загрузить из таблицы</span>
                      </button>
                    </div>
                  </div>

                  {/* JSON Backup Import */}
                  <div className="bg-[#FAF8F5] p-4 rounded-xl border border-dashed border-[#DDD5C7] flex items-center justify-between">
                    <div>
                      <span className="font-medium text-xs text-[#24211D] block">
                        Импорт резервной копии JSON
                      </span>
                      <span className="text-[10px] text-[#7A7265]">
                        Для восстановления полного снимка приложения
                      </span>
                    </div>

                    <input
                      type="file"
                      id="json-import-file-backup"
                      accept=".json,application/json"
                      onChange={handleJsonFileUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="json-import-file-backup"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF8F5] border border-[#C7BEAF] hover:border-[#24211D] rounded text-xs font-medium cursor-pointer text-[#24211D] transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#8A8172]" />
                      <span>Выбрать JSON</span>
                    </label>
                  </div>
                </div>
              ) : (
                /* Step 2: Preview & Merge/Replace Decision */
                <div className="p-5 bg-[#F7F4EF] border border-[#DDD5C7] rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-medium text-xs text-[#24211D]">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      <span>
                        Источник: <strong>{importPreview.sourceName}</strong> — найдено <strong>{importPreview.books.length}</strong> книг
                      </span>
                    </div>
                    <button
                      onClick={() => setImportPreview(null)}
                      className="text-[11px] text-[#7A7265] hover:text-[#24211D]"
                    >
                      Выбрать другой файл
                    </button>
                  </div>

                  <div className="bg-[#FAF8F5] p-3 rounded-lg border border-[#E8E2D8] text-xs space-y-1.5">
                    <p className="text-[#24211D]">
                      • Новых уникальных книг: <strong className="font-mono text-emerald-800">{importPreview.newCount}</strong>
                    </p>
                    {importPreview.duplicateCount > 0 && (
                      <p className="text-amber-800 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Уже есть в вашей библиотеке (дубликаты): <strong className="font-mono">{importPreview.duplicateCount}</strong>
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Sample Books Preview */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#7A7265]">
                      Пример распознанных книг:
                    </span>
                    <div className="max-h-36 overflow-y-auto space-y-1 bg-white p-2.5 rounded-md border border-[#E8E2D8]">
                      {importPreview.books.slice(0, 5).map((b, idx) => (
                        <div key={idx} className="text-[11px] text-[#24211D] truncate flex items-center justify-between">
                          <span>
                            «{b.title}» — <span className="text-[#7A7265]">{b.authors.join(', ')}</span>
                          </span>
                          <span className="text-[10px] text-[#8A5A36] ml-2 shrink-0">
                            {b.status === 'completed' ? 'Прочитана' : 'Читаю'}
                            {b.rating ? ` (${b.rating}/10★)` : ''}
                            {b.endDate ? ` · ${formatDateRU(b.endDate)}` : ''}
                          </span>
                        </div>
                      ))}
                      {importPreview.books.length > 5 && (
                        <div className="text-[10px] text-[#7A7265] pt-1">
                          ...и ещё {importPreview.books.length - 5} книг
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap gap-2.5">
                    <button
                      onClick={() => handleApplyImport('merge')}
                      className="px-4 py-2 font-medium text-xs text-white bg-[#24211D] hover:bg-[#3B342C] rounded-lg transition-colors shadow-xs"
                    >
                      Объединить с текущей библиотекой (добавить {importPreview.newCount})
                    </button>
                    <button
                      onClick={() => handleApplyImport('replace')}
                      className="px-3.5 py-2 font-medium text-xs text-rose-800 bg-rose-100 hover:bg-rose-200 rounded-lg transition-colors"
                    >
                      Заменить всю библиотеку
                    </button>
                    <button
                      onClick={() => setImportPreview(null)}
                      className="px-3 py-2 text-xs text-[#6B6357] hover:text-[#24211D]"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: BACKUPS & DEMO */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              {/* Export Downloads Section */}
              <div className="space-y-3">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[#7A7265]">
                  Скачать локальные копии
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={handleExportCSV}
                    className="p-3.5 bg-[#FAF8F5] border border-[#DDD5C7] hover:border-[#24211D] rounded-xl flex items-center gap-3 transition-colors text-left shadow-xs"
                  >
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-semibold text-xs text-[#24211D] block">Таблица CSV</span>
                      <span className="text-[11px] text-[#7A7265]">Для Excel или Google Sheets</span>
                    </div>
                  </button>

                  <button
                    onClick={handleExportJSON}
                    className="p-3.5 bg-[#FAF8F5] border border-[#DDD5C7] hover:border-[#24211D] rounded-xl flex items-center gap-3 transition-colors text-left shadow-xs"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#EFE9DF] flex items-center justify-center text-[#24211D] shrink-0">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-semibold text-xs text-[#24211D] block">Резервная копия (JSON)</span>
                      <span className="text-[11px] text-[#7A7265]">Полный снимок базы данных</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Reset to Demo / Clear */}
              <div className="space-y-3 pt-4 border-t border-[#EFE9DF]">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[#7A7265]">
                  Сброс и управление
                </h4>
                {!currentUser && (
                  <p className="text-[11px] text-[#8A8172]">
                    Управление библиотекой (сброс и очистка) доступно после авторизации через Google.
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => {
                      if (!currentUser) {
                        onClose();
                        onOpenAuthModal?.();
                        return;
                      }
                      onResetToDemo();
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#FAF8F5] border border-[#DDD5C7] hover:border-[#24211D] rounded-lg text-[#24211D] font-medium transition-colors shadow-xs"
                    title={currentUser ? 'Сбросить' : 'Требуется вход через Google'}
                  >
                    {!currentUser ? <Lock className="w-3.5 h-3.5 text-[#8A8172]" /> : <Sparkles className="w-3.5 h-3.5 text-[#8A5A36]" />}
                    <span>Загрузить эталонную демо-библиотеку</span>
                  </button>

                  <button
                    onClick={() => {
                      if (!currentUser) {
                        onClose();
                        onOpenAuthModal?.();
                        return;
                      }
                      setShowClearConfirm(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                    title={currentUser ? 'Очистить' : 'Требуется вход через Google'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Очистить все книги</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Workspace API Confirmation Dialog for Overwriting Spreadsheet Data (MANDATORY per skill) */}
        {pendingSheetsAction && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-40">
            <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-xl p-5 max-w-md text-left shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-emerald-800">
                <FileSpreadsheet className="w-6 h-6 shrink-0" />
                <h4 className="font-display font-semibold text-base text-[#24211D]">
                  {pendingSheetsAction.type === 'create_and_export'
                    ? 'Создать Google Таблицу и выгрузить книги?'
                    : 'Обновить Google Таблицу?'}
                </h4>
              </div>

              <div className="text-xs text-[#6B6357] space-y-2 leading-relaxed">
                <p>
                  {pendingSheetsAction.type === 'create_and_export' ? (
                    <>
                      В вашем Google Диске будет создана новая таблица <strong>«{pendingSheetsAction.targetTitle}»</strong>, и в неё будет записан список из <strong>{books.length}</strong> книг.
                    </>
                  ) : (
                    <>
                      В таблице <strong>«{pendingSheetsAction.targetTitle}»</strong> будут перезаписаны строки с книгами (всего: <strong>{books.length}</strong> книг).
                    </>
                  )}
                </p>
                <p className="text-[11px] text-[#7A7265]">
                  Таблица получит структурированные колонки: Название, Авторы, Статус, Оценка (1-5), Жанры, Страниц, Заметки и даты.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setPendingSheetsAction(null)}
                  className="px-3.5 py-2 text-xs font-medium text-[#6B6357] hover:text-[#24211D] rounded-lg"
                >
                  Отмена
                </button>
                <button
                  onClick={executeConfirmedSheetsAction}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#273B30] hover:bg-[#344E40] rounded-lg shadow-xs transition-colors"
                >
                  {pendingSheetsAction.type === 'create_and_export'
                    ? 'Создать и выгрузить'
                    : 'Подтвердить выгрузку'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Clear Library Confirmation Overlay */}
        {showClearConfirm && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-30">
            <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-xl p-5 max-w-sm text-center shadow-lg space-y-4">
              <h4 className="font-display font-semibold text-base text-[#24211D]">
                Очистить всю библиотеку?
              </h4>
              <p className="text-xs text-[#6B6357]">
                Все {books.length} книг будут удалены. Рекомендуется перед этим скачать резервную копию JSON или синхронизировать с Google Таблицей.
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
                  className="px-4 py-1.5 text-xs font-medium text-white bg-rose-700 hover:bg-rose-800 rounded-lg transition-colors"
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
