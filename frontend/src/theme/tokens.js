/** Shared semantic token keys — values per theme in themes.js */
export const TOKEN_KEYS = [
  'bg-base',
  'bg-sidebar',
  'bg-card',
  'bg-card-hover',
  'bg-subtle',
  'bg-elevated',
  'border-subtle',
  'border',
  'border-strong',
  'text-primary',
  'text-secondary',
  'text-muted',
  'color-primary',
  'color-primary-hover',
  'color-primary-light',
  'color-secondary',
  'color-success',
  'color-success-bg',
  'color-warning',
  'color-warning-bg',
  'color-danger',
  'color-danger-bg',
  'color-info',
  'color-info-bg',
  'accent',
  'accent-hover',
  'accent-light',
  'accent-gradient',
  'green',
  'green-bg',
  'amber',
  'amber-bg',
  'red',
  'red-bg',
  'blue',
  'blue-bg',
  'shadow-sm',
  'shadow-md',
  'shadow-lg',
  'shadow-float',
  'shadow-glow',
  'radius-card',
  'radius-input',
  'focus-ring',
];

export function toCssVars(tokenMap) {
  const vars = {};
  Object.entries(tokenMap).forEach(([key, value]) => {
    vars[`--${key}`] = value;
  });
  return vars;
}
