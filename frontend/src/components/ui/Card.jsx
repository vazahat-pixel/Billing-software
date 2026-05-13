import React from 'react';
import { twMerge } from 'tailwind-merge';

const Card = ({ children, title, subtitle, extra, className, noPadding = false }) => {
  return (
    <div className={twMerge('card-professional', className)}>
      {(title || extra) && (
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            {title && <h3 className="text-sm font-bold text-slate-900">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {extra && <div>{extra}</div>}
        </div>
      )}
      <div className={twMerge(noPadding ? 'p-0' : 'p-6')}>
        {children}
      </div>
    </div>
  );
};

export default Card;
