import React from 'react';

export function Card({
  children,
  className = '',
  title,
  actions,
}: {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-5 py-3">
          {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** Label/value pairs for a profile card. */
export function DefinitionList({
  items,
}: {
  items: { label: string; value: React.ReactNode }[];
}) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">{item.label}</dt>
          <dd className="mt-0.5 break-words text-sm text-foreground">{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
