import { Book } from '../types/book';

const DB_NAME = 'my_book_shelf_db';
const DB_VERSION = 2;
const BOOKS_STORE = 'books';
const GENRES_STORE = 'genres';

export const DEFAULT_GENRES: string[] = [
  'Детектив/Триллер',
  'Фантастика',
  'Фэнтези',
  'Классическая литература',
  'Современная проза',
  'Приключения',
  'Юмор',
  'Драма',
  'Философия',
  'Антиутопия',
  'Ужасы',
  'Повесть',
  'Другое'
];

class StorageService {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private isIndexedDBAvailable = true;

  private async openDB(): Promise<IDBDatabase | null> {
    if (this.db) return this.db;
    if (this.dbPromise) return this.dbPromise;

    if (typeof window === 'undefined' || !window.indexedDB) {
      this.isIndexedDBAvailable = false;
      return null;
    }

    this.dbPromise = new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(BOOKS_STORE)) {
            db.createObjectStore(BOOKS_STORE, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(GENRES_STORE)) {
            db.createObjectStore(GENRES_STORE, { keyPath: 'name' });
          }
        };

        request.onsuccess = (event) => {
          this.db = (event.target as IDBOpenDBRequest).result;
          this.db.onversionchange = () => {
            this.db?.close();
            this.db = null;
            this.dbPromise = null;
          };
          resolve(this.db);
        };

        request.onerror = () => {
          console.warn('IndexedDB failed to open, falling back to localStorage');
          this.isIndexedDBAvailable = false;
          resolve(null);
        };

