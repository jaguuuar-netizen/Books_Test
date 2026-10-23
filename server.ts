import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Parse CLI flags or env vars
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const hostIndex = args.indexOf('--host');

const PORT = portIndex !== -1 && args[portIndex + 1]
  ? parseInt(args[portIndex + 1], 10)
  : parseInt(process.env.PORT || '3000', 10);

const HOST = hostIndex !== -1 && args[hostIndex + 1]
  ? args[hostIndex + 1]
  : (process.env.HOST || '0.0.0.0');

const isProd = process.env.NODE_ENV === 'production';

// Enable CORS and OPTIONS handling
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));

// Healthcheck and API ping
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// --- Server-Authoritative Cross-Device Sync Engine ---
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const CANONICAL_USER = 'jaguuuar@gmail.com';

function getSafeUserFilePath(rawUserId: string): string {
  const safeId = String(rawUserId || CANONICAL_USER).toLowerCase().replace(/[^a-z0-9_@.\-]/g, '_');
  return path.join(DATA_DIR, `vault_${safeId}.json`);
}

function resolveUserVaultPath(rawUserId: string): string {
  const directPath = getSafeUserFilePath(rawUserId);
  if (fs.existsSync(directPath)) {
    return directPath;
  }
  const canonicalPath = getSafeUserFilePath(CANONICAL_USER);
  if (fs.existsSync(canonicalPath)) {
    return canonicalPath;
  }
  try {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('vault_') && f.endsWith('.json') && !f.endsWith('.tmp'));
    if (files.length > 0) {
      return path.join(DATA_DIR, files[0]);
    }
  } catch {}
  return directPath;
}

interface UserVault {
  userId: string;
  updatedAt: string;
  books: any[];
  genres: string[];
}

function readUserVault(userId: string): UserVault {
  const file = resolveUserVaultPath(userId);
  try {
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, 'utf8');
      const parsed = JSON.parse(data);
      return {
        userId: parsed.userId || userId || CANONICAL_USER,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        books: Array.isArray(parsed.books) ? parsed.books : [],
        genres: Array.isArray(parsed.genres) ? parsed.genres : [],
      };
    }
  } catch (err) {
    console.warn(`Error reading vault for ${userId}:`, err);
  }
  return { userId: userId || CANONICAL_USER, updatedAt: new Date().toISOString(), books: [], genres: [] };
}

function writeUserVault(vault: UserVault): void {
  const primaryFile = getSafeUserFilePath(vault.userId);
  const canonicalFile = getSafeUserFilePath(CANONICAL_USER);

  const saveToFile = (targetFile: string) => {
    const tmpFile = `${targetFile}.tmp`;
    try {
      fs.writeFileSync(tmpFile, JSON.stringify(vault, null, 2), 'utf8');
      fs.renameSync(tmpFile, targetFile);
    } catch (err) {
      console.error(`Error writing vault to ${targetFile}:`, err);
    }
  };

  saveToFile(primaryFile);
  // Mirror to canonical user vault so PC and mobile always stay in sync regardless of identifier used
  if (primaryFile !== canonicalFile) {
    saveToFile(canonicalFile);
  }
}

// 1. Pull user's latest library (called on load, refresh, or tab visibility change)
app.get('/api/sync/get', (req, res) => {
  const userId = String(req.query.userId || CANONICAL_USER).trim();
  const vault = readUserVault(userId);
  res.json({
    success: true,
    userId,
    updatedAt: vault.updatedAt,
    books: vault.books,
    genres: vault.genres,
  });
});

// 2. Real-time single book save (called immediately when a book is added or edited on PC/phone)
app.post('/api/sync/save', (req, res) => {
  const { userId, book } = req.body;
  const targetUser = String(userId || CANONICAL_USER).trim();
  if (!book || !book.id) {
    return res.status(400).json({ success: false, error: 'book with id is required' });
  }
  const vault = readUserVault(targetUser);
  const now = new Date().toISOString();
  const bookWithMeta = {
    ...book,
    updatedAt: book.updatedAt || now,
    userId: targetUser,
  };

  const idx = vault.books.findIndex((b: any) => b.id === book.id);
  if (idx >= 0) {
    vault.books[idx] = bookWithMeta;
  } else {
    vault.books.unshift(bookWithMeta);
  }
  vault.updatedAt = now;

  // Add any new genres
  if (Array.isArray(book.genres)) {
    for (const g of book.genres) {
      if (g && typeof g === 'string' && !vault.genres.includes(g)) {
        vault.genres.push(g);
      }
    }
  }

  writeUserVault(vault);
  res.json({ success: true, count: vault.books.length, updatedAt: vault.updatedAt });
});

