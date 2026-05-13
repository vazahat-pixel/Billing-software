import React from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Bell, User, ChevronDown, Calendar, Building, LogOut, Settings } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import useStore from '../../store/useStore';

const Topbar = () => {
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const { logout, user } = useStore();
  const location = useLocation();

  const pageTitle = React.useMemo(() => {
    const path = location.pathname;
    if (path === '/') return 'Command Center';
    if (path.includes('purchase')) return 'Purchase Ledger';
    if (path.includes('sales')) return 'Sales Registry';
    if (path.includes('inventory')) return 'Stock Analytics';
    if (path.includes('jobwork')) return 'Harvest Processing';
    if (path.includes('accounting')) return 'Financial Intelligence';
    if (path.includes('gst')) return 'Compliance Dashboard';
    if (path.includes('logistics')) return 'Fleet Intelligence';
    return 'Enterprise ERP';
  }, [location.pathname]);

  return (
    <header className="h-[80px] bg-white/80 backdrop-blur-md border-b border-slate-100 px-10 flex items-center justify-between no-print sticky top-0 z-[50]">
      <div className="flex items-center gap-8">
        <div className="flex flex-col">
           <h1 className="text-[18px] font-black text-black italic tracking-tight">
             {pageTitle}<span className="text-slate-300">.</span>
           </h1>
           <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mt-0.5">Golden Enterprise System</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Modern Search Bar */}
        <div className="hidden lg:flex items-center gap-3 px-5 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl w-80 group focus-within:border-black transition-all">
           <Search size={16} className="text-slate-300 group-focus-within:text-black transition-colors" />
           <input 
             type="text" 
             placeholder="QUICK COMMAND (CTRL + K)" 
             className="bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-widest text-black placeholder:text-slate-300 w-full"
           />
        </div>

        {/* Company Badge */}
        <div className="hidden md:flex items-center gap-3 px-5 py-2.5 bg-black text-white rounded-2xl shadow-xl shadow-black/10">
          <Building size={14} strokeWidth={3} />
          <span className="text-[10px] font-black uppercase tracking-widest">{user?.companyName || 'LAXMI LIBAS'}</span>
        </div>

        <button className="p-3 text-black bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:shadow-md transition-all relative group">
          <Bell size={20} className="group-hover:rotate-12 transition-transform" />
          <span className="absolute top-3 right-3 w-2 h-2 bg-black border-2 border-white rounded-full"></span>
        </button>

        <div className="h-10 w-[1px] bg-slate-100"></div>

        <div className="relative">
          <div
            className="flex items-center gap-4 cursor-pointer group"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            <div className="text-right hidden sm:block">
              <p className="text-[11px] font-black text-black leading-none uppercase tracking-widest">
                {user?.name || 'ADMINISTRATOR'}
              </p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1.5">
                {user?.role === 'super_admin' ? 'Root Access' : 'Standard Node'}
              </p>
            </div>
            <div className="w-[44px] h-[44px] bg-black rounded-2xl flex items-center justify-center text-white text-[12px] font-black shadow-xl group-hover:scale-105 transition-transform">
              {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'AD'}
            </div>
            <ChevronDown size={14} className={twMerge("text-slate-400 transition-transform duration-300", showProfileMenu && "rotate-180")} />
          </div>

          {showProfileMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowProfileMenu(false)}></div>
              <div className="absolute right-0 mt-4 w-64 bg-white border border-slate-100 rounded-[2rem] shadow-2xl z-20 overflow-hidden animate-premium p-2">
                <div className="p-6 border-b border-slate-50 bg-slate-50/50 rounded-t-[1.5rem] mb-2">
                  <p className="text-[11px] font-black text-black uppercase tracking-widest">{user?.name || 'ADMIN'}</p>
                  <p className="text-[10px] font-bold text-slate-400 truncate mt-1">{user?.email || 'admin@ogun.erp'}</p>
                </div>
                <div className="space-y-1">
                  <button className="w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 hover:text-black rounded-xl flex items-center gap-4 transition-all">
                    <User size={16} strokeWidth={2.5} />
                    Identity Profile
                  </button>
                  <button className="w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 hover:text-black rounded-xl flex items-center gap-4 transition-all">
                    <Settings size={16} strokeWidth={2.5} />
                    Node Preferences
                  </button>
                  <div className="h-[1px] bg-slate-50 mx-4 my-2"></div>
                  <button
                    onClick={logout}
                    className="w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 rounded-xl flex items-center gap-4 transition-all"
                  >
                    <LogOut size={16} strokeWidth={2.5} />
                    Terminate Session
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