        request.onblocked = () => {
          console.warn('IndexedDB blocked');
          resolve(null);
        };
      } catch (err) {
        console.warn('IndexedDB exception, falling back to localStorage', err);
        this.isIndexedDBAvailable = false;
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  private currentUserId: string | null = null;

  setUserId(userId: string | null): void {
    this.currentUserId = userId ? String(userId).trim() : null;
  }

  getUserId(): string | null {
    return this.currentUserId;
  }

  // --- Seeding Check ---
  isSeeded(): boolean {
    if (!this.currentUserId) return false;
    try {
      return localStorage.getItem(`my_book_shelf_seeded_${this.currentUserId}`) === 'true';
    } catch {
      return false;
    }
  }

  setSeeded(value = true): void {
    if (!this.currentUserId) return;
    try {
      localStorage.setItem(`my_book_shelf_seeded_${this.currentUserId}`, value ? 'true' : 'false');
    } catch {}
  }

  private getStorageKey(): string | null {
    if (!this.currentUserId) return null;
    return `my_book_shelf_books_${this.currentUserId}`;
  }

  // --- Books ---
  async getBooks(): Promise<Book[]> {
    // Strict isolation: Unauthenticated users have no local library
    if (!this.currentUserId) {
      return [];
    }

    const fallback = this.getBooksFallback();
    const db = await this.openDB();

    if (db && this.isIndexedDBAvailable) {
      try {
        const idbBooks = await new Promise<Book[]>((resolve) => {
          try {
            const tx = db.transaction(BOOKS_STORE, 'readonly');
            const store = tx.objectStore(BOOKS_STORE);
            const req = store.getAll();
            req.onsuccess = () => {
              const all = (req.result || []) as Book[];
              // Filter strictly to current user's documents
              const userOnly = all.filter((b) => b.userId === this.currentUserId);
              resolve(userOnly);
            };
            req.onerror = () => resolve([]);
          } catch {
            resolve([]);
          }
        });

        if (idbBooks && idbBooks.length > 0) {
          this.saveBooksToLocalStorage(idbBooks);
          return idbBooks;
        }
      } catch (err) {
        console.warn('Error reading from IndexedDB:', err);
      }
    }

    return fallback;
  }

  private getBooksFallback(): Book[] {
    const key = this.getStorageKey();
    if (!key) return [];
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveBooksToLocalStorage(books: Book[]): void {
    const key = this.getStorageKey();
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(books));
    } catch (e) {
      // If localStorage quota exceeded due to large base64 covers, store slim version
      try {
        const slim = books.map((b) => {
          if (b.coverUrl && b.coverUrl.startsWith('data:')) {
            return { ...b, coverUrl: undefined };
          }
          return b;
        });
        localStorage.setItem(key, JSON.stringify(slim));
      } catch (err) {
        console.warn('Failed to save to localStorage:', err);
      }
    }
  }

  async saveBook(book: Book): Promise<void> {
    const bookToSave = this.currentUserId ? { ...book, userId: this.currentUserId } : book;
    // 1. Immediately update fallback storage
    const all = this.getBooksFallback();
    const idx = all.findIndex((b) => b.id === bookToSave.id);
    if (idx >= 0) {
      all[idx] = bookToSave;
    } else {
      all.unshift(bookToSave);
    }
    this.saveBooksToLocalStorage(all);
    this.setSeeded(true);

    // 2. Persist to IndexedDB and wait for transaction commit
    const db = await this.openDB();
    if (db && this.isIndexedDBAvailable) {
      await new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction(BOOKS_STORE, 'readwrite');
          const store = tx.objectStore(BOOKS_STORE);
          store.put(bookToSave);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        } catch (err) {
          console.warn('IndexedDB write error, saved in localStorage fallback:', err);
          resolve();
        }
      });
    }
  }

  async deleteBook(id: string): Promise<void> {
    const all = this.getBooksFallback().filter((b) => b.id !== id);
    this.saveBooksToLocalStorage(all);

    const db = await this.openDB();
    if (db && this.isIndexedDBAvailable) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(BOOKS_STORE, 'readwrite');
          const store = tx.objectStore(BOOKS_STORE);
          store.delete(id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  }

  async setAllBooks(books: Book[]): Promise<void> {
    this.saveBooksToLocalStorage(books);
    this.setSeeded(true);

    const db = await this.openDB();
    if (db && this.isIndexedDBAvailable && this.currentUserId) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(BOOKS_STORE, 'readwrite');
          const store = tx.objectStore(BOOKS_STORE);
          const req = store.getAll();
          req.onsuccess = () => {
            const all = (req.result || []) as Book[];
            // Remove previous books for current user only
            for (const item of all) {
              if (item.userId === this.currentUserId || !item.userId) {
                store.delete(item.id);
              }
            }
            // Put updated books
            for (const b of books) {
              store.put({ ...b, userId: this.currentUserId });
            }
          };
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  }

  // --- Genres ---
  async getGenres(): Promise<string[]> {
    const fallback = this.getGenresFallback();
    const db = await this.openDB();
    if (db && this.isIndexedDBAvailable) {
      try {
        const idbGenres = await new Promise<string[]>((resolve) => {
          try {
            const tx = db.transaction(GENRES_STORE, 'readonly');
            const store = tx.objectStore(GENRES_STORE);
            const req = store.getAll();
            req.onsuccess = () => {
              const list = req.result ? req.result.map((item: { name: string }) => item.name) : [];
              resolve(list);
            };
            req.onerror = () => resolve([]);
          } catch {
            resolve([]);
          }
        });

        if (idbGenres && idbGenres.length > 0) {
          return idbGenres;
        }
      } catch {}
    }
    return fallback;
  }

  private getGenresFallback(): string[] {
    try {
      const data = localStorage.getItem('my_book_shelf_genres');
      if (data) return JSON.parse(data);
    } catch {}
    return DEFAULT_GENRES;
  }

  async saveGenres(genres: string[]): Promise<void> {
    try {
      localStorage.setItem('my_book_shelf_genres', JSON.stringify(genres));
    } catch {}

    const db = await this.openDB();
    if (db && this.isIndexedDBAvailable) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(GENRES_STORE, 'readwrite');
          const store = tx.objectStore(GENRES_STORE);
          store.clear();
          for (const name of genres) {
            store.put({ name });
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  }

  // --- Cloud Sync Key Management ---
  getSyncKey(): string {
    try {
      return localStorage.getItem('my_book_shelf_sync_key') || '';
    } catch {
      return '';
    }
  }

  setSyncKey(key: string): void {
    try {
      localStorage.setItem('my_book_shelf_sync_key', key.trim());
    } catch {}
  }

  isAutoSyncEnabled(): boolean {
    try {
      return localStorage.getItem('my_book_shelf_auto_sync') === 'true';
    } catch {
      return false;
    }
  }

  setAutoSyncEnabled(enabled: boolean): void {
    try {
      localStorage.setItem('my_book_shelf_auto_sync', enabled ? 'true' : 'false');
    } catch {}
  }
}

export const storageService = new StorageService();

// Clean up legacy non-user-scoped storage key to ensure complete per-user isolation
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('my_book_shelf_books');
  } catch {}
}
