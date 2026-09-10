import React from 'react';

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex justify-center py-16 ${className}`} role="status" aria-label="Loading">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-14 text-center text-sm text-muted">{children}</p>;
}

/** Inline error or notice. */
export function Alert({
  tone = 'danger',
  children,
  className = '',
}: {
  tone?: 'danger' | 'warning' | 'info';
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    danger: 'border-danger/30 bg-danger/10 text-danger',
    warning: 'border-warning/30 bg-warning/10 text-warning',
    info: 'border-primary/30 bg-primary/10 text-primary-soft',
  };
  return (
    <div role="alert" className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]} ${className}`}>
      {children}
    </div>
  );
}
