import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  writeBatch 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Book } from '../types/book';

export function subscribeToCloudBooks(
  userId: string, 
  onUpdate: (books: Book[]) => void
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
      onUpdate(books);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, booksPath);
    }
  );

  return unsubscribe;
}

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

export async function saveBookToCloud(userId: string, book: Book): Promise<void> {
  const path = `users/${userId}/books/${book.id}`;
  try {
    const bookRef = doc(db, 'users', userId, 'books', book.id);
    const payload = {
      ...book,
      userId,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(bookRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteBookFromCloud(userId: string, bookId: string): Promise<void> {
  const path = `users/${userId}/books/${bookId}`;
  try {
    const bookRef = doc(db, 'users', userId, 'books', bookId);
    await deleteDoc(bookRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function uploadLocalBooksBatch(userId: string, books: Book[]): Promise<void> {
  if (books.length === 0) return;
  const path = `users/${userId}/books`;
  try {
    const batch = writeBatch(db);
    for (const b of books) {
      const bookRef = doc(db, 'users', userId, 'books', b.id);
      batch.set(bookRef, { ...b, userId, updatedAt: new Date().toISOString() });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
