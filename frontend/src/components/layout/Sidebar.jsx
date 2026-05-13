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
  Bell,
  Command
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';

import useStore from '../../store/useStore';

const Sidebar = () => {
  const { logout } = useStore();

  const menuItems = [
    { name: 'Terminal', icon: LayoutDashboard, path: '/' },
    { name: 'Tapal Deck', icon: ShoppingCart, path: '/purchase' },
    { name: 'Harvest Ops', icon: Hammer, path: '/jobwork' },
    { name: 'Warehouse', icon: Warehouse, path: '/inventory' },
    { name: 'Logistics', icon: Truck, path: '/logistics' },
    { name: 'Driver Fleet', icon: Users, path: '/drivers' },
    { name: 'Accounting', icon: CreditCard, path: '/accounting' },
    { name: 'Billing', icon: FileText, path: '/billing' },
    { name: 'Security', icon: Lock, path: '/access' },
    { name: 'System', icon: Settings, path: '/settings' },
  ];

  return (
    <aside className="w-72 bg-white border-r border-slate-100 flex flex-col h-screen sticky top-0 overflow-hidden select-none">
      <div className="p-10 mb-2">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center text-white shadow-xl">
              <Command size={20} strokeWidth={3} />
           </div>
           <div>
              <h1 className="text-2xl font-black italic tracking-tighter text-black leading-none">OGUN<span className="text-slate-200">.</span></h1>
              <p className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-300 mt-1">Enterprise ERP</p>
           </div>
        </div>
      </div>

      <nav className="flex-1 px-6 space-y-2 overflow-y-auto no-scrollbar py-4">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              twMerge(
                'flex items-center gap-4 px-5 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300 group',
                isActive
                  ? 'bg-black text-white shadow-2xl shadow-black/20 scale-[1.02]'
                  : 'text-slate-400 hover:bg-slate-50 hover:text-black'
              )
            }
          >
            <item.icon size={18} className={twMerge("transition-transform duration-300 group-hover:scale-110", "stroke-[2.5]")} />
            {item.name}
          </NavLink>
        ))}
      </nav>

      <div className="p-6 border-t border-slate-50 space-y-2">
        <NavLink
          to="/notifications"
          className="flex items-center gap-4 px-5 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 hover:bg-slate-50 hover:text-black transition-all group"
        >
          <Bell size={18} className="stroke-[2.5] group-hover:rotate-12 transition-transform" />
          Alerts
        </NavLink>
        <button
          onClick={logout}
          className="flex items-center gap-4 px-5 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] text-rose-500 hover:bg-rose-50 transition-all w-full text-left group"
        >
          <LogOut size={18} className="stroke-[2.5] group-hover:-translate-x-1 transition-transform" />
          Exit Session
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
