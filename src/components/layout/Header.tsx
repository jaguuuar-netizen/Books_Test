import React from 'react';
import { Plus } from 'lucide-react';

export type NavTab = 'dashboard' | 'shelf' | 'statistics' | 'calendar' | 'genres';

interface HeaderProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenAddModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenWindowsModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  onOpenAddModal,
  onOpenSettingsModal,
  onOpenWindowsModal,
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
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#6B6357]">
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
            Windows (.exe)
          </button>
          <button
            onClick={onOpenSettingsModal}
            className="whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 border-transparent hover:text-[#24211D] hover:border-[#D1C7B7] text-xs uppercase tracking-wider text-[#8A8172]"
          >
            Резерв / Данные
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#FAF8F5] bg-[#24211D] rounded-md hover:bg-[#3B342C] transition-colors shadow-sm whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Добавить книгу</span>
          </button>
        </div>
      </div>
    </header>
  );
};