// 3. Real-time single book delete
app.post('/api/sync/delete', (req, res) => {
  const { userId, bookId } = req.body;
  const targetUser = String(userId || CANONICAL_USER).trim();
  if (!bookId) {
    return res.status(400).json({ success: false, error: 'bookId is required' });
  }
  const vault = readUserVault(targetUser);
  vault.books = vault.books.filter((b: any) => b.id !== bookId);
  vault.updatedAt = new Date().toISOString();
  writeUserVault(vault);
  res.json({ success: true, count: vault.books.length, updatedAt: vault.updatedAt });
});

// 4. Two-Way Intelligent Synchronization (reconciles differences between PC and Phone)
app.post('/api/sync/merge', (req, res) => {
  const { userId, clientBooks, clientGenres } = req.body;
  const targetUser = String(userId || CANONICAL_USER).trim();
  const vault = readUserVault(targetUser);
  const serverBooks = vault.books;
  const clientList = Array.isArray(clientBooks) ? clientBooks : [];

  const serverMap = new Map<string, any>();
  for (const sb of serverBooks) {
    serverMap.set(sb.id, sb);
  }

  const mergedMap = new Map<string, any>();
  let uploadedCount = 0;
  let downloadedCount = 0;

  for (const cb of clientList) {
    const sb = serverMap.get(cb.id);
    if (!sb) {
      // Client has a book that server doesn't have yet -> add to server
      mergedMap.set(cb.id, cb);
      uploadedCount++;
    } else {
      // Both have it: compare timestamps
      const clientTime = new Date(cb.updatedAt || cb.createdAt || 0).getTime();
      const serverTime = new Date(sb.updatedAt || sb.createdAt || 0).getTime();
      if (clientTime > serverTime) {
        mergedMap.set(cb.id, cb);
        uploadedCount++;
      } else {
        mergedMap.set(sb.id, sb);
        if (serverTime > clientTime) {
          downloadedCount++;
        }
      }
      serverMap.delete(cb.id);
    }
  }

  // Add any remaining server books (added from the other device)
  for (const sb of serverMap.values()) {
    mergedMap.set(sb.id, sb);
    downloadedCount++;
  }

  const finalBooks = Array.from(mergedMap.values()).sort((a: any, b: any) => {
    const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return timeB - timeA;
  });

  // Merge genres
  const mergedGenres = Array.from(new Set([
    ...(vault.genres || []),
    ...(Array.isArray(clientGenres) ? clientGenres : [])
  ]));

  vault.books = finalBooks;
  vault.genres = mergedGenres;
  vault.updatedAt = new Date().toISOString();
  writeUserVault(vault);

  res.json({
    success: true,
    books: finalBooks,
    genres: mergedGenres,
    downloadedCount,
    uploadedCount,
    updatedAt: vault.updatedAt,
  });
});

// 5. Full push (overwrite cloud vault with local books list)
app.post('/api/sync/push-all', (req, res) => {
  const { userId, books, genres } = req.body;
  const targetUser = String(userId || CANONICAL_USER).trim();
  if (!Array.isArray(books)) {
    return res.status(400).json({ success: false, error: 'books array is required' });
  }
  const vault = readUserVault(targetUser);
  vault.books = books;
  if (Array.isArray(genres)) {
    vault.genres = genres;
  }
  vault.updatedAt = new Date().toISOString();
  writeUserVault(vault);
  res.json({ success: true, count: vault.books.length, updatedAt: vault.updatedAt });
});

// Setup Vite in development or serve static in production
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server is running at http://${HOST}:${PORT} [${isProd ? 'production' : 'development'}]`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
