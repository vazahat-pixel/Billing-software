import React, { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { Plus, Trash2, Search } from 'lucide-react';
import { warehousesApi } from '../../api';
import { toast } from '../../store/useToastStore';

const LOCATION_TYPES = ['Warehouse', 'Godown', 'Rack', 'Bin'];

const WarehouseMasterModal = ({ isOpen, onClose, readOnly = false }) => {
  const [rows, setRows] = useState([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState('Warehouse');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await warehousesApi.list();
      setRows(Array.isArray(list) ? list : []);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      load();
      setName('');
      setCode('');
      setType('Warehouse');
      setSearchQuery('');
    }
  }, [isOpen]);

  const filtered = rows.filter(
    (r) =>
      r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      toast.warning('Name and code required');
      return;
    }
    setIsSubmitting(true);
    try {
      await warehousesApi.create({ name: name.trim(), code: code.trim(), type });
      toast.success('Location saved');
      setName('');
      setCode('');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Soft-delete this location?')) return;
    try {
      await warehousesApi.remove(id);
      toast.success('Deleted');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Warehouse / Location Master" className="max-w-2xl">
      <div className="p-6 space-y-4">
        {!readOnly && (
          <form onSubmit={handleSubmit} className="grid grid-cols-4 gap-2 items-end">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Name</label>
              <input className="w-full border border-slate-200 px-2 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Code</label>
              <input className="w-full border border-slate-200 px-2 py-2 text-sm uppercase" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Type</label>
              <select className="w-full border border-slate-200 px-2 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
                {LOCATION_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={isSubmitting} className="h-10 bg-black text-white text-[10px] font-black uppercase flex items-center justify-center gap-1">
              <Plus size={14} /> {isSubmitting ? '…' : 'Add'}
            </button>
          </form>
        )}

        <div className="relative">
          <Search size={14} className="absolute left-3 top-3 text-slate-400" />
          <input
            className="w-full border border-slate-200 pl-9 pr-3 py-2 text-sm"
            placeholder="Search locations…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="border border-slate-200 max-h-72 overflow-auto">
          {loading ? (
            <p className="p-4 text-xs text-slate-400">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-xs text-slate-400">No locations yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="text-left p-2">Code</th>
                  <th className="text-left p-2">Name</th>
                  <th className="text-left p-2">Type</th>
                  {!readOnly && <th className="p-2 w-10" />}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r._id} className="border-t border-slate-100">
                    <td className="p-2 font-mono text-xs">{r.code}</td>
                    <td className="p-2">{r.name}</td>
                    <td className="p-2 text-xs">{r.type}</td>
                    {!readOnly && (
                      <td className="p-2">
                        <button type="button" onClick={() => handleDelete(r._id)} className="text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default WarehouseMasterModal;
