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
    <aside className="w-[180px] bg-[var(--bg-sidebar)] border-r border-[var(--border)] flex flex-col h-screen sticky top-0 overflow-hidden select-none z-20">
      <div className="p-5 mb-2 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
           <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm shadow-[var(--accent)]/10" style={{ background: 'var(--accent-gradient)' }}>
              <Command size={16} strokeWidth={2.5} />
           </div>
           <div>
              <h1 className="text-lg font-bold tracking-tight text-[var(--text-primary)] leading-none">OGUN<span className="text-[var(--accent)]">.</span></h1>
              <p className="text-[8px] font-medium uppercase tracking-[0.2em] text-[var(--text-muted)] mt-1">Enterprise</p>
           </div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto no-scrollbar py-3">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              twMerge(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-[11px] font-medium tracking-[0.02em] transition-all duration-200 group',
                isActive
                  ? 'bg-[var(--blue-bg)] text-[var(--accent)] shadow-sm border border-transparent'
                  : 'text-[var(--text-secondary)] border border-transparent hover:bg-[var(--bg-base)] hover:text-[var(--text-primary)]'
              )}
            >
            <item.icon size={16} className={twMerge("transition-colors duration-300 group-hover:text-[var(--text-primary)]", "stroke-[2]")} />
            {item.name}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-[var(--border)] space-y-1">
        <NavLink
          to="/notifications"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-[11px] font-medium tracking-[0.02em] text-[var(--text-secondary)] hover:bg-[var(--bg-base)] hover:text-[var(--text-primary)] transition-all group"
        >
          <Bell size={14} className="stroke-[2] group-hover:rotate-12 transition-transform" />
          Alerts
        </NavLink>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-[11px] font-medium tracking-[0.02em] text-[var(--red)] hover:bg-[var(--red-bg)] transition-all w-full text-left group"
        >
          <LogOut size={14} className="stroke-[2] group-hover:-translate-x-1 transition-transform" />
          Exit Session
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
