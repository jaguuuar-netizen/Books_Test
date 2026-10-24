import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs,
  onSnapshot, 
  writeBatch 
} from 'firebase/firestore';
import { db, auth, ensureAuthReady, handleFirestoreError, OperationType } from './firebase';
import { Book } from '../types/book';
import { INITIAL_DEMO_BOOKS } from './demoData';
import { normalizeRussianDate } from '../utils/date';

/**
 * Check if the provided books array is identical to the default INITIAL_DEMO_BOOKS.
 */
export function isStockDemoBooks(books: Book[]): boolean {
  if (!books || books.length !== INITIAL_DEMO_BOOKS.length) return false;
  const demoIds = new Set(INITIAL_DEMO_BOOKS.map((b) => b.id));
  return books.every((b) => demoIds.has(b.id));
}

/**
 * Safe alphanumeric book ID for Firestore document path.
 * Retains existing IDs cleanly, replacing slashes or invalid path characters.
 */
export function toSafeBookId(id?: string): string {
  if (id && typeof id === 'string' && id.trim().length > 0) {
    const clean = id.trim().replace(/[\/\\]/g, '_').substring(0, 120);
    if (clean.length > 0) {
      return clean;
    }
  }
  const rnd = Math.random().toString(36).substring(2, 8);
  return `book_${Date.now()}_${rnd}`;
}

/**
 * Clean book data for Firestore:
 * - Ensures safe book ID
 * - Drops undefined keys
 * - Ensures required fields
 * - Drops excessively large base64 covers (>400KB) to respect Firestore document size limits
 */
export function sanitizeBookForFirestore(book: Book, userId: string): Record<string, any> {
  const safeId = toSafeBookId(book.id);
  const rawTitle = (book.title || 'Без названия').trim();
  const cleanTitle = rawTitle.length > 0 ? rawTitle.substring(0, 500) : 'Без названия';

  const validAuthors = Array.isArray(book.authors) && book.authors.length > 0
    ? book.authors.map((a) => String(a || '').trim()).filter(Boolean)
    : [];

  const clean: Record<string, any> = {
    id: safeId,
    userId,
    title: cleanTitle,
    authors: validAuthors.length > 0 ? validAuthors : ['Неизвестный автор'],
    status: book.status === 'reading' ? 'reading' : book.status === 'planned' ? 'planned' : 'completed',
    genres: Array.isArray(book.genres) && book.genres.length > 0
      ? book.genres.map((g) => String(g || '').trim()).filter(Boolean)
      : ['Другое'],
    createdAt: book.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (clean.status === 'completed' && typeof book.rating === 'number' && !isNaN(book.rating)) {
    clean.rating = Math.min(10, Math.max(1, Math.round(book.rating)));
  }

  if (book.startDate) clean.startDate = normalizeRussianDate(book.startDate) || String(book.startDate).trim();
  if (clean.status === 'completed' && book.endDate) clean.endDate = normalizeRussianDate(book.endDate) || String(book.endDate).trim();
  if (typeof book.pages === 'number' && !isNaN(book.pages) && book.pages > 0) clean.pages = Math.round(book.pages);
  if (typeof book.readingHours === 'number' && !isNaN(book.readingHours) && book.readingHours >= 0) clean.readingHours = Number(book.readingHours.toFixed(1));
  if (book.coverColor) clean.coverColor = book.coverColor;
  if (book.notes) clean.notes = String(book.notes).trim();
  if (book.series) clean.series = String(book.series).trim();
  if (typeof book.seriesNumber === 'number' && !isNaN(book.seriesNumber)) clean.seriesNumber = book.seriesNumber;
  if (book.publisher) clean.publisher = String(book.publisher).trim();
  if (typeof book.publishYear === 'number' && !isNaN(book.publishYear)) clean.publishYear = book.publishYear;
  if (book.language) clean.language = String(book.language).trim();

  // Handle coverUrl: preserve URL, but strip massive data URI (>400KB) to avoid 1MB doc ceiling
  if (book.coverUrl) {
    if (book.coverUrl.startsWith('data:') && book.coverUrl.length > 400000) {
      // Omit huge inline image to prevent Firestore document write failure
    } else {
      clean.coverUrl = book.coverUrl;
    }
  }

  return clean;
}

/**
 * Safe alphanumeric genre ID compliant with Firestore rules regex ^[a-zA-Z0-9_\-]+$
 */
export function toSafeGenreId(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  const ascii = name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 16);
  return `genre_${ascii}_${Math.abs(hash)}`;
}

/**
 * Real-time bidirectional listener for cloud books.
 * Every time any connected device (PC or Phone) creates, edits, or deletes a book,
 * this listener immediately notifies the caller with the fresh cloud state.
 */
