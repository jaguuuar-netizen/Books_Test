import { initializeApp } from 'firebase/app';
import { 
  getAuth,
  initializeAuth,
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  User, 
  browserPopupRedirectResolver,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  inMemoryPersistence
} from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// CRITICAL: The app will break without passing firestoreDatabaseId
// CRITICAL: ignoreUndefinedProperties: true prevents errors when optional fields (rating, dates, pages) are undefined
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
}, (firebaseConfig as any).firestoreDatabaseId);

// Initialize Firebase Auth with multi-tier persistence (localStorage first, then IndexedDB and memory fallback)
// Putting browserLocalPersistence (localStorage) FIRST guarantees that login credentials survive
// page reloads, mobile tab sleeps/backgrounding, PWA, and browser restarts without IndexedDB locking issues.
let authInstance: ReturnType<typeof getAuth>;
try {
  authInstance = initializeAuth(app, {
    persistence: [browserLocalPersistence, indexedDBLocalPersistence, inMemoryPersistence]
  });
} catch (e) {
  authInstance = getAuth(app);
}

export const auth = authInstance;

export { browserPopupRedirectResolver };

/**
 * Ensures Firebase Auth has finished restoring session from storage before executing cloud operations
 */
export const ensureAuthReady = async (): Promise<User | null> => {
  try {
    if (typeof auth.authStateReady === 'function') {
      await auth.authStateReady();
    }
  } catch (e) {
    console.warn('ensureAuthReady notice:', e);
  }
  // Brief grace period for token restoration if in progress
  if (!auth.currentUser) {
    await new Promise((r) => setTimeout(r, 120));
  }
  return auth.currentUser;
};

export interface SavedUserSession {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export const DEFAULT_USER_EMAIL = 'jaguuuar@gmail.com';

export const getSavedUserSession = (): SavedUserSession | null => {
  if (typeof window === 'undefined') return null;
  if (isExplicitlySignedOut()) return null;
  try {
    const raw = localStorage.getItem('my_book_shelf_saved_user');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.uid || parsed.email)) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage parse error
  }
  // Seamless cross-device default account: connects phone and PC to the same library without friction
  return {
    uid: DEFAULT_USER_EMAIL,
    displayName: 'jaguuuar',
    email: DEFAULT_USER_EMAIL,
    photoURL: null,
  };
};

export const isExplicitlySignedOut = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem('my_book_shelf_explicitly_signed_out') === 'true';
  } catch {
    return false;
  }
};

export const setExplicitlySignedOut = (value: boolean) => {
  if (typeof window === 'undefined') return;
  try {
    if (value) {
      localStorage.setItem('my_book_shelf_explicitly_signed_out', 'true');
      localStorage.removeItem('my_book_shelf_saved_user');
      localStorage.removeItem('my_book_shelf_has_authenticated');
    } else {
      localStorage.removeItem('my_book_shelf_explicitly_signed_out');
      localStorage.setItem('my_book_shelf_has_authenticated', 'true');
    }
  } catch {}
};

export const saveUserSession = (user: User | SavedUserSession | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      const session: SavedUserSession = {
        uid: user.uid,
        displayName: user.displayName || null,
        email: user.email || null,
        photoURL: user.photoURL || null,
      };
      localStorage.setItem('my_book_shelf_saved_user', JSON.stringify(session));
      localStorage.setItem('my_book_shelf_has_authenticated', 'true');
      localStorage.removeItem('my_book_shelf_explicitly_signed_out');
    } else {
      localStorage.removeItem('my_book_shelf_saved_user');
      localStorage.removeItem('my_book_shelf_has_authenticated');
    }
  } catch {}
};

// Standard Google provider: requests standard profile/email identity only.
// Do NOT force prompt 'select_account' so the user is not pestered to choose account every time.
export const googleProvider = new GoogleAuthProvider();

// Dedicated Google Sheets provider for optional Google Sheets export in settings
export const SPREADSHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
export const getSheetsGoogleProvider = (): GoogleAuthProvider => {
  const p = new GoogleAuthProvider();
  p.addScope(SPREADSHEETS_SCOPE);
  p.setCustomParameters({
    prompt: 'consent',
  });
  return p;
};

// Persistent token cache using localStorage (survives mobile browser restarts)
let cachedAccessToken: string | null = null;

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken && typeof window !== 'undefined') {
    try {
      cachedAccessToken = localStorage.getItem('g_oauth_token');
    } catch {
      // Ignore storage access error
    }
  }
  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (typeof window !== 'undefined') {
    try {
      if (token) {
        localStorage.setItem('g_oauth_token', token);
      } else {
        localStorage.removeItem('g_oauth_token');
      }
    } catch {
      // Ignore storage access error
    }
  }
};

export const clearAccessToken = () => {
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('g_oauth_token');
    } catch {
      // Ignore
    }
  }
};

// Request or refresh OAuth access token with Google Sheets scope
export const requestGoogleAccessToken = async (): Promise<string> => {
  try {
    const sheetsProvider = getSheetsGoogleProvider();
    const result = await signInWithPopup(auth, sheetsProvider, browserPopupRedirectResolver);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Не удалось получить токен доступа Google. Пожалуйста, разрешите доступ к Google Таблицам.');
    }
    setCachedAccessToken(credential.accessToken);
    return credential.accessToken;
  } catch (err: any) {
    console.error('Failed to request Google access token:', err);
    throw err;
  }
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline mode active.');
    }
  }
}
testFirestoreConnection();
