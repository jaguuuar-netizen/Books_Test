import React, { useState } from 'react';
import { Cloud, Lock, BarChart3, TrendingUp, Sparkles, BookOpen, Clock, Users, ArrowRight } from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../../services/firebase';

interface StatisticsAuthGateProps {
  onOpenAuthModal: () => void;
  onGoToShelf?: () => void;
}

export const StatisticsAuthGate: React.FC<StatisticsAuthGateProps> = ({
  onOpenAuthModal,
  onGoToShelf,
}) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleQuickGoogleSignIn = async () => {
    setIsSigningIn(true);
    setErrorMessage(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.warn('Google sign in error:', err);
      // Fallback: open auth modal where full instructions (and domain warnings) are handled
      onOpenAuthModal();
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-xl shadow-xs overflow-hidden">
        {/* Top Header Badge */}
        <div className="bg-[#F7F4EF] border-b border-[#E8E2D8] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#8A5A36]">
            <Lock className="w-4 h-4 text-[#8A5A36]" />
            <span>Требуется авторизация в облаке</span>
          </div>
          <span className="text-[11px] font-mono text-[#8A8172]">
            Google Cloud Sync
          </span>
        </div>

        {/* Hero Section */}
        <div className="p-6 sm:p-10 text-center space-y-6">
          <div className="relative mx-auto w-16 h-16 rounded-2xl bg-[#F1EAE0] border border-[#E0D5C5] flex items-center justify-center text-[#8A5A36] shadow-inner">
            <BarChart3 className="w-8 h-8" />
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 items-center justify-center text-[9px] text-white font-bold">
                🔒
              </span>
            </span>
          </div>

          <div className="max-w-xl mx-auto space-y-3">
            <h2 className="text-2xl sm:text-3xl font-display font-semibold text-[#24211D] tracking-tight">
              Статистика доступна после входа в облако
            </h2>
            <p className="text-sm text-[#6B6357] leading-relaxed">
              Чтобы рассчитывать вашу персональную скорость чтения, строить графики по месяцам и вести учет прочитанного без риска потерять данные, подключите аккаунт Google.
            </p>
          </div>

          {/* Quick Sign-In CTA */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleQuickGoogleSignIn}
              disabled={isSigningIn}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-6 py-3 bg-[#24211D] hover:bg-[#3B342C] text-white rounded-lg font-medium text-sm transition-all shadow-sm hover:shadow hover:-translate-y-0.5 disabled:opacity-50"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isSigningIn ? 'Подключение к Google...' : 'Войти через Google и открыть статистику'}</span>
            </button>

            {onGoToShelf && (
              <button
                onClick={onGoToShelf}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-3 bg-[#FAF8F5] border border-[#D1C7B7] hover:border-[#24211D] text-[#24211D] rounded-lg font-medium text-sm transition-colors"
              >
                <span>К книжной полке</span>
                <ArrowRight className="w-4 h-4 text-[#7A7265]" />
              </button>
            )}
          </div>

          {errorMessage && (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2.5 max-w-md mx-auto">
              {errorMessage}
            </p>
          )}

          {/* Features Preview Grid */}
          <div className="pt-8 border-t border-[#E8E2D8] grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
            <div className="p-4 bg-[#F7F4EF]/70 border border-[#E8E2D8] rounded-lg space-y-1.5">
              <div className="flex items-center gap-2 text-[#24211D] font-medium text-xs">
                <TrendingUp className="w-4 h-4 text-[#273B30]" />
                <span>Динамика и графики по годам</span>
              </div>
              <p className="text-[11px] text-[#7A7265] leading-relaxed">
                Сравнение количества прочитанных книг по месяцам и годам с удобной визуализацией.
              </p>
            </div>

            <div className="p-4 bg-[#F7F4EF]/70 border border-[#E8E2D8] rounded-lg space-y-1.5">
              <div className="flex items-center gap-2 text-[#24211D] font-medium text-xs">
                <Clock className="w-4 h-4 text-[#8A5A36]" />
                <span>Темп и скорость чтения</span>
              </div>
              <p className="text-[11px] text-[#7A7265] leading-relaxed">
                Автоматический подсчет страниц в час, среднее время на страницу и общее затраченное время.
              </p>
            </div>

            <div className="p-4 bg-[#F7F4EF]/70 border border-[#E8E2D8] rounded-lg space-y-1.5">
              <div className="flex items-center gap-2 text-[#24211D] font-medium text-xs">
                <Users className="w-4 h-4 text-[#1C2A3A]" />
                <span>Топ авторов и объединение</span>
              </div>
              <p className="text-[11px] text-[#7A7265] leading-relaxed">
                Рейтинг авторов по оценкам и количеству книг, а также исправление дубликатов написания.
              </p>
            </div>

            <div className="p-4 bg-[#F7F4EF]/70 border border-[#E8E2D8] rounded-lg space-y-1.5">
              <div className="flex items-center gap-2 text-[#24211D] font-medium text-xs">
                <Cloud className="w-4 h-4 text-[#204028]" />
                <span>Двусторонняя синхронизация</span>
              </div>
              <p className="text-[11px] text-[#7A7265] leading-relaxed">
                Книги сохраняются в облаке и мгновенно доступны на компьютере и мобильном телефоне.
              </p>
            </div>
          </div>
        </div>

        {/* Footer info note */}
        <div className="px-6 py-3.5 bg-[#F1ECE4] border-t border-[#E8E2D8] flex items-center justify-between text-[11px] text-[#7A7265]">
          <span>Синхронизация работает безопасно через официальный Google Sign-In</span>
          <button
            onClick={onOpenAuthModal}
            className="text-[#8A5A36] hover:text-[#5E3023] underline font-medium"
          >
            Подробнее об авторизации
          </button>
        </div>
      </div>
    </div>
  );
};
