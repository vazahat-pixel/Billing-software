import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';
import { 
  Plus, Users, Package, MapPin, Hash, Search, 
  Edit2, Trash2, ArrowRight, User, Phone, 
  Globe, CreditCard, Banknote, FileText, ShoppingBag, Book, Wallet, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ERPButton } from '../../components/forms/FormElements';
import PartyModal from './PartyModal';
import ItemModal from './ItemModal';
import AccountMasterModal from './AccountMasterModal';
import BookMasterModal from './BookMasterModal';
import GenericMasterModal from './GenericMasterModal';

const MasterPage = () => {
  const { 
    parties, items, ledgers, books, subMasters,
    fetchParties, fetchItems, fetchLedgers, fetchBooks, fetchSubMasters 
  } = useStore();
  
  const [activeTab, setActiveTab] = useState('parties');
  const [selectedItem, setSelectedItem] = useState(null);
  const [modals, setModals] = useState({ 
    party: false, 
    item: false,
    ledger: false,
    book: false,
    general: false
  });

  useEffect(() => {
    fetchParties();
    fetchItems();
    fetchLedgers();
    fetchBooks();
    fetchSubMasters();
  }, [fetchParties, fetchItems, fetchLedgers, fetchBooks, fetchSubMasters]);

  const tabs = [
    { id: 'parties', label: 'Parties', icon: Users, count: parties.length },
    { id: 'items', label: 'Items', icon: Package, count: items.length },
    { id: 'ledgers', label: 'Ledgers', icon: Wallet, count: ledgers.length },
    { id: 'books', label: 'Books', icon: Book, count: books.length },
    { id: 'general', label: 'General', icon: Settings, count: subMasters.length }
  ];

  const handleRowClick = (item) => {
    setSelectedItem(item);
  };

  const getActiveData = () => {
    switch (activeTab) {
      case 'parties': return parties;
      case 'items': return items;
      case 'ledgers': return ledgers;
      case 'books': return books;
      case 'general': return subMasters;
      default: return [];
    }
  };

  const activeData = getActiveData();

  const getIcon = () => {
    switch (activeTab) {
      case 'parties': return <Users size={28} />;
      case 'items': return <Package size={28} />;
      case 'ledgers': return <Wallet size={28} />;
      case 'books': return <Book size={28} />;
      case 'general': return <Settings size={28} />;
      default: return <Settings size={28} />;
    }
  };

  const getTabLabel = () => {
    switch (activeTab) {
      case 'parties': return 'Party';
      case 'items': return 'Item';
      case 'ledgers': return 'Ledger';
      case 'books': return 'Book';
      case 'general': return 'SubMaster';
      default: return 'Master';
    }
  };

  const handleInitialize = () => {
    switch (activeTab) {
      case 'parties': setModals({ ...modals, party: true }); break;
      case 'items': setModals({ ...modals, item: true }); break;
      case 'ledgers': setModals({ ...modals, ledger: true }); break;
      case 'books': setModals({ ...modals, book: true }); break;
      case 'general': setModals({ ...modals, general: true }); break;
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden gap-6 animate-fadeIn">
      {/* Left Section - Main Content */}
      <div className={`flex-1 flex flex-col gap-6 transition-all duration-500 ${selectedItem ? 'w-2/3' : 'w-full'}`}>
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-8 border-2 border-black">
          <div className="flex items-center gap-6">
             <div className="p-4 bg-black text-white">
                {getIcon()}
             </div>
             <div>
                <h1 className="text-2xl font-black text-black uppercase tracking-tighter">Master Management</h1>
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">
                   <span>Registry</span>
                   <ArrowRight size={10} />
                   <span className="text-black">{activeTab}</span>
                </div>
             </div>
          </div>
          <ERPButton 
             variant="indigo" 
             icon={Plus} 
             onClick={handleInitialize}
             className="px-10"
          >
             Initialize {getTabLabel()}
          </ERPButton>
        </div>

        {/* Tabs & Search */}
        <div className="bg-white p-1 border-2 border-black flex items-center justify-between">
           <div className="flex items-center gap-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setSelectedItem(null); }}
                  className={`flex items-center gap-3 px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                    activeTab === tab.id 
                      ? 'bg-black text-white' 
                      : 'text-slate-400 hover:text-black hover:bg-slate-50'
                  }`}
                >
                  <tab.icon size={14} />
                  {tab.label}
                  <span className={`ml-2 px-2 py-0.5 text-[9px] font-black ${activeTab === tab.id ? 'bg-white text-black' : 'bg-slate-100 text-slate-500'}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
           </div>
           <div className="relative mr-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-black" size={14} />
              <input 
                placeholder="Audit Search..." 
                className="pl-12 pr-6 py-3 bg-white border-l-2 border-black text-[10px] font-black uppercase tracking-widest outline-none w-64 transition-all focus:w-80"
              />
           </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 bg-white border-2 border-black overflow-hidden flex flex-col">
           <div className="overflow-y-auto flex-1 custom-scrollbar">
              <table className="w-full text-left border-collapse">
                 <thead>
                    <tr className="bg-black text-[9px] font-black text-white uppercase tracking-[0.3em] sticky top-0 z-10">
                       {activeTab === 'parties' && (
                         <>
                           <th className="px-8 py-5">Entity Name & Identifiers</th>
                           <th className="px-8 py-5">Classification</th>
                           <th className="px-8 py-5">Communication</th>
                           <th className="px-8 py-5">Jurisdiction</th>
                         </>
                       )}
                       {activeTab === 'items' && (
                         <>
                           <th className="px-8 py-5">Item Identity</th>
                           <th className="px-8 py-5">Architecture</th>
                           <th className="px-8 py-5">Compliance</th>
                           <th className="px-8 py-5">Inventory Unit</th>
                         </>
                       )}
                       {activeTab === 'ledgers' && (
                         <>
                           <th className="px-8 py-5">Ledger Name</th>
                           <th className="px-8 py-5">Account Group</th>
                           <th className="px-8 py-5">Opening Balance</th>
                           <th className="px-8 py-5">Status</th>
                         </>
                       )}
                       {activeTab === 'books' && (
                         <>
                           <th className="px-8 py-5">Book Name</th>
                           <th className="px-8 py-5">Code</th>
                           <th className="px-8 py-5">Module</th>
                           <th className="px-8 py-5">Type</th>
                         </>
                       )}
                       {activeTab === 'general' && (
                         <>
                           <th className="px-8 py-5">Name</th>
                           <th className="px-8 py-5">Master Type</th>
                           <th className="px-8 py-5">Associated Meta</th>
                         </>
                       )}
                    </tr>
                 </thead>
                 <tbody className="divide-y-2 divide-slate-50">
                    {activeData.map((row, idx) => (
                      <tr 
                        key={row._id || row.id || idx} 
                        onClick={() => handleRowClick(row)}
                        className={`cursor-pointer transition-all ${
                          selectedItem && (selectedItem._id === row._id || selectedItem.id === row.id) ? 'bg-slate-100' : 'hover:bg-slate-50'
                        }`}
                      >
                         {activeTab === 'parties' && (
                           <>
                             <td className="px-8 py-5">
                                <p className="text-[11px] font-black text-black uppercase tracking-widest">{row.name}</p>
                                <p className="text-[9px] text-slate-400 font-black uppercase mt-1 tracking-widest">{row.gstin || 'GST: UNREGISTERED'}</p>
                             </td>
                             <td className="px-8 py-5">
                                <span className={`px-3 py-1 border-2 text-[9px] font-black uppercase tracking-widest ${
                                  row.type === 'Customer' ? 'bg-black text-white border-black' : 'border-slate-200 text-slate-400'
                                }`}>
                                  {row.type}
                                </span>
                             </td>
                             <td className="px-8 py-5 text-[10px] font-black text-black tracking-widest">{row.mobile}</td>
                             <td className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{row.state}</td>
                           </>
                         )}
                         {activeTab === 'items' && (
                           <>
                             <td className="px-8 py-5">
                                <p className="text-[11px] font-black text-black uppercase tracking-widest">{row.itemName}</p>
                                <p className="text-[9px] text-slate-400 font-black uppercase mt-1 tracking-widest">{row.category}</p>
                             </td>
                             <td className="px-8 py-5 text-[10px] font-black text-black uppercase tracking-widest">{row.design}</td>
                             <td className="px-8 py-5 text-[10px] font-black text-slate-400 tracking-[0.2em]">{row.hsnCode}</td>
                             <td className="px-8 py-5 text-[10px] font-black text-black uppercase tracking-widest">{row.unit}</td>
                           </>
                         )}
                         {activeTab === 'ledgers' && (
                           <>
                             <td className="px-8 py-5 text-[11px] font-black text-black uppercase tracking-widest">{row.name}</td>
                             <td className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{row.group}</td>
                             <td className="px-8 py-5 text-[10px] font-black text-black tracking-widest">
                                ₹ {Math.abs(row.openingBalance || 0)} {row.openingBalanceType}
                             </td>
                             <td className="px-8 py-5">
                                <span className={`px-3 py-1 border-2 text-[9px] font-black uppercase tracking-widest ${row.isActive !== false ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                  {row.isActive !== false ? 'ACTIVE' : 'INACTIVE'}
                                </span>
                             </td>
                           </>
                         )}
                         {activeTab === 'books' && (
                           <>
                             <td className="px-8 py-5 text-[11px] font-black text-black uppercase tracking-widest">{row.name}</td>
                             <td className="px-8 py-5 text-[10px] font-black text-black uppercase tracking-widest">{row.code}</td>
                             <td className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{row.module}</td>
                             <td className="px-8 py-5">
                                <span className={`px-3 py-1 border-2 text-[9px] font-black uppercase tracking-widest ${!row.companyId ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-black text-white border-black'}`}>
                                  {!row.companyId ? 'SYSTEM' : 'CUSTOM'}
                                </span>
                             </td>
                           </>
                         )}
                         {activeTab === 'general' && (
                           <>
                             <td className="px-8 py-5 text-[11px] font-black text-black uppercase tracking-widest">{row.name}</td>
                             <td className="px-8 py-5">
                                <span className="px-3 py-1 border-2 border-black text-[9px] font-black uppercase tracking-widest bg-slate-50 text-black">
                                  {row.type}
                                </span>
                             </td>
                             <td className="px-8 py-5 text-[10px] font-black text-slate-400 tracking-widest truncate max-w-xs">
                                {row.extraFields ? JSON.stringify(row.extraFields) : '-'}
                             </td>
                           </>
                         )}
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      </div>

      {/* Right Smart Panel */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="w-[400px] bg-white border-l border-slate-100 shadow-2xl flex flex-col z-20"
          >
             <SmartPanel 
                data={selectedItem} 
                onClose={() => setSelectedItem(null)} 
                type={activeTab}
             />
          </motion.div>
        )}
      </AnimatePresence>

      <PartyModal isOpen={modals.party} onClose={() => setModals({ ...modals, party: false })} />
      <ItemModal isOpen={modals.item} onClose={() => setModals({ ...modals, item: false })} />
      <AccountMasterModal isOpen={modals.ledger} onClose={() => { setModals({ ...modals, ledger: false }); fetchLedgers(); }} />
      <BookMasterModal isOpen={modals.book} onClose={() => { setModals({ ...modals, book: false }); fetchBooks(); }} />
      <GenericMasterModal isOpen={modals.general} onClose={() => { setModals({ ...modals, general: false }); fetchSubMasters(); }} />
    </div>
  );
};

