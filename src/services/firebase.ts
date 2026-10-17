import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  User, 
  setPersistence, 
  browserLocalPersistence, 
  indexedDBLocalPersistence 
} from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// CRITICAL: The app will break without passing firestoreDatabaseId
// CRITICAL: ignoreUndefinedProperties: true prevents errors when optional fields (rating, dates, pages) are undefined
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
}, (firebaseConfig as any).firestoreDatabaseId);

export const auth = getAuth(app);

// Enforce browserLocalPersistence (localStorage) so user authentication
// and sync do not drop when mobile browser tabs are closed, refreshed, or backgrounded.
try {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('Firebase setPersistence notice:', err);
  });
} catch (e) {
  console.warn('Could not set persistence synchronously:', e);
}

export const googleProvider = new GoogleAuthProvider();

export const SPREADSHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
googleProvider.addScope(SPREADSHEETS_SCOPE);

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

// Clear cached token on sign-out
auth.onAuthStateChanged((user) => {
  if (!user) {
    clearAccessToken();
  }
});

// Request or refresh OAuth access token with Google Sheets scope
export const requestGoogleAccessToken = async (): Promise<string> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Не удалось получить токен доступа Google. Пожалуйста, разрешите доступ к Google Таблицам.');
    }
    cachedAccessToken = credential.accessToken;
    return cachedAccessToken;
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
