import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import ERPCombobox from '../erp/ERPCombobox';

export const FormField = ({ label, error, children, className = '', required = false }) => (
  <div className={`erp-field ${className}`}>
    {label && (
      <label className={`erp-label ${required ? 'text-[var(--red)]' : ''}`}>{label}</label>
    )}
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

export const ERPSelect = ({
  options = [],
  value,
  onChange,
  error,
  label,
  className = '',
  placeholder,
  recentKey = null,
  onCreateNew = null,
  createLabel,
  disabled = false,
  ...props
}) => (
  <ERPCombobox
    value={value}
    onChange={(val) => onChange?.({ target: { value: val } })}
    options={options.map((o) =>
      typeof o === 'object' && o !== null && 'value' in o
        ? o
        : { value: o.value ?? o, label: o.label ?? String(o.value ?? o) }
    )}
    placeholder={placeholder || `Select ${label || 'option'}`}
    error={error}
    disabled={disabled}
    className={className}
    recentKey={recentKey}
    onCreateNew={onCreateNew}
    createLabel={createLabel || label}
    {...props}
  />
);

/** @deprecated use ERPSelect — alias for backward compatibility */
export const ERPSearchableSelect = ({
  options = [],
  value,
  onChange,
  onCreateNew,
  placeholder = 'Search...',
  label,
  createLabel,
  className = '',
  recentKey = null,
  disabled = false,
}) => (
  <ERPCombobox
    options={options}
    value={value}
    onChange={onChange}
    onCreateNew={onCreateNew}
    placeholder={placeholder}
    createLabel={createLabel || label || 'Record'}
    recentKey={recentKey || (label ? `master-${label.toLowerCase()}` : null)}
    className={className}
    disabled={disabled}
  />
);

export { default as ERPCombobox } from '../erp/ERPCombobox';
export { default as ERPField } from '../erp/ERPField';

export const ERPButton = ({ variant = 'primary', icon: Icon, children, className = '', ...props }) => (
  <button
    type="button"
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

export const ERPCreateButton = ({ onClick, label, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`text-[11px] font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)] flex items-center gap-1 ${className}`}
  >
    <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
    {label}
  </button>
);
