import React, { useState, useMemo } from 'react';
import { User } from 'firebase/auth';
import { Book } from '../../types/book';
import { 
  Trophy, 
  Award, 
  Medal, 
  Star, 
  BookOpen, 
  Scroll, 
  Sparkles, 
  Compass, 
  Crown, 
  Clock, 
  Feather, 
  ShieldCheck, 
  CheckCircle2, 
  Lock, 
  Cloud,
  ChevronRight,
  Flame,
  Layers,
  Search,
  Filter,
  X
} from 'lucide-react';

interface AchievementsViewProps {
  books: Book[];
  currentUser?: User | any | null;
  onOpenAuthModal?: () => void;
  onSelectBook?: (book: Book) => void;
}

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type AchievementCategory = 'all' | 'unlocked' | 'progress' | 'volume' | 'pages' | 'genre' | 'reviews' | 'authors';

export interface AchievementItem {
  id: string;
  title: string;
  description: string;
  category: 'volume' | 'pages' | 'genre' | 'reviews' | 'authors';
  tier: AchievementTier;
  iconType: string;
  current: number;
  target: number;
  unit: string;
  isUnlocked: boolean;
  contributingBooks: Book[];
  xpReward: number;
}

export const AchievementsView: React.FC<AchievementsViewProps> = ({
  books,
  currentUser,
  onOpenAuthModal,
  onSelectBook,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectedAchievement, setInspectedAchievement] = useState<AchievementItem | null>(null);

  // Completed books only for achievements
  const completedBooks = useMemo(() => {
    return books.filter((b) => b.status === 'completed');
  }, [books]);

  // Compute all achievements dynamically based on user's real library
  const achievements = useMemo<AchievementItem[]>(() => {
    const totalCompleted = completedBooks.length;
    const totalPages = completedBooks.reduce((acc, b) => acc + (b.pages || 0), 0);
    const totalHours = completedBooks.reduce((acc, b) => acc + (b.readingHours || 0), 0);

    // Genre distribution
    const genreMap = new Map<string, Book[]>();
    completedBooks.forEach((b) => {
      b.genres.forEach((g) => {
        if (!genreMap.has(g)) genreMap.set(g, []);
        genreMap.get(g)!.push(b);
      });
    });
    const uniqueGenresCount = genreMap.size;

    // Authors distribution
    const authorMap = new Map<string, Book[]>();
    completedBooks.forEach((b) => {
      b.authors.forEach((a) => {
        const clean = a.trim();
        if (!clean) return;
        if (!authorMap.has(clean)) authorMap.set(clean, []);
        authorMap.get(clean)!.push(b);
      });
    });

    let maxAuthorBooks = 0;
    let topAuthorBooks: Book[] = [];
    authorMap.forEach((authorBooksList) => {
      if (authorBooksList.length > maxAuthorBooks) {
        maxAuthorBooks = authorBooksList.length;
        topAuthorBooks = authorBooksList;
      }
    });

    // Books with thick page count (> 700 pages)
    const thickBooks = completedBooks.filter((b) => (b.pages || 0) >= 700);

    // Books with notes/reviews
    const booksWithNotes = completedBooks.filter((b) => (b.notes || '').trim().length >= 15);

    // High rated books (rating 10)
    const perfectScoreBooks = completedBooks.filter((b) => (b.rating || 0) >= 10);

    // Rated books count
    const ratedBooks = completedBooks.filter((b) => typeof b.rating === 'number' && b.rating > 0);

    // Detective / Thriller books
    const detectiveBooks = completedBooks.filter((b) => 
      b.genres.some((g) => g.toLowerCase().includes('детектив') || g.toLowerCase().includes('триллер'))
    );

    // Sci-Fi / Fantasy books
    const scifiFantasyBooks = completedBooks.filter((b) => 
      b.genres.some((g) => g.toLowerCase().includes('фантастика') || g.toLowerCase().includes('фэнтези'))
    );

    // Classic Literature books
    const classicBooks = completedBooks.filter((b) => 
      b.genres.some((g) => g.toLowerCase().includes('класс'))
    );

    // Series books
    const seriesBooks = completedBooks.filter((b) => Boolean((b.series || '').trim()));

    const list: AchievementItem[] = [
      // --- VOLUME CATEGORY ---
      {
        id: 'vol_1',
        title: 'Первая ласточка',
        description: 'Прочитайте и завершите вашу самую первую книгу в дневнике',
        category: 'volume',
        tier: 'bronze',
        iconType: 'book',
        current: Math.min(totalCompleted, 1),
        target: 1,
        unit: 'книга',
        isUnlocked: totalCompleted >= 1,
        contributingBooks: completedBooks.slice(0, 1),
        xpReward: 50,
      },
      {
        id: 'vol_5',
        title: 'Книжная полка',
        description: 'Соберите 5 полностью прочитанных книг в личной коллекции',
        category: 'volume',
        tier: 'bronze',
        iconType: 'layers',
        current: Math.min(totalCompleted, 5),
        target: 5,
        unit: 'книг',
        isUnlocked: totalCompleted >= 5,
        contributingBooks: completedBooks.slice(0, 5),
        xpReward: 100,
      },
      {
        id: 'vol_10',
        title: 'Малая библиотека',
        description: 'Успешно завершите чтение 10 литературных произведений',
        category: 'volume',
        tier: 'silver',
        iconType: 'scroll',
        current: Math.min(totalCompleted, 10),
        target: 10,
        unit: 'книг',
        isUnlocked: totalCompleted >= 10,
        contributingBooks: completedBooks.slice(0, 10),
        xpReward: 200,
      },
      {
        id: 'vol_25',
        title: 'Библиофил',
        description: 'Покорите рубеж в 25 прочитанных томов',
        category: 'volume',
        tier: 'gold',
        iconType: 'award',
        current: Math.min(totalCompleted, 25),
        target: 25,
        unit: 'книг',
        isUnlocked: totalCompleted >= 25,
        contributingBooks: completedBooks.slice(0, 25),
        xpReward: 400,
      },
      {
        id: 'vol_50',
        title: 'Хранитель фолиантов',
        description: 'Достигните монументальной отметки в 50 завершённых книг',
        category: 'volume',
        tier: 'platinum',
        iconType: 'crown',
        current: Math.min(totalCompleted, 50),
        target: 50,
        unit: 'книг',
        isUnlocked: totalCompleted >= 50,
        contributingBooks: completedBooks.slice(0, 50),
        xpReward: 800,
      },

      // --- PAGES CATEGORY ---
      {
        id: 'pg_1000',
        title: 'Килостраничник',
        description: 'Преодолейте первый порог в 1 000 прочитанных страниц',
        category: 'pages',
        tier: 'bronze',
        iconType: 'sparkles',
        current: Math.min(totalPages, 1000),
        target: 1000,
        unit: 'стр.',
        isUnlocked: totalPages >= 1000,
        contributingBooks: completedBooks,
        xpReward: 75,
      },
      {
        id: 'pg_5000',
        title: 'Литературный спринтер',
        description: 'Наберите 5 000 прочитанных книжных страниц',
        category: 'pages',
        tier: 'silver',
        iconType: 'flame',
        current: Math.min(totalPages, 5000),
        target: 5000,
        unit: 'стр.',
        isUnlocked: totalPages >= 5000,
        contributingBooks: completedBooks,
        xpReward: 250,
      },
      {
        id: 'pg_10000',
        title: 'Толстоевский',
        description: 'Преодолейте рубеж в 10 000 страниц чистого текста',
        category: 'pages',
        tier: 'gold',
        iconType: 'trophy',
        current: Math.min(totalPages, 10000),
        target: 10000,
        unit: 'стр.',
        isUnlocked: totalPages >= 10000,
        contributingBooks: completedBooks,
        xpReward: 500,
      },
      {
        id: 'pg_heavy',
        title: 'Тяжеловес',
        description: 'Прочитайте фундаментальный фолиант объёмом от 700 страниц',
        category: 'pages',
        tier: 'silver',
        iconType: 'shield',
        current: Math.min(thickBooks.length, 1),
        target: 1,
        unit: 'книга',
        isUnlocked: thickBooks.length >= 1,
        contributingBooks: thickBooks,
        xpReward: 200,
      },

      // --- GENRE CATEGORY ---
      {
        id: 'genre_3',
        title: 'Широкий кругозор',
        description: 'Прочитайте книги минимум из 3 различных жанров',
        category: 'genre',
        tier: 'bronze',
        iconType: 'compass',
        current: Math.min(uniqueGenresCount, 3),
        target: 3,
        unit: 'жанра',
        isUnlocked: uniqueGenresCount >= 3,
        contributingBooks: completedBooks,
        xpReward: 100,
      },
      {
        id: 'genre_6',
        title: 'Жанровый полимат',
        description: 'Охватите 6 разнообразных жанровых направлений',
        category: 'genre',
        tier: 'gold',
        iconType: 'crown',
        current: Math.min(uniqueGenresCount, 6),
        target: 6,
        unit: 'жанров',
        isUnlocked: uniqueGenresCount >= 6,
        contributingBooks: completedBooks,
        xpReward: 350,
      },
      {
        id: 'genre_detective',
        title: 'Шерлок',
        description: 'Прочитайте 3 книги в жанре «Детектив» или «Триллер»',
        category: 'genre',
        tier: 'silver',
        iconType: 'shield',
        current: Math.min(detectiveBooks.length, 3),
        target: 3,
        unit: 'книги',
        isUnlocked: detectiveBooks.length >= 3,
        contributingBooks: detectiveBooks,
        xpReward: 150,
      },
      {
        id: 'genre_scifi',
        title: 'Звёздный странник',
        description: 'Прочитайте 3 книги в жанре «Фантастика» или «Фэнтези»',
        category: 'genre',
        tier: 'silver',
        iconType: 'sparkles',
        current: Math.min(scifiFantasyBooks.length, 3),
        target: 3,
        unit: 'книги',
        isUnlocked: scifiFantasyBooks.length >= 3,
        contributingBooks: scifiFantasyBooks,
        xpReward: 150,
      },
      {
        id: 'genre_classic',
        title: 'Ценитель вечного',
        description: 'Прочитайте 3 произведения из классической литературы',
        category: 'genre',
        tier: 'silver',
        iconType: 'scroll',
        current: Math.min(classicBooks.length, 3),
        target: 3,
        unit: 'книги',
        isUnlocked: classicBooks.length >= 3,
        contributingBooks: classicBooks,
        xpReward: 150,
      },

      // --- REVIEWS & RATINGS CATEGORY ---
      {
        id: 'rev_notes',
        title: 'Вдумчивый критик',
        description: 'Напишите осмысленные заметки или цитаты к 3 книгам',
        category: 'reviews',
        tier: 'bronze',
        iconType: 'feather',
        current: Math.min(booksWithNotes.length, 3),
        target: 3,
        unit: 'книги',
        isUnlocked: booksWithNotes.length >= 3,
        contributingBooks: booksWithNotes,
        xpReward: 100,
      },
      {
        id: 'rev_masterpiece',
        title: 'Золотой фонд',
        description: 'Присудите наивысшую оценку 10/10 хотя бы двум шедеврам',
        category: 'reviews',
        tier: 'silver',
        iconType: 'star',
        current: Math.min(perfectScoreBooks.length, 2),
        target: 2,
        unit: 'книги',
        isUnlocked: perfectScoreBooks.length >= 2,
        contributingBooks: perfectScoreBooks,
        xpReward: 150,
      },
      {
        id: 'rev_judge',
        title: 'Справедливый судья',
        description: 'Оцените по 10-балльной шкале не менее 7 прочитанных книг',
        category: 'reviews',
        tier: 'silver',
        iconType: 'medal',
        current: Math.min(ratedBooks.length, 7),
        target: 7,
        unit: 'книг',
        isUnlocked: ratedBooks.length >= 7,
        contributingBooks: ratedBooks,
        xpReward: 180,
      },

      // --- AUTHORS & SERIES CATEGORY ---
      {
        id: 'aut_fan',
        title: 'Преданный поклонник',
        description: 'Прочитайте как минимум 3 произведения одного любимого автора',
        category: 'authors',
        tier: 'silver',
        iconType: 'feather',
        current: Math.min(maxAuthorBooks, 3),
        target: 3,
        unit: 'книги',
        isUnlocked: maxAuthorBooks >= 3,
        contributingBooks: topAuthorBooks,
        xpReward: 200,
      },
      {
        id: 'aut_series',
        title: 'Серийный книгочей',
        description: 'Прочитайте 2 или более книги, входящие в книжную серию',
        category: 'authors',
        tier: 'bronze',
        iconType: 'layers',
        current: Math.min(seriesBooks.length, 2),
        target: 2,
        unit: 'книги',
        isUnlocked: seriesBooks.length >= 2,
        contributingBooks: seriesBooks,
        xpReward: 120,
      },
      {
        id: 'time_24h',
        title: 'Сутки с книгой',
        description: 'Накопите суммарно 24 часа за чтением литературы',
        category: 'volume',
        tier: 'silver',
        iconType: 'clock',
        current: Math.min(Math.round(totalHours), 24),
        target: 24,
        unit: 'ч.',
        isUnlocked: totalHours >= 24,
        contributingBooks: completedBooks.filter((b) => (b.readingHours || 0) > 0),
        xpReward: 220,
      },
    ];

    return list;
  }, [completedBooks]);

  // Overall reader Level & XP system
  const levelStats = useMemo(() => {
    // Calculate total XP: from achievements + completed books + pages read
    const achievementXp = achievements
      .filter((a) => a.isUnlocked)
      .reduce((acc, a) => acc + a.xpReward, 0);
    
    const booksXp = completedBooks.length * 80;
    const pagesXp = Math.floor(completedBooks.reduce((acc, b) => acc + (b.pages || 0), 0) / 10);
    const totalXp = achievementXp + booksXp + pagesXp;

    // Levels definitions
    const levels = [
      { level: 1, title: 'Читатель-новичок', minXp: 0, maxXp: 250 },
      { level: 2, title: 'Любознательный книголюб', minXp: 250, maxXp: 600 },
      { level: 3, title: 'Знаток страниц', minXp: 600, maxXp: 1200 },
      { level: 4, title: 'Литературный эрудит', minXp: 1200, maxXp: 2200 },
      { level: 5, title: 'Магистр библиотеки', minXp: 2200, maxXp: 3800 },
      { level: 6, title: 'Повелитель фолиантов', minXp: 3800, maxXp: 6000 },
      { level: 7, title: 'Великий архивариус', minXp: 6000, maxXp: 10000 },
    ];

    let currentLvl = levels[0];
    for (const lvl of levels) {
      if (totalXp >= lvl.minXp) {
        currentLvl = lvl;
      }
    }

    const currentLvlRange = currentLvl.maxXp - currentLvl.minXp;
    const xpInLvl = Math.max(0, totalXp - currentLvl.minXp);
    const progressPercent = Math.min(100, Math.round((xpInLvl / currentLvlRange) * 100));
    const xpToNext = Math.max(0, currentLvl.maxXp - totalXp);

    const unlockedCount = achievements.filter((a) => a.isUnlocked).length;
    const totalCount = achievements.length;

    return {
      currentLevel: currentLvl.level,
      title: currentLvl.title,
      totalXp,
      xpInLvl,
      currentLvlRange,
      progressPercent,
      xpToNext,
      unlockedCount,
      totalCount,
    };
  }, [achievements, completedBooks]);

  // Filtered achievements based on category & search
  const filteredAchievements = useMemo(() => {
    return achievements.filter((item) => {
      // Category filter
      if (selectedCategory === 'unlocked' && !item.isUnlocked) return false;
      if (selectedCategory === 'progress' && item.isUnlocked) return false;
      if (selectedCategory !== 'all' && selectedCategory !== 'unlocked' && selectedCategory !== 'progress') {
        if (item.category !== selectedCategory) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) return false;
      }

      return true;
    });
  }, [achievements, selectedCategory, searchQuery]);

  // Render achievement icon helper
  const renderIcon = (type: string, isUnlocked: boolean, tier: AchievementTier) => {
    const iconClass = isUnlocked ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-5 h-5 sm:w-6 sm:h-6 opacity-40';

    switch (type) {
      case 'trophy': return <Trophy className={iconClass} />;
      case 'medal': return <Medal className={iconClass} />;
      case 'award': return <Award className={iconClass} />;
      case 'crown': return <Crown className={iconClass} />;
      case 'star': return <Star className={iconClass} />;
      case 'book': return <BookOpen className={iconClass} />;
      case 'scroll': return <Scroll className={iconClass} />;
      case 'sparkles': return <Sparkles className={iconClass} />;
      case 'compass': return <Compass className={iconClass} />;
      case 'clock': return <Clock className={iconClass} />;
      case 'feather': return <Feather className={iconClass} />;
      case 'shield': return <ShieldCheck className={iconClass} />;
      case 'flame': return <Flame className={iconClass} />;
      case 'layers': return <Layers className={iconClass} />;
      default: return <Award className={iconClass} />;
    }
  };

  // Tier color styling classes
  const getTierBadgeStyle = (tier: AchievementTier, isUnlocked: boolean) => {
    if (!isUnlocked) {
      return {
        cardBorder: 'border-[#E8E2D8] bg-[#FAF8F5]',
        badgeBg: 'bg-[#EFE9DF] text-[#8A8172] border-[#DDD5C7]',
        label: 'В процессе',
        iconBg: 'bg-[#EFE9DF] text-[#8A8172]',
        barColor: 'bg-[#8A5A36]',
      };
    }

    switch (tier) {
      case 'bronze':
        return {
          cardBorder: 'border-[#D9A066] bg-gradient-to-br from-[#FFFDF9] to-[#FBF4EB] shadow-xs',
          badgeBg: 'bg-[#8A5025] text-[#FFF9F2] border-[#743C16]',
          label: 'Бронза',
          iconBg: 'bg-[#F2DEC9] text-[#8A5025] border border-[#D9A066]',
          barColor: 'bg-[#8A5025]',
        };
      case 'silver':
        return {
          cardBorder: 'border-[#94A3B8] bg-gradient-to-br from-[#FFFFFF] to-[#F1F5F9] shadow-xs',
          badgeBg: 'bg-[#475569] text-white border-[#334155]',
          label: 'Серебро',
          iconBg: 'bg-[#E2E8F0] text-[#334155] border border-[#CBD5E1]',
          barColor: 'bg-[#475569]',
        };
      case 'gold':
        return {
          cardBorder: 'border-[#F59E0B] bg-gradient-to-br from-[#FFFDF2] to-[#FEF3C7]/60 shadow-sm',
          badgeBg: 'bg-[#B45309] text-amber-50 border-[#92400E]',
          label: 'Золото',
          iconBg: 'bg-[#FDE68A] text-[#92400E] border border-[#FCD34D]',
          barColor: 'bg-[#B45309]',
        };
      case 'platinum':
        return {
          cardBorder: 'border-[#818CF8] bg-gradient-to-br from-[#FAF8FF] to-[#EDE9FE]/70 shadow-md',
          badgeBg: 'bg-[#4338CA] text-indigo-50 border-[#3730A3]',
          label: 'Платина',
          iconBg: 'bg-[#E0E7FF] text-[#4338CA] border border-[#C7D2FE]',
          barColor: 'bg-[#4338CA]',
        };
    }
  };

  // Auth lock screen for unauthenticated users
  if (!currentUser) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 sm:py-24 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[#EFE9DF] flex items-center justify-center text-[#8A5A36] shadow-inner">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-display font-semibold text-[#24211D]">
          Зал читательских достижений
        </h2>
        <p className="mt-3 text-sm sm:text-base text-[#6B6357] max-w-lg mx-auto leading-relaxed">
          Каждый прочитанный том, покоренная сотня страниц и оставленная заметка приближают вас к новым трофеям и званиям. Войдите через Google, чтобы открыть свою персональную стену наград.
        </p>
        <div className="mt-8 flex items-center justify-center">
          <button
            onClick={onOpenAuthModal}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-[#FAF8F5] bg-[#24211D] rounded-md hover:bg-[#3B342C] transition-colors shadow-sm"
          >
            <Cloud className="w-4 h-4 text-[#EFE9DF]" />
            <span>Войти через Google</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6">
      {/* Top Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-[#E8E2D8]">
        <div>
          <div className="flex items-center gap-2.5">
            <Trophy className="w-6 h-6 text-[#8A5A36]" />
            <h1 className="text-2xl sm:text-3xl font-display font-semibold text-[#24211D]">
              Читательские достижения
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[#6B6357]">
            Личные рекорды, книжные трофеи и звания за ваш читательский прогресс
          </p>
        </div>

        {/* Counter Summary */}
        <div className="flex items-center gap-2 bg-[#FAF8F5] border border-[#E8E2D8] px-3.5 py-2 rounded-lg text-xs self-start md:self-auto font-mono text-[#6B6357]">
          <span className="font-semibold text-sm text-[#24211D]">{levelStats.unlockedCount}</span>
          <span>из {levelStats.totalCount} наград получено</span>
          <span className="text-[#DDD5C7]">·</span>
          <span className="text-[#8A5A36] font-bold">{Math.round((levelStats.unlockedCount / levelStats.totalCount) * 100)}%</span>
        </div>
      </div>

      {/* Reader Level & XP Hero Banner */}
      <div className="bg-[#FAF8F5] border-2 border-[#E8E2D8] rounded-xl p-4 sm:p-6 shadow-xs relative overflow-hidden">
        {/* Subtle decorative watermark */}
        <div className="absolute -right-6 -bottom-8 opacity-5 pointer-events-none text-[#24211D]">
          <Trophy className="w-48 h-48" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Level badge & Title */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#8A5A36] to-[#5C341E] text-amber-100 flex flex-col items-center justify-center shadow-md border-2 border-[#D9A066]">
                <Crown className="w-5 h-5 sm:w-6 sm:h-6 mb-0.5 text-amber-200" />
                <span className="text-xs font-mono uppercase tracking-wider text-amber-200/80">Уровень</span>
                <span className="text-lg sm:text-xl font-bold font-mono leading-none">{levelStats.currentLevel}</span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#8A5A36] bg-[#EFE9DF] px-2 py-0.5 rounded font-semibold">
                  Читательский статус
                </span>
                <span className="text-xs font-mono text-[#7A7265]">
                  {levelStats.totalXp.toLocaleString('ru-RU')} XP
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-display font-semibold text-[#24211D] mt-1">
                {levelStats.title}
              </h2>
              <p className="text-xs text-[#6B6357] mt-0.5">
                До уровня {levelStats.currentLevel + 1} осталось <span className="font-semibold text-[#24211D]">{levelStats.xpToNext} XP</span>
              </p>
            </div>
          </div>

          {/* XP Progress Bar */}
          <div className="w-full md:w-80 space-y-1.5 self-center">
            <div className="flex items-center justify-between text-xs font-mono text-[#7A7265]">
              <span>Прогресс уровня</span>
              <span className="font-semibold text-[#24211D]">{levelStats.progressPercent}%</span>
            </div>
            <div className="w-full h-3 bg-[#EFE9DF] rounded-full overflow-hidden border border-[#DDD5C7] p-0.5">
              <div 
                className="h-full bg-gradient-to-r from-[#8A5A36] to-[#B45309] rounded-full transition-all duration-500"
                style={{ width: `${levelStats.progressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-[#8A8172]">
              <span>{levelStats.xpInLvl} XP на уровне</span>
              <span>{levelStats.currentLvlRange} XP цель</span>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Categories Filter & Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#FAF8F5] p-2.5 sm:p-3 border border-[#E8E2D8] rounded-lg">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 text-xs scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap font-medium ${
              selectedCategory === 'all'
                ? 'bg-[#24211D] text-[#FAF8F5]'
                : 'bg-[#EFE9DF] text-[#6B6357] hover:text-[#24211D]'
            }`}
          >
            Все ({achievements.length})
          </button>
          <button
            onClick={() => setSelectedCategory('unlocked')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 font-medium ${
              selectedCategory === 'unlocked'
                ? 'bg-[#24211D] text-[#FAF8F5]'
                : 'bg-[#EFE9DF] text-[#6B6357] hover:text-[#24211D]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Полученные ({levelStats.unlockedCount})</span>
          </button>
          <button
            onClick={() => setSelectedCategory('progress')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 font-medium ${
              selectedCategory === 'progress'
                ? 'bg-[#24211D] text-[#FAF8F5]'
                : 'bg-[#EFE9DF] text-[#6B6357] hover:text-[#24211D]'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>В процессе ({levelStats.totalCount - levelStats.unlockedCount})</span>
          </button>
          <span className="text-[#DDD5C7] px-1">|</span>
          <button
            onClick={() => setSelectedCategory('volume')}
            className={`px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap ${
              selectedCategory === 'volume'
                ? 'bg-[#24211D] text-[#FAF8F5] font-medium'
                : 'bg-[#EFE9DF] text-[#6B6357] hover:text-[#24211D]'
            }`}
          >
            Тома
          </button>
          <button
            onClick={() => setSelectedCategory('pages')}
            className={`px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap ${
              selectedCategory === 'pages'
                ? 'bg-[#24211D] text-[#FAF8F5] font-medium'
                : 'bg-[#EFE9DF] text-[#6B6357] hover:text-[#24211D]'
            }`}
          >
            Страницы
          </button>
          <button
            onClick={() => setSelectedCategory('genre')}
            className={`px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap ${
              selectedCategory === 'genre'
                ? 'bg-[#24211D] text-[#FAF8F5] font-medium'
                : 'bg-[#EFE9DF] text-[#6B6357] hover:text-[#24211D]'
            }`}
          >
            Жанры
          </button>
          <button
            onClick={() => setSelectedCategory('reviews')}
            className={`px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap ${
              selectedCategory === 'reviews'
                ? 'bg-[#24211D] text-[#FAF8F5] font-medium'
                : 'bg-[#EFE9DF] text-[#6B6357] hover:text-[#24211D]'
            }`}
          >
            Рецензии & Оценки
          </button>
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:w-56 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A8172]" />
          <input
            type="text"
            placeholder="Найти достижение..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#FAF8F5] border border-[#DDD5C7] rounded pl-8 pr-7 py-1 text-xs text-[#24211D] focus:outline-none focus:border-[#24211D]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8A8172] hover:text-[#24211D]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Achievements Cards Grid */}
      {filteredAchievements.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-[#DDD5C7] rounded-lg bg-[#F7F4EF]">
          <Award className="w-8 h-8 mx-auto text-[#8A8172] mb-3" />
          <h3 className="text-base font-display font-medium text-[#24211D]">
            Ни одно достижение не найдено
          </h3>
          <p className="mt-1 text-xs text-[#6B6357] max-w-sm mx-auto">
            Попробуйте изменить категорию или сбросить поисковый запрос
          </p>
          <button
            onClick={() => {
              setSelectedCategory('all');
              setSearchQuery('');
            }}
            className="mt-4 px-3 py-1.5 text-xs font-medium text-[#24211D] bg-[#EFE9DF] hover:bg-[#E4DCCE] rounded transition-colors"
          >
            Сбросить фильтры
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {filteredAchievements.map((item) => {
            const style = getTierBadgeStyle(item.tier, item.isUnlocked);
            const progressPercent = Math.min(100, Math.round((item.current / item.target) * 100));

            return (
              <div
                key={item.id}
                onClick={() => setInspectedAchievement(item)}
                className={`relative rounded-xl border p-4 sm:p-5 transition-all duration-200 cursor-pointer hover:shadow-md flex flex-col justify-between ${style.cardBorder}`}
              >
                {/* Top Badge header */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${style.iconBg}`}>
                        {renderIcon(item.iconType, item.isUnlocked, item.tier)}
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-sm border font-semibold ${style.badgeBg}`}>
                            {style.label}
                          </span>
                          <span className="text-[10px] font-mono text-[#8A5A36] font-semibold">
                            +{item.xpReward} XP
                          </span>
                        </div>
                        <h3 className="font-display font-semibold text-sm sm:text-base text-[#24211D] mt-1 leading-snug">
                          {item.title}
                        </h3>
                      </div>
                    </div>

                    {item.isUnlocked ? (
                      <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center shadow-xs" title="Награда получена">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="shrink-0 w-6 h-6 rounded-full bg-[#EFE9DF] text-[#8A8172] flex items-center justify-center" title="В процессе выполнения">
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>

                  <p className="mt-2.5 text-xs text-[#6B6357] leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Bottom Progress status */}
                <div className="mt-4 pt-3 border-t border-black/5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono text-[#7A7265]">
                    <span>Прогресс:</span>
                    <span className="font-semibold text-[#24211D]">
                      {item.current} / {item.target} {item.unit} ({progressPercent}%)
                    </span>
                  </div>

                  <div className="w-full h-2 bg-black/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${style.barColor}`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {item.contributingBooks.length > 0 && (
                    <div className="pt-1 flex items-center justify-between text-[11px] text-[#8A5A36] font-medium">
                      <span>Связанные книги ({item.contributingBooks.length})</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Achievement Detail Inspection Modal */}
      {inspectedAchievement && (
        <div 
          className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setInspectedAchievement(null)}
        >
          <div
            className="relative w-full max-w-lg bg-[#FAF8F5] border border-[#E8E2D8] rounded-xl shadow-2xl overflow-hidden my-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E2D8] bg-[#F7F4EF]">
              <div className="flex items-center gap-2.5">
                <Trophy className="w-5 h-5 text-[#8A5A36]" />
                <h3 className="font-display font-semibold text-base text-[#24211D]">
                  Детали награды
                </h3>
              </div>
              <button
                onClick={() => setInspectedAchievement(null)}
                className="p-1 rounded-md text-[#7A7265] hover:text-[#24211D] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 text-xs text-[#6B6357]">
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${getTierBadgeStyle(inspectedAchievement.tier, inspectedAchievement.isUnlocked).iconBg}`}>
                  {renderIcon(inspectedAchievement.iconType, inspectedAchievement.isUnlocked, inspectedAchievement.tier)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-sm border font-semibold ${getTierBadgeStyle(inspectedAchievement.tier, inspectedAchievement.isUnlocked).badgeBg}`}>
                      {getTierBadgeStyle(inspectedAchievement.tier, inspectedAchievement.isUnlocked).label}
                    </span>
                    <span className="text-[11px] font-mono text-[#8A5A36] font-bold">
                      +{inspectedAchievement.xpReward} Очков опыта
                    </span>
                  </div>
                  <h4 className="text-lg font-display font-semibold text-[#24211D] mt-1">
                    {inspectedAchievement.title}
                  </h4>
                  <p className="text-xs text-[#6B6357] mt-1">
                    {inspectedAchievement.description}
                  </p>
                </div>
              </div>

              {/* Progress Box */}
              <div className="bg-[#FAF8F5] p-3.5 border border-[#E8E2D8] rounded-lg space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[#7A7265]">Текущий результат:</span>
                  <span className="font-semibold text-[#24211D]">
                    {inspectedAchievement.current} из {inspectedAchievement.target} {inspectedAchievement.unit}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-[#EFE9DF] rounded-full overflow-hidden border border-[#DDD5C7]">
                  <div 
                    className="h-full bg-gradient-to-r from-[#8A5A36] to-[#B45309] rounded-full"
                    style={{ width: `${Math.min(100, Math.round((inspectedAchievement.current / inspectedAchievement.target) * 100))}%` }}
                  />
                </div>
                <div className="text-[11px] text-right font-mono text-[#8A8172]">
                  {inspectedAchievement.isUnlocked ? '✓ Цель полностью достигнута!' : `Осталось: ${Math.max(0, inspectedAchievement.target - inspectedAchievement.current)} ${inspectedAchievement.unit}`}
                </div>
              </div>

              {/* Books that contributed to this trophy */}
              {inspectedAchievement.contributingBooks.length > 0 && (
                <div className="space-y-2">
                  <h5 className="font-semibold text-[#24211D] text-xs uppercase tracking-wider font-mono">
                    Книги, поспособствовавшие награде ({inspectedAchievement.contributingBooks.length}):
                  </h5>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {inspectedAchievement.contributingBooks.map((b) => (
                      <div
                        key={b.id}
                        onClick={() => {
                          onSelectBook?.(b);
                          setInspectedAchievement(null);
                        }}
                        className="flex items-center justify-between p-2 rounded bg-[#F7F4EF] border border-[#E8E2D8] hover:bg-[#EFE9DF] cursor-pointer transition-colors"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="font-medium text-xs text-[#24211D] truncate">
                            {b.title}
                          </p>
                          <p className="text-[10px] text-[#7A7265] truncate">
                            {b.authors.join(', ')} {b.pages ? `· ${b.pages} стр.` : ''} {b.rating ? `· ${b.rating}/10★` : ''}
                          </p>
                        </div>
                        <span className="text-[10px] text-[#8A5A36] font-medium shrink-0">
                          Открыть →
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-[#E8E2D8] bg-[#F7F4EF] flex justify-end">
              <button
                onClick={() => setInspectedAchievement(null)}
                className="px-4 py-1.5 text-xs font-medium text-[#24211D] bg-[#EFE9DF] hover:bg-[#E4DCCE] rounded transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
