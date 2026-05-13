import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Warehouse, 
  Hammer, 
  TrendingUp, 
  FileText, 
  Settings,
  Database,
  LogOut,
  Book,
  ShieldCheck
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';

import useStore from '../../store/useStore';

const Sidebar = () => {
  const { plan, role } = useStore();

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/', feature: null },
    { name: 'Masters', icon: Database, path: '/masters', feature: null },
    { name: 'Purchase', icon: ShoppingCart, path: '/purchase', feature: 'purchase' },
    { name: 'Inventory', icon: Warehouse, path: '/inventory', feature: 'inventory' },
    { name: 'Job Work', icon: Hammer, path: '/jobwork', feature: 'jobWork' },
    { name: 'Sales', icon: TrendingUp, path: '/sales', feature: 'purchase' }, // Sales usually tied to purchase/inventory
    { name: 'Accounting', icon: Book, path: '/accounting', feature: 'gst' },
    { name: 'GST', icon: ShieldCheck, path: '/gst', feature: 'gst' },
    { name: 'Reports', icon: FileText, path: '/reports', feature: 'reports' },
  ];

  // Show all items as per user request
  const visibleItems = menuItems;

  const { logout } = useStore();

  return (
    <aside className="sidebar-compact">
      <div className="h-12 px-5 flex items-center gap-2.5 border-b border-slate-50 shrink-0">
        <div className="w-6 h-6 bg-black rounded flex items-center justify-center text-white font-black text-[10px] shadow-md">
          S
        </div>
        <span className="text-[14px] font-black text-black uppercase tracking-widest">Stockly</span>
      </div>

      <div className="flex-1 py-4 space-y-0.5 overflow-y-auto no-scrollbar">
        <p className="px-5 text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Main</p>
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => 
              twMerge('nav-item-compact', isActive && 'active')
            }
          >
            <item.icon size={16} />
            {item.name}
          </NavLink>
        ))}
      </div>

      <div className="p-3 border-t border-slate-50 shrink-0">
        <NavLink to="/settings" className="nav-item-compact">
          <Settings size={16} />
          Settings
        </NavLink>
        <button 
          onClick={logout}
          className="nav-item-compact w-full text-left text-rose-500 hover:bg-rose-50 hover:text-rose-600 mt-1"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
