import React from 'react';
import { twMerge } from 'tailwind-merge';

const Badge = ({ children, variant = 'default', className }) => {
  const variants = {
    default: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    warning: 'bg-amber-50 text-amber-700 border-amber-100',
    danger: 'bg-rose-50 text-rose-700 border-rose-100',
    info: 'bg-blue-50 text-blue-700 border-blue-100',
  };

  return (
    <span className={twMerge(
      'px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border',
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
};

export default Badge;
