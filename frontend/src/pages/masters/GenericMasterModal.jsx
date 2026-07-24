import React, { useState, useEffect, useMemo } from 'react';
import useStore from '../../store/useStore';
import Modal from '../../components/ui/Modal';
import { Plus, Trash2, Search } from 'lucide-react';
import { erpConfirmDelete } from '../../utils/confirm';
import { notifyError } from '../../utils/notify';

const GenericMasterModal = ({ isOpen, onClose, type, readOnly = false }) => {
  const { subMasters, fetchSubMasters, addSubMaster, deleteSubMaster } = useStore();
  const [name, setName] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [gstRate, setGstRate] = useState('5');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch sub-masters on open or type change
  useEffect(() => {
    if (isOpen && type) {
      fetchSubMasters(type);
      setName('');
      setHsnCode('');
      setGstRate('5');
      setSearchQuery('');
      setErrorMsg('');
    }
  }, [isOpen, type]);

  // Compute readable title
  const title = useMemo(() => {
    switch (type) {
      case 'AccountGroup': return 'Account Main Group Registry';
      case 'AccountHead': return 'Account Head Registry';
      case 'BookType': return 'Book Type Registry';
      case 'ItemGroup': return 'Item Group Registry';
      case 'Unit': return 'Unit Registry';
      case 'ItemTaxSlab': return 'Item Tax Slab Registry';
      case 'City': return 'Station / City Registry';
      case 'Transport': return 'Transport Agent Registry';
      case 'Type': return 'Type Registry';
      case 'OtherMaster': return 'Other Master Registry';
      case 'Color': return 'Color Master Registry';
      case 'Design': return 'Design Master Registry';
      case 'HSN': return 'HSN Code Registry';
      case 'Quality': return 'Quality Master Registry';
      case 'Pattern': return 'Pattern Master Registry';
      case 'Brand': return 'Brand Master Registry';
      case 'Shade': return 'Shade Master Registry';
      case 'Process': return 'Process Master Registry';
      case 'Machine': return 'Machine Master Registry';
      case 'Department': return 'Department Master Registry';
      case 'PaymentTerms': return 'Payment Terms Registry';
      case 'Currency': return 'Currency Registry';
      default: return type ? `${type} Registry` : 'Master Registry';
    }
  }, [type]);

  const filteredList = useMemo(() => {
    return subMasters.filter(item => 
      item.type === type &&
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [subMasters, type, searchQuery]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (type === 'HSN') {
      if (!hsnCode.trim() || hsnCode.trim().length < 4) {
        setErrorMsg('Valid HSN code is required');
        return;
      }
      if (!name.trim()) {
        setErrorMsg('Description is required');
        return;
      }
    } else if (!name.trim()) {
      setErrorMsg('Name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = type === 'HSN'
        ? {
            type,
            name: name.trim(),
            extraFields: { code: hsnCode.trim(), description: name.trim(), gstRate: Number(gstRate || 5) }
          }
        : { type, name: name.trim() };
      await addSubMaster(payload);
      setName('');
      setHsnCode('');
      setGstRate('5');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to add record');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!(await erpConfirmDelete('this record'))) return;
    try {
      await deleteSubMaster(id);
    } catch (err) {
      notifyError(err, 'Failed to delete record');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} bare className="max-w-2xl">
      <div className="classic-erp-window flex flex-col max-h-[90vh]">
        <div className="classic-erp-header">
          <span>{title}</span>
          <button type="button" className="classic-erp-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="classic-erp-body border-b border-[var(--border)]">
          <form onSubmit={handleSubmit} className="space-y-3">
            {type === 'HSN' ? (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="classic-erp-label">HSN Code</label>
                  <input className="classic-erp-input w-full mt-1" value={hsnCode} onChange={e => setHsnCode(e.target.value)} placeholder="5208" maxLength={8} disabled={readOnly} />
                </div>
                <div className="col-span-2">
                  <label className="classic-erp-label">Description</label>
                  <input className="classic-erp-input w-full mt-1" value={name} onChange={e => setName(e.target.value)} disabled={readOnly} />
                </div>
                <div>
                  <label className="classic-erp-label">GST %</label>
                  <input type="number" className="classic-erp-input w-full mt-1" value={gstRate} onChange={e => setGstRate(e.target.value)} disabled={readOnly} />
                </div>
              </div>
            ) : (
              <div>
                <label className="classic-erp-label">Name</label>
                <input className="classic-erp-input w-full mt-1" value={name} onChange={e => setName(e.target.value)} placeholder={`New ${type} name`} disabled={readOnly} />
              </div>
            )}
            {!readOnly && (
              <button type="submit" disabled={isSubmitting} className="classic-erp-btn btn-blue">
                <Plus size={12} /> Add
              </button>
            )}
          </form>
          {errorMsg && <p className="text-[11px] text-[var(--red)] mt-2">{errorMsg}</p>}
        </div>

        <div className="classic-erp-body flex-1 min-h-0 flex flex-col">
          <div className="relative mb-2">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="classic-erp-input w-full pl-7"
            />
          </div>
          <div className="classic-erp-table-container flex-1 min-h-[160px]">
            <table className="classic-erp-table">
              <thead>
                <tr>
                  <th>{type === 'HSN' ? 'HSN / Description' : 'Name'}</th>
                  {type === 'HSN' && <th>GST %</th>}
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((item) => (
                  <tr key={item._id}>
                    <td>{type === 'HSN' ? `${item.extraFields?.code || item.name} — ${item.extraFields?.description || item.name}` : item.name}</td>
                    {type === 'HSN' && <td>{item.extraFields?.gstRate ?? 5}%</td>}
                    <td className="text-right">
                      {!readOnly && (
                        <button type="button" onClick={() => handleDelete(item._id)} className="classic-erp-btn btn-red" style={{ height: 24, padding: '0 8px' }}>
                          <Trash2 size={11} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredList.length === 0 && (
                  <tr><td colSpan={type === 'HSN' ? 3 : 2} className="text-center text-[var(--text-muted)] py-6">No records</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default GenericMasterModal;
