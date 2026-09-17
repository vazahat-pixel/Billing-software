/**
 * Internal QA / Stage modals — hidden from end-user ERP unless explicitly enabled.
 */
export const showDevTools = () =>
  import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV_TOOLS === '1';

/** Menu labels that are staging labs, not customer-facing ERP. */
export const DEV_ONLY_MENU_LABELS = new Set([
  'Business Automation',
  'Enterprise Platform',
  'Infrastructure & Security',
  'Stage 2 Ops',
]);
