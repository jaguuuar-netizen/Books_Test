export type BookStatus = 'reading' | 'completed';

export interface Book {
  id: string;
  title: string;
  authors: string[];
  status: BookStatus;
  rating?: number; // 1 to 10
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  pages?: number;
  readingHours?: number;
  coverUrl?: string;
  coverColor?: string; // Fallback procedural cover tint (e.g. #2C3E30, #1F2937, #7C2D12)
  genres: string[];
  notes?: string;
  series?: string;
  seriesNumber?: number;
  publisher?: string;
  publishYear?: number;
  language?: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export type ViewMode = 'shelf' | 'grid' | 'list';

export type SortField = 
  | 'endDate' 
  | 'startDate' 
  | 'title' 
  | 'author' 
  | 'rating' 
  | 'pages' 
  | 'readingHours'
  | 'createdAt';

export type SortOrder = 'asc' | 'desc';

export interface BookFilter {
  searchQuery: string;
  status: 'all' | BookStatus;
  genre: string;
  author: string;
  ratingGroup: 'all' | 'high' | 'medium' | 'low'; // high: 9-10, medium: 7-8, low: <=6
  readYear: string; // 'all' or specific year '2026'
  publishYear: string;
}

export interface AuthorStat {
  name: string;
  booksCount: number;
  completedCount: number;
  totalPages: number;
  totalHours: number;
  avgRating: number;
  books: Book[];
}

export interface GenreStat {
  name: string;
  count: number;
  totalPages: number;
  totalHours: number;
  avgRating: number;
}
