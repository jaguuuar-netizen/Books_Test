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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#FAF8F5]/95 backdrop-blur-md border-t border-[#E8E2D8] px-2 py-1 safe-area-pb">
      <div className="flex items-center justify-around h-14">
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`flex flex-col items-center justify-center min-w-[48px] py-1 px-1 transition-colors ${
            currentTab === 'dashboard' ? 'text-[#24211D] font-medium' : 'text-[#8A8172]'
          }`}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] whitespace-nowrap">Главная</span>
        </button>

        <button
          onClick={() => onSelectTab('shelf')}
          className={`flex flex-col items-center justify-center min-w-[48px] py-1 px-1 transition-colors ${
            currentTab === 'shelf' ? 'text-[#24211D] font-medium' : 'text-[#8A8172]'
          }`}
        >
          <BookOpen className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] whitespace-nowrap">Полка</span>
        </button>

        <button
          onClick={() => onSelectTab('statistics')}
          className={`flex flex-col items-center justify-center min-w-[48px] py-1 px-1 transition-colors ${
            currentTab === 'statistics' ? 'text-[#24211D] font-medium' : 'text-[#8A8172]'
          }`}
        >
          <BarChart3 className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] whitespace-nowrap">Статистика</span>
        </button>

        <button
          onClick={() => onSelectTab('calendar')}
          className={`flex flex-col items-center justify-center min-w-[48px] py-1 px-1 transition-colors ${
            currentTab === 'calendar' ? 'text-[#24211D] font-medium' : 'text-[#8A8172]'
          }`}
        >
          <Calendar className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] whitespace-nowrap">Календарь</span>
        </button>

        <button
          onClick={() => onSelectTab('genres')}
          className={`flex flex-col items-center justify-center min-w-[48px] py-1 px-1 transition-colors ${
            currentTab === 'genres' ? 'text-[#24211D] font-medium' : 'text-[#8A8172]'
          }`}
        >
          <Tag className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] whitespace-nowrap">Жанры</span>
        </button>

        <button
          onClick={onOpenSettingsModal}
          className="flex flex-col items-center justify-center min-w-[48px] py-1 px-1 text-[#8A8172] hover:text-[#24211D] transition-colors"
          title="Резервные копии"
        >
          <Database className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] whitespace-nowrap">Резерв</span>
        </button>
      </div>
    </nav>
  );
};
