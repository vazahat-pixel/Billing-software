import { createPortal } from 'react-dom';

/**
 * Renders a popup (F3 find list, after-save actions) on document.body so it always sits above the
 * bill window, which Modal already portals to body. Inside the bill's own DOM a fixed overlay is
 * trapped under the bill's stacking context, which is why Find opened behind the bill.
 */
export default function ErpTopLayer({ children }) {
  if (typeof document === 'undefined') return children;
  return createPortal(
    <div data-erp-top-layer style={{ display: 'contents' }}>{children}</div>,
    document.body
  );
}
