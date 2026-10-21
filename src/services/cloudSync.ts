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
  const booksCol = collection(db, 'users', userId, 'books');

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
  const booksPath = `users/${userId}/books`;
  try {
    const booksCol = collection(db, 'users', userId, 'books');
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
    handleFirestoreError(error, OperationType.LIST, booksPath);
  }
}

/**
 * Save single book to cloud in real time.
 */
export async function saveBookToCloud(userId: string, book: Book): Promise<string> {
  await ensureAuthReady();
  if (!auth.currentUser) {
    throw new Error('Для сохранения книги в облаке требуется подтвердить вход в Google.');
  }

  const safeId = toSafeBookId(book.id);
  const path = `users/${userId}/books/${safeId}`;
  try {
    const bookRef = doc(db, 'users', userId, 'books', safeId);
    const payload = sanitizeBookForFirestore({ ...book, id: safeId }, userId);
    await setDoc(bookRef, payload);
    return safeId;
  } catch (error) {
    console.error('saveBookToCloud error:', error);
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Delete single book from cloud in real time.
 */
export async function deleteBookFromCloud(userId: string, bookId: string): Promise<void> {
  const safeId = toSafeBookId(bookId);
  const path = `users/${userId}/books/${safeId}`;
  try {
    const bookRef = doc(db, 'users', userId, 'books', safeId);
    await deleteDoc(bookRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Sync entire book library to cloud (used for batch uploads, author merges, and imports).
 * Deletes any books in cloud that are not in the local books list.
 * Respects the Firestore maximum of 500 writes per batch by chunking operations.
 */
export async function syncAllBooksToCloud(userId: string, books: Book[]): Promise<void> {
  const path = `users/${userId}/books`;
  try {
    // 1. Get existing cloud book IDs to clean up orphaned entries
    const existingSnap = await getDocs(collection(db, 'users', userId, 'books'));
    
    // Ensure all books have clean, safe Firestore document IDs
    const safeBooks = books.map((b) => ({
      ...b,
      id: toSafeBookId(b.id),
    }));
    const newBookIds = new Set(safeBooks.map((b) => b.id));

    const deleteRefs: any[] = [];
    existingSnap.forEach((docSnap) => {
      if (!newBookIds.has(docSnap.id)) {
        deleteRefs.push(docSnap.ref);
      }
    });

    const CHUNK_SIZE = 300;

    // 2. Commit deletions in safe chunks
    for (let i = 0; i < deleteRefs.length; i += CHUNK_SIZE) {
      const chunk = deleteRefs.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const ref of chunk) {
        batch.delete(ref);
      }
      await batch.commit();
    }

    // 3. Commit writes in safe chunks
    for (let i = 0; i < safeBooks.length; i += CHUNK_SIZE) {
      const chunk = safeBooks.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const b of chunk) {
        const bookRef = doc(db, 'users', userId, 'books', b.id);
        batch.set(bookRef, sanitizeBookForFirestore(b, userId));
      }
      await batch.commit();
    }
  } catch (error) {
    console.error('syncAllBooksToCloud error:', error);
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Save a single genre to cloud
 */
export async function saveGenreToCloud(userId: string, genreName: string): Promise<void> {
  const genreId = toSafeGenreId(genreName);
  const path = `users/${userId}/genres/${genreId}`;
  try {
    const ref = doc(db, 'users', userId, 'genres', genreId);
    await setDoc(ref, {
      userId,
      name: genreName.trim(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Delete a single genre from cloud
 */
export async function deleteGenreFromCloud(userId: string, genreName: string): Promise<void> {
  const genreId = toSafeGenreId(genreName);
  const path = `users/${userId}/genres/${genreId}`;
  try {
    const ref = doc(db, 'users', userId, 'genres', genreId);
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Sync all genres to cloud
 */
export async function syncAllGenresToCloud(userId: string, genres: string[]): Promise<void> {
  const path = `users/${userId}/genres`;
  try {
    const existingSnap = await getDocs(collection(db, 'users', userId, 'genres'));
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
      const ref = doc(db, 'users', userId, 'genres', gid);
      batch.set(ref, {
        userId,
        name: g.trim(),
        updatedAt: new Date().toISOString(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Real-time listener for cloud genres.
 */
export function subscribeToCloudGenres(
  userId: string,
  onUpdate: (genres: string[]) => void
): () => void {
  const genresCol = collection(db, 'users', userId, 'genres');

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
  const user = await ensureAuthReady();
  if (!user || user.uid !== userId) {
    throw new Error('Для синхронизации требуется авторизованный аккаунт Google.');
  }

  const cloudBooks = await fetchCloudBooksOnce(userId);

  // If cloud is completely empty, but user has real local books (not demo):
  if (cloudBooks.length === 0 && localBooks.length > 0 && !isStockDemoBooks(localBooks)) {
    await syncAllBooksToCloud(userId, localBooks);
    return {
      success: true,
      books: localBooks,
      downloadedCount: 0,
      uploadedCount: localBooks.length,
      message: `Все ${localBooks.length} книг успешно отправлены в Google Облако!`,
    };
  }

  // Maps for efficient ID matching
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

  // 1. Process local books
  for (const [id, localBook] of localMap.entries()) {
    const cloudBook = cloudMap.get(id);

    if (!cloudBook) {
      // Book exists on this device only: upload to cloud so other device gets it
      booksToUpload.push(localBook);
      mergedBooks.push(localBook);
      uploadedCount++;
    } else {
      // Exists on both: timestamp comparison
      const localTime = new Date(localBook.updatedAt || localBook.createdAt || 0).getTime();
      const cloudTime = new Date(cloudBook.updatedAt || cloudBook.createdAt || 0).getTime();

      if (localTime > cloudTime) {
        // Local is strictly newer: upload to cloud
        booksToUpload.push(localBook);
        mergedBooks.push(localBook);
        uploadedCount++;
      } else {
        // Cloud is newer or equal: use cloud version
        mergedBooks.push(cloudBook);
        if (cloudTime > localTime) {
          downloadedCount++;
        }
      }
    }
  }

  // 2. Process cloud books that this device doesn't have yet (e.g. added on phone)
  for (const [id, cloudBook] of cloudMap.entries()) {
    if (!localMap.has(id)) {
      mergedBooks.push(cloudBook);
      downloadedCount++;
    }
  }

  // 3. Upload newer local items
  if (booksToUpload.length > 0) {
    for (const b of booksToUpload) {
      await saveBookToCloud(userId, b);
    }
  }

  // 4. Sort newest first
  mergedBooks.sort((a, b) => {
    const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return timeB - timeA;
  });

  return {
    success: true,
    books: mergedBooks,
    downloadedCount,
    uploadedCount,
    message: downloadedCount > 0 || uploadedCount > 0
      ? `Синхронизация завершена: обновлено ${downloadedCount} книг из облака, отправлено ${uploadedCount} изменений.`
      : 'Все книги полностью синхронизированы и актуальны на всех устройствах!',
  };
}

/**
 * Force pull all books directly from Google Cloud, replacing local state.
 */
export async function pullAllBooksFromCloud(userId: string): Promise<Book[]> {
  const user = await ensureAuthReady();
  if (!user || user.uid !== userId) {
    throw new Error('Для загрузки из облака требуется авторизованный аккаунт Google.');
  }
  const cloudBooks = await fetchCloudBooksOnce(userId);
  cloudBooks.sort((a, b) => {
    const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return timeB - timeA;
  });
  return cloudBooks;
}

// Backward compatibility alias
export const uploadLocalBooksBatch = syncAllBooksToCloud;
