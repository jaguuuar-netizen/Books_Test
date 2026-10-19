import React, { useState } from 'react';
import { 
  User, 
  signInWithPopup, 
  signOut, 
  GoogleAuthProvider,
  browserPopupRedirectResolver 
} from 'firebase/auth';
import { auth, googleProvider, setCachedAccessToken, clearAccessToken, saveUserSession } from '../../services/firebase';
import { uploadLocalBooksBatch } from '../../services/cloudSync';
import { Book } from '../../types/book';
import { 
  X, 
  Cloud, 
  CloudCheck, 
  Smartphone, 
  Monitor, 
  LogOut, 
  Sparkles, 
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | any | null;
  books: Book[];
  onSignOut?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  books,
  onSignOut,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [syncSuccessMessage, setSyncSuccessMessage] = useState('');
  const [isUnauthorizedDomain, setIsUnauthorizedDomain] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);

  if (!isOpen) return null;

  const currentDomain = typeof window !== 'undefined' ? window.location.hostname : '';
  const firebaseSettingsUrl = `https://console.firebase.google.com/project/thematic-cathode-98f9p/authentication/settings`;

  const handleCopyDomain = async () => {
    if (currentDomain) {
      await navigator.clipboard.writeText(currentDomain);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2500);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage('');
    setIsUnauthorizedDomain(false);
    try {
      const result = await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setCachedAccessToken(credential.accessToken);
      }
      if (result.user) {
        saveUserSession(result.user);
      }
      // Data synchronization is handled reactively by subscribeToCloudBooks
    } catch (err: any) {
      console.error('Google Sign In error:', err);
      const msg = err.message || '';
      const code = err.code || '';
      if (code === 'auth/unauthorized-domain' || msg.includes('auth/unauthorized-domain')) {
        setIsUnauthorizedDomain(true);
        setErrorMessage('Домен этого сайта пока не добавлен в список авторизованных доменов в Firebase.');
      } else {
        setErrorMessage(msg || 'Не удалось выполнить вход через Google.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      saveUserSession(null);
      clearAccessToken();
      onSignOut?.();
      await signOut(auth);
      onClose();
    } catch (err: any) {
      console.error('Sign out error:', err);
    }
  };

  const handleManualUpload = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    setErrorMessage('');
    setSyncSuccessMessage('');
    try {
      const booksToUpload = books;
      if (!booksToUpload || booksToUpload.length === 0) {
        setErrorMessage('В библиотеке сейчас нет книг для отправки.');
        return;
      }
      await uploadLocalBooksBatch(currentUser.uid, booksToUpload);
      setSyncSuccessMessage(`Успешно отправлено ${booksToUpload.length} книг в базу данных Google Облака! Теперь они мгновенно доступны на телефоне.`);
    } catch (err: any) {
      console.error('Manual upload error:', err);
      setErrorMessage(`Ошибка отправки в облако: ${err?.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div 
        className="relative w-full max-w-lg bg-[#FAF8F5] border border-[#E8E2D8] rounded-lg shadow-xl overflow-hidden my-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E2D8] bg-[#F7F4EF]">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-[#8A5A36]" />
            <h3 className="font-display font-semibold text-base text-[#24211D]">
              Облачная синхронизация
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#7A7265] hover:text-[#24211D] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 text-xs">
          {errorMessage && !isUnauthorizedDomain && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isUnauthorizedDomain && (
            <div className="p-4 bg-amber-50/80 border border-amber-300 rounded-lg text-[#3B342C] space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-semibold text-xs text-[#24211D]">
                    Требуется добавить домен в Firebase Console (1 минута)
                  </h5>
                  <p className="text-[11px] text-[#6B6357] mt-0.5">
                    Firebase защищает вход и разрешает авторизацию только с доменов из белого списка.
                  </p>
                </div>
              </div>

              <div className="p-2.5 bg-white border border-amber-200 rounded text-[11px] space-y-2">
                <div className="text-[11px] font-medium text-[#7A7265]">Ваш текущий домен:</div>
                <div className="flex items-center justify-between gap-2 p-1.5 bg-[#FAF8F5] border border-[#E8E2D8] rounded font-mono text-[10px] break-all">
                  <span>{currentDomain}</span>
                  <button
                    onClick={handleCopyDomain}
                    className="shrink-0 px-2 py-1 bg-[#24211D] hover:bg-[#3B342C] text-white rounded font-sans text-[10px] font-medium transition-colors"
                  >
                    {copiedDomain ? 'Скопировано!' : 'Копировать'}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 text-[11px] text-[#554D41]">
                <p className="font-medium text-[#24211D]">Как добавить домен:</p>
                <ol className="list-decimal list-inside space-y-1 pl-1">
                  <li>
                    Откройте{' '}
                    <a
                      href={firebaseSettingsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#8A5A36] underline font-medium hover:text-[#5E3A1F]"
                    >
                      Настройки авторизации Firebase
                    </a>
                  </li>
                  <li>
                    Вкладка <strong>Settings</strong> &rarr; раздел <strong>Authorized domains</strong>.
                  </li>
                  <li>
                    Нажмите <strong>Add domain</strong>, вставьте скопированный домен и сохраните.
                  </li>
                </ol>
              </div>

              <div className="pt-1 flex items-center gap-2">
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="flex-1 py-1.5 px-3 bg-[#24211D] hover:bg-[#3B342C] text-white rounded font-medium text-xs transition-colors shadow-sm text-center"
                >
                  {isLoading ? 'Проверка...' : 'Я добавил, войти снова'}
                </button>
                <a
                  href={firebaseSettingsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1.5 px-3 bg-white border border-[#D1C7B7] hover:border-[#24211D] text-[#24211D] rounded font-medium text-xs transition-colors text-center inline-block"
                >
                  Открыть Firebase
                </a>
              </div>
            </div>
          )}

          {syncSuccessMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{syncSuccessMessage}</span>
            </div>
          )}

          {currentUser ? (
            /* Signed In State */
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3.5 bg-[#F7F4EF] border border-[#E8E2D8] rounded-md">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt=""
                    className="w-10 h-10 rounded-full border border-[#D1C7B7]"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#24211D] text-white flex items-center justify-center font-bold text-sm">
                    {currentUser.email?.[0].toUpperCase() || 'U'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#24211D]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Синхронизация активна</span>
                  </div>
                  <p className="text-[11px] text-[#7A7265] truncate mt-0.5">
                    {currentUser.email}
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-[#FAF8F5] border border-[#E8E2D8] rounded-md text-[11px] text-[#6B6357] space-y-2">
                <p className="font-medium text-[#24211D]">
                  Как это работает:
                </p>
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-[#8A8172] shrink-0" />
                  <span>Любое изменение книги на ПК мгновенно обновляется в облаке.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#8A8172] shrink-0" />
                  <span>Откройте сайт на телефоне и войдите под этим же аккаунтом ({currentUser.email}).</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#EFE9DF]">
                <button
                  onClick={handleManualUpload}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF8F5] border border-[#D1C7B7] hover:border-[#24211D] rounded font-medium text-[#24211D] transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Синхронизировать сейчас</span>
                </button>

                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-rose-700 hover:bg-rose-50 rounded transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Выйти из аккаунта</span>
                </button>
              </div>
            </div>
          ) : (
            /* Not Signed In State */
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-[#F1EAE0] text-[#8A5A36] mx-auto flex items-center justify-center">
                  <Cloud className="w-6 h-6" />
                </div>
                <h4 className="font-display font-semibold text-base text-[#24211D]">
                  Синхронизация между ПК и телефоном
                </h4>
                <p className="text-xs text-[#6B6357] max-w-sm mx-auto leading-relaxed">
                  Войдите в аккаунт Google на компьютере и на телефоне — и ваша книжная полка, оценки и заметки будут автоматически обновляться на всех устройствах в реальном времени.
                </p>
              </div>

              <div className="p-4 bg-[#F7F4EF] border border-[#E8E2D8] rounded-md space-y-2.5 text-[11px] text-[#6B6357]">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#8A5A36] shrink-0 mt-0.5" />
                  <span>Все существующие на этом устройстве книги автоматически загрузятся в ваш аккаунт.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Smartphone className="w-3.5 h-3.5 text-[#273B30] shrink-0 mt-0.5" />
                  <span>При чтении книги в дороге на телефоне статус сразу обновится на вашем компьютере.</span>
                </div>
              </div>

              <button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 bg-[#24211D] hover:bg-[#3B342C] text-white rounded font-medium text-xs transition-colors shadow-sm disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                <span>{isLoading ? 'Подключение к Google...' : 'Войти через Google для синхронизации'}</span>
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-3.5 bg-[#F7F4EF] border-t border-[#E8E2D8] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-[#24211D] bg-[#EFE9DF] hover:bg-[#E4DCCE] rounded transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
