import React from 'react';
import { ChevronDown } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

const SelectInput = ({ label, options = [], error, className, ...props }) => {
  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-0.5">
          {label}
        </label>
      )}
      <div className="relative group">
        <select
          className={twMerge(
            "w-full bg-slate-50 border border-slate-200 rounded-lg pl-4 pr-10 py-2 text-[13px] outline-none appearance-none transition-all focus:bg-white focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500",
            error && "border-rose-500 focus:ring-rose-500/10 focus:border-rose-500",
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-emerald-600 transition-colors">
          <ChevronDown size={14} />
        </div>
      </div>
      {error && <p className="text-[10px] text-rose-600 font-bold px-0.5">{error}</p>}
    </div>
  );
};

export default SelectInput;
