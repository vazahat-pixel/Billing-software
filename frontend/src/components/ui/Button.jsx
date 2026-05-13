import React from 'react';
import { motion } from 'framer-motion';
import { twMerge } from 'tailwind-merge';

const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  className, 
  loading = false, 
  icon: Icon,
  ...props 
}) => {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
  };

  const sizes = {
    sm: 'px-2.5 py-1 text-[11px]',
    md: 'px-4 py-1.5 text-[12px]',
    lg: 'px-6 py-2 text-[14px]',
  };

  return (
    <button
      className={twMerge(
        'btn-professional disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {Icon && <Icon size={14} className="shrink-0" />}
          {children}
        </>
      )}
    </button>
  );
};

export default Button;