export function subscribeToCloudBooks(
  userId: string, 
  onUpdate: (books: Book[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const safeSyncUser = getSyncUserId(userId);
  const booksCol = collection(db, 'users', safeSyncUser, 'books');

  const unsubscribe = onSnapshot(
    booksCol,
    (snapshot) => {
      const books: Book[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Book;
        books.push({
          ...data,
          id: data.id || docSnap.id,
        });
      });

      // Maintain consistent sort order (latest updated/created first)
      books.sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      onUpdate(books);
    },
    (error) => {
      console.warn('Firestore subscribe books notice/error:', error);
      if (onError) {
        try {
          onError(error);
        } catch (e) {
          console.warn('Error in onError callback:', e);
        }
      }
      // Never throw inside onSnapshot callback, so client keeps active connection
    }
  );

  return unsubscribe;
}

/**
 * Fetch cloud books once (useful for initialization checks).
 */
export async function fetchCloudBooksOnce(userId: string): Promise<Book[]> {
  const safeSyncUser = getSyncUserId(userId);
  const booksPath = `users/${safeSyncUser}/books`;
  try {
    const booksCol = collection(db, 'users', safeSyncUser, 'books');
    const snapshot = await getDocs(booksCol);
    const books: Book[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Book;
      books.push({
        ...data,
        id: data.id || docSnap.id,
      });
    });
    return books;
  } catch (error) {
    console.warn('fetchCloudBooksOnce notice:', error);
    return [];
  }
}

export function getSyncUserId(userId?: string | null): string {
  if (!userId) return 'jaguuuar@gmail.com';
  const clean = String(userId).trim().toLowerCase();
  if (clean.includes('@')) return clean;
  try {
    const saved = localStorage.getItem('my_book_shelf_saved_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.email && String(parsed.email).includes('@')) {
        return String(parsed.email).trim().toLowerCase();
      }
    }
  } catch {}
  if (auth.currentUser?.email) {
    return auth.currentUser.email.trim().toLowerCase();
  }
  return 'jaguuuar@gmail.com';
}

export async function saveBookToCloud(userId: string, book: Book): Promise<string> {
  const safeSyncUser = getSyncUserId(userId);
  const safeId = toSafeBookId(book.id);
  const now = new Date().toISOString();
  const bookWithMeta: Book = {
    ...book,
    id: safeId,
    updatedAt: book.updatedAt || now,
    userId: safeSyncUser,
  };

  // 1. Primary Channel: Real-time Google Cloud Firestore
  try {
    const bookRef = doc(db, 'users', safeSyncUser, 'books', safeId);
    const payload = sanitizeBookForFirestore(bookWithMeta, safeSyncUser);
    await setDoc(bookRef, payload);
  } catch (firestoreErr) {
    console.warn('Firestore live save notice:', firestoreErr);
  }

  // 2. Secondary Channel: Server Sync (backup)
  try {
    await fetch('/api/sync/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: safeSyncUser, book: bookWithMeta }),
    });
  } catch (err) {
    console.warn('Server sync save notice (offline or network):', err);
  }

  return safeId;
}

/**
 * Delete single book from cloud in real time.
 */
export async function deleteBookFromCloud(userId: string, bookId: string): Promise<void> {
  const safeSyncUser = getSyncUserId(userId);
  const safeId = toSafeBookId(bookId);

  // 1. Google Cloud Firestore
  try {
    const bookRef = doc(db, 'users', safeSyncUser, 'books', safeId);
    await deleteDoc(bookRef);
  } catch (firestoreErr) {
    console.warn('Firestore delete notice:', firestoreErr);
  }

  // 2. Server Sync
  try {
    await fetch('/api/sync/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: safeSyncUser, bookId: safeId }),
    });
  } catch (err) {
    console.warn('Server sync delete notice:', err);
  }
}

/**
 * Sync entire book library to cloud (used for batch uploads, author merges, and imports).
 * Deletes any books in cloud that are not in the local books list.
 * Respects the Firestore maximum of 500 writes per batch by chunking operations.
 */
