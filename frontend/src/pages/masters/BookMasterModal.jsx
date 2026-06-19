import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';
import Modal from '../../components/ui/Modal';

const BookMasterModal = ({ isOpen, onClose, readOnly = false }) => {
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
  const [selectedBookId, setSelectedBookId] = useState('');
  const [mode, setMode] = useState('View'); // 'View', 'Add'
  const [error, setError] = useState('');

  // Book fields matching PDF Page 3
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    bookType: 'SALES BOOK',
    groupHead: 'TRADING INCOME',
    opBalance: 0,
    retailTax: '',
    detailJobWork: 'D',
    rowFinishMaterial: 'F',
    incExcVat: '',
    effectOnStock: 'N',
    address1: '',
    address2: '',
    dist: '',
    state: '',
    head1: 'Pcs',
    head2: 'Qty',
    createDate: new Date().toISOString().split('T')[0],
    jobWorkBook: false,
    tdsHead: '',
    tdsCode: 0
  });

  const locked = readOnly || mode === 'View';

  const loadBooks = async () => {
    setLoading(true);
    try {
      const data = await fetchBooksByModule(selectedModule);
      setBooks(data || []);
      if (data && data.length > 0) {
        setSelectedBookId(data[0]._id || data[0].id);
        setFormData({ ...formData, ...data[0] });
      } else {
        setSelectedBookId('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadBooks();
      if (!readOnly) setMode('Add');
    }
  }, [isOpen, selectedModule, readOnly]);

  const handleSelectBook = (e) => {
    const id = e.target.value;
    setSelectedBookId(id);
    if (id) {
      const book = books.find(b => b._id === id || b.id === id);
      if (book) {
        setFormData({ ...formData, ...book });
        setMode('View');
      }
    }
  };

  const handleNew = () => {
    setFormData({
      code: '',
      name: '',
      bookType: selectedModule === 'sales' ? 'SALES BOOK' : selectedModule === 'purchase' ? 'PURCHASE BOOK' : 'GENERAL BOOK',
      groupHead: selectedModule === 'sales' ? 'TRADING INCOME' : 'TRADING EXPENSE',
      opBalance: 0,
      retailTax: '',
      detailJobWork: 'D',
      rowFinishMaterial: 'F',
      incExcVat: '',
      effectOnStock: 'N',
      address1: '',
      address2: '',
      dist: '',
      state: '',
      head1: 'Pcs',
      head2: 'Qty',
      createDate: new Date().toISOString().split('T')[0],
      jobWorkBook: false,
      tdsHead: '',
      tdsCode: 0
    });
    setMode('Add');
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!formData.name || !formData.code) {
      setError('Name and Code are required');
      return;
    }
    setError('');
    try {
      const created = await createBook({
        ...formData,
        name: formData.name.toUpperCase(),
        module: selectedModule
      });
      alert('Book saved successfully!');
      setMode('View');
      loadBooks();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save book');
    }
  };

  const handleDelete = async () => {
    if (!selectedBookId) return alert('Select a book first');
    const book = books.find(b => b._id === selectedBookId || b.id === selectedBookId);
    if (!book.companyId) {
      return alert('Cannot delete system default books');
    }
    if (window.confirm('Are you sure you want to delete this custom book?')) {
      try {
        await deleteBook(selectedBookId);
        alert('Book deleted!');
        loadBooks();
      } catch (err) {
        alert(err.response?.data?.message || err.message || 'Failed to delete');
      }
    }
  };

  const handleCancel = () => {
    if (selectedBookId) {
      const book = books.find(b => b._id === selectedBookId || b.id === selectedBookId);
      if (book) setFormData({ ...formData, ...book });
    }
    setMode('View');
    setError('');
  };

  const setField = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [key]: val });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} bare className="max-w-5xl">
      <div className="classic-erp-window flex flex-col h-full">
        {/* Title bar */}
        <div className="classic-erp-header">
          <span>Book Master</span>
          <button className="classic-erp-close-btn" onClick={onClose}>X</button>
        </div>

        {/* Outer Split Pane Layout */}
        <div className="grid grid-cols-12 gap-3 classic-erp-body flex-1 overflow-y-auto">
          
          {/* Left Panel: Module Selector */}
          <div className="col-span-3 classic-erp-frame flex flex-col gap-1 p-2">
            <span className="classic-erp-label blue-label mb-2 uppercase font-bold text-center">Module</span>
            {modules.map((m) => (
              <button
                key={m.key}
                onClick={() => {
                  setSelectedModule(m.key);
                  setMode('View');
                }}
                className={`classic-erp-btn text-left justify-start w-full ${selectedModule === m.key ? 'btn-blue' : ''}`}
                style={selectedModule === m.key ? { borderStyle: 'inset', backgroundColor: '#e4e0d8' } : {}}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Right Panel: Detail Fields */}
          <div className="col-span-9 flex flex-col gap-3">
            
            {/* View Selection Mode */}
            {mode === 'View' && (
              <div className="classic-erp-frame flex gap-3 items-center">
                <span className="classic-erp-label blue-label">Select Book:</span>
                <select className="classic-erp-input flex-1" value={selectedBookId} onChange={handleSelectBook}>
                  <option value="">- Select Book to View -</option>
                  {books.map(b => (
                    <option key={b._id || b.id} value={b._id || b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="classic-erp-frame grid grid-cols-12 gap-2">
              <div className="col-span-4 flex gap-2">
                <span className="classic-erp-label red-label w-20">Book Id:</span>
                <input type="text" className="classic-erp-input w-24" value={formData.code} onChange={setField('code')} disabled={locked} placeholder="e.g. F00000" />
              </div>
              <div className="col-span-8 flex gap-2">
                <span className="classic-erp-label red-label w-24">Book Name:</span>
                <input type="text" className="classic-erp-input flex-1" value={formData.name} onChange={setField('name')} disabled={locked} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Box 1: Core Parameters */}
              <div className="classic-erp-frame space-y-2">
                <div className="flex gap-2">
                  <span className="classic-erp-label w-32">Book Type:</span>
                  <select className="classic-erp-select flex-1" value={formData.bookType} onChange={setField('bookType')} disabled={locked}>
                    <option value="SALES BOOK">SALES BOOK</option>
                    <option value="PURCHASE BOOK">PURCHASE BOOK</option>
                    <option value="CASH BOOK">CASH BOOK</option>
                    <option value="BANK BOOK">BANK BOOK</option>
                    <option value="GENERAL LEDGER">GENERAL LEDGER</option>
                    <option value="JOB WORK BOOK">JOB WORK BOOK</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <span className="classic-erp-label w-32">Group Head:</span>
                  <select className="classic-erp-select flex-1" value={formData.groupHead} onChange={setField('groupHead')} disabled={locked}>
                    <option value="TRADING INCOME">TRADING INCOME</option>
                    <option value="TRADING EXPENSE">TRADING EXPENSE</option>
                    <option value="INDIRECT INCOME">INDIRECT INCOME</option>
                    <option value="INDIRECT EXPENSE">INDIRECT EXPENSE</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <span className="classic-erp-label w-32">Op. Balance:</span>
                  <input type="number" className="classic-erp-input flex-1 text-right" value={formData.opBalance} onChange={setField('opBalance')} disabled={locked} />
                </div>

                <div className="flex gap-2">
                  <span className="classic-erp-label w-32">Retail / Tax [R/T]:</span>
                  <input type="text" className="classic-erp-input w-16 text-center" value={formData.retailTax} onChange={setField('retailTax')} disabled={locked} />
                </div>

                <div className="flex gap-2">
                  <span className="classic-erp-label w-32">Detail/JobWork [D/J]:</span>
                  <input type="text" className="classic-erp-input w-16 text-center" value={formData.detailJobWork} onChange={setField('detailJobWork')} disabled={locked} />
                </div>

                <div className="flex gap-2">
                  <span className="classic-erp-label w-32">Row/Finish Mat [R/F]:</span>
                  <input type="text" className="classic-erp-input w-16 text-center" value={formData.rowFinishMaterial} onChange={setField('rowFinishMaterial')} disabled={locked} />
                </div>

                <div className="flex gap-2">
                  <span className="classic-erp-label w-32">Incl/Excl Vat [I/E]:</span>
                  <input type="text" className="classic-erp-input w-16 text-center" value={formData.incExcVat} onChange={setField('incExcVat')} disabled={locked} />
                </div>

                <div className="flex gap-2">
                  <span className="classic-erp-label w-32">Effect On Stock Y/N:</span>
                  <input type="text" className="classic-erp-input w-16 text-center" value={formData.effectOnStock} onChange={setField('effectOnStock')} disabled={locked} />
                </div>
              </div>

              {/* Box 2: Address & TDS Setup */}
              <div className="classic-erp-frame space-y-2">
                <div className="flex gap-2">
                  <span className="classic-erp-label w-24">Address 1:</span>
                  <input type="text" className="classic-erp-input flex-1" value={formData.address1} onChange={setField('address1')} disabled={locked} />
                </div>
                <div className="flex gap-2">
                  <span className="classic-erp-label w-24">Address 2:</span>
                  <input type="text" className="classic-erp-input flex-1" value={formData.address2} onChange={setField('address2')} disabled={locked} />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex gap-2">
                    <span className="classic-erp-label w-12">Dist:</span>
                    <input type="text" className="classic-erp-input flex-1" value={formData.dist} onChange={setField('dist')} disabled={locked} />
                  </div>
                  <div className="flex gap-2">
                    <span className="classic-erp-label w-12">State:</span>
                    <input type="text" className="classic-erp-input flex-1" value={formData.state} onChange={setField('state')} disabled={locked} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex gap-2">
                    <span className="classic-erp-label w-16">Head[1]:</span>
                    <input type="text" className="classic-erp-input flex-1" value={formData.head1} onChange={setField('head1')} disabled={locked} />
                  </div>
                  <div className="flex gap-2">
                    <span className="classic-erp-label w-16">Head[2]:</span>
                    <input type="text" className="classic-erp-input flex-1" value={formData.head2} onChange={setField('head2')} disabled={locked} />
                  </div>
                </div>

                <div className="flex gap-2">
                  <span className="classic-erp-label w-24">CreateDate:</span>
                  <input type="date" className="classic-erp-input flex-1" value={formData.createDate} onChange={setField('createDate')} disabled={locked} />
                </div>

                <div className="flex gap-2 items-center">
                  <span className="classic-erp-label w-24">JobWork Book:</span>
                  <input type="checkbox" checked={formData.jobWorkBook} onChange={setField('jobWorkBook')} disabled={locked} />
                </div>

                <div className="flex gap-2">
                  <span className="classic-erp-label w-24">Tds Head:</span>
                  <input type="text" className="classic-erp-input flex-1" value={formData.tdsHead} onChange={setField('tdsHead')} disabled={locked} />
                </div>
                <div className="flex gap-2">
                  <span className="classic-erp-label w-24">Tds Code:</span>
                  <input type="number" className="classic-erp-input flex-1" value={formData.tdsCode} onChange={setField('tdsCode')} disabled={locked} />
                </div>
              </div>
            </div>

            {error && <p className="text-red-600 font-bold text-xs uppercase tracking-wide">{error}</p>}
          </div>
        </div>

        {/* Action Button Bar */}
        <div className="classic-erp-form-footer">
          <button className="classic-erp-btn" type="button" onClick={handleNew} disabled={readOnly || mode !== 'View'}>New</button>
          <button className="classic-erp-btn btn-blue" type="button" onClick={handleSave} disabled={locked}>Save</button>
          <button className="classic-erp-btn" type="button" onClick={handleCancel} disabled={locked}>Cancel</button>
          <button className="classic-erp-btn btn-red" type="button" onClick={handleDelete} disabled={readOnly || locked || !selectedBookId}>Delete</button>
          <button className="classic-erp-btn" type="button" onClick={onClose}>Exit</button>
        </div>
      </div>
    </Modal>
  );
};

export default BookMasterModal;
