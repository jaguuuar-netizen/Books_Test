import React, { useState, useEffect, useRef } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { 
  auth, 
  getAccessToken, 
  getSavedUserSession, 
  saveUserSession, 
  SavedUserSession 
} from './services/firebase';
import { 
  subscribeToCloudBooks, 
  subscribeToCloudGenres, 
  saveBookToCloud, 
  deleteBookFromCloud, 
  syncAllBooksToCloud,
  uploadLocalBooksBatch,
  saveGenreToCloud,
  deleteGenreFromCloud,
  isStockDemoBooks
} from './services/cloudSync';
import { 
  GoogleSheetsConfig, 
  loadGoogleSheetsConfig, 
  saveGoogleSheetsConfig, 
  writeBooksToSpreadsheet 
} from './services/googleSheets';
import { Book } from './types/book';
import { storageService, DEFAULT_GENRES } from './services/storage';
import { INITIAL_DEMO_BOOKS } from './services/demoData';
import { Header, NavTab } from './components/layout/Header';
import { MobileNav } from './components/layout/MobileNav';
import { Dashboard } from './components/dashboard/Dashboard';
import { LibraryView } from './components/library/LibraryView';
import { StatisticsView } from './components/statistics/StatisticsView';
import { CalendarView } from './components/calendar/CalendarView';
import { GenresView } from './components/genres/GenresView';
import { Lock, Cloud } from 'lucide-react';
import { BookDetailModal } from './components/book/BookDetailModal';
import { BookFormModal } from './components/book/BookFormModal';
import { QuickCompleteModal } from './components/book/QuickCompleteModal';
import { ExportImportModal } from './components/settings/ExportImportModal';
import { WindowsInstallModal } from './components/settings/WindowsInstallModal';
import { AuthModal } from './components/auth/AuthModal';
import { StatisticsAuthGate } from './components/statistics/StatisticsAuthGate';
import { RecommendationsView } from './components/recommendations/RecommendationsView';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [books, setBooks] = useState<Book[]>([]);
  const [genres, setGenres] = useState<string[]>(DEFAULT_GENRES);
  const [isLoading, setIsLoading] = useState(true);
  
  // Initialize with cached user session immediately to prevent auth dropping on page reload / mobile sleep
  const cachedSessionRef = useRef<SavedUserSession | null>(getSavedUserSession());
  const [currentUser, setCurrentUser] = useState<User | null>(
    () => auth.currentUser || (cachedSessionRef.current as unknown as User) || null
  );
  const explicitlySignedOutRef = useRef<boolean>(false);

  const [isAuthReady, setIsAuthReady] = useState(() => Boolean(auth.currentUser || cachedSessionRef.current));
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [sheetsConfig, setSheetsConfig] = useState<GoogleSheetsConfig | null>(() => loadGoogleSheetsConfig());
  const sheetsConfigRef = useRef(sheetsConfig);
  sheetsConfigRef.current = sheetsConfig;

  // Modals state
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [quickCompleteBook, setQuickCompleteBook] = useState<Book | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isWindowsModalOpen, setIsWindowsModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // 1. Initialize local cache on mount immediately
  useEffect(() => {
    async function loadData() {
      try {
        const activeUid = auth.currentUser?.uid || cachedSessionRef.current?.uid;
        if (activeUid) {
          storageService.setUserId(activeUid);
          const cached = await storageService.getBooks();
          if (cached && cached.length > 0) {
            setBooks(cached);
          }
        }
        const storedGenres = await storageService.getGenres();
        if (storedGenres && storedGenres.length > 0) {
          setGenres(storedGenres);
        }
      } catch (err) {
        console.error('Error loading initial data from storage:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Safety timeout: ensure auth check never hangs indefinitely on offline/slow mobile networks
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAuthReady(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Safety watchdog: ensure isSyncing never gets stuck spinning indefinitely
  useEffect(() => {
    if (!isSyncing) return;
    const timer = setTimeout(() => {
      setIsSyncing(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, [isSyncing]);

  // 2. Real-time two-way cloud sync with Firebase
  useEffect(() => {
    let unsubBooks: (() => void) | null = null;
    let unsubGenres: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setIsAuthReady(true);

      if (user) {
        explicitlySignedOutRef.current = false;
        setCurrentUser(user);
        saveUserSession(user);
        cachedSessionRef.current = {
          uid: user.uid,
          displayName: user.displayName || null,
          email: user.email || null,
          photoURL: user.photoURL || null,
        };

        // Scope local cache to this user
        storageService.setUserId(user.uid);

        // Fast initial paint from this user's private local cache
        try {
          const userCached = await storageService.getBooks();
          if (userCached && userCached.length > 0) {
            setBooks(userCached);
          }
        } catch {}

        setIsSyncing(true);

        // A. Bidirectional real-time listener for user's private books
        unsubBooks = subscribeToCloudBooks(
          user.uid, 
          async (cloudBooks) => {
            setIsSyncing(false);
            setLastSyncedAt(new Date());

            if (cloudBooks && cloudBooks.length > 0) {
              // Cloud has books: Cloud is the definitive source of truth across all devices
              setBooks(cloudBooks);
              await storageService.setAllBooks(cloudBooks);
              storageService.setSeeded(true);

              // Keep selectedBook detail modal live and updated
              setSelectedBook((prev) => {
                if (!prev) return null;
                return cloudBooks.find((b) => b.id === prev.id) || null;
              });
            } else {
              // Cloud has 0 books: check if user already has local books to prevent accidental wipe!
              const localBooks = await storageService.getBooks();
              if (localBooks && localBooks.length > 0) {
                // Preserve local books and automatically backup to Cloud!
                try {
                  await uploadLocalBooksBatch(user.uid, localBooks);
                } catch (e) {
                  console.warn('Auto backup local books to cloud error:', e);
                }
              } else {
                setBooks([]);
                await storageService.setAllBooks([]);
                storageService.setSeeded(true);
              }
            }
          },
          (error) => {
            console.warn('Cloud books subscription notification:', error);
            setIsSyncing(false);
          }
        );

        // B. Bidirectional real-time listener for custom genres
        unsubGenres = subscribeToCloudGenres(user.uid, async (cloudGenres) => {
          if (cloudGenres && cloudGenres.length > 0) {
            setGenres(cloudGenres);
            await storageService.saveGenres(cloudGenres);
          }
        });

      } else {
        // Firebase reported null user: only clear if explicitly signed out or no saved session exists
        if (explicitlySignedOutRef.current || !getSavedUserSession()) {
          if (unsubBooks) {
            unsubBooks();
            unsubBooks = null;
          }
          if (unsubGenres) {
            unsubGenres();
            unsubGenres = null;
          }
          saveUserSession(null);
          cachedSessionRef.current = null;
          storageService.setUserId(null);
          setBooks([]);
          setSelectedBook(null);
          setCurrentUser(null);
          setIsSyncing(false);
          setLastSyncedAt(null);
        } else {
          // Tab backgrounded or network reconnecting on mobile: preserve session
          console.log('Firebase reported null user, but cached session exists. Keeping session active.');
        }
      }
    });

    return () => {
      unsubAuth();
      if (unsubBooks) unsubBooks();
      if (unsubGenres) unsubGenres();
    };
  }, []);

  // Automatic background update to Google Sheets when enabled and token available
  const syncToGoogleSheetsIfEnabled = async (updatedBooks: Book[]) => {
    try {
      const cfg = sheetsConfigRef.current;
      if (!cfg || !cfg.autoSync || !cfg.spreadsheetId) return;
      const token = await getAccessToken();
      if (!token) return;
      await writeBooksToSpreadsheet(token, cfg.spreadsheetId, updatedBooks);
      const updated: GoogleSheetsConfig = {
        ...cfg,
        lastSyncedAt: new Date().toISOString(),
        lastSyncCount: updatedBooks.length,
      };
      saveGoogleSheetsConfig(updated);
      setSheetsConfig(updated);
    } catch (err) {
      console.warn('Auto-sync to Google Sheets failed or skipped:', err);
    }
  };

  // Guard helper to prevent unauthenticated/unsynchronized data modifications
  const ensureAuthenticated = (): boolean => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return false;
    }
    return true;
  };

  const handleOpenAddModal = () => {
    if (!ensureAuthenticated()) return;
    setEditingBook(null);
    setIsAddModalOpen(true);
  };

  const handleAddRecommendedBook = async (rec: Partial<Book>) => {
    if (!ensureAuthenticated()) return;
    const newBook: Book = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: currentUser?.uid,
      title: rec.title || 'Новая книга',
      authors: rec.authors && rec.authors.length > 0 ? rec.authors : ['Неизвестный автор'],
      status: rec.status || 'planned',
      genres: rec.genres && rec.genres.length > 0 ? rec.genres : ['Художественная литература'],
      pages: rec.pages || 350,
      coverColor: rec.coverColor,
      notes: rec.notes || '',
      startDate: rec.status === 'reading' ? new Date().toISOString().split('T')[0] : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await handleSaveBook(newBook);
  };

  // Save book (create or edit) -> writes to local storage AND to Firestore in real time
  const handleSaveBook = async (book: Book) => {
    if (!ensureAuthenticated()) return;
    try {
      // 1. Optimistic local update
      await storageService.saveBook(book);

      let updatedList: Book[] = [];
      setBooks((prev) => {
        const idx = prev.findIndex((b) => b.id === book.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = book;
          updatedList = next;
          return next;
        }
        updatedList = [book, ...prev];
        return updatedList;
      });

      // 2. Propagate to Cloud -> updates all other connected devices (Phone/PC)
      if (currentUser) {
        setIsSyncing(true);
        await saveBookToCloud(currentUser.uid, book);
        setIsSyncing(false);
        setLastSyncedAt(new Date());
      }

      // 3. Register any new genres discovered
      const newGenresFound = book.genres.filter((g) => !genres.includes(g));
      if (newGenresFound.length > 0) {
        const updatedGenres = [...genres, ...newGenresFound];
        setGenres(updatedGenres);
        await storageService.saveGenres(updatedGenres);
        if (currentUser) {
          for (const ng of newGenresFound) {
            await saveGenreToCloud(currentUser.uid, ng);
          }
        }
      }

      // 4. Auto-sync to Google Sheets if configured
      if (updatedList.length > 0) {
        syncToGoogleSheetsIfEnabled(updatedList);
      }
    } catch (err) {
      console.error('Failed to save book:', err);
      setIsSyncing(false);
    }
  };

  // Delete book -> removes from local storage AND from Firestore
  const handleDeleteBook = async (id: string) => {
    if (!ensureAuthenticated()) return;
    try {
      await storageService.deleteBook(id);
      const nextList = books.filter((b) => b.id !== id);
      setBooks(nextList);
      if (selectedBook?.id === id) {
        setSelectedBook(null);
      }

      if (currentUser) {
        setIsSyncing(true);
        await deleteBookFromCloud(currentUser.uid, id);
        setIsSyncing(false);
        setLastSyncedAt(new Date());
      }

      // Auto-sync to Google Sheets
      syncToGoogleSheetsIfEnabled(nextList);
    } catch (err) {
      console.error('Failed to delete book:', err);
      setIsSyncing(false);
    }
  };

  // Quick complete book
  const handleQuickComplete = async (updatedBook: Book) => {
    if (!ensureAuthenticated()) return;
    await handleSaveBook(updatedBook);
    setQuickCompleteBook(null);
    if (selectedBook?.id === updatedBook.id) {
      setSelectedBook(updatedBook);
    }
  };

  // Revert completed book back to reading
  const handleRevertToReading = async (book: Book) => {
    if (!ensureAuthenticated()) return;
    const reverted: Book = {
      ...book,
      status: 'reading',
      endDate: undefined,
      rating: undefined,
      updatedAt: new Date().toISOString(),
    };
    await handleSaveBook(reverted);
  };

  // Merge duplicate author names
  const handleMergeAuthors = async (sourceName: string, targetName: string) => {
    if (!ensureAuthenticated()) return;
    setIsSyncing(true);
    try {
      const updated = books.map((b) => {
        if (b.authors.includes(sourceName)) {
          const newAuthors = b.authors.map((a) => (a === sourceName ? targetName : a));
          const unique = Array.from(new Set(newAuthors));
          return {
            ...b,
            authors: unique,
            updatedAt: new Date().toISOString(),
          };
        }
        return b;
      });

      setBooks(updated);
      await storageService.setAllBooks(updated);

      if (currentUser) {
        await syncAllBooksToCloud(currentUser.uid, updated);
        setLastSyncedAt(new Date());
      }
    } catch (err) {
      console.error('Failed to merge authors:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Genre management
  const handleAddGenre = async (newGenre: string) => {
    if (!ensureAuthenticated()) return;
    const trimmed = newGenre.trim();
    if (!trimmed) return;
    if (!genres.includes(trimmed)) {
      const next = [...genres, trimmed];
      setGenres(next);
      await storageService.saveGenres(next);
      if (currentUser) {
        try {
          await saveGenreToCloud(currentUser.uid, trimmed);
        } catch (err) {
          console.warn('Failed to save genre to cloud:', err);
        }
      }
    }
  };

  const handleEditGenre = async (oldName: string, newName: string) => {
    if (!ensureAuthenticated()) return;
    setIsSyncing(true);
    try {
      const nextGenres = genres.map((g) => (g === oldName ? newName : g));
      setGenres(nextGenres);
      await storageService.saveGenres(nextGenres);

      const updatedBooks = books.map((b) => {
        if (b.genres.includes(oldName)) {
          return {
            ...b,
            genres: b.genres.map((g) => (g === oldName ? newName : g)),
            updatedAt: new Date().toISOString(),
          };
        }
        return b;
      });
      setBooks(updatedBooks);
      await storageService.setAllBooks(updatedBooks);

      if (currentUser) {
        await deleteGenreFromCloud(currentUser.uid, oldName);
        await saveGenreToCloud(currentUser.uid, newName);
        await syncAllBooksToCloud(currentUser.uid, updatedBooks);
        setLastSyncedAt(new Date());
      }
    } catch (err) {
      console.error('Failed to edit genre:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteGenre = async (genreName: string) => {
    if (!ensureAuthenticated()) return;
    setIsSyncing(true);
    try {
      const nextGenres = genres.filter((g) => g !== genreName);
      setGenres(nextGenres);
      await storageService.saveGenres(nextGenres);

      const updatedBooks = books.map((b) => {
        if (b.genres.includes(genreName)) {
          return {
            ...b,
            genres: b.genres.filter((g) => g !== genreName),
            updatedAt: new Date().toISOString(),
          };
        }
        return b;
      });
      setBooks(updatedBooks);
      await storageService.setAllBooks(updatedBooks);

      if (currentUser) {
        await deleteGenreFromCloud(currentUser.uid, genreName);
        await syncAllBooksToCloud(currentUser.uid, updatedBooks);
        setLastSyncedAt(new Date());
      }
    } catch (err) {
      console.error('Failed to delete genre:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Settings & Data actions
  const handleImportBooks = async (importedBooks: Book[], mode: 'merge' | 'replace') => {
    if (!ensureAuthenticated()) return;
    setIsSyncing(true);
    try {
      let finalBooks: Book[] = [];
      if (mode === 'replace') {
        finalBooks = importedBooks;
      } else {
        const keyMap = new Map<string, Book>();
        books.forEach((b) => {
          const k = `${(b.title || '').toLowerCase().trim()}::${((b.authors && b.authors[0]) || '').toLowerCase().trim()}`;
          keyMap.set(k, b);
        });
        importedBooks.forEach((b) => {
          const k = `${(b.title || '').toLowerCase().trim()}::${((b.authors && b.authors[0]) || '').toLowerCase().trim()}`;
          keyMap.set(k, b);
        });
        finalBooks = Array.from(keyMap.values());
      }

      // Collect new genres from imported books
      const allImportedGenres = new Set<string>();
      finalBooks.forEach((b) => {
        if (Array.isArray(b.genres)) {
          b.genres.forEach((g) => {
            if (g && g.trim()) allImportedGenres.add(g.trim());
          });
        }
      });
      const newGenresFound = Array.from(allImportedGenres).filter((g) => !genres.includes(g));
      if (newGenresFound.length > 0) {
        const mergedGenres = [...genres, ...newGenresFound];
        setGenres(mergedGenres);
        await storageService.saveGenres(mergedGenres);
        if (currentUser) {
          for (const ng of newGenresFound) {
            try {
              await saveGenreToCloud(currentUser.uid, ng);
            } catch (err) {
              console.warn('Could not save genre during import:', err);
            }
          }
        }
      }

      setBooks(finalBooks);
      await storageService.setAllBooks(finalBooks);
      storageService.setSeeded(true);

      if (currentUser) {
        await syncAllBooksToCloud(currentUser.uid, finalBooks);
        setLastSyncedAt(new Date());
      }
      syncToGoogleSheetsIfEnabled(finalBooks);
    } catch (err) {
      console.error('Failed to import books:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResetToDemo = async () => {
    if (!ensureAuthenticated()) return;
    setIsSyncing(true);
    try {
      setBooks(INITIAL_DEMO_BOOKS);
      await storageService.setAllBooks(INITIAL_DEMO_BOOKS);
      storageService.setSeeded(true);
      if (currentUser) {
        await syncAllBooksToCloud(currentUser.uid, INITIAL_DEMO_BOOKS);
        setLastSyncedAt(new Date());
      }
      syncToGoogleSheetsIfEnabled(INITIAL_DEMO_BOOKS);
    } catch (err) {
      console.error('Failed to reset to demo:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearLibrary = async () => {
    if (!ensureAuthenticated()) return;
    setIsSyncing(true);
    try {
      setBooks([]);
      await storageService.setAllBooks([]);
      storageService.setSeeded(true);
      if (currentUser) {
        await syncAllBooksToCloud(currentUser.uid, []);
        setLastSyncedAt(new Date());
      }
    } catch (err) {
      console.error('Failed to clear library:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExplicitSignOut = () => {
    explicitlySignedOutRef.current = true;
    saveUserSession(null);
    cachedSessionRef.current = null;
    storageService.setUserId(null);
    setBooks([]);
    setSelectedBook(null);
    setCurrentUser(null);
    setIsSyncing(false);
    setLastSyncedAt(null);
  };

  // Absolute privacy boundary: unauthenticated readers cannot see another user's books
  const visibleBooks = currentUser ? books : [];

  if (isLoading || !isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5] text-[#24211D]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#24211D] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-display font-medium text-sm text-[#7A7265]">
            Открываем книжную полку...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#24211D] flex flex-col pb-16 md:pb-0">
      {/* Top 3-Zone Header with live sync indicator */}
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenAddModal={handleOpenAddModal}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onOpenWindowsModal={() => setIsWindowsModalOpen(true)}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        isSyncing={isSyncing}
        lastSyncedAt={lastSyncedAt}
        hasConnectedSheets={Boolean(sheetsConfig?.spreadsheetId)}
      />

      {/* Main App Viewport */}
      <main className="flex-1">
        {currentTab === 'dashboard' && (
          <Dashboard
            books={visibleBooks}
            onOpenAddModal={handleOpenAddModal}
            onSelectBook={(book) => setSelectedBook(book)}
            onGoToShelf={() => setCurrentTab('shelf')}
            onQuickComplete={(book) => setQuickCompleteBook(book)}
            onLoadDemo={handleResetToDemo}
            currentUser={currentUser}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            isAuthReady={isAuthReady}
          />
        )}

        {currentTab === 'shelf' && (
          <LibraryView
            books={visibleBooks}
            onSelectBook={(book) => setSelectedBook(book)}
            onOpenAddModal={handleOpenAddModal}
            genresList={genres}
            currentUser={currentUser}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
          />
        )}

        {currentTab === 'recommendations' && (
          <RecommendationsView
            books={visibleBooks}
            currentUser={currentUser}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            onAddBookToLibrary={handleAddRecommendedBook}
            onSelectBook={(book) => setSelectedBook(book)}
            genresList={genres}
          />
        )}

        {currentTab === 'statistics' && (
          !currentUser ? (
            <StatisticsAuthGate
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
              onGoToShelf={() => setCurrentTab('shelf')}
            />
          ) : (
            <StatisticsView
              books={visibleBooks}
              onSelectBook={(book) => setSelectedBook(book)}
              onMergeAuthors={handleMergeAuthors}
            />
          )
        )}

        {currentTab === 'calendar' && (
          !currentUser ? (
            <div className="max-w-4xl mx-auto px-4 py-16 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#EFE9DF] flex items-center justify-center text-[#8A5A36] shadow-inner">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-display font-semibold text-[#24211D]">
                Календарь чтения
              </h3>
              <p className="mt-2 text-xs text-[#6B6357] max-w-sm mx-auto leading-relaxed">
                Каждый читатель видит только свои записи. Войдите через Google, чтобы открыть персональный календарь завершения книг.
              </p>
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-[#24211D] hover:bg-[#3B342C] text-white rounded-md font-medium text-xs transition-colors shadow-xs"
              >
                <Cloud className="w-4 h-4 text-[#EFE9DF]" />
                <span>Войти через Google</span>
              </button>
            </div>
          ) : (
            <CalendarView
              books={visibleBooks}
              onSelectBook={(book) => setSelectedBook(book)}
            />
          )
        )}

        {currentTab === 'genres' && (
          !currentUser ? (
            <div className="max-w-4xl mx-auto px-4 py-16 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#EFE9DF] flex items-center justify-center text-[#8A5A36] shadow-inner">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-display font-semibold text-[#24211D]">
                Управление жанрами
              </h3>
              <p className="mt-2 text-xs text-[#6B6357] max-w-sm mx-auto leading-relaxed">
                Войдите через Google, чтобы управлять персональным списком жанров и синхронизировать его с облаком.
              </p>
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-[#24211D] hover:bg-[#3B342C] text-white rounded-md font-medium text-xs transition-colors shadow-xs"
              >
                <Cloud className="w-4 h-4 text-[#EFE9DF]" />
                <span>Войти через Google</span>
              </button>
            </div>
          ) : (
            <GenresView
              genres={genres}
              books={visibleBooks}
              onAddGenre={handleAddGenre}
              onEditGenre={handleEditGenre}
              onDeleteGenre={handleDeleteGenre}
              onSelectGenre={(_genre) => {
                setCurrentTab('shelf');
              }}
              currentUser={currentUser}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
            />
          )
        )}
      </main>

      {/* Mobile Bottom Thumb Navigation */}
      <MobileNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
      />

      {/* Book Details Modal */}
      <BookDetailModal
        book={selectedBook}
        onClose={() => setSelectedBook(null)}
        onEdit={(book) => {
          setEditingBook(book);
          setIsAddModalOpen(true);
        }}
        onDelete={handleDeleteBook}
        onQuickComplete={(book) => setQuickCompleteBook(book)}
        onRevertToReading={handleRevertToReading}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Add / Edit Book Modal */}
      <BookFormModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingBook(null);
        }}
        onSave={handleSaveBook}
        initialBook={editingBook}
        genresList={genres}
      />

      {/* Quick Finish Modal */}
      <QuickCompleteModal
        book={quickCompleteBook}
        onClose={() => setQuickCompleteBook(null)}
        onComplete={handleQuickComplete}
      />

      {/* Export / Import & Data Management Modal */}
      <ExportImportModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        books={visibleBooks}
        genres={genres}
        onImportBooks={handleImportBooks}
        onResetToDemo={handleResetToDemo}
        onClearLibrary={handleClearLibrary}
        onSheetsConfigChange={(cfg) => setSheetsConfig(cfg)}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Windows Program Installation Modal */}
      <WindowsInstallModal
        isOpen={isWindowsModalOpen}
        onClose={() => setIsWindowsModalOpen(false)}
      />

      {/* Cloud Sync & Google Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        books={visibleBooks}
        onSignOut={handleExplicitSignOut}
      />
    </div>
  );
}
