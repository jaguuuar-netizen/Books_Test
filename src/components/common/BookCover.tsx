import React, { useState } from 'react';
import { Book } from '../../types/book';

interface BookCoverProps {
  book: Book;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showSpineCrease?: boolean;
}

const PRESET_COLORS = [
  '#273B30', // Deep Pine / Forest
  '#1C2A3A', // Midnight Navy
  '#3C241E', // Warm Walnut
  '#542323', // Burgundy Wine
  '#3E3547', // Muted Plum
  '#2C3539', // Slate Charcoal
  '#7A4B1A', // Burnished Amber
  '#34444C', // Deep Teal
];

function getDeterministicColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PRESET_COLORS.length;
  return PRESET_COLORS[index];
}

export const BookCover: React.FC<BookCoverProps> = ({
  book,
  size = 'md',
  className = '',
  showSpineCrease = true,
}) => {
  const [imageFailed, setImageFailed] = useState(false);

  // Size dimensions (standard ~1:1.45 or 3:4 book ratio)
  const sizeStyles = {
    sm: 'w-10 h-14 text-[9px]',
    md: 'w-24 h-36 sm:w-28 sm:h-40 text-[11px]',
    lg: 'w-36 h-52 sm:w-44 sm:h-64 text-xs',
    xl: 'w-52 h-72 sm:w-64 sm:h-92 text-sm',
  };

  const hasValidImage = Boolean(book.coverUrl && !imageFailed);
  const bgColor = book.coverColor || getDeterministicColor(book.title || 'book');

  return (
    <div
      className={`relative select-none overflow-hidden rounded-[3px] shrink-0 book-shadow transition-transform duration-200 group-hover:-translate-y-1 ${sizeStyles[size]} ${className}`}
      style={{ backgroundColor: bgColor }}
    >
      {hasValidImage ? (
        <img
          src={book.coverUrl}
          alt={`Обложка книги ${book.title}`}
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          className="w-full h-full object-cover rounded-[2px]"
          loading="lazy"
        />
      ) : (
        /* Procedural Book Cover Fallback with Cloth/Linen Texture & Gold Embossing */
        <div
          className="w-full h-full p-2 sm:p-2.5 flex flex-col justify-between text-amber-100 relative overflow-hidden"
          style={{
            backgroundColor: bgColor,
            backgroundImage: `radial-gradient(circle at 50% 30%, rgba(255,255,255,0.12) 0%, rgba(0,0,0,0.3) 100%)`,
          }}
        >
          {/* Subtle gold decorative border */}
          <div className="absolute inset-1 sm:inset-1.5 border border-amber-300/30 rounded-[1px] pointer-events-none" />

          {/* Book Spine crease effect */}
          {showSpineCrease && <div className="book-spine-crease" />}

          {/* Header ornament */}
          <div className="relative z-10 text-center pt-1">
            <div className="inline-block px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-amber-200/70 truncate max-w-full font-sans">
              {book.genres?.[0] || 'My Book Shelf'}
            </div>
            <div className="w-6 h-[1px] bg-amber-300/40 mx-auto mt-0.5" />
          </div>

          {/* Title & Author */}
          <div className="relative z-10 text-center my-auto px-1">
            <h4
              className="font-serif font-semibold leading-tight text-amber-50 line-clamp-3"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
            >
              {book.title}
            </h4>
            <p className="mt-1 text-amber-200/80 font-sans text-[10px] sm:text-xs truncate">
              {book.authors?.join(', ') || 'Автор'}
            </p>
          </div>

          {/* Footer ornament */}
          <div className="relative z-10 text-center pb-1">
            <div className="w-4 h-[1px] bg-amber-300/30 mx-auto mb-0.5" />
            <span className="text-[8px] font-mono text-amber-200/60 tabular-nums">
              {book.pages ? `${book.pages} стр.` : (book.publishYear ? `${book.publishYear} г.` : '•')}
            </span>
          </div>
        </div>
      )}

      {/* Book Spine crease overlay for images too */}
      {showSpineCrease && (
        <div className="book-spine-crease" aria-hidden="true" />
      )}

      {/* Soft gloss highlight on right page edge */}
      <div
        className="absolute top-0 right-0 bottom-0 w-[2px] bg-white/20 pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
};
