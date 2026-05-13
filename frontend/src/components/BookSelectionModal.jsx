import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faTimes, faBookOpen, faChevronRight, faPlus, faCheck } from '@fortawesome/free-solid-svg-icons';
import useStore from '../store/useStore';

const BookSelectionModal = ({ isOpen, onClose, moduleName, onSelectBook }) => {
  const { fetchBooksByModule, createBook, theme } = useStore();
  const [books, setBooks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // New book creation states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBookName, setNewBookName] = useState('');
  const [newBookCode, setNewBookCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [creationError, setCreationError] = useState('');

  const isDark = theme === 'dark';

  useEffect(() => {
    if (isOpen && moduleName) {
      setLoading(true);
      fetchBooksByModule(moduleName)
        .then((data) => {
          setBooks(data || []);
          setSelectedIdx(0);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [isOpen, moduleName, fetchBooksByModule]);

  const handleCreateBook = async (e) => {
    e.preventDefault();
    if (!newBookName || !newBookCode) {
      setCreationError('Both name and code are required');
      return;
    }
    setSaving(true);
    setCreationError('');
    try {
      const created = await createBook({
        name: newBookName.toUpperCase(),
        code: newBookCode,
        module: moduleName
      });
      setBooks((prev) => [...prev, created]);
      setNewBookName('');
      setNewBookCode('');
      setShowAddForm(false);
    } catch (err) {
      setCreationError(err.response?.data?.message || err.message || 'Failed to create book');
    } finally {
      setSaving(false);
    }
  };

  // Handle keyboard navigation for books list
  useEffect(() => {
    if (!isOpen || books.length === 0) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((prev) => (prev + 1) % filteredBooks.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((prev) => (prev - 1 + filteredBooks.length) % filteredBooks.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredBooks[selectedIdx]) {
          onSelectBook(filteredBooks[selectedIdx]);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, books, selectedIdx, searchQuery]);

  const filteredBooks = books.filter((book) =>
    book.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Modal Box */}
        <motion.div
          initial={{ scale: 0.95, y: 15, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 15, opacity: 0 }}
          className={`relative w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border ${
            isDark 
              ? 'bg-slate-900 border-slate-700 text-white' 
              : 'bg-white border-slate-200 text-slate-800'
          }`}
        >
          {/* Title Bar */}
          <div className="bg-gradient-to-r from-[#1e3a8a] to-[#0f172a] text-white px-5 py-3.5 flex items-center justify-between border-b border-[#3b82f6]/20">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-yellow-400/10 text-yellow-400 flex items-center justify-center">
                <FontAwesomeIcon icon={faBookOpen} className="text-sm" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-yellow-300">Book Selection</h3>
                <p className="text-[10px] text-slate-300 font-semibold uppercase mt-0.5">Select a Ledger Book to Continue</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>

          {/* Search Box */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <FontAwesomeIcon icon={faSearch} className="text-xs" />
              </span>
              <input
                type="text"
                autoFocus
                placeholder="Search ledger book or code..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedIdx(0);
                }}
                className={`w-full h-10 pl-9 pr-4 text-xs font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all border ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                    : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'
                }`}
              />
            </div>
          </div>

          {/* Toggle Button for Add Book Form */}
          <div className="px-4 py-2 flex justify-between items-center bg-slate-100/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {moduleName ? `${moduleName} Books` : 'Books'}
            </span>
            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                setCreationError('');
              }}
              className="text-[10px] font-black uppercase text-sky-500 hover:text-sky-600 transition-colors flex items-center gap-1"
            >
              <FontAwesomeIcon icon={showAddForm ? faTimes : faPlus} />
              {showAddForm ? 'Cancel' : 'Add Custom Book'}
            </button>
          </div>

          {/* Inline Add Book Form */}
          <AnimatePresence>
            {showAddForm && (
              <motion.form
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                onSubmit={handleCreateBook}
                className="px-4 py-3 bg-sky-50/50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800 overflow-hidden space-y-2.5"
              >
                <p className="text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest">
                  Create New Book for {moduleName}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1">Book Name</label>
                    <input
                      type="text"
                      placeholder="e.g. GREY PURCHASE"
                      value={newBookName}
                      onChange={(e) => setNewBookName(e.target.value)}
                      className={`w-full h-8 px-2 text-[11px] font-bold rounded focus:outline-none focus:ring-1 focus:ring-sky-500 border ${
                        isDark
                          ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-600'
                          : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'
                      }`}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1">Book Code</label>
                    <input
                      type="text"
                      placeholder="e.g. 97"
                      value={newBookCode}
                      onChange={(e) => setNewBookCode(e.target.value)}
                      className={`w-full h-8 px-2 text-[11px] font-mono font-bold rounded focus:outline-none focus:ring-1 focus:ring-sky-500 border ${
                        isDark
                          ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-600'
                          : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'
                      }`}
                      required
                    />
                  </div>
                </div>

                {creationError && (
                  <p className="text-[9px] font-bold text-rose-500">{creationError}</p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className={`px-3 py-1 text-[9px] font-black uppercase rounded ${
                      isDark ? 'bg-slate-800 text-slate-350 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-3 py-1 text-[9px] font-black uppercase rounded bg-sky-500 hover:bg-sky-600 text-white flex items-center gap-1"
                  >
                    {saving ? 'Saving...' : (
                      <>
                        <FontAwesomeIcon icon={faCheck} />
                        Create Book
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Table Area */}
          <div className="max-h-[300px] overflow-y-auto">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400 font-bold uppercase tracking-wider animate-pulse">
                Loading books from backend...
              </div>
            ) : filteredBooks.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 font-bold uppercase tracking-wider">
                No ledger books found matching query
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 h-9">
                    <th className="px-5 font-black uppercase tracking-wider text-slate-400 text-[10px] w-2/3">Book</th>
                    <th className="px-5 font-black uppercase tracking-wider text-slate-400 text-[10px] text-right">Book Cd</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredBooks.map((book, idx) => {
                    const isSelected = idx === selectedIdx;
                    return (
                      <tr
                        key={book._id || idx}
                        onClick={() => setSelectedIdx(idx)}
                        onDoubleClick={() => onSelectBook(book)}
                        className={`h-11 cursor-pointer transition-all duration-150 ${
                          isSelected
                            ? 'bg-sky-500/10 text-sky-500 font-black border-l-4 border-sky-500'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                        }`}
                      >
                        <td className="px-5 font-bold uppercase text-[11px] flex items-center justify-between h-11">
                          <span>{book.name}</span>
                          {isSelected && (
                            <FontAwesomeIcon icon={faChevronRight} className="text-[10px] text-sky-500 animate-pulse" />
                          )}
                        </td>
                        <td className="px-5 text-right font-mono font-bold text-slate-600 dark:text-slate-400 text-[11px]">
                          {book.code}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer Guide */}
          <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-950/20">
            <span>Use ↑ ↓ to navigate • Enter to select</span>
            <button
              onClick={() => {
                if (filteredBooks[selectedIdx]) {
                  onSelectBook(filteredBooks[selectedIdx]);
                }
              }}
              disabled={filteredBooks.length === 0}
              className="px-4 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-md text-[10px] font-black transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              Select Book
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BookSelectionModal;
