import React from 'react';
import { twMerge } from 'tailwind-merge';

const FormInput = ({ label, icon: Icon, error, className, ...props }) => {
  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-0.5">
          {label}
        </label>
      )}
      <div className="relative group">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors">
            <Icon size={14} />
          </div>
        )}
        <input
          className={twMerge(
            "w-full bg-slate-50 border border-slate-200 rounded-lg py-2 text-[13px] outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500",
            Icon ? "pl-9 pr-4" : "px-4",
            error && "border-rose-500 focus:ring-rose-500/10 focus:border-rose-500",
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="text-[10px] text-rose-600 font-bold px-0.5">{error}</p>}
    </div>
  );
};

export default FormInput;
