import { Book } from '../types/book';

const DB_NAME = 'my_book_shelf_db';
const DB_VERSION = 1;
const BOOKS_STORE = 'books';
const GENRES_STORE = 'genres';
const METADATA_STORE = 'metadata';

export const DEFAULT_GENRES: string[] = [
  'Детектив',
  'Триллер',
  'Фантастика',
  'Фэнтези',
  'Классическая литература',
  'Современная проза',
  'Исторический роман',
  'Научная фантастика',
  'Приключения',
  'Юмор',
  'Драма',
  'Нон-фикшн',
  'Биография',
  'Философия',
  'Антиутопия',
  'Повесть',
  'Рассказ и новелла',
  'Другое'
];

class StorageService {
  private db: IDBDatabase | null = null;
  private isIndexedDBAvailable = true;

  private async openDB(): Promise<IDBDatabase | null> {
    if (this.db) return this.db;
    if (typeof window === 'undefined' || !window.indexedDB) {
      this.isIndexedDBAvailable = false;
      return null;
    }

    return new Promise((resolve) => {
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
          if (!db.objectStoreNames.contains(METADATA_STORE)) {
            db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
          }
        };

        request.onsuccess = (event) => {
          this.db = (event.target as IDBOpenDBRequest).result;
          resolve(this.db);
        };

        request.onerror = () => {
          console.warn('IndexedDB failed to open, falling back to localStorage');
          this.isIndexedDBAvailable = false;
          resolve(null);
        };
      } catch (err) {
        console.warn('IndexedDB exception, falling back to localStorage', err);
        this.isIndexedDBAvailable = false;
        resolve(null);
      }
    });
  }

  // --- Books ---
  async getBooks(): Promise<Book[]> {
    const db = await this.openDB();
    if (db && this.isIndexedDBAvailable) {
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(BOOKS_STORE, 'readonly');
          const store = tx.objectStore(BOOKS_STORE);
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => {
            resolve(this.getBooksFallback());
          };
        } catch {
          resolve(this.getBooksFallback());
        }
      });
    }
    return this.getBooksFallback();
  }

  private getBooksFallback(): Book[] {
    try {
      const data = localStorage.getItem('my_book_shelf_books');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  async saveBook(book: Book): Promise<void> {
    const db = await this.openDB();
    if (db && this.isIndexedDBAvailable) {
      await new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction(BOOKS_STORE, 'readwrite');
          const store = tx.objectStore(BOOKS_STORE);
          const req = store.put(book);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        } catch (err) {
          reject(err);
        }
      });
    }
    // Also sync localStorage for durability
    const all = this.getBooksFallback();
    const idx = all.findIndex((b) => b.id === book.id);
    if (idx >= 0) {
      all[idx] = book;
    } else {
      all.push(book);
    }
    try {
      localStorage.setItem('my_book_shelf_books', JSON.stringify(all));
    } catch (e) {
      console.warn('LocalStorage quota or write warning', e);
    }
  }

  async deleteBook(id: string): Promise<void> {
    const db = await this.openDB();
    if (db && this.isIndexedDBAvailable) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(BOOKS_STORE, 'readwrite');
          const store = tx.objectStore(BOOKS_STORE);
          const req = store.delete(id);
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
    const all = this.getBooksFallback().filter((b) => b.id !== id);
    try {
      localStorage.setItem('my_book_shelf_books', JSON.stringify(all));
    } catch (e) {
      console.warn('LocalStorage error', e);
    }
  }

  async setAllBooks(books: Book[]): Promise<void> {
    const db = await this.openDB();
    if (db && this.isIndexedDBAvailable) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(BOOKS_STORE, 'readwrite');
          const store = tx.objectStore(BOOKS_STORE);
          store.clear();
          for (const b of books) {
            store.put(b);
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
    try {
      localStorage.setItem('my_book_shelf_books', JSON.stringify(books));
    } catch (e) {
      console.warn('LocalStorage error', e);
    }
  }

  // --- Genres ---
  async getGenres(): Promise<string[]> {
    const db = await this.openDB();
    if (db && this.isIndexedDBAvailable) {
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(GENRES_STORE, 'readonly');
          const store = tx.objectStore(GENRES_STORE);
          const req = store.getAll();
          req.onsuccess = () => {
            const list = req.result ? req.result.map((item: { name: string }) => item.name) : [];
            if (!list || list.length === 0) {
              resolve(this.getGenresFallback());
            } else {
              resolve(list);
            }
          };
          req.onerror = () => resolve(this.getGenresFallback());
        } catch {
          resolve(this.getGenresFallback());
        }
      });
    }
    return this.getGenresFallback();
  }

  private getGenresFallback(): string[] {
    try {
      const data = localStorage.getItem('my_book_shelf_genres');
      if (data) return JSON.parse(data);
    } catch {}
    return DEFAULT_GENRES;
  }

  async saveGenres(genres: string[]): Promise<void> {
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
    try {
      localStorage.setItem('my_book_shelf_genres', JSON.stringify(genres));
    } catch (e) {
      console.warn('LocalStorage error', e);
    }
  }
}

export const storageService = new StorageService();
