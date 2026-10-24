import React, { useState } from 'react';
import { 
  User, 
  signInWithPopup, 
  signOut, 
  GoogleAuthProvider,
  browserPopupRedirectResolver 
} from 'firebase/auth';
import { auth, googleProvider, setCachedAccessToken, clearAccessToken, saveUserSession } from '../../services/firebase';
import { 
  uploadLocalBooksBatch, 
  twoWaySyncBooks, 
  pullAllBooksFromCloud 
} from '../../services/cloudSync';
import { Book } from '../../types/book';
import { 
  X, 
  Cloud, 
  Smartphone, 
  Monitor, 
  LogOut, 
  Sparkles, 
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  DownloadCloud,
  UploadCloud
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | any | null;
  books: Book[];
  onSignOut?: () => void;
  onSyncComplete?: (updatedBooks: Book[]) => void;
  onUserChange?: (user: any) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  books,
  onSignOut,
  onSyncComplete,
  onUserChange,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [syncSuccessMessage, setSyncSuccessMessage] = useState('');
  const [isUnauthorizedDomain, setIsUnauthorizedDomain] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [emailInput, setEmailInput] = useState(() => currentUser?.email || 'jaguuuar@gmail.com');

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
        onUserChange?.(result.user);
        // Automatically sync with server
        pullAllBooksFromCloud(result.user.uid).then((b) => {
          if (b && b.length > 0 && onSyncComplete) onSyncComplete(b);
        }).catch(() => {});
      }
    } catch (err: any) {
      console.error('Google Sign In error:', err);
      const msg = err.message || '';
      const code = err.code || '';
      if (code === 'auth/unauthorized-domain' || msg.includes('auth/unauthorized-domain')) {
        setIsUnauthorizedDomain(true);
        setErrorMessage('Google заблокировал вход с этого временного домена. Используйте быстрый вход по Email ниже — он работает мгновенно без блокировок!');
      } else if (code === 'auth/popup-blocked' || msg.includes('popup')) {
        setErrorMessage('Браузер телефона заблокировал всплывающее окно Google. Войдите по Email ниже — окно не потребуется.');
      } else {
        setErrorMessage(msg || 'Не удалось выполнить вход через Google.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignIn = async (emailOverride?: string) => {
    const raw = (emailOverride || emailInput).trim().toLowerCase();
    if (!raw || !raw.includes('@')) {
      setErrorMessage('Пожалуйста, введите корректный адрес электронной почты (например, jaguuuar@gmail.com).');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    try {
      const userSession = {
        uid: raw,
        displayName: raw.split('@')[0],
        email: raw,
        photoURL: null,
      };
      saveUserSession(userSession);
      onUserChange?.(userSession);
      const remoteBooks = await pullAllBooksFromCloud(raw);
      if (onSyncComplete && remoteBooks && remoteBooks.length > 0) {
        onSyncComplete(remoteBooks);
      }
      setSyncSuccessMessage(`Синхронизация успешно подключена для ${raw}!`);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Email sign in notice:', err);
      setErrorMessage(`Ошибка подключения: ${err?.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      saveUserSession(null);
      clearAccessToken();
      onUserChange?.(null);
      onSignOut?.();
      await signOut(auth);
      onClose();
    } catch (err: any) {
      console.error('Sign out error:', err);
    }
  };

  const handleTwoWaySync = async () => {
    setIsLoading(true);
    setErrorMessage('');
    setSyncSuccessMessage('');
    try {
      const syncTarget = currentUser?.email || currentUser?.uid || 'jaguuuar@gmail.com';
      const result = await twoWaySyncBooks(syncTarget, books);
      if (onSyncComplete && result.books) {
        onSyncComplete(result.books);
      }
      setSyncSuccessMessage(result.message);
    } catch (err: any) {
      console.error('Two-way sync error:', err);
      setErrorMessage(`Ошибка синхронизации: ${err?.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForcePull = async () => {
    setIsLoading(true);
    setErrorMessage('');
    setSyncSuccessMessage('');
    try {
      const syncTarget = currentUser?.email || currentUser?.uid || 'jaguuuar@gmail.com';
      const cloudBooks = await pullAllBooksFromCloud(syncTarget);
      if (!cloudBooks || cloudBooks.length === 0) {
        setErrorMessage('В облаке пока нет сохранённых книг для этого аккаунта.');
        return;
      }
      if (onSyncComplete) {
        onSyncComplete(cloudBooks);
      }
      setSyncSuccessMessage(`Успешно загружено ${cloudBooks.length} книг из облака! Ваша книжная полка полностью обновлена.`);
    } catch (err: any) {
      console.error('Force pull error:', err);
      setErrorMessage(`Ошибка загрузки из облака: ${err?.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForcePush = async () => {
    setIsLoading(true);
    setErrorMessage('');
    setSyncSuccessMessage('');
    try {
      if (!books || books.length === 0) {
        setErrorMessage('В библиотеке сейчас нет книг для отправки.');
        return;
      }
      const syncTarget = currentUser?.email || currentUser?.uid || 'jaguuuar@gmail.com';
      await uploadLocalBooksBatch(syncTarget, books);
      setSyncSuccessMessage(`Все ${books.length} книг успешно загружены в облако как основная копия.`);
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
            <div className="p-4 bg-amber-50/95 border border-amber-300 rounded-lg text-[#3B342C] space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h5 className="font-semibold text-xs text-[#24211D]">
                    Требуется разрешить домен в Firebase Console
                  </h5>
                  <p className="text-[11px] text-[#6B6357] leading-relaxed">
                    Политика безопасности Google требует добавить этот домен в список <strong>Authorized Domains</strong> вашего проекта Firebase (<strong>thematic-cathode-98f9p</strong>). Это занимает 30 секунд:
                  </p>
                </div>
              </div>

              <div className="bg-white border border-amber-200 rounded p-2.5 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-[#24211D] truncate select-all">
                    {currentDomain}
                  </span>
                  <button
                    onClick={handleCopyDomain}
                    className="shrink-0 px-2.5 py-1 text-[11px] font-medium bg-[#FAF8F5] border border-[#D1C7B7] hover:border-[#24211D] rounded transition-colors cursor-pointer"
                  >
                    {copiedDomain ? 'Скопировано ✓' : 'Скопировать'}
                  </button>
                </div>
              </div>

              <div className="pt-1 flex flex-col sm:flex-row gap-2">
                <a
                  href={firebaseSettingsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-3 bg-[#FAF8F5] border border-[#D1C7B7] hover:border-[#24211D] text-[#24211D] rounded font-medium text-xs text-center transition-colors shadow-xs"
                >
                  1. Открыть Authorized domains в Firebase →
                </a>
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="flex-1 py-2 px-3 bg-[#24211D] hover:bg-[#3B342C] text-white rounded font-medium text-xs transition-colors shadow-xs text-center cursor-pointer disabled:opacity-50"
                >
                  2. {isLoading ? 'Подключение...' : 'Повторить вход через Google'}
                </button>
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

              <div className="space-y-2.5 pt-2 border-t border-[#EFE9DF]">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    onClick={handleTwoWaySync}
                    disabled={isLoading}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#24211D] hover:bg-[#3B342C] text-white rounded font-medium text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                    title="Объединить изменения с телефона и компьютера без потери данных"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>Синхронизировать (ПК & Телефон)</span>
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleForcePull}
                      disabled={isLoading}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#FAF8F5] border border-[#D1C7B7] hover:border-[#24211D] rounded font-medium text-[11px] text-[#24211D] transition-colors cursor-pointer disabled:opacity-50"
                      title="Загрузить актуальную базу из Google Облака, если на компьютере отображаются старые данные"
                    >
                      <DownloadCloud className="w-3.5 h-3.5 text-[#8A5A36]" />
                      <span>Загрузить из облака</span>
                    </button>

                    <button
                      onClick={handleForcePush}
                      disabled={isLoading}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#FAF8F5] border border-[#D1C7B7] hover:border-[#24211D] rounded font-medium text-[11px] text-[#6B6357] hover:text-[#24211D] transition-colors cursor-pointer disabled:opacity-50"
                      title="Отправить локальные книги в облако как резервную копию"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Отправить в облако</span>
                    </button>
                  </div>

                  <button
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Выйти</span>
                  </button>
                </div>
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

              <div className="space-y-4 pt-1">
                {/* Primary: Google Sign In */}
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-3 bg-[#24211D] hover:bg-[#3B342C] text-white rounded font-medium text-xs transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
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
                  <span className="font-semibold">{isLoading ? 'Подключение к Google...' : 'Войти через Google для синхронизации'}</span>
                </button>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-[#E8E2D8]"></div>
                  <span className="flex-shrink mx-2 text-[10px] uppercase tracking-wider text-[#8A8172]">или резервная синхронизация</span>
                  <div className="flex-grow border-t border-[#E8E2D8]"></div>
                </div>

                {/* Secondary Pairing Card */}
                <div className="p-3 bg-[#FAF8F5] border border-[#D1C7B7] rounded-md space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[11px] text-[#24211D]">Синхронизация по Email:</span>
                    <span className="text-[10px] text-[#7A7265]">Без всплывающих окон</span>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch gap-2">
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="jaguuuar@gmail.com"
                      className="flex-1 px-3 py-1.5 text-xs bg-white border border-[#D1C7B7] rounded focus:outline-none focus:border-[#24211D] text-[#24211D]"
                    />
                    <button
                      onClick={() => handleEmailSignIn(emailInput)}
                      disabled={isLoading}
                      className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#F1EAE0] border border-[#D1C7B7] text-[#24211D] rounded font-medium text-xs transition-colors cursor-pointer disabled:opacity-50 shrink-0 text-center shadow-xs"
                    >
                      Подключить по Email
                    </button>
                  </div>
                </div>
              </div>
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
