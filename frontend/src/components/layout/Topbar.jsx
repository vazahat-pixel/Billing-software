import React from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Bell, User, ChevronDown, Calendar, Building } from 'lucide-react';
import useStore from '../../store/useStore';

const Topbar = () => {
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const { logout, user } = useStore();
  const location = useLocation();

  const pageTitle = React.useMemo(() => {
    switch (location.pathname) {
      case '/': return 'Dashboard Analytics';
      case '/sales': return 'Sales Invoice';
      case '/purchases': return 'Purchase Invoice';
      case '/inventory': return 'Inventory Management';
      case '/jobs': return 'Job Work Processing';
      case '/accounting': return 'Financial Ledger & Accounting';
      case '/gst': return 'GST Returns Filing';
      case '/reports': return 'ERP Reports';
      case '/settings': return 'Settings';
      default: return 'Textile ERP';
    }
  }, [location.pathname]);

  return (
    <header className="h-[52px] bg-white border-b border-slate-200 shadow-sm px-6 flex items-center justify-between no-print">
      <div className="flex items-center gap-6">
        <h1 className="text-[14px] font-black text-black uppercase tracking-widest">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Company Selector */}
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded">
          <Building size={14} className="text-black" />
          <span className="text-[11px] font-bold text-black uppercase">{user?.companyName || 'Laxmi Libas'}</span>
        </div>

        <button className="p-2 text-black hover:bg-slate-100 rounded transition-all relative">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-black border border-white rounded-full"></span>
        </button>

        <div className="h-6 w-px bg-slate-200"></div>

        <div className="relative">
          <div 
            className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 pl-2 pr-1 py-1 rounded transition-all"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            <div className="text-right hidden sm:block">
              <p className="text-[11px] font-black text-black leading-none uppercase">
                {user?.name || 'Admin'}
              </p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                {user?.role === 'super_admin' ? 'Super User' : 'Standard'}
              </p>
            </div>
            <div className="w-[32px] h-[32px] bg-black rounded flex items-center justify-center text-white text-[10px] font-black shadow-md">
               {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'AD'}
            </div>
            <ChevronDown size={12} className="text-black" />
          </div>

          {showProfileMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowProfileMenu(false)}></div>
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-xl shadow-xl z-20 overflow-hidden">
                <div className="p-3 border-b border-slate-50">
                  <p className="text-xs font-bold text-slate-800">{user?.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
                </div>
                <div className="p-1">
                  <button className="w-full text-left px-3 py-2 text-[12px] text-slate-600 hover:bg-slate-50 rounded-lg flex items-center gap-2">
                    <User size={14} />
                    My Profile
                  </button>
                  <button 
                    onClick={logout}
                    className="w-full text-left px-3 py-2 text-[12px] text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2"
                  >
                    Logout
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
