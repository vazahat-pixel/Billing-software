import React, { useState, useEffect, useMemo } from 'react';
import useStore from '../../store/useStore';
import Modal from '../../components/ui/Modal';
import { ERPSelect } from '../../components/forms/FormElements';
import { notifySuccess, notifyError, notifyWarning } from '../../utils/notify';
import { erpConfirm } from '../../utils/confirm';
import { normalizeGstStateCode, stateNameFromCode } from '../../utils/gstStateCodes';
import { ErpBusyOverlay, SaveButtonLabel, InlineLoader } from '../../components/ui/loaders';

const emptyForm = (module = 'sales') => ({
  code: '',
  name: '',
  bookType: module === 'sales' ? 'SALES BOOK' : module === 'purchase' ? 'PURCHASE BOOK' : module === 'receipt' || module === 'payment' ? 'CASH/BANK BOOK' : 'GENERAL BOOK',
  groupHead: module === 'sales' ? 'TRADING INCOME' : module === 'receipt' || module === 'payment' ? 'BANK BALANCE' : 'TRADING EXPENSE',
  opBalance: 0,
  opBalanceType: 'DR',
  accountNo: '',
  gstinNo: '',
  stateCode: '0',
  stateName: '',
  gstType: '',
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
  notes: '',
  jobWorkBook: false,
  tdsHead: '',
  tdsCode: 0,
});

const toFormDate = (v) => {
  if (!v) return new Date().toISOString().split('T')[0];
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
  return d.toISOString().split('T')[0];
};

const MODULES = [
  { key: 'sales', label: 'Sales Billing' },
  { key: 'purchase', label: 'Purchase Billing' },
  { key: 'receipt', label: 'Bank/Cash Receipt' },
  { key: 'payment', label: 'Bank/Cash Payment' },
  { key: 'millIssue', label: 'Mill Issue (Grey)' },
  { key: 'millRec', label: 'Mill Receive (Finished)' },
  { key: 'jobIssue', label: 'Job Work Issue' },
  { key: 'jobRec', label: 'Job Work Receive' },
  { key: 'ledger', label: 'General Ledger' },
];

const FlagCell = ({ label, value, onChange, locked, title }) => (
  <div className="bm-flag">
    <span className="bm-flag-label" title={title || label}>{label}</span>
    <input
      type="text"
      maxLength={1}
      className="classic-erp-input bm-flag-input"
      value={value}
      onChange={onChange}
      disabled={locked}
    />
  </div>
);

