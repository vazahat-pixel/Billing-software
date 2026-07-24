import React from 'react';
import { Loader2 } from 'lucide-react';

const cx = (...parts) => parts.filter(Boolean).join(' ');

export function Skeleton({ className = '', style }) {
  return (
    <div
      className={cx('erp-skeleton', className)}
      style={style}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={cx('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3 rounded"
          style={{ width: i === lines - 1 ? '70%' : '100%' }}
        />
      ))}
    </div>
  );
}

export function SkeletonBlock({ className = 'h-24 rounded-lg' }) {
  return <Skeleton className={className} />;
}

export function SkeletonTable({ rows = 6, cols = 5, className = '' }) {
  return (
    <div className={cx('border border-[var(--border-subtle)] rounded-lg overflow-hidden', className)}>
      <div className="flex gap-3 px-3 py-2 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)]">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1 rounded" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3 px-3 py-2.5 border-b border-[var(--border-subtle)] last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-3 flex-1 rounded" style={{ opacity: 1 - c * 0.08 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={cx('erp-card p-4 space-y-3', className)}>
      <Skeleton className="h-4 w-1/3 rounded" />
      <Skeleton className="h-8 w-2/3 rounded" />
      <SkeletonText lines={2} />
    </div>
  );
}

export function SkeletonDashboard({ cards = 4, className = '' }) {
  return (
    <div className={cx('space-y-4', className)}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: cards }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <SkeletonTable rows={8} cols={6} />
    </div>
  );
}

export function PageSkeleton({ title = true, table = true, className = '' }) {
  return (
    <div className={cx('space-y-4 animate-fade-in p-1', className)} aria-busy="true" aria-label="Loading">
      {title && (
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40 rounded" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      )}
      {table && <SkeletonTable rows={10} cols={5} />}
    </div>
  );
}

export function SectionSkeleton({ className = '' }) {
  return (
    <div className={cx('erp-card p-4', className)} aria-busy="true">
      <Skeleton className="h-4 w-32 rounded mb-3" />
      <SkeletonText lines={4} />
    </div>
  );
}

export function Spinner({ size = 16, className = '' }) {
  return (
    <Loader2
      className={cx('animate-spin text-[var(--color-primary)]', className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

export function ButtonLoader({ label = 'Saving…', className = '' }) {
  return (
    <span className={cx('inline-flex items-center gap-2', className)}>
      <Spinner size={14} />
      <span>{label}</span>
    </span>
  );
}

export function InlineLoader({ message = 'Loading…', className = '' }) {
  return (
    <div className={cx('flex items-center gap-2 text-[11px] text-[var(--text-muted)]', className)}>
      <Spinner size={14} />
      {message}
    </div>
  );
}

export function TableLoaderOverlay({ message = 'Loading data…' }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg-card)]/75 backdrop-blur-[1px] rounded-lg">
      <InlineLoader message={message} />
    </div>
  );
}

export function ModalLoader({ message = 'Please wait…' }) {
  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/85 backdrop-blur-[1px]"
      aria-busy="true"
      aria-live="polite"
    >
      <Spinner size={28} />
      <p className="mt-3 text-[12px] font-semibold text-[var(--text-secondary)] tracking-wide">{message}</p>
    </div>
  );
}

/** Classic ERP window overlay — parent must be `relative` (classic-erp-window is fine with position) */
export function ErpBusyOverlay({ show, message = 'Loading…' }) {
  if (!show) return null;
  return <ModalLoader message={message} />;
}

/** Footer Save button content helper */
export function SaveButtonLabel({ saving, idle = 'Save', busy = 'Saving…' }) {
  return saving ? <ButtonLoader label={busy} /> : idle;
}

export function DropdownLoader() {
  return (
    <div className="flex items-center justify-center gap-2 py-4 text-[11px] text-[var(--text-muted)]">
      <Spinner size={14} />
      Searching…
    </div>
  );
}

export function CardGridLoader({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function ReportLoader() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full rounded-lg" />
      <SkeletonTable rows={12} cols={4} />
    </div>
  );
}

export function ProgressBar({ value = 0, className = '' }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={cx('h-1.5 w-full rounded-full bg-[var(--border-subtle)] overflow-hidden', className)}>
      <div
        className="h-full bg-[var(--color-primary)] transition-all duration-300 ease-out rounded-full"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
