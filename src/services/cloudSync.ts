import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs,
  onSnapshot, 
  writeBatch 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Book } from '../types/book';
import { INITIAL_DEMO_BOOKS } from './demoData';

/**
 * Check if the provided books array is identical to the default INITIAL_DEMO_BOOKS.
 */
export function isStockDemoBooks(books: Book[]): boolean {
  if (!books || books.length !== INITIAL_DEMO_BOOKS.length) return false;
  const demoIds = new Set(INITIAL_DEMO_BOOKS.map((b) => b.id));
  return books.every((b) => demoIds.has(b.id));
}

/**
 * Clean book data for Firestore:
 * - Drops undefined keys
 * - Ensures required fields
 * - Drops excessively large base64 covers (>400KB) to respect Firestore document size limits
 */
export function sanitizeBookForFirestore(book: Book, userId: string): Record<string, any> {
  const clean: Record<string, any> = {
    id: book.id,
    userId,
    title: (book.title || 'Без названия').substring(0, 500),
    authors: Array.isArray(book.authors) && book.authors.length > 0 ? book.authors : ['Неизвестный автор'],
    status: book.status === 'completed' ? 'completed' : 'reading',
    genres: Array.isArray(book.genres) ? book.genres : [],
    createdAt: book.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (book.status === 'completed' && typeof book.rating === 'number' && !isNaN(book.rating)) {
    clean.rating = Math.min(10, Math.max(1, Math.round(book.rating)));
  }

  if (book.startDate) clean.startDate = book.startDate;
  if (book.status === 'completed' && book.endDate) clean.endDate = book.endDate;
  if (typeof book.pages === 'number' && !isNaN(book.pages)) clean.pages = book.pages;
  if (typeof book.readingHours === 'number' && !isNaN(book.readingHours)) clean.readingHours = book.readingHours;
  if (book.coverColor) clean.coverColor = book.coverColor;
  if (book.notes) clean.notes = book.notes;
  if (book.series) clean.series = book.series;
  if (typeof book.seriesNumber === 'number' && !isNaN(book.seriesNumber)) clean.seriesNumber = book.seriesNumber;
  if (book.publisher) clean.publisher = book.publisher;
  if (typeof book.publishYear === 'number' && !isNaN(book.publishYear)) clean.publishYear = book.publishYear;
  if (book.language) clean.language = book.language;

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
  const booksPath = `users/${userId}/books`;
  const booksCol = collection(db, 'users', userId, 'books');

  const unsubscribe = onSnapshot(
    booksCol,
    (snapshot) => {
      const books: Book[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Book;
        books.push(data);
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
      console.error('Firestore subscribe books error:', error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, booksPath);
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
      books.push(docSnap.data() as Book);
    });
    return books;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, booksPath);
  }
}

/**
 * Real-time listener for cloud genres.
 */
export function subscribeToCloudGenres(
  userId: string,
  onUpdate: (genres: string[]) => void
): () => void {
  const genresPath = `users/${userId}/genres`;
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
      handleFirestoreError(error, OperationType.GET, genresPath);
    }
  );

  return unsubscribe;
}

/**
 * Save single book to cloud in real time.
 */
export async function saveBookToCloud(userId: string, book: Book): Promise<void> {
  const path = `users/${userId}/books/${book.id}`;
  try {
    const bookRef = doc(db, 'users', userId, 'books', book.id);
    const payload = sanitizeBookForFirestore(book, userId);
    await setDoc(bookRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Delete single book from cloud in real time.
 */
export async function deleteBookFromCloud(userId: string, bookId: string): Promise<void> {
  const path = `users/${userId}/books/${bookId}`;
  try {
    const bookRef = doc(db, 'users', userId, 'books', bookId);
    await deleteDoc(bookRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Sync entire book library to cloud (used for batch uploads, author merges, and imports).
 * Deletes any books in cloud that are not in the local books list.
 */
export async function syncAllBooksToCloud(userId: string, books: Book[]): Promise<void> {
  const path = `users/${userId}/books`;
  try {
    // 1. Get existing cloud book IDs to clean up orphaned entries
    const existingSnap = await getDocs(collection(db, 'users', userId, 'books'));
    const newBookIds = new Set(books.map((b) => b.id));

    const batch = writeBatch(db);

    // Delete books in cloud not present in the new set
    existingSnap.forEach((docSnap) => {
      if (!newBookIds.has(docSnap.id)) {
        batch.delete(docSnap.ref);
      }
    });

    // Write all updated books
    for (const b of books) {
      const bookRef = doc(db, 'users', userId, 'books', b.id);
      batch.set(bookRef, sanitizeBookForFirestore(b, userId));
    }

    await batch.commit();
  } catch (error) {
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

// Backward compatibility alias
export const uploadLocalBooksBatch = syncAllBooksToCloud;
