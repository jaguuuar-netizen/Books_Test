import React, { useState, useEffect } from 'react';
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
import { BookDetailModal } from './components/book/BookDetailModal';
import { BookFormModal } from './components/book/BookFormModal';
import { QuickCompleteModal } from './components/book/QuickCompleteModal';
import { ExportImportModal } from './components/settings/ExportImportModal';
import { WindowsInstallModal } from './components/settings/WindowsInstallModal';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [books, setBooks] = useState<Book[]>([]);
  const [genres, setGenres] = useState<string[]>(DEFAULT_GENRES);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [quickCompleteBook, setQuickCompleteBook] = useState<Book | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isWindowsModalOpen, setIsWindowsModalOpen] = useState(false);

  // Initialize data on mount
  useEffect(() => {
    async function loadData() {
      try {
        const storedBooks = await storageService.getBooks();
        const storedGenres = await storageService.getGenres();

        if (storedBooks.length > 0) {
          setBooks(storedBooks);
        } else {
          // First time launch: pre-load our high quality demo library with generated covers
          await storageService.setAllBooks(INITIAL_DEMO_BOOKS);
          setBooks(INITIAL_DEMO_BOOKS);
        }

        if (storedGenres && storedGenres.length > 0) {
          setGenres(storedGenres);
        }
      } catch (err) {
        console.error('Error loading initial data from storage:', err);
        setBooks(INITIAL_DEMO_BOOKS);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Save book (create or update)
  const handleSaveBook = async (book: Book) => {
    try {
      await storageService.saveBook(book);
      setBooks((prev) => {
        const idx = prev.findIndex((b) => b.id === book.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = book;
          return next;
        }
        return [book, ...prev];
      });

      // If user added new genres, register them in genres list
      const newGenresFound = book.genres.filter((g) => !genres.includes(g));
      if (newGenresFound.length > 0) {
        const updatedGenres = [...genres, ...newGenresFound];
        setGenres(updatedGenres);
        await storageService.saveGenres(updatedGenres);
      }
    } catch (err) {
      console.error('Failed to save book:', err);
    }
  };

  // Delete book
  const handleDeleteBook = async (id: string) => {
    try {
      await storageService.deleteBook(id);
      setBooks((prev) => prev.filter((b) => b.id !== id));
      if (selectedBook?.id === id) {
        setSelectedBook(null);
      }
    } catch (err) {
      console.error('Failed to delete book:', err);
    }
  };

  // Quick complete
  const handleQuickComplete = async (updatedBook: Book) => {
    await handleSaveBook(updatedBook);
    setQuickCompleteBook(null);
    if (selectedBook?.id === updatedBook.id) {
      setSelectedBook(updatedBook);
    }
  };

  // Revert completed book back to reading
  const handleRevertToReading = async (book: Book) => {
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
    const updated = books.map((b) => {
      if (b.authors.includes(sourceName)) {
        const newAuthors = b.authors.map((a) => (a === sourceName ? targetName : a));
        // Deduplicate in case target already existed
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
  };

  // Genre management
  const handleAddGenre = async (newGenre: string) => {
    if (!genres.includes(newGenre)) {
      const next = [...genres, newGenre];
      setGenres(next);
      await storageService.saveGenres(next);
    }
  };

  const handleEditGenre = async (oldName: string, newName: string) => {
    const nextGenres = genres.map((g) => (g === oldName ? newName : g));
    setGenres(nextGenres);
    await storageService.saveGenres(nextGenres);

    // Also update existing books using oldName
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
  };

  const handleDeleteGenre = async (genreName: string) => {
    const nextGenres = genres.filter((g) => g !== genreName);
    setGenres(nextGenres);
    await storageService.saveGenres(nextGenres);

    // Also clean up books containing this genre
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
  };

  // Settings & Data actions
  const handleImportBooks = async (importedBooks: Book[], mode: 'merge' | 'replace') => {
    let finalBooks: Book[] = [];
    if (mode === 'replace') {
      finalBooks = importedBooks;
    } else {
      // Merge by title & author key
      const keyMap = new Map<string, Book>();
      books.forEach((b) => {
        const k = `${b.title.toLowerCase().trim()}::${(b.authors[0] || '').toLowerCase().trim()}`;
        keyMap.set(k, b);
      });
      importedBooks.forEach((b) => {
        const k = `${b.title.toLowerCase().trim()}::${(b.authors[0] || '').toLowerCase().trim()}`;
        keyMap.set(k, b);
      });
      finalBooks = Array.from(keyMap.values());
    }

    setBooks(finalBooks);
    await storageService.setAllBooks(finalBooks);
  };

  const handleResetToDemo = async () => {
    setBooks(INITIAL_DEMO_BOOKS);
    await storageService.setAllBooks(INITIAL_DEMO_BOOKS);
  };

  const handleClearLibrary = async () => {
    setBooks([]);
    await storageService.setAllBooks([]);
  };

  if (isLoading) {
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
      {/* Top 3-Zone Header */}
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenAddModal={() => {
          setEditingBook(null);
          setIsAddModalOpen(true);
        }}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onOpenWindowsModal={() => setIsWindowsModalOpen(true)}
      />

      {/* Main App Viewport */}
      <main className="flex-1">
        {currentTab === 'dashboard' && (
          <Dashboard
            books={books}
            onOpenAddModal={() => {
              setEditingBook(null);
              setIsAddModalOpen(true);
            }}
            onSelectBook={(book) => setSelectedBook(book)}
            onGoToShelf={() => setCurrentTab('shelf')}
            onQuickComplete={(book) => setQuickCompleteBook(book)}
            onLoadDemo={handleResetToDemo}
          />
        )}

        {currentTab === 'shelf' && (
          <LibraryView
            books={books}
            onSelectBook={(book) => setSelectedBook(book)}
            onOpenAddModal={() => {
              setEditingBook(null);
              setIsAddModalOpen(true);
            }}
            genresList={genres}
          />
        )}

        {currentTab === 'statistics' && (
          <StatisticsView
            books={books}
            onSelectBook={(book) => setSelectedBook(book)}
            onMergeAuthors={handleMergeAuthors}
          />
        )}

        {currentTab === 'calendar' && (
          <CalendarView
            books={books}
            onSelectBook={(book) => setSelectedBook(book)}
          />
        )}

        {currentTab === 'genres' && (
          <GenresView
            genres={genres}
            books={books}
            onAddGenre={handleAddGenre}
            onEditGenre={handleEditGenre}
            onDeleteGenre={handleDeleteGenre}
            onSelectGenre={(genre) => {
              setCurrentTab('shelf');
            }}
          />
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
        books={books}
        genres={genres}
        onImportBooks={handleImportBooks}
        onResetToDemo={handleResetToDemo}
        onClearLibrary={handleClearLibrary}
      />

      {/* Windows Program Installation Modal */}
      <WindowsInstallModal
        isOpen={isWindowsModalOpen}
        onClose={() => setIsWindowsModalOpen(false)}
      />
    </div>
  );
}
