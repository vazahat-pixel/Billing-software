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
  ShieldCheck,
  Truck,
  Users,
  CreditCard,
  Lock,
  Bell
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';

import useStore from '../../store/useStore';

const Sidebar = () => {
  const { logout } = useStore();

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Tapals', icon: ShoppingCart, path: '/purchase' },
    { name: 'Harvest', icon: Hammer, path: '/jobwork' },
    { name: 'Inventory', icon: Warehouse, path: '/inventory' },
    { name: 'Logistics', icon: Truck, path: '/logistics' },
    { name: 'Drivers', icon: Users, path: '/drivers' },
    { name: 'Vehicle Fleet', icon: Warehouse, path: '/fleet' },
    { name: 'Outlets', icon: Warehouse, path: '/outlets' },
    { name: 'Finance', icon: CreditCard, path: '/accounting' },
    { name: 'Billing', icon: FileText, path: '/billing' },
    { name: 'Access Control', icon: Lock, path: '/access' },
    { name: 'Settings', icon: Settings, path: '/settings' },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-100 flex flex-col h-screen sticky top-0 overflow-hidden">
      <div className="p-8 mb-4">
        <h1 className="text-2xl font-black italic tracking-tighter text-black">OGUN<span className="text-slate-300">.</span></h1>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto no-scrollbar">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => 
              twMerge(
                'flex items-center gap-4 px-4 py-3 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all duration-200',
                isActive 
                  ? 'bg-black text-white shadow-lg' 
                  : 'text-slate-400 hover:bg-slate-50 hover:text-black'
              )
            }
          >
            <item.icon size={18} />
            {item.name}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-50 space-y-1">
        <NavLink
          to="/notifications"
          className="flex items-center gap-4 px-4 py-3 rounded-lg text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:bg-slate-50 hover:text-black transition-all"
        >
          <Bell size={18} />
          Notifications
        </NavLink>
        <button 
          onClick={logout}
          className="flex items-center gap-4 px-4 py-3 rounded-lg text-[11px] font-bold uppercase tracking-widest text-rose-500 hover:bg-rose-50 transition-all w-full text-left"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