const BookMasterModal = ({ isOpen, onClose, readOnly = false }) => {
  const { fetchBooksByModule, createBook, updateBook, deleteBook } = useStore();

  const [selectedModule, setSelectedModule] = useState('sales');
  const [activeTab, setActiveTab] = useState('Book');
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState('');
  const [mode, setMode] = useState('View');
  const [error, setError] = useState('');
  const [formData, setFormData] = useState(emptyForm('sales'));
  const [findCode, setFindCode] = useState('');

  const locked = readOnly || mode === 'View';

  const bookOptions = useMemo(
    () => books.map((b) => ({ value: b._id || b.id, label: `${b.name} (${b.code})` })),
    [books]
  );

  const moduleOptions = useMemo(
    () => MODULES.map((m) => ({ value: m.key, label: m.label })),
    []
  );

  const mapBookToForm = (book) => ({
    ...emptyForm(selectedModule),
    ...book,
    createDate: toFormDate(book.createDate || book.createdAt),
    opBalanceType: book.opBalanceType === 'CR' ? 'CR' : 'DR',
    stateCode: book.stateCode != null ? String(book.stateCode) : '0',
  });

  const loadBooks = async () => {
    setLoading(true);
    try {
      const data = await fetchBooksByModule(selectedModule);
      setBooks(data || []);
      if (data && data.length > 0) {
        const first = data[0];
        setSelectedBookId(first._id || first.id);
        setFormData(mapBookToForm(first));
      } else {
        setSelectedBookId('');
        setFormData(emptyForm(selectedModule));
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
      setActiveTab('Book');
      if (!readOnly) setMode('Add');
      else setMode('View');
    }
  }, [isOpen, selectedModule, readOnly]);

  const handleSelectBook = (e) => {
    const id = e.target.value;
    setSelectedBookId(id);
    if (id) {
      const book = books.find((b) => b._id === id || b.id === id);
      if (book) {
        setFormData(mapBookToForm(book));
        setMode('View');
      }
    }
  };

  const handleNew = () => {
    setSelectedBookId('');
    setFormData(emptyForm(selectedModule));
    setMode('Add');
    setError('');
    setActiveTab('Book');
  };

  const handleEdit = () => {
    if (!selectedBookId) return notifyWarning('Select a book first');
    const book = books.find((b) => b._id === selectedBookId || b.id === selectedBookId);
    if (book && !book.companyId) {
      return notifyWarning('Cannot edit system default books');
    }
    setMode('Edit');
  };

  const handleFind = () => {
    const q = (findCode || '').trim().toLowerCase();
    if (!q) return notifyWarning('Enter Book Id / Name to find');
    const book = books.find(
      (b) =>
        String(b.code || '').toLowerCase() === q ||
        String(b.name || '').toLowerCase().includes(q)
    );
    if (!book) return notifyWarning('Book not found');
    setSelectedBookId(book._id || book.id);
    setFormData(mapBookToForm(book));
    setMode('View');
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (saving || locked) return;
    if (!formData.name || !formData.code) {
      setError('Name and Code are required');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...formData,
        name: formData.name.toUpperCase(),
        module: selectedModule,
        opBalance: Number(formData.opBalance || 0),
        tdsCode: Number(formData.tdsCode || 0),
      };
      if (mode === 'Edit' && selectedBookId) {
        await updateBook(selectedBookId, payload);
        notifySuccess('Book updated successfully!');
      } else {
        const created = await createBook(payload);
        setSelectedBookId(created._id || created.id);
        notifySuccess('Book saved successfully!');
      }
      setMode('View');
      await loadBooks();
    } catch (err) {
      notifyError(err, 'Failed to save book');
      setError(err.response?.data?.message || err.message || 'Failed to save book');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedBookId) return notifyWarning('Select a book first');
    const book = books.find((b) => b._id === selectedBookId || b.id === selectedBookId);
    if (!book?.companyId) {
      return notifyWarning('Cannot delete system default books');
    }
    if (!(await erpConfirm({
      title: 'Delete Book',
      message: 'Are you sure you want to delete this custom book?',
      confirmLabel: 'Delete',
      danger: true,
    }))) return;
    try {
      await deleteBook(selectedBookId);
      notifySuccess('Book deleted!');
      loadBooks();
    } catch (err) {
      notifyError(err, 'Failed to delete book');
    }
  };

  const handleCancel = () => {
    if (selectedBookId) {
      const book = books.find((b) => b._id === selectedBookId || b.id === selectedBookId);
      if (book) setFormData(mapBookToForm(book));
    } else {
      setFormData(emptyForm(selectedModule));
    }
    setMode('View');
    setError('');
  };

  const setField = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;

    if (key === 'stateCode') {
      const digits = String(val).replace(/\D/g, '').slice(0, 2);
      const name = digits.length === 2 ? stateNameFromCode(digits) : '';
      setFormData({
        ...formData,
        stateCode: digits,
        stateName: name,
        ...(name ? { state: name } : {}),
      });
      return;
    }

    if (key === 'gstinNo') {
      const gstin = String(val).toUpperCase();
      const fromGstin = gstin.length >= 2 ? gstin.slice(0, 2) : '';
      const name = stateNameFromCode(fromGstin);
      setFormData({
        ...formData,
        gstinNo: gstin,
        ...(fromGstin
          ? {
              stateCode: normalizeGstStateCode(fromGstin) || fromGstin,
              stateName: name || formData.stateName,
              state: name || formData.state,
            }
          : {}),
      });
      return;
    }

    setFormData({ ...formData, [key]: val });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} bare className="max-w-[920px]">
      <div className="classic-erp-window flex flex-col h-full max-h-[90vh]">
        <ErpBusyOverlay show={loading} message="Loading books…" />
        <ErpBusyOverlay show={!loading && saving} message="Saving book…" />
        <div className="classic-erp-header">
          <span>Book Master</span>
          <button type="button" className="classic-erp-close-btn" onClick={onClose}>X</button>
        </div>

        <div className="classic-erp-tabs">
          {['Book', 'Book Detail'].map((tab) => (
            <button
              key={tab}
              type="button"
              className={`classic-erp-tab-button ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="classic-erp-body bm-body flex-1 overflow-y-auto">
          {/* Toolbar row */}
          <div className="bm-toolbar">
            <div className="bm-field bm-field--module">
              <span className="bm-label">Module</span>
              <ERPSelect
                className="classic-erp-select"
                value={selectedModule}
                onChange={(e) => {
                  setSelectedModule(e.target.value);
                  setMode('View');
                }}
                options={moduleOptions}
              />
            </div>
            <div className="bm-field bm-field--grow">
              <span className="bm-label">Select Book</span>
              <ERPSelect
                className="classic-erp-select"
                value={selectedBookId}
                onChange={handleSelectBook}
                options={bookOptions}
                placeholder="- Select Book -"
                recentKey="book-master"
              />
            </div>
            <div className="bm-field bm-field--find">
              <span className="bm-label">Find</span>
              <div className="bm-inline">
                <input
                  type="text"
                  className="classic-erp-input"
                  placeholder="Id / Name"
                  value={findCode}
                  onChange={(e) => setFindCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFind()}
                />
                <button type="button" className="classic-erp-btn" onClick={handleFind} disabled={readOnly}>Go</button>
              </div>
            </div>
            {loading && <InlineLoader message="Loading books…" className="bm-loading" />}
          </div>

          {activeTab === 'Book' ? (
            <>
              {/* Identity */}
              <div className="bm-section">
                <div className="bm-row bm-row--id">
                  <div className="bm-field">
                    <span className="bm-label bm-label--req">Book Id</span>
                    <input type="text" className="classic-erp-input" value={formData.code} onChange={setField('code')} disabled={locked} />
                  </div>
                  <div className="bm-field bm-field--grow">
                    <span className="bm-label bm-label--req">Book Name</span>
                    <div className="bm-inline">
                      <input
                        type="text"
                        className="classic-erp-input bm-name-input"
                        value={formData.name}
                        onChange={setField('name')}
                        disabled={locked}
                      />
                      <input
                        type="text"
                        className="classic-erp-input bm-ref-input"
                        value={formData.tdsCode || 0}
                        onChange={setField('tdsCode')}
                        disabled={locked}
                        title="Ref / Code"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Left params + Right GST */}
              <div className="bm-split">
                <div className="bm-section">
                  <div className="bm-field">
                    <span className="bm-label">Book Type</span>
                    <select className="classic-erp-select" value={formData.bookType} onChange={setField('bookType')} disabled={locked}>
                      <option value="SALES BOOK">SALES BOOK</option>
                      <option value="PURCHASE BOOK">PURCHASE BOOK</option>
                      <option value="CASH/BANK BOOK">CASH/BANK BOOK</option>
                      <option value="CASH BOOK">CASH BOOK</option>
                      <option value="BANK BOOK">BANK BOOK</option>
                      <option value="GENERAL LEDGER">GENERAL LEDGER</option>
                      <option value="JOB WORK BOOK">JOB WORK BOOK</option>
                    </select>
                  </div>
                  <div className="bm-field">
                    <span className="bm-label">Group Head</span>
                    <select className="classic-erp-select" value={formData.groupHead} onChange={setField('groupHead')} disabled={locked}>
                      <option value="TRADING INCOME">TRADING INCOME</option>
                      <option value="TRADING EXPENSE">TRADING EXPENSE</option>
                      <option value="BANK BALANCE">BANK BALANCE</option>
                      <option value="CASH BALANCE">CASH BALANCE</option>
                      <option value="INDIRECT INCOME">INDIRECT INCOME</option>
                      <option value="INDIRECT EXPENSE">INDIRECT EXPENSE</option>
                    </select>
                  </div>
                  <div className="bm-field">
                    <span className="bm-label">Op. Balance</span>
                    <div className="bm-inline">
                      <input type="number" className="classic-erp-input text-right" value={formData.opBalance} onChange={setField('opBalance')} disabled={locked} />
                      <select className="classic-erp-select bm-drcr" value={formData.opBalanceType} onChange={setField('opBalanceType')} disabled={locked}>
                        <option value="DR">DR</option>
                        <option value="CR">CR</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bm-section bm-gst">
                  <div className="bm-field">
                    <span className="bm-label">A/c No.</span>
                    <input type="text" className="classic-erp-input" value={formData.accountNo} onChange={setField('accountNo')} disabled={locked} />
                  </div>
                  <div className="bm-gst-inner">
                    <div className="bm-field">
                      <span className="bm-label bm-label--gst">GstinNo</span>
                      <input type="text" className="classic-erp-input" value={formData.gstinNo} onChange={setField('gstinNo')} disabled={locked} />
                    </div>
                    <div className="bm-field">
                      <span className="bm-label bm-label--gst">StateCode</span>
                      <div className="bm-inline">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={2}
                          className="classic-erp-input bm-code-input text-center"
                          value={formData.stateCode}
                          onChange={setField('stateCode')}
                          disabled={locked}
                          title="Enter GST state code (e.g. 23 = Madhya Pradesh)"
                        />
                        <input
                          type="text"
                          className="classic-erp-input"
                          value={formData.stateName}
                          readOnly
                          disabled={locked}
                          placeholder="State (auto)"
                          title="Filled from StateCode"
                        />
                      </div>
                    </div>
                    <div className="bm-field">
                      <span className="bm-label bm-label--gst">StateName</span>
                      <input type="text" className="classic-erp-input" value={formData.stateName} readOnly disabled={locked} placeholder="Auto from StateCode" />
                    </div>
                    <div className="bm-field">
                      <span className="bm-label bm-label--gst">GstType</span>
                      <select className="classic-erp-select" value={formData.gstType} onChange={setField('gstType')} disabled={locked}>
                        <option value="">—</option>
                        <option value="REGISTERED">REGISTERED</option>
                        <option value="UNREGISTERED">UNREGISTERED</option>
                        <option value="COMPOSITION">COMPOSITION</option>
                        <option value="SEZ">SEZ</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Flags — one neat strip */}
              <div className="bm-section bm-flags-row">
                <FlagCell label="R/T" title="Retail / Tax" value={formData.retailTax} onChange={setField('retailTax')} locked={locked} />
                <FlagCell label="R/F" title="Row / Finish Material" value={formData.rowFinishMaterial} onChange={setField('rowFinishMaterial')} locked={locked} />
                <FlagCell label="Detail" title="Detail [D]" value={formData.detailJobWork} onChange={setField('detailJobWork')} locked={locked} />
                <FlagCell label="I/E" title="Including / Excluding Vat" value={formData.incExcVat} onChange={setField('incExcVat')} locked={locked} />
                <FlagCell label="Stock" title="Effect On Stock Y/N" value={formData.effectOnStock} onChange={setField('effectOnStock')} locked={locked} />
              </div>

              {/* Address */}
              <div className="bm-section">
                <div className="bm-field bm-field--addr">
                  <span className="bm-label">Address</span>
                  <div className="bm-addr-stack">
                    <input type="text" className="classic-erp-input" value={formData.address1} onChange={setField('address1')} disabled={locked} />
                    <input type="text" className="classic-erp-input" value={formData.address2} onChange={setField('address2')} disabled={locked} />
                  </div>
                </div>
                <div className="bm-meta-row">
                  <div className="bm-field">
                    <span className="bm-label">Dist</span>
                    <input type="text" className="classic-erp-input" value={formData.dist} onChange={setField('dist')} disabled={locked} />
                  </div>
                  <div className="bm-field">
                    <span className="bm-label">State</span>
                    <input type="text" className="classic-erp-input" value={formData.state} onChange={setField('state')} disabled={locked} />
                  </div>
                  <div className="bm-field">
                    <span className="bm-label">Head[1]</span>
                    <input type="text" className="classic-erp-input" value={formData.head1} onChange={setField('head1')} disabled={locked} />
                  </div>
                  <div className="bm-field">
                    <span className="bm-label">Head[2]</span>
                    <input type="text" className="classic-erp-input" value={formData.head2} onChange={setField('head2')} disabled={locked} />
                  </div>
                  <div className="bm-field">
                    <span className="bm-label">CreateDate</span>
                    <input type="date" className="classic-erp-input" value={formData.createDate} onChange={setField('createDate')} disabled={locked} />
                  </div>
                </div>
              </div>

              <div className="bm-section bm-notes">
                <textarea
                  className="classic-erp-input"
                  placeholder="Notes / Description"
                  value={formData.notes || ''}
                  onChange={setField('notes')}
                  disabled={locked}
                />
              </div>
            </>
          ) : (
            <div className="bm-section bm-detail-tab">
              <div className="bm-field">
                <span className="bm-label">JobWork Book</span>
                <label className="bm-check">
                  <input type="checkbox" checked={!!formData.jobWorkBook} onChange={setField('jobWorkBook')} disabled={locked} />
                  <span>Yes</span>
                </label>
              </div>
              <div className="bm-field">
                <span className="bm-label">Tds Head</span>
                <input type="text" className="classic-erp-input" value={formData.tdsHead} onChange={setField('tdsHead')} disabled={locked} />
              </div>
              <div className="bm-field">
                <span className="bm-label">Tds Code</span>
                <input type="number" className="classic-erp-input bm-ref-input" value={formData.tdsCode} onChange={setField('tdsCode')} disabled={locked} />
              </div>
              <div className="bm-field bm-field--addr">
                <span className="bm-label">Notes</span>
                <textarea className="classic-erp-input" style={{ minHeight: 140 }} value={formData.notes || ''} onChange={setField('notes')} disabled={locked} />
              </div>
            </div>
          )}

          {error && <p className="bm-error">{error}</p>}
        </div>

        <div className="classic-erp-form-footer">
          <button className="classic-erp-btn" type="button" onClick={handleNew} disabled={readOnly || mode === 'Add' || mode === 'Edit'}>New</button>
          <button className="classic-erp-btn" type="button" onClick={handleEdit} disabled={readOnly || mode !== 'View' || !selectedBookId}>Edit</button>
          <button className="classic-erp-btn btn-blue" type="button" onClick={handleSave} disabled={locked || saving || loading}>
            <SaveButtonLabel saving={saving} />
          </button>
          <button className="classic-erp-btn" type="button" onClick={handleCancel} disabled={locked}>Cancel</button>
          <button className="classic-erp-btn" type="button" onClick={handleFind} disabled={readOnly}>Find</button>
          <button className="classic-erp-btn btn-red" type="button" onClick={handleDelete} disabled={readOnly || !selectedBookId}>Delete</button>
          <button className="classic-erp-btn" type="button" onClick={onClose}>Exit</button>
        </div>
      </div>
    </Modal>
  );
};

export default BookMasterModal;
