import React from 'react';
import { twMerge } from 'tailwind-merge';

const InputNumber = ({ error, className, ...props }) => {
  return (
    <input
      type="number"
      className={twMerge(
        "w-full bg-transparent border-none outline-none text-[13px] font-bold p-0 focus:ring-0 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
        error && "text-rose-500",
        className
      )}
      {...props}
    />
  );
};

export default InputNumber;
