import React from 'react';
import { Plus, Cloud, Check } from 'lucide-react';
import { User } from 'firebase/auth';

export type NavTab = 'dashboard' | 'shelf' | 'statistics' | 'calendar' | 'genres';

interface HeaderProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenAddModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenWindowsModal: () => void;
  currentUser: User | null;
  onOpenAuthModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  onOpenAddModal,
  onOpenSettingsModal,
  onOpenWindowsModal,
  currentUser,
  onOpenAuthModal,
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
            Библиотека
          </button>
          <button
            onClick={() => onSelectTab('statistics')}
            className={`whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 ${
              currentTab === 'statistics'
                ? 'text-[#24211D] border-[#24211D] font-semibold'
                : 'border-transparent hover:text-[#24211D] hover:border-[#D1C7B7]'
            }`}
          >
            Статистика
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
            className="whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 border-transparent hover:text-[#24211D] hover:border-[#D1C7B7] text-xs uppercase tracking-wider text-[#8A8172]"
          >
            Данные
          </button>
        </nav>

        {/* Zone 3: Cloud Sync status + Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenAuthModal}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              currentUser
                ? 'bg-[#E9EFE9] text-[#273B30] hover:bg-[#DFEADF]'
                : 'bg-[#F1ECE4] text-[#6B6357] hover:text-[#24211D] hover:bg-[#EAE4DC]'
            }`}
            title={currentUser ? `Синхронизировано с ${currentUser.email}` : 'Войти для синхронизации с телефоном'}
          >
            {currentUser ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="truncate max-w-[90px] sm:max-w-[130px]">
                  {currentUser.displayName || currentUser.email?.split('@')[0]}
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
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#FAF8F5] bg-[#24211D] rounded-md hover:bg-[#3B342C] transition-colors shadow-sm whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Добавить</span>
          </button>
        </div>
      </div>
    </header>
  );
};
