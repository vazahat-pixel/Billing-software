import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faTimes, faBook, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import useStore from '../../store/useStore';
import Modal from '../../components/ui/Modal';

const BookMasterModal = ({ isOpen, onClose }) => {
  const { fetchBooksByModule, createBook, deleteBook } = useStore();
  
  const modules = [
    { key: 'sales', label: 'Sales Billing' },
    { key: 'purchase', label: 'Purchase Billing' },
    { key: 'receipt', label: 'Bank/Cash Receipt' },
    { key: 'payment', label: 'Bank/Cash Payment' },
    { key: 'millIssue', label: 'Mill Issue (Grey)' },
    { key: 'millRec', label: 'Mill Receive (Finished)' },
    { key: 'jobIssue', label: 'Job Work Issue' },
    { key: 'jobRec', label: 'Job Work Receive' },
    { key: 'ledger', label: 'General Ledger' }
  ];

  const [selectedModule, setSelectedModule] = useState('sales');
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [newBookName, setNewBookName] = useState('');
  const [newBookCode, setNewBookCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadBooks = async () => {
    setLoading(true);
    try {
      const data = await fetchBooksByModule(selectedModule);
      setBooks(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadBooks();
    }
  }, [isOpen, selectedModule]);

  const handleCreateBook = async (e) => {
    e.preventDefault();
    if (!newBookName || !newBookCode) {
      setError('Both Name and Code are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const created = await createBook({
        name: newBookName.toUpperCase(),
        code: newBookCode,
        module: selectedModule
      });
      setBooks((prev) => [...prev, created]);
      setNewBookName('');
      setNewBookCode('');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to create book');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBook = async (bookId) => {
    if (window.confirm('Are you sure you want to delete this custom book?')) {
      try {
        await deleteBook(bookId);
        setBooks((prev) => prev.filter((b) => b._id !== bookId));
      } catch (err) {
        alert(err.response?.data?.message || err.message || 'Failed to delete book');
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Book Master Configuration" className="max-w-4xl">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-2">
        {/* Left column: Module selector */}
        <div className="md:col-span-4 border-r border-slate-100 pr-4 space-y-2">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Select Module</h4>
          <div className="flex flex-col gap-1">
            {modules.map((m) => {
              const isSelected = selectedModule === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => {
                    setSelectedModule(m.key);
                    setError('');
                    setNewBookName('');
                    setNewBookCode('');
                  }}
                  className={`w-full text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest rounded-xl transition-all flex justify-between items-center ${
                    isSelected
                      ? 'bg-black text-white'
                      : 'hover:bg-slate-50 text-slate-600 hover:text-black'
                  }`}
                >
                  <span>{m.label}</span>
                  {isSelected && <FontAwesomeIcon icon={faChevronRight} className="text-[10px]" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right column: Books list and Add form */}
        <div className="md:col-span-8 flex flex-col space-y-6">
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <h4 className="text-[11px] font-black text-black uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-black rounded-full" />
              Add Custom Book to {modules.find((m) => m.key === selectedModule)?.label}
            </h4>
            <form onSubmit={handleCreateBook} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="sm:col-span-2">
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">Book Name</label>
                <input
                  type="text"
                  placeholder="e.g. SPECIAL GREY SALES"
                  value={newBookName}
                  onChange={(e) => setNewBookName(e.target.value)}
                  className="w-full h-10 px-3 text-[12px] font-bold rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-black placeholder-slate-300 transition-all bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">Book Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 102"
                    value={newBookCode}
                    onChange={(e) => setNewBookCode(e.target.value)}
                    className="w-full h-10 px-3 text-[12px] font-mono font-bold rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-black placeholder-slate-300 transition-all bg-white"
                    required
                  />
                  <button
                    type="submit"
                    disabled={saving}
                    className="h-10 px-4 bg-black hover:bg-slate-800 text-white rounded-lg text-[12px] font-bold uppercase transition-all shadow-md active:scale-95 disabled:opacity-50"
                  >
                    {saving ? '...' : <FontAwesomeIcon icon={faPlus} />}
                  </button>
                </div>
              </div>
            </form>
            {error && <p className="text-[10px] font-bold text-rose-500 mt-2 uppercase tracking-wide">{error}</p>}
          </div>

          <div className="flex-1">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Available Books</h4>
            {loading ? (
              <div className="py-12 text-center text-[11px] text-slate-400 font-bold uppercase tracking-widest animate-pulse">
                Loading books...
              </div>
            ) : books.length === 0 ? (
              <div className="py-12 text-center text-[11px] text-slate-400 font-bold uppercase tracking-widest">
                No books found for this module.
              </div>
            ) : (
              <div className="border border-slate-100 rounded-2xl overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                     <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                       <th className="px-6 py-3">Book Name</th>
                       <th className="px-6 py-3">Code</th>
                       <th className="px-6 py-3 text-center">Type</th>
                       <th className="px-6 py-3 text-right">Action</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {books.map((b) => {
                      const isSystem = !b.companyId;
                      return (
                        <tr key={b._id || b.name} className="hover:bg-slate-50/50 transition-all">
                          <td className="px-6 py-4 text-[12px] font-bold uppercase tracking-tight text-slate-800">
                            {b.name}
                          </td>
                          <td className="px-6 py-4 font-mono text-[12px] font-bold text-slate-500">
                            {b.code}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2.5 py-0.5 text-[8px] font-bold uppercase rounded ${
                              isSystem ? 'bg-slate-100 text-slate-400' : 'bg-black text-white font-black'
                            }`}>
                              {isSystem ? 'System' : 'Custom'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {!isSystem ? (
                              <button
                                onClick={() => handleDeleteBook(b._id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all"
                              >
                                <FontAwesomeIcon icon={faTrash} size="sm" />
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-300 italic font-medium">Locked</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default BookMasterModal;
