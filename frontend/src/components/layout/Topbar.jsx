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
    <header className="h-[60px] bg-white border-b border-[#E2E8F0] shadow-sm px-6 flex items-center justify-between no-print">
      <div className="flex items-center gap-6">
        <h1 className="text-[18px] font-semibold text-[#1B3A6B] tracking-tight">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Company Selector Dropdown */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-[#E2E8F0] rounded-lg">
          <Building size={14} className="text-[#0D7377]" />
          <span className="text-[12px] font-semibold text-[#1B3A6B]">{user?.companyName || 'Laxmi Libas Pvt Ltd'}</span>
        </div>

        <button className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all relative">
          <Bell size={18} className="text-[#1B3A6B]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#0D7377] border border-white rounded-full"></span>
        </button>

        <div className="h-6 w-px bg-[#E2E8F0]"></div>

        <div className="relative">
          <div 
            className="flex items-center gap-3 cursor-pointer group hover:bg-slate-50 pl-2 pr-1 py-1 rounded-lg transition-all"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            <div className="text-right hidden sm:block">
              <p className="text-[13px] font-semibold text-[#1B3A6B] leading-none">
                {user?.name || 'Admin User'}
              </p>
              <p className="text-[10px] font-medium text-[#0D7377] uppercase tracking-wider mt-1">
                {user?.role === 'super_admin' ? 'Super Admin' : 'Administrator'}
              </p>
            </div>
            <div className="w-[36px] h-[36px] bg-[#1B3A6B] rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm group-hover:scale-105 transition-transform">
               {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'AD'}
            </div>
            <ChevronDown size={14} className="text-slate-400 transition-transform" />
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
