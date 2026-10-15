import React, { useState } from 'react';
import { Book } from '../../types/book';
import { Plus, Edit2, Trash2, Check, X, Tag, BookOpen } from 'lucide-react';

interface GenresViewProps {
  genres: string[];
  books: Book[];
  onAddGenre: (name: string) => void;
  onEditGenre: (oldName: string, newName: string) => void;
  onDeleteGenre: (name: string) => void;
  onSelectGenre: (genre: string) => void;
}

export const GenresView: React.FC<GenresViewProps> = ({
  genres,
  books,
  onAddGenre,
  onEditGenre,
  onDeleteGenre,
  onSelectGenre,
}) => {
  const [newGenreName, setNewGenreName] = useState('');
  const [editingGenre, setEditingGenre] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [genreToDelete, setGenreToDelete] = useState<string | null>(null);

  // Calculate book count per genre
  const getBookCount = (genreName: string) => {
    return books.filter((b) => b.genres.includes(genreName)).length;
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newGenreName.trim() && !genres.includes(newGenreName.trim())) {
      onAddGenre(newGenreName.trim());
      setNewGenreName('');
    }
  };

  const handleStartEdit = (name: string) => {
    setEditingGenre(name);
    setEditValue(name);
  };

  const handleSaveEdit = (oldName: string) => {
    if (editValue.trim() && editValue.trim() !== oldName) {
      onEditGenre(oldName, editValue.trim());
    }
    setEditingGenre(null);
  };

  const confirmDelete = () => {
    if (genreToDelete) {
      onDeleteGenre(genreToDelete);
      setGenreToDelete(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="pb-4 border-b border-[#E8E2D8] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-[#24211D]">
            Справочник жанров
          </h1>
          <p className="mt-1 text-sm text-[#6B6357]">
            Управляйте списком литературных жанров, редактируйте названия и просматривайте книги
          </p>
        </div>

        {/* Add Genre Form */}
        <form onSubmit={handleAdd} className="flex items-center gap-2">
          <input
            type="text"
            value={newGenreName}
            onChange={(e) => setNewGenreName(e.target.value)}
            placeholder="Новый жанр..."
            className="bg-[#FAF8F5] border border-[#DDD5C7] rounded px-3 py-1.5 text-xs text-[#24211D] focus:outline-none focus:border-[#24211D]"
          />
          <button
            type="submit"
            disabled={!newGenreName.trim()}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#24211D] hover:bg-[#3B342C] rounded transition-colors disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Добавить</span>
          </button>
        </form>
      </div>

      {/* Genres Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {genres.map((g) => {
          const count = getBookCount(g);
          const isEditing = editingGenre === g;

          return (
            <div
              key={g}
              className="bg-[#FAF8F5] border border-[#E8E2D8] hover:border-[#D1C7B7] rounded-md p-3.5 flex items-center justify-between gap-3 transition-colors"
            >
              {isEditing ? (
                <div className="flex items-center gap-1.5 flex-1">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="flex-1 bg-[#FAF8F5] border border-[#24211D] rounded px-2 py-1 text-xs text-[#24211D] focus:outline-none"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(g);
                      if (e.key === 'Escape') setEditingGenre(null);
                    }}
                  />
                  <button
                    onClick={() => handleSaveEdit(g)}
                    className="p-1 text-[#273B30] hover:bg-[#E9EFE9] rounded"
                    title="Сохранить"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingGenre(null)}
                    className="p-1 text-[#7A7265] hover:bg-[#EAE4DC] rounded"
                    title="Отмена"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div
                    onClick={() => onSelectGenre(g)}
                    className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
                    title="Показать книги этого жанра в библиотеке"
                  >
                    <Tag className="w-4 h-4 text-[#8A8172] shrink-0" />
                    <span className="font-medium text-xs text-[#24211D] truncate">
                      {g}
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-[#8A8172] bg-[#EFE9DF] px-2 py-0.5 rounded-sm shrink-0">
                      {count}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleStartEdit(g)}
                      className="p-1 text-[#7A7265] hover:text-[#24211D] hover:bg-[#EFE9DF] rounded transition-colors"
                      title="Переименовать"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setGenreToDelete(g)}
                      className="p-1 text-[#7A7265] hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                      title="Удалить жанр"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {genreToDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-md p-5 max-w-sm w-full text-center shadow-lg space-y-4">
            <h4 className="font-display font-semibold text-base text-[#24211D]">
              Удалить жанр «{genreToDelete}»?
            </h4>
            <p className="text-xs text-[#6B6357]">
              {getBookCount(genreToDelete) > 0
                ? `В вашей библиотеке ${getBookCount(genreToDelete)} книг содержат этот жанр. Он будет удалён из справочника и из этих книг.`
                : 'Жанр будет удалён из списка доступных жанров.'}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setGenreToDelete(null)}
                className="px-3.5 py-1.5 text-xs text-[#6B6357] hover:text-[#24211D]"
              >
                Отмена
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-1.5 text-xs font-medium text-white bg-rose-700 hover:bg-rose-800 rounded transition-colors"
              >
                Удалить жанр
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
