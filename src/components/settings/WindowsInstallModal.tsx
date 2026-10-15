import React from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { 
  X, 
  Monitor, 
  Download, 
  CheckCircle2, 
  ExternalLink, 
  Terminal, 
  ShieldCheck, 
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface WindowsInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WindowsInstallModal: React.FC<WindowsInstallModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div 
        className="relative w-full max-w-xl bg-[#FAF8F5] border border-[#E8E2D8] rounded-lg shadow-xl overflow-hidden my-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E2D8] bg-[#F7F4EF]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#24211D] text-[#FAF8F5] flex items-center justify-center">
              <Monitor className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-base text-[#24211D]">
                Установка программы на Windows
              </h3>
              <p className="text-[11px] text-[#7A7265]">
                Автономная работа, ярлык на рабочем столе и в меню «Пуск»
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#7A7265] hover:text-[#24211D] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-xs">
          {/* Method 1: Instant 1-Click Browser-to-Windows Installation (PWA Native Windows App) */}
          <div className="p-4 bg-[#F1ECE4] border border-[#DDD5C7] rounded-md space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-[#8A5A36] mb-0.5">
                  Рекомендуемый способ (мгновенно)
                </span>
                <h4 className="font-display font-semibold text-sm text-[#24211D]">
                  Установить как программу Windows в 1 клик
                </h4>
                <p className="text-[11px] text-[#6B6357] mt-1 leading-relaxed">
                  Windows автоматически создаст исполняемый ярлык на рабочем столе и в меню «Пуск». Приложение будет запускаться в своём отдельном окне без рамок браузера и сохранять данные полностью офлайн.
                </p>
              </div>
            </div>

            <div className="pt-1">
              {isInstalled ? (
                <div className="flex items-center gap-2 text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>Программа уже успешно установлена в Windows!</span>
                </div>
              ) : isInstallable ? (
                <button
                  onClick={async () => {
                    await install();
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 font-semibold text-[#FAF8F5] bg-[#24211D] hover:bg-[#3B342C] rounded shadow-xs transition-colors text-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Установить «My Book Shelf» на компьютер</span>
                </button>
              ) : (
                <div className="space-y-2 text-[11px] text-[#6B6357] bg-[#FAF8F5] p-3 rounded border border-[#E8E2D8]">
                  <p className="font-medium text-[#24211D]">
                    Если кнопка браузера не сработала автоматически:
                  </p>
                  <p>
                    1. В браузере (Microsoft Edge или Google Chrome) нажмите на иконку компьютера со стрелочкой в правом конце адресной строки <strong>«Установить приложение»</strong> (или через меню «···» → <em>«Приложения» → «Установить My Book Shelf»</em>).
                  </p>
                  <p>
                    2. Подтвердите установку — ярлык появится на вашем рабочем столе и в панели задач.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Method 2: Standalone .exe Installer via Electron */}
          <div className="space-y-3">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-[#7A7265]">
              Автономный установщик .exe (Electron / NSIS)
            </h4>
            <p className="text-[11px] text-[#6B6357] leading-relaxed">
              В проект уже включены все конфигурационные файлы для генерации классического инсталлятора <code>My Book Shelf Setup.exe</code> и портативной версии <code>portable.exe</code> на базе Electron.
            </p>

            <div className="bg-[#24211D] text-[#FAF8F5] p-3 rounded font-mono text-[11px] space-y-1.5 overflow-x-auto">
              <div className="text-[#8A8172]">// Команда для сборки .exe установщика Windows:</div>
              <div className="text-amber-200">npm run build:win</div>
              <div className="text-[#8A8172] mt-1">// Или сборка портативного .exe без инсталляции:</div>
              <div className="text-amber-200">npm run build:win:portable</div>
            </div>

            <div className="flex items-start gap-2 pt-1 text-[11px] text-[#7A7265]">
              <ShieldCheck className="w-4 h-4 text-[#273B30] shrink-0 mt-0.5" />
              <span>
                Готовый исполняемый файл помещается в папку <code>release/</code>. Также в корне проекта подготовлен запускающий скрипт <code>start-windows.bat</code>.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#F7F4EF] border-t border-[#E8E2D8] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-[#FAF8F5] bg-[#24211D] hover:bg-[#3B342C] rounded transition-colors"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
};
