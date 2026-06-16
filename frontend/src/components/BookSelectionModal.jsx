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
          className="relative w-full max-w-lg bg-white rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden border border-slate-200"
        >
          {/* Title Bar - Matching Reference */}
          <div className="px-6 py-5 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-base)]">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ background: 'var(--accent-gradient)', color: 'white' }}>
                <FontAwesomeIcon icon={faBookOpen} className="text-lg" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)] leading-none">Book Selection</h3>
                <p className="text-[11px] text-[var(--text-muted)] font-medium mt-1 uppercase tracking-wider">Select a Ledger Book to Continue</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-2 rounded-lg hover:bg-[var(--bg-card)]"
            >
              <FontAwesomeIcon icon={faTimes} size="lg" />
            </button>
          </div>

          {/* Search Box - Blue Ring style */}
          <div className="p-6 pb-2">
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-500 transition-colors">
                <FontAwesomeIcon icon={faSearch} className="text-sm" />
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
                className="w-full h-12 pl-11 pr-4 text-[13px] font-bold rounded-xl focus:outline-none ring-2 ring-slate-100 focus:ring-black transition-all border-none bg-slate-50 placeholder-slate-400"
              />
            </div>
          </div>

          {/* Toggle Button for Add Book Form */}
          <div className="px-6 py-4 flex justify-between items-center bg-slate-50/50 border-b border-slate-100">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
              {moduleName ? `${moduleName} Books` : 'Ledger Books'}
            </span>
            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                setCreationError('');
              }}
              className="text-[10px] font-black uppercase text-black hover:bg-slate-100 transition-colors flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-md shadow-sm"
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
                className="px-6 py-4 bg-slate-50/80 border-b border-slate-100 overflow-hidden space-y-3"
              >
                <p className="text-[10px] font-black text-black uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-black rounded-full" />
                  Create New Book for {moduleName}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">Book Name</label>
                    <input
                      type="text"
                      placeholder="e.g. GREY PURCHASE"
                      value={newBookName}
                      onChange={(e) => setNewBookName(e.target.value)}
                      className="w-full h-10 px-3 text-[12px] font-bold rounded-lg focus:outline-none ring-1 ring-slate-200 focus:ring-black border-none bg-white placeholder-slate-300 transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">Book Code</label>
                    <input
                      type="text"
                      placeholder="e.g. 97"
                      value={newBookCode}
                      onChange={(e) => setNewBookCode(e.target.value)}
                      className="w-full h-10 px-3 text-[12px] font-mono font-bold rounded-lg focus:outline-none ring-1 ring-slate-200 focus:ring-black border-none bg-white placeholder-slate-300 transition-all"
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
                    className="px-3 py-1 text-[9px] font-black uppercase rounded bg-black hover:bg-slate-800 text-white flex items-center gap-1"
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
              <div className="py-12 text-center text-[11px] text-slate-400 font-black uppercase tracking-widest animate-pulse">
                Fetching ledger books...
              </div>
            ) : filteredBooks.length === 0 ? (
              <div className="py-12 text-center text-[11px] text-slate-400 font-black uppercase tracking-widest">
                No matching ledger books found
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 h-10">
                    <th className="px-6 font-black uppercase tracking-widest text-slate-400 text-[10px] w-3/4">Book</th>
                    <th className="px-6 font-black uppercase tracking-widest text-slate-400 text-[10px] text-right">Book Cd</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredBooks.map((book, idx) => {
                    const isSelected = idx === selectedIdx;
                    return (
                      <tr
                        key={book._id || idx}
                        onClick={() => setSelectedIdx(idx)}
                        onDoubleClick={() => onSelectBook(book)}
                        className={`h-14 cursor-pointer transition-all duration-150 relative ${
                          isSelected
                            ? 'bg-slate-100 text-black font-black'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <td className="px-6 text-[13px] font-bold uppercase tracking-tight">
                           <div className="flex items-center justify-between">
                              <span>{book.name}</span>
                              {isSelected && (
                                 <FontAwesomeIcon icon={faChevronRight} className="text-black mr-4" />
                              )}
                           </div>
                           {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-black" />}
                        </td>
                        <td className="px-6 text-right font-mono font-black text-slate-500 text-[13px]">
                          {book.code}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer Guide - Matching Reference */}
          <div className="p-6 border-t border-slate-100 flex justify-between items-center bg-white">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Use ↑ ↓ to navigate • Enter to select
            </span>
            <button
              onClick={() => {
                if (filteredBooks[selectedIdx]) {
                  onSelectBook(filteredBooks[selectedIdx]);
                }
              }}
              disabled={filteredBooks.length === 0}
              className="px-6 py-2.5 bg-black hover:bg-slate-800 text-white rounded-lg text-[12px] font-black uppercase tracking-wider transition-all shadow-[0_4px_15px_rgba(0,0,0,0.2)] active:scale-95 disabled:opacity-50"
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