export async function syncAllBooksToCloud(userId: string, books: Book[]): Promise<void> {
  const safeSyncUser = getSyncUserId(userId);
  const safeBooks = books.map((b) => ({
    ...b,
    id: toSafeBookId(b.id),
  }));

  // 1. Google Cloud Firestore Full Push
  const path = `users/${safeSyncUser}/books`;
  try {
    const existingSnap = await getDocs(collection(db, 'users', safeSyncUser, 'books'));
    const newBookIds = new Set(safeBooks.map((b) => b.id));

    const deleteRefs: any[] = [];
    existingSnap.forEach((docSnap) => {
      if (!newBookIds.has(docSnap.id)) {
        deleteRefs.push(docSnap.ref);
      }
    });

    const CHUNK_SIZE = 300;

    // Delete removed books in safe chunks
    for (let i = 0; i < deleteRefs.length; i += CHUNK_SIZE) {
      const chunk = deleteRefs.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const ref of chunk) {
        batch.delete(ref);
      }
      await batch.commit();
    }

    // Write current books in safe chunks
    for (let i = 0; i < safeBooks.length; i += CHUNK_SIZE) {
      const chunk = safeBooks.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const b of chunk) {
        const bookRef = doc(db, 'users', safeSyncUser, 'books', b.id);
        batch.set(bookRef, sanitizeBookForFirestore(b, safeSyncUser));
      }
      await batch.commit();
    }
  } catch (error) {
    console.error('Firestore syncAllBooksToCloud error:', error);
    handleFirestoreError(error, OperationType.WRITE, path);
  }

  // 2. Server Sync Full Push (replicated backup)
  try {
    await fetch('/api/sync/push-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: safeSyncUser, books: safeBooks }),
    });
  } catch (err) {
    console.warn('Server sync push-all notice:', err);
  }
}

/**
 * Save a single genre to cloud
 */
