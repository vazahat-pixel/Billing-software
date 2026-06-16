import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSearch, faChevronDown } from '@fortawesome/free-solid-svg-icons';

export const FormField = ({ label, error, children, className = '' }) => (
  <div className={`erp-field ${className}`}>
    {label && <label className="erp-label">{label}</label>}
    <div className="erp-input-container">{children}</div>
    {error && <span className="text-[11px] text-[var(--red)] mt-0.5">{error}</span>}
  </div>
);

export const ERPInput = ({
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  disabled,
  className = '',
  ...props
}) => (
  <input
    type={type}
    className={`erp-input ${error ? 'border-[var(--red)]' : ''} ${className}`}
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    disabled={disabled}
    {...props}
  />
);

export const ERPSelect = ({ options = [], value, onChange, error, label, className = '', ...props }) => (
  <select
    className={`erp-select ${error ? 'border-[var(--red)]' : ''} ${className}`}
    value={value}
    onChange={onChange}
    {...props}
  >
    <option value="">Select {label || 'option'}</option>
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
  </select>
);

export const ERPSearchableSelect = ({
  options = [],
  value,
  onChange,
  onCreateNew,
  placeholder = 'Search...',
  label,
  createLabel,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  const entityLabel = createLabel || label || 'Record';
  const selectedOption = options.find((opt) => opt.value === value);
  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`erp-input cursor-pointer flex justify-between items-center ${isOpen ? 'border-[rgba(0,0,0,0.4)]' : ''}`}
      >
        <span className={selectedOption ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <FontAwesomeIcon icon={faChevronDown} className={`text-[10px] text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-1 bg-[var(--bg-card)] border border-[var(--border-strong)] shadow-[var(--shadow-lg)] z-[200] rounded-lg overflow-hidden animate-fade-in-up origin-top">
          <div className="p-2 border-b border-[var(--border-subtle)] flex items-center gap-2 bg-[var(--bg-base)]">
            <FontAwesomeIcon icon={faSearch} className="text-[var(--accent)] text-xs ml-1" />
            <input
              autoFocus
              className="w-full bg-transparent border-none outline-none text-[13px] font-medium h-7 text-[var(--text-primary)]"
              placeholder={`Search ${entityLabel.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-56 overflow-y-auto no-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`px-3 py-2 text-[13px] cursor-pointer transition-colors ${
                    value === opt.value
                      ? 'bg-[var(--accent-light)] font-semibold text-[var(--accent-hover)]'
                      : 'hover:bg-[var(--bg-base)] text-[var(--text-secondary)] font-medium'
                  }`}
                >
                  {opt.label}
                </div>
              ))
            ) : (
              <div className="px-3 py-3 text-center text-[var(--text-muted)] text-xs">
                {search ? `No ${entityLabel.toLowerCase()} found` : `No ${entityLabel.toLowerCase()} yet`}
              </div>
            )}
          </div>

          {onCreateNew && (
            <button
              type="button"
              onClick={() => {
                onCreateNew(search);
                setIsOpen(false);
                setSearch('');
              }}
              className="w-full px-3 py-2 border-t border-[var(--border-subtle)] text-[13px] text-[var(--accent)] hover:text-[var(--accent-hover)] bg-[var(--accent-light)]/30 hover:bg-[var(--accent-light)] flex items-center gap-2 transition-colors text-left font-semibold"
            >
              <FontAwesomeIcon icon={faPlus} className="text-[11px]" />
              {search ? `Add ${entityLabel}: "${search}"` : `Add new ${entityLabel}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const ERPButton = ({ variant = 'primary', icon: Icon, children, className = '', ...props }) => (
  <button
    className={`erp-btn ${variant === 'secondary' ? 'erp-btn-secondary' : 'erp-btn-primary'} ${className}`}
    {...props}
  >
    {Icon && <Icon size={14} />}
    <span>{children}</span>
  </button>
);

export const ERPSection = ({ title, icon: Icon, children, className = '' }) => (
  <div className={`erp-form-section ${className}`}>
    <div className="erp-form-section-header">
      {Icon && <Icon size={14} />}
      <h4 className="erp-form-section-title">{title}</h4>
    </div>
    {children}
  </div>
);
