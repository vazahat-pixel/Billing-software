import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { getDefaultBooksForModule } from '../utils/defaultBooks';
import useStore from '../store/useStore';

/** Compact book picker — list + Continue only. */
const BookSelectionModal = ({ isOpen, onClose, moduleName, onSelectBook, bookFilter = null }) => {
  const { fetchBooksByModule, books: storeBooks } = useStore();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const applyFilter = (list) => {
    if (!bookFilter || typeof bookFilter !== 'function') return list || [];
    const filtered = (list || []).filter(bookFilter);
    return filtered.length > 0 ? filtered : (list || []);
  };

  useEffect(() => {
    if (isOpen && moduleName) {
      setLoading(true);
      fetchBooksByModule(moduleName)
        .then((data) => {
          const list = (data && data.length > 0)
            ? data
            : storeBooks.filter((b) => b.module === moduleName);
          setBooks(applyFilter(list));
          setSelectedIdx(0);
          setLoading(false);
        })
        .catch(() => {
          const fromStore = storeBooks.filter((b) => b.module === moduleName);
          const fallback = fromStore.length > 0 ? fromStore : getDefaultBooksForModule(moduleName);
          setBooks(applyFilter(fallback));
          setLoading(false);
        });
    }
  }, [isOpen, moduleName, fetchBooksByModule, storeBooks, bookFilter]);

  useEffect(() => {
    if (!isOpen || books.length === 0) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((prev) => (prev + 1) % books.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((prev) => (prev - 1 + books.length) % books.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (books[selectedIdx]) onSelectBook(books[selectedIdx]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, books, selectedIdx, onSelectBook, onClose]);

  if (!isOpen) return null;

  const handleContinue = () => {
    if (books[selectedIdx]) onSelectBook(books[selectedIdx]);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-4" data-book-selection-modal>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/50"
        />

        <motion.div
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.98, opacity: 0 }}
          className="relative w-full max-w-sm bg-white rounded-lg shadow-xl overflow-hidden border border-slate-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 flex items-center justify-between border-b border-slate-200 bg-slate-50">
            <span className="text-[13px] font-bold text-slate-800">Select Book</span>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>

          <div className="max-h-[240px] overflow-y-auto">
            {loading ? (
              <div className="py-6 text-center text-[11px] text-slate-400">Loading…</div>
            ) : books.length === 0 ? (
              <div className="py-6 text-center text-[11px] text-slate-400">No books found</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-3 py-1.5 text-[10px] font-semibold uppercase text-slate-400">Book</th>
                    <th className="px-3 py-1.5 text-[10px] font-semibold uppercase text-slate-400 text-right w-16">Cd</th>
                  </tr>
                </thead>
                <tbody>
                  {books.map((book, idx) => {
                    const isSelected = idx === selectedIdx;
                    return (
                      <tr
                        key={book._id || idx}
                        onClick={() => setSelectedIdx(idx)}
                        onDoubleClick={handleContinue}
                        className={`cursor-pointer border-b border-slate-50 ${
                          isSelected ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-3 py-2 text-[12px] font-medium">
                          <span className="flex items-center justify-between gap-2">
                            {book.name}
                            {isSelected ? <FontAwesomeIcon icon={faChevronRight} className="text-[10px]" /> : null}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[11px] text-slate-500">{book.code}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="px-3 py-2 border-t border-slate-200 flex justify-end bg-slate-50">
            <button
              type="button"
              onClick={handleContinue}
              disabled={books.length === 0}
              className="px-4 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded text-[12px] font-semibold disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BookSelectionModal;