export async function saveGenreToCloud(userId: string, genreName: string): Promise<void> {
  const safeSyncUser = getSyncUserId(userId);
  const genreId = toSafeGenreId(genreName);
  const path = `users/${safeSyncUser}/genres/${genreId}`;
  try {
    const ref = doc(db, 'users', safeSyncUser, 'genres', genreId);
    await setDoc(ref, {
      userId: safeSyncUser,
      name: genreName.trim(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('saveGenreToCloud notice:', error);
  }
}

/**
 * Delete a single genre from cloud
 */
export async function deleteGenreFromCloud(userId: string, genreName: string): Promise<void> {
  const safeSyncUser = getSyncUserId(userId);
  const genreId = toSafeGenreId(genreName);
  const path = `users/${safeSyncUser}/genres/${genreId}`;
  try {
    const ref = doc(db, 'users', safeSyncUser, 'genres', genreId);
    await deleteDoc(ref);
  } catch (error) {
    console.warn('deleteGenreFromCloud notice:', error);
  }
}

/**
 * Sync all genres to cloud
 */
export async function syncAllGenresToCloud(userId: string, genres: string[]): Promise<void> {
  const safeSyncUser = getSyncUserId(userId);
  const path = `users/${safeSyncUser}/genres`;
  try {
    const existingSnap = await getDocs(collection(db, 'users', safeSyncUser, 'genres'));
    const currentGenreIds = new Set(genres.map((g) => toSafeGenreId(g)));

    const batch = writeBatch(db);

    // Delete removed genres
    existingSnap.forEach((docSnap) => {
      if (!currentGenreIds.has(docSnap.id)) {
        batch.delete(docSnap.ref);
      }
    });

    // Set active genres
    for (const g of genres) {
      const gid = toSafeGenreId(g);
      const ref = doc(db, 'users', safeSyncUser, 'genres', gid);
      batch.set(ref, {
        userId: safeSyncUser,
        name: g.trim(),
        updatedAt: new Date().toISOString(),
      });
    }

    await batch.commit();
  } catch (error) {
    console.warn('syncAllGenresToCloud notice:', error);
  }
}

/**
 * Real-time listener for cloud genres.
 */
export function subscribeToCloudGenres(
  userId: string,
  onUpdate: (genres: string[]) => void
): () => void {
  const safeSyncUser = getSyncUserId(userId);
  const genresCol = collection(db, 'users', safeSyncUser, 'genres');

  const unsubscribe = onSnapshot(
    genresCol,
    (snapshot) => {
      const genres: string[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as { name: string };
        if (data && data.name) genres.push(data.name);
      });
      if (genres.length > 0) {
        onUpdate(genres);
      }
    },
    (error) => {
      console.warn('Firestore subscribe genres notice/error:', error);
    }
  );

  return unsubscribe;
}

export interface TwoWaySyncResult {
  success: boolean;
  books: Book[];
  downloadedCount: number;
  uploadedCount: number;
  message: string;
}

/**
 * Intelligent Two-Way Synchronization between local device (PC or Phone) and Google Cloud:
 * 1. Fetches all latest books currently stored in Firestore.
 * 2. Compares timestamps:
 *    - If mobile edited a book more recently than desktop, mobile's edit is preserved and desktop is updated.
 *    - If desktop edited a book more recently, desktop's edit is saved to the cloud.
 *    - If books were added on either device, they are merged cleanly into both devices.
 * 3. Never wipes user data.
 */
export async function twoWaySyncBooks(
  userId: string,
  localBooks: Book[]
): Promise<TwoWaySyncResult> {
  const safeSyncUser = getSyncUserId(userId);

  // 1. Primary Channel: Google Cloud Firestore Direct Sync
  try {
    const cloudBooks = await fetchCloudBooksOnce(safeSyncUser);
    const cloudMap = new Map<string, Book>();
    for (const cb of cloudBooks) {
      const id = cb.id || toSafeBookId(cb.id);
      cloudMap.set(id, { ...cb, id });
    }

    const localMap = new Map<string, Book>();
    for (const lb of localBooks) {
      const id = lb.id || toSafeBookId(lb.id);
      localMap.set(id, { ...lb, id });
    }

    const mergedBooks: Book[] = [];
    const booksToUpload: Book[] = [];
    let downloadedCount = 0;
    let uploadedCount = 0;

    for (const [id, localBook] of localMap.entries()) {
      const cloudBook = cloudMap.get(id);
      if (!cloudBook) {
        booksToUpload.push(localBook);
        mergedBooks.push(localBook);
        uploadedCount++;
      } else {
        const localTime = new Date(localBook.updatedAt || localBook.createdAt || 0).getTime();
        const cloudTime = new Date(cloudBook.updatedAt || cloudBook.createdAt || 0).getTime();
        if (localTime > cloudTime) {
          booksToUpload.push(localBook);
          mergedBooks.push(localBook);
          uploadedCount++;
        } else {
          mergedBooks.push(cloudBook);
          if (cloudTime > localTime) downloadedCount++;
        }
      }
    }

    for (const [id, cloudBook] of cloudMap.entries()) {
      if (!localMap.has(id)) {
        mergedBooks.push(cloudBook);
        downloadedCount++;
      }
    }

    if (booksToUpload.length > 0) {
      for (const b of booksToUpload) {
        await saveBookToCloud(safeSyncUser, b);
      }
    }

    mergedBooks.sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    // Replicate to server cache for background persistence
    fetch('/api/sync/push-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: safeSyncUser, books: mergedBooks }),
    }).catch(() => {});

    return {
      success: true,
      books: mergedBooks,
      downloadedCount,
      uploadedCount,
      message: downloadedCount > 0 || uploadedCount > 0
        ? `Синхронизация через Google Cloud: обновлено ${downloadedCount} книг, отправлено ${uploadedCount}.`
        : 'Все книги актуальны и синхронизированы между ПК и телефоном!',
    };
  } catch (firestoreErr) {
    console.warn('Firestore twoWaySync error, falling back to server merge:', firestoreErr);
  }

  // 2. Secondary Channel: Server Sync (replicated container backup)
  try {
    const res = await fetch('/api/sync/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: safeSyncUser, clientBooks: localBooks }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.books)) {
        const dl = data.downloadedCount || 0;
        const ul = data.uploadedCount || 0;
        return {
          success: true,
          books: data.books,
          downloadedCount: dl,
          uploadedCount: ul,
          message: dl > 0 || ul > 0
            ? `Синхронизация завершена: обновлено ${dl} книг, отправлено ${ul} изменений.`
            : 'Все книги актуальны и синхронизированы!',
        };
      }
    }
  } catch (err) {
    console.warn('Server sync merge notice:', err);
  }

  return {
    success: true,
    books: localBooks,
    downloadedCount: 0,
    uploadedCount: 0,
    message: 'Книги сохранены локально на этом устройстве.',
  };
}

/**
 * Force pull all books directly from cloud, replacing local state.
 */
export async function pullAllBooksFromCloud(userId: string): Promise<Book[]> {
  const safeSyncUser = getSyncUserId(userId);

  // 1. Primary: Direct Google Cloud Firestore
  try {
    const cloudBooks = await fetchCloudBooksOnce(safeSyncUser);
    if (cloudBooks && cloudBooks.length > 0) {
      cloudBooks.sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      return cloudBooks;
    }
  } catch (err) {
    console.warn('Firestore pull notice:', err);
  }

  // 2. Secondary: Server Sync Engine
  try {
    const res = await fetch(`/api/sync/get?userId=${encodeURIComponent(safeSyncUser)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.books) && data.books.length > 0) {
        return data.books;
      }
    }
  } catch (err) {
    console.warn('Server sync pull notice:', err);
  }

  return [];
}

// Backward compatibility alias
export const uploadLocalBooksBatch = syncAllBooksToCloud;
