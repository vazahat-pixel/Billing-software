import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';
import { 
  Plus, Users, Package, MapPin, Hash, Search, 
  Edit2, Trash2, ArrowRight, User, Phone, 
  Globe, CreditCard, Banknote, FileText, ShoppingBag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ERPButton } from '../../components/forms/FormElements';
import PartyModal from './PartyModal';
import ItemModal from './ItemModal';

const MasterPage = () => {
  const { parties, items, fetchParties, fetchItems } = useStore();
  const [activeTab, setActiveTab] = useState('parties');
  const [selectedItem, setSelectedItem] = useState(null);
  const [modals, setModals] = useState({ party: false, item: false });

  useEffect(() => {
    fetchParties();
    fetchItems();
  }, [fetchParties, fetchItems]);

  const tabs = [
    { id: 'parties', label: 'Parties', icon: Users, count: parties.length },
    { id: 'items', label: 'Items', icon: Package, count: items.length },
    { id: 'hsn', label: 'HSN', icon: Hash, count: 2 },
    { id: 'warehouses', label: 'Warehouses', icon: MapPin, count: 3 }
  ];

  const handleRowClick = (item) => {
    setSelectedItem(item);
  };

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden gap-6 animate-fadeIn">
      {/* Left Section - Main Content */}
      <div className={`flex-1 flex flex-col gap-6 transition-all duration-500 ${selectedItem ? 'w-2/3' : 'w-full'}`}>
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-8 border-2 border-black">
          <div className="flex items-center gap-6">
             <div className="p-4 bg-black text-white">
                {activeTab === 'parties' ? <Users size={28} /> : <Package size={28} />}
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
             onClick={() => setModals({ ...modals, [activeTab === 'parties' ? 'party' : 'item']: true })}
             className="px-10"
          >
             Initialize {activeTab === 'parties' ? 'Party' : 'Item'}
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
                       {activeTab === 'parties' ? (
                         <>
                           <th className="px-8 py-5">Entity Name & Identifiers</th>
                           <th className="px-8 py-5">Classification</th>
                           <th className="px-8 py-5">Communication</th>
                           <th className="px-8 py-5">Jurisdiction</th>
                         </>
                       ) : (
                         <>
                           <th className="px-8 py-5">Item Identity</th>
                           <th className="px-8 py-5">Architecture</th>
                           <th className="px-8 py-5">Compliance</th>
                           <th className="px-8 py-5">Inventory Unit</th>
                         </>
                       )}
                    </tr>
                 </thead>
                 <tbody className="divide-y-2 divide-slate-50">
                    {activeTab === 'parties' && parties.map(party => (
                      <tr 
                        key={party.id} 
                        onClick={() => handleRowClick(party)}
                        className={`cursor-pointer transition-all ${
                          selectedItem?.id === party.id ? 'bg-slate-100' : 'hover:bg-slate-50'
                        }`}
                      >
                         <td className="px-8 py-5">
                            <p className="text-[11px] font-black text-black uppercase tracking-widest">{party.name}</p>
                            <p className="text-[9px] text-slate-400 font-black uppercase mt-1 tracking-widest">{party.gstin || 'GST: UNREGISTERED'}</p>
                         </td>
                         <td className="px-8 py-5">
                            <span className={`px-3 py-1 border-2 text-[9px] font-black uppercase tracking-widest ${
                              party.type === 'Customer' ? 'bg-black text-white border-black' : 'border-slate-200 text-slate-400'
                            }`}>
                              {party.type}
                            </span>
                         </td>
                         <td className="px-8 py-5 text-[10px] font-black text-black tracking-widest">{party.mobile}</td>
                         <td className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{party.state}</td>
                      </tr>
                    ))}
                    {activeTab === 'items' && items.map(item => (
                      <tr 
                        key={item.id} 
                        onClick={() => handleRowClick(item)}
                        className={`cursor-pointer transition-all ${
                          selectedItem?.id === item.id ? 'bg-slate-100' : 'hover:bg-slate-50'
                        }`}
                      >
                         <td className="px-8 py-5">
                            <p className="text-[11px] font-black text-black uppercase tracking-widest">{item.itemName}</p>
                            <p className="text-[9px] text-slate-400 font-black uppercase mt-1 tracking-widest">{item.category}</p>
                         </td>
                         <td className="px-8 py-5 text-[10px] font-black text-black uppercase tracking-widest">{item.design}</td>
                         <td className="px-8 py-5 text-[10px] font-black text-slate-400 tracking-[0.2em]">{item.hsnCode}</td>
                         <td className="px-8 py-5 text-[10px] font-black text-black uppercase tracking-widest">{item.unit}</td>
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
    </div>
  );
};

const SmartPanel = ({ data, onClose, type }) => {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
       {/* Panel Header */}
       <div className="p-8 border-b-2 border-black flex items-center justify-between bg-black text-white">
          <div>
             <h3 className="text-[11px] font-black uppercase tracking-[0.4em]">{type === 'parties' ? 'Entity Dossier' : 'Asset Intelligence'}</h3>
             <p className="text-[9px] text-slate-400 font-black mt-2 uppercase tracking-[0.3em]">{data.id}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 transition-all text-white"><Plus className="rotate-45" size={24} /></button>
       </div>

       {/* Panel Content */}
       <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar">
          <div className="flex flex-col items-center text-center">
             <div className="w-24 h-24 bg-black text-white flex items-center justify-center mb-6">
                {type === 'parties' ? <User size={40} strokeWidth={2.5} /> : <Package size={40} strokeWidth={2.5} />}
             </div>
             <h2 className="text-xl font-black text-black uppercase tracking-tight leading-tight">{type === 'parties' ? data.name : data.itemName}</h2>
             <span className="text-[10px] font-black uppercase tracking-[0.3em] px-5 py-2 bg-slate-100 text-black mt-6">{type === 'parties' ? data.type : data.design}</span>
          </div>

          <div className="space-y-10">
             <PanelSection title="Critical Data">
                {type === 'parties' ? (
                   <>
                     <DetailItem icon={Phone} label="Contact Primary" value={data.mobile} />
                     <DetailItem icon={Globe} label="Portal GSTIN" value={data.gstin || 'UNREGISTERED'} />
                     <DetailItem icon={CreditCard} label="PAN Registry" value={data.pan || 'N/A'} />
                     <DetailItem icon={MapPin} label="Geographic State" value={data.state} />
                   </>
                ) : (
                   <>
                     <DetailItem icon={Hash} label="HSN/SAC Schema" value={data.hsnCode} />
                     <DetailItem icon={ShoppingBag} label="Design Reference" value={data.design} />
                     <DetailItem icon={Package} label="Classification" value={data.category} />
                     <DetailItem icon={FileText} label="Inventory Basis" value={data.unit} />
                   </>
                )}
             </PanelSection>

             <PanelSection title="Operational Metrics">
                {type === 'parties' ? (
                   <>
                     <DetailItem icon={Banknote} label="Opening Balance" value={`₹ ${data.openingBalance}`} />
                     <DetailItem icon={CreditCard} label="Authorized Limit" value={`₹ ${data.creditLimit}`} />
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
          </div>
       </div>

       {/* Panel Actions */}
       <div className="p-8 bg-white border-t-2 border-black grid grid-cols-2 gap-2">
          <ERPButton variant="secondary" icon={Edit2} className="text-[10px] h-14">Edit Master</ERPButton>
          <ERPButton variant="indigo" icon={ArrowRight} className="text-[10px] h-14">{type === 'parties' ? 'Ledger' : 'Stock'}</ERPButton>
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
     <div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
        <p className="text-[11px] font-black text-black uppercase tracking-widest">{value}</p>
     </div>
  </div>
);

export default MasterPage;
