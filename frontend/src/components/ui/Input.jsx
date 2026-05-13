import React from 'react';
import { twMerge } from 'tailwind-merge';

const Input = ({ label, error, className, ...props }) => {
  return (
    <div className="space-y-1 w-full">
      {label && <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">{label}</label>}
      <input
        className={twMerge(
          'w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-[12px] transition-all focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none placeholder:text-slate-400',
          error && 'border-rose-500 focus:ring-rose-500/10 focus:border-rose-500',
          className
        )}
        {...props}
      />
      {error && <p className="text-[10px] text-rose-600 font-medium">{error}</p>}
    </div>
  );
};

export const Select = ({ label, options = [], error, className, ...props }) => {
  return (
    <div className="space-y-1 w-full">
      {label && <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">{label}</label>}
      <select
        className={twMerge(
          'w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-[12px] transition-all focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none',
          error && 'border-rose-500 focus:ring-rose-500/10 focus:border-rose-500',
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="text-[10px] text-rose-600 font-medium">{error}</p>}
    </div>
  );
};

export default Input;
