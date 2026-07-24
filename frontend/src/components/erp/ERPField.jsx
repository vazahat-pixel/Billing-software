import React from 'react';

/** Standard ERP field row: label + control */
export default function ERPField({
  label,
  required = false,
  error = null,
  children,
  className = '',
  labelClassName = '',
  compact = false,
}) {
  return (
    <div className={`classic-erp-field ${compact ? 'classic-erp-field--compact' : ''} ${className}`}>
      {label ? (
        <span className={`classic-erp-label ${required ? 'red-label' : ''} ${labelClassName}`}>
          {label}
          {required ? ':' : ''}
        </span>
      ) : null}
      <div className="classic-erp-control classic-erp-control--grow">
        {children}
        {error ? <span className="erp-field-error">{error}</span> : null}
      </div>
    </div>
  );
}
