import React from 'react';
import { AlertTriangle, Clock, Lock, Zap } from 'lucide-react';
import useEntitlements from '../../hooks/useEntitlements';

/**
 * Commercial status in the top bar: plan name, days remaining, and the
 * monthly invoice meter.
 *
 * Only speaks up when something needs attention. A healthy account with plenty
 * of runway shows a quiet plan chip; expiry, read-only grace and a nearly
 * spent quota escalate, so the operator learns about a lapse before a save
 * fails rather than from a 402.
 */

const WARN_DAYS = 15;

export default function PlanStatusBadge() {
  const { entitlements, status, daysLeft, isReadOnly, plan, usage, loading } = useEntitlements();

  if (loading || entitlements.degraded) return null;

  const invoices = usage?.invoices;
  const quotaWarn = invoices?.warn || invoices?.exceeded;
  const expiryWarn = daysLeft !== null && daysLeft <= WARN_DAYS;

  // Most severe state wins the chip.
  let tone = 'quiet';
  let Icon = Zap;
  let text = plan?.name ? plan.name.toUpperCase() : 'PLAN';

  if (status === 'suspended' || status === 'expired') {
    tone = 'critical';
    Icon = Lock;
    text = status === 'suspended' ? 'ACCOUNT SUSPENDED' : 'SUBSCRIPTION EXPIRED';
  } else if (isReadOnly || status === 'grace') {
    tone = 'critical';
    Icon = AlertTriangle;
    text = `READ ONLY · ${daysLeft}D LEFT`;
  } else if (expiryWarn) {
    tone = 'warn';
    Icon = Clock;
    text = `${daysLeft} DAY${daysLeft === 1 ? '' : 'S'} LEFT`;
  } else if (invoices?.exceeded) {
    tone = 'critical';
    Icon = AlertTriangle;
    text = 'INVOICE LIMIT REACHED';
  } else if (quotaWarn) {
    tone = 'warn';
    Icon = AlertTriangle;
    text = `${invoices.used}/${invoices.limit} INVOICES`;
  }

  const styles = {
    quiet: 'bg-slate-50 border-slate-100 text-slate-500',
    warn: 'bg-amber-50 border-amber-200 text-amber-700',
    critical: 'bg-red-50 border-red-200 text-red-700',
  }[tone];

  const title = [
    plan?.name ? `Plan: ${plan.name}` : null,
    daysLeft !== null ? `${daysLeft} day(s) remaining` : null,
    invoices?.limit ? `Invoices this month: ${invoices.used}/${invoices.limit}` : null,
    entitlements.statusReason || null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className={`hidden md:flex items-center gap-2 px-4 py-2.5 border rounded-2xl ${styles}`}
      title={title}
    >
      <Icon size={13} strokeWidth={3} />
      <span className="text-[10px] font-black uppercase tracking-widest">{text}</span>
    </div>
  );
}
