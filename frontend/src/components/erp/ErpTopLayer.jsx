import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders a popup (F3 find list, after-save actions) on document.body so it always sits above the
 * bill window, which Modal already portals to body. Inside the bill's own DOM a fixed overlay is
 * trapped under the bill's stacking context, which is why Find opened behind the bill.
 *
 * Find lists highlight the current row (blue row + amber bill-no badge). After every update the
 * highlighted row is scrolled into view, so Up/Down visibly move through long lists.
 */
export default function ErpTopLayer({ children }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const active = ref.current?.querySelector('.bg-blue-600:has(.bg-amber-400)');
    active?.scrollIntoView({ block: 'nearest' });
  });

  if (typeof document === 'undefined') return children;
  return createPortal(
    <div ref={ref} data-erp-top-layer style={{ display: 'contents' }}>{children}</div>,
    document.body
  );
}
