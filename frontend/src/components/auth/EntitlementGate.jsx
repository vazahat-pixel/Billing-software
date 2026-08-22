import React from 'react';
import { Lock } from 'lucide-react';
import useEntitlements from '../../hooks/useEntitlements';

/**
 * Gates UI on what the company's plan actually includes.
 *
 * Two modes, because the two cases mean different things to the operator:
 *
 *   lock (default) — the control stays visible but disabled, with a padlock.
 *                    Used when the plan does not include the module: the
 *                    operator should be able to see there is more to buy.
 *   hide           — the control is removed entirely. Used when the module
 *                    was switched off for this company, where showing a
 *                    padlock would only invite a support call.
 *
 * This is presentation only. The API refuses the same calls independently, so
 * a bypassed gate leaks nothing.
 */
export default function EntitlementGate({
  module,
  mode = 'lock',
  fallback = null,
  children,
}) {
  const { hasModule, isUpsell } = useEntitlements();

  if (!module || hasModule(module)) return <>{children}</>;

  // Not in the plan → worth showing as lockable. Switched off by the admin →
  // hide, unless the caller explicitly asked to lock.
  const effectiveMode = mode === 'auto' ? (isUpsell(module) ? 'lock' : 'hide') : mode;

  if (effectiveMode === 'hide') return fallback;

  return (
    <div
      className="relative opacity-50 pointer-events-none select-none"
      aria-disabled="true"
      title={
        isUpsell(module)
          ? 'Not included in your plan'
          : 'Switched off for your company'
      }
    >
      {children}
      <span className="absolute top-1 right-1 text-slate-500">
        <Lock size={12} strokeWidth={3} />
      </span>
    </div>
  );
}

/** Inline padlock for menu rows that cannot host a wrapper. */
export function ModuleLockBadge({ module }) {
  const { hasModule, isUpsell } = useEntitlements();
  if (!module || hasModule(module)) return null;

  return (
    <span
      className="ml-auto text-slate-400"
      title={isUpsell(module) ? 'Not included in your plan' : 'Switched off for your company'}
    >
      <Lock size={11} strokeWidth={3} />
    </span>
  );
}
