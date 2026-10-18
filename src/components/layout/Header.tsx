import { Plus, Cloud, Check, RefreshCw, Lock } from 'lucide-react';
import { User } from 'firebase/auth';

export type NavTab = 'dashboard' | 'shelf' | 'spines' | 'statistics' | 'calendar' | 'genres';

interface HeaderProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenAddModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenWindowsModal: () => void;
  currentUser: User | null;
  onOpenAuthModal: () => void;
  isSyncing?: boolean;
  lastSyncedAt?: Date | null;
  hasConnectedSheets?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  onOpenAddModal,
  onOpenSettingsModal,
  onOpenWindowsModal,
  currentUser,
  onOpenAuthModal,
  isSyncing = false,
  lastSyncedAt = null,
  hasConnectedSheets = false,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-[#E8E2D8]">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-4 sm:px-6 lg:px-8 h-16">
        {/* Zone 1: Brand Wordmark in display face */}
        <button
          onClick={() => onSelectTab('dashboard')}
          className="text-xl font-display font-semibold tracking-tight text-[#24211D] hover:text-[#5E3023] transition-colors whitespace-nowrap shrink-0 text-left"
        >
          My Book Shelf
        </button>

        {/* Zone 2: 4-5 concise single-line nav links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#6B6357]">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 ${
              currentTab === 'dashboard'
                ? 'text-[#24211D] border-[#24211D] font-semibold'
                : 'border-transparent hover:text-[#24211D] hover:border-[#D1C7B7]'
            }`}
          >
            Дашборд
          </button>
          <button
            onClick={() => onSelectTab('shelf')}
            className={`whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 ${
              currentTab === 'shelf'
                ? 'text-[#24211D] border-[#24211D] font-semibold'
                : 'border-transparent hover:text-[#24211D] hover:border-[#D1C7B7]'
            }`}
          >
            Полка
          </button>
          <button
            onClick={() => onSelectTab('spines')}
            className={`whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 flex items-center gap-1.5 ${
              currentTab === 'spines'
                ? 'text-[#24211D] border-[#24211D] font-semibold'
                : 'border-transparent hover:text-[#24211D] hover:border-[#D1C7B7]'
            }`}
            title="Книжный шкаф: книги стоят корешками к вам"
          >
            <span>Корешки</span>
          </button>
          <button
            onClick={() => onSelectTab('statistics')}
            className={`whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 inline-flex items-center gap-1.5 ${
              currentTab === 'statistics'
                ? 'text-[#24211D] border-[#24211D] font-semibold'
                : 'border-transparent hover:text-[#24211D] hover:border-[#D1C7B7]'
            }`}
          >
            <span>Статистика</span>
            {!currentUser && (
              <span title="Требуется вход через Google">
                <Lock className="w-3 h-3 text-[#8A5A36] opacity-75" />
              </span>
            )}
          </button>
          <button
            onClick={() => onSelectTab('calendar')}
            className={`whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 ${
              currentTab === 'calendar'
                ? 'text-[#24211D] border-[#24211D] font-semibold'
                : 'border-transparent hover:text-[#24211D] hover:border-[#D1C7B7]'
            }`}
          >
            Календарь
          </button>
          <button
            onClick={() => onSelectTab('genres')}
            className={`whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 ${
              currentTab === 'genres'
                ? 'text-[#24211D] border-[#24211D] font-semibold'
                : 'border-transparent hover:text-[#24211D] hover:border-[#D1C7B7]'
            }`}
          >
            Жанры
          </button>
          <button
            onClick={onOpenWindowsModal}
            className="whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 border-transparent hover:text-[#24211D] hover:border-[#D1C7B7] text-xs uppercase tracking-wider text-[#8A5A36] font-semibold"
            title="Установка программы для Windows"
          >
            Windows
          </button>
          <button
            onClick={onOpenSettingsModal}
            className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 border-transparent hover:text-[#24211D] hover:border-[#D1C7B7] text-xs uppercase tracking-wider text-[#8A8172]"
            title="Google Таблицы, ИИ, импорт и экспорт"
          >
            <span>Таблицы & Данные</span>
            {hasConnectedSheets && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" title="Google Таблица синхронизируется" />
            )}
          </button>
        </nav>

        {/* Zone 3: Cloud Sync status + Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenAuthModal}
            className={`inline-flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              currentUser
                ? 'bg-[#EBF3EC] text-[#204028] hover:bg-[#DEEADB] border border-[#CDE1CD]'
                : 'bg-[#F1ECE4] text-[#6B6357] hover:text-[#24211D] hover:bg-[#EAE4DC]'
            }`}
            title={
              currentUser 
                ? `Двусторонняя синхронизация активна (${currentUser.email})${lastSyncedAt ? ' • Обновлено ' + lastSyncedAt.toLocaleTimeString('ru-RU') : ''}` 
                : 'Войти через Google для синхронизации с телефоном'
            }
          >
            {currentUser ? (
              <>
                {isSyncing ? (
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-700 animate-spin shrink-0" />
                ) : (
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                  </span>
                )}
                <span className="truncate max-w-[90px] sm:max-w-[130px]">
                  {currentUser.displayName || currentUser.email?.split('@')[0]}
                </span>
                <span className="hidden xl:inline text-[10px] text-emerald-700/80 font-mono">
                  {isSyncing ? 'обновление...' : 'в сети'}
                </span>
              </>
            ) : (
              <>
                <Cloud className="w-3.5 h-3.5 text-[#8A8172]" />
                <span className="hidden sm:inline">Синхронизация</span>
                <span className="sm:hidden">Облако</span>
              </>
            )}
          </button>

          <button
            onClick={onOpenAddModal}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-colors shadow-sm whitespace-nowrap shrink-0 ${
              currentUser
                ? 'text-[#FAF8F5] bg-[#24211D] hover:bg-[#3B342C]'
                : 'text-[#4A3B2C] bg-[#EFE8DD] hover:bg-[#E4DCCE] border border-[#D8CEBC]'
            }`}
            title={currentUser ? 'Добавить книгу' : 'Войдите через Google для добавления книг'}
          >
            {currentUser ? (
              <Plus className="w-3.5 h-3.5" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-[#8A5A36]" />
            )}
            <span>Добавить</span>
          </button>
        </div>
      </div>
    </header>
  );
};

