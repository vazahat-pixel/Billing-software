import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSearch, faChevronDown } from '@fortawesome/free-solid-svg-icons';

/**
 * FormField Wrapper - Upgraded for Premium Spacing
 */
export const FormField = ({ label, error, children, className = "" }) => (
  <div className={`erp-module-container erp-field ${className}`}>
    {label && <label className="erp-label">{label}</label>}
    <div className="erp-input-container">
      {children}
    </div>
    {error && <span className="text-[11px] font-bold text-rose-500 mt-1.5 pl-1 uppercase tracking-wider">{error}</span>}
  </div>
);

/**
 * Premium ERP Input - Upgraded with smooth interactions
 */
export const ERPInput = ({ 
  type = "text", 
  placeholder, 
  value, 
  onChange, 
  error, 
  disabled,
  className = "",
  ...props 
}) => (
  <input
    type={type}
    className={`erp-input ${error ? 'border-rose-400 focus:border-rose-500' : ''} ${className}`}
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    disabled={disabled}
    {...props}
  />
);

/**
 * Premium ERP Select - Upgraded with custom styling
 */
export const ERPSelect = ({ options = [], value, onChange, error, label, className = "", ...props }) => (
  <select
    className={`erp-select ${error ? 'border-rose-400 focus:border-rose-500' : ''} ${className}`}
    value={value}
    onChange={onChange}
    {...props}
  >
    <option value="">Select {label || 'Option'}</option>
    {options.map(opt => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
  </select>
);

/**
 * Advanced Searchable Select with Inline Creation
 */
export const ERPSearchableSelect = ({ 
  options = [], 
  value, 
  onChange, 
  onCreateNew, 
  placeholder = "Search...", 
  label,
  className = "" 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value);
  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`erp-input cursor-pointer flex justify-between items-center ${isOpen ? 'ring-2 ring-blue-500/20 border-blue-500' : ''}`}
      >
        <span className={selectedOption ? 'text-inherit' : 'text-slate-400'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <FontAwesomeIcon icon={faChevronDown} className={`text-[10px] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 shadow-2xl z-[200] rounded-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="p-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
            <FontAwesomeIcon icon={faSearch} className="text-slate-400 text-xs" />
            <input 
              autoFocus
              className="w-full bg-transparent border-none outline-none text-xs h-6"
              placeholder={`Type to search ${label}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => (
                <div 
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={`px-3 py-2 text-xs cursor-pointer transition-colors ${value === opt.value ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50'}`}
                >
                  {opt.label}
                </div>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-slate-400 text-xs">
                No results found for "{search}"
              </div>
            )}
          </div>

          {onCreateNew && (
            <div 
              onClick={() => {
                onCreateNew(search);
                setIsOpen(false);
              }}
              className="p-2 border-t border-slate-100 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold cursor-pointer flex items-center gap-2 transition-colors"
            >
              <FontAwesomeIcon icon={faPlus} />
              Create New "{search || label}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * ERP Button - Upgraded with smooth click animations & colorful variants
 */
export const ERPButton = ({ variant = "indigo", icon: Icon, children, className = "", ...props }) => (
  <button 
    className={`erp-btn erp-btn-${variant} ${className}`} 
    {...props}
  >
    {Icon && <Icon size={18} className="relative z-10" />}
    <span className="relative z-10">{children}</span>
  </button>
);

/**
 * ERP Form Section - For grouping fields with style
 */
export const ERPSection = ({ title, icon: Icon, children, className = "" }) => (
  <div className={`erp-form-section ${className}`}>
    <div className="erp-form-section-header">
      {Icon && <Icon size={18} />}
      <h4 className="erp-form-section-title">{title}</h4>
    </div>
    {children}
  </div>
);
