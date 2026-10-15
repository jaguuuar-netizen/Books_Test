export interface SearchBookResult {
  id: string;
  title: string;
  authors: string[];
  publishYear?: number;
  publisher?: string;
  pages?: number;
  coverUrl?: string;
  genres?: string[];
  source: 'openlibrary' | 'googlebooks';
}

export async function searchBooksOnline(query: string): Promise<SearchBookResult[]> {
  if (!query || query.trim().length < 2) return [];

  const cleanQuery = query.trim();
  const results: SearchBookResult[] = [];

  // Try Open Library first
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const openLibUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(cleanQuery)}&limit=10`;
    const res = await fetch(openLibUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.docs && Array.isArray(data.docs)) {
        for (const doc of data.docs) {
          const coverId = doc.cover_i;
          const coverUrl = coverId 
            ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` 
            : undefined;

          results.push({
            id: doc.key || `ol-${Math.random()}`,
            title: doc.title || 'Без названия',
            authors: doc.author_name && Array.isArray(doc.author_name) 
              ? doc.author_name.slice(0, 3) 
              : ['Неизвестный автор'],
            publishYear: doc.first_publish_year || (doc.publish_year ? doc.publish_year[0] : undefined),
            publisher: doc.publisher && doc.publisher[0] ? doc.publisher[0] : undefined,
            pages: doc.number_of_pages_median || doc.number_of_pages || undefined,
            coverUrl,
            genres: doc.subject ? doc.subject.slice(0, 3) : [],
            source: 'openlibrary',
          });
        }
      }
    }
  } catch (err) {
    console.warn('Open Library search failed or timed out:', err);
  }

  // If few or no results, try Google Books API
  if (results.length < 5) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const gbUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(cleanQuery)}&maxResults=6`;
      const res = await fetch(gbUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.items && Array.isArray(data.items)) {
          for (const item of data.items) {
            const info = item.volumeInfo || {};
            // Convert http image to https to prevent mixed-content
            let coverUrl = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail;
            if (coverUrl && coverUrl.startsWith('http://')) {
              coverUrl = coverUrl.replace('http://', 'https://');
            }

            let year: number | undefined;
            if (info.publishedDate) {
              const match = info.publishedDate.match(/^\d{4}/);
              if (match) year = parseInt(match[0], 10);
            }

            results.push({
              id: item.id || `gb-${Math.random()}`,
              title: info.title || 'Без названия',
              authors: info.authors || ['Неизвестный автор'],
              publishYear: year,
              publisher: info.publisher,
              pages: info.pageCount,
              coverUrl,
              genres: info.categories ? info.categories.slice(0, 3) : [],
              source: 'googlebooks',
            });
          }
        }
      }
    } catch (err) {
      console.warn('Google Books search failed:', err);
    }
  }

  // Deduplicate results by title + author
  const seen = new Set<string>();
  const uniqueResults: SearchBookResult[] = [];
  for (const item of results) {
    const key = `${item.title.toLowerCase().trim()}::${(item.authors[0] || '').toLowerCase().trim()}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueResults.push(item);
    }
  }

  return uniqueResults;
}
