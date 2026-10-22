import React from 'react';
import { Home, BookOpen, BarChart3, Calendar, Tag, Database } from 'lucide-react';
import { NavTab } from './Header';

interface MobileNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenSettingsModal: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenSettingsModal,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FAF8F5]/98 backdrop-blur-md border-t border-[#E8E2D8] px-1 pt-1 pb-[max(8px,env(safe-area-inset-bottom))] shadow-lg select-none">
      <div className="flex items-center justify-around h-13 max-w-lg mx-auto">
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-0.5 transition-colors cursor-pointer ${
            currentTab === 'dashboard' ? 'text-[#24211D] font-semibold' : 'text-[#8A8172]'
          }`}
        >
          <Home className="w-4 h-4 mb-0.5 shrink-0" />
          <span className="text-[10px] leading-tight truncate">Главная</span>
        </button>

        <button
          onClick={() => onSelectTab('shelf')}
          className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-0.5 transition-colors cursor-pointer ${
            currentTab === 'shelf' ? 'text-[#24211D] font-semibold' : 'text-[#8A8172]'
          }`}
        >
          <BookOpen className="w-4 h-4 mb-0.5 shrink-0" />
          <span className="text-[10px] leading-tight truncate">Полка</span>
        </button>

        <button
          onClick={() => onSelectTab('statistics')}
          className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-0.5 transition-colors cursor-pointer ${
            currentTab === 'statistics' ? 'text-[#24211D] font-semibold' : 'text-[#8A8172]'
          }`}
        >
          <BarChart3 className="w-4 h-4 mb-0.5 shrink-0" />
          <span className="text-[10px] leading-tight truncate">Статы</span>
        </button>

        <button
          onClick={() => onSelectTab('calendar')}
          className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-0.5 transition-colors cursor-pointer ${
            currentTab === 'calendar' ? 'text-[#24211D] font-semibold' : 'text-[#8A8172]'
          }`}
        >
          <Calendar className="w-4 h-4 mb-0.5 shrink-0" />
          <span className="text-[10px] leading-tight truncate">Календарь</span>
        </button>

        <button
          onClick={() => onSelectTab('genres')}
          className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-0.5 transition-colors cursor-pointer ${
            currentTab === 'genres' ? 'text-[#24211D] font-semibold' : 'text-[#8A8172]'
          }`}
        >
          <Tag className="w-4 h-4 mb-0.5 shrink-0" />
          <span className="text-[10px] leading-tight truncate">Жанры</span>
        </button>

        <button
          onClick={onOpenSettingsModal}
          className="flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-0.5 text-[#8A8172] hover:text-[#24211D] transition-colors cursor-pointer"
          title="Резервные копии и таблицы"
        >
          <Database className="w-4 h-4 mb-0.5 shrink-0" />
          <span className="text-[10px] leading-tight truncate">Резерв</span>
        </button>
      </div>
    </nav>
  );
};