const SmartPanel = ({ data, onClose, type }) => {
  const getPanelIcon = () => {
    switch (type) {
      case 'parties': return User;
      case 'items': return Package;
      case 'ledgers': return Wallet;
      case 'books': return Book;
      case 'general': return Settings;
      default: return Settings;
    }
  };

  const getPanelTitle = () => {
    switch (type) {
      case 'parties': return data.name;
      case 'items': return data.itemName;
      case 'ledgers': return data.name;
      case 'books': return data.name;
      case 'general': return data.name;
      default: return 'Details';
    }
  };

  const PanelIcon = getPanelIcon();

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
       {/* Panel Header */}
       <div className="p-8 border-b-2 border-black flex items-center justify-between bg-black text-white">
          <div>
             <h3 className="text-[11px] font-black uppercase tracking-[0.4em]">{type} Dossier</h3>
             <p className="text-[9px] text-slate-400 font-black mt-2 uppercase tracking-[0.3em]">{data._id || data.id}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 transition-all text-white"><Plus className="rotate-45" size={24} /></button>
       </div>

       {/* Panel Content */}
       <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar">
          <div className="flex flex-col items-center text-center">
             <div className="w-24 h-24 bg-black text-white flex items-center justify-center mb-6">
                <PanelIcon size={40} strokeWidth={2.5} />
             </div>
             <h2 className="text-xl font-black text-black uppercase tracking-tight leading-tight">{getPanelTitle()}</h2>
             <span className="text-[10px] font-black uppercase tracking-[0.3em] px-5 py-2 bg-slate-100 text-black mt-6">
                {type === 'parties' && data.type}
                {type === 'items' && data.design}
                {type === 'ledgers' && data.group}
                {type === 'books' && data.module}
                {type === 'general' && data.type}
             </span>
          </div>

          <div className="space-y-10">
             <PanelSection title="Critical Data">
                {type === 'parties' && (
                   <>
                     <DetailItem icon={Phone} label="Contact Primary" value={data.mobile} />
                     <DetailItem icon={Globe} label="Portal GSTIN" value={data.gstin || 'UNREGISTERED'} />
                     <DetailItem icon={CreditCard} label="PAN Registry" value={data.pan || 'N/A'} />
                     <DetailItem icon={MapPin} label="Geographic State" value={data.state} />
                   </>
                )}
                {type === 'items' && (
                   <>
                     <DetailItem icon={Hash} label="HSN/SAC Schema" value={data.hsnCode} />
                     <DetailItem icon={ShoppingBag} label="Design Reference" value={data.design} />
                     <DetailItem icon={Package} label="Classification" value={data.category} />
                     <DetailItem icon={FileText} label="Inventory Basis" value={data.unit} />
                   </>
                )}
                {type === 'ledgers' && (
                   <>
                     <DetailItem icon={Wallet} label="Account Group" value={data.group} />
                     <DetailItem icon={Banknote} label="Opening Balance" value={`₹ ${data.openingBalance || 0} ${data.openingBalanceType || ''}`} />
                     <DetailItem icon={Settings} label="Status" value={data.isActive !== false ? 'ACTIVE' : 'INACTIVE'} />
                   </>
                )}
                {type === 'books' && (
                   <>
                     <DetailItem icon={Hash} label="Book Code" value={data.code} />
                     <DetailItem icon={Package} label="Module" value={data.module} />
                     <DetailItem icon={Settings} label="Type" value={!data.companyId ? 'SYSTEM DEFAULT' : 'CUSTOM'} />
                   </>
                )}
                {type === 'general' && (
                   <>
                     <DetailItem icon={Settings} label="Master Type" value={data.type} />
                     <DetailItem icon={FileText} label="Extra Fields" value={data.extraFields ? JSON.stringify(data.extraFields) : 'N/A'} />
                   </>
                )}
             </PanelSection>

             {/* Only show operational metrics for parties/items for now */}
             {(type === 'parties' || type === 'items') && (
               <PanelSection title="Operational Metrics">
                  {type === 'parties' ? (
                     <>
                       <DetailItem icon={Banknote} label="Opening Balance" value={`₹ ${data.openingBalance || 0}`} />
                       <DetailItem icon={CreditCard} label="Authorized Limit" value={`₹ ${data.creditLimit || 0}`} />
                       <DetailItem icon={FileText} label="Primary Address" value={data.address} />
                     </>
                  ) : (
                     <>
                       <div className="grid grid-cols-2 gap-2">
                          <div className="p-6 bg-white border-2 border-black">
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Stock</p>
                             <p className="text-xl font-black text-black mt-2">1,240 <span className="text-[10px]">Mtrs</span></p>
                          </div>
                          <div className="p-6 bg-slate-50 border-2 border-slate-100">
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pending</p>
                             <p className="text-xl font-black text-slate-300 mt-2">450 <span className="text-[10px]">Mtrs</span></p>
                          </div>
                       </div>
                     </>
                  )}
               </PanelSection>
             )}
          </div>
       </div>

       {/* Panel Actions */}
       <div className="p-8 bg-white border-t-2 border-black grid grid-cols-2 gap-2">
          <ERPButton variant="secondary" icon={Edit2} className="text-[10px] h-14">Edit Master</ERPButton>
          <ERPButton variant="indigo" icon={ArrowRight} className="text-[10px] h-14">
             {type === 'parties' ? 'Ledger' : type === 'items' ? 'Stock' : 'Details'}
          </ERPButton>
          <button className="col-span-2 py-4 text-black text-[9px] font-black uppercase tracking-[0.4em] hover:bg-slate-100 transition-all border-2 border-slate-50 mt-2 flex items-center justify-center gap-3">
             <Trash2 size={14} /> De-register Entity
          </button>
       </div>
    </div>
  );
};

const PanelSection = ({ title, children }) => (
  <div className="space-y-6">
     <h4 className="text-[10px] font-black text-black uppercase tracking-[0.4em] flex items-center gap-4">
        {title}
        <div className="h-[2px] flex-1 bg-slate-50"></div>
     </h4>
     <div className="space-y-4">{children}</div>
  </div>
);

const DetailItem = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-6 group">
     <div className="w-10 h-10 bg-slate-50 text-black flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all">
        <Icon size={18} />
     </div>
     <div className="flex-1 overflow-hidden">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
        <p className="text-[11px] font-black text-black uppercase tracking-widest truncate">{value}</p>
     </div>
  </div>
);

export default MasterPage;
