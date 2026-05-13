import React from 'react';
import { twMerge } from 'tailwind-merge';

const Badge = ({ children, variant = 'default', className }) => {
  const variants = {
    default: 'bg-slate-100 text-slate-800 border-slate-200',
    success: 'bg-black text-white border-black',
    warning: 'bg-slate-200 text-black border-slate-300',
    danger: 'bg-white text-black border-black border-dashed',
    info: 'bg-slate-800 text-white border-slate-900',
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
