'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdmin } from './AdminContext';
import { Button } from './ui/Button';
import { humanize } from '../lib/format';

const LINKS: { href: string; label: string; exact?: boolean }[] = [
  { href: '/dashboard', label: 'Overview', exact: true },
  { href: '/dashboard/users', label: 'Users' },
  { href: '/dashboard/support', label: 'Support' },
];

const isActive = (pathname: string, link: (typeof LINKS)[number]): boolean =>
  link.exact ? pathname === link.href : pathname.startsWith(link.href);

/**
 * Sidebar on wide screens, collapsible top bar on narrow ones. Rendered once
 * by the dashboard layout so every page shares one nav.
 */
export function Sidebar() {
  const pathname = usePathname();
  const { admin, signOut } = useAdmin();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-1">
      {LINKS.map((link) => {
        const active = isActive(pathname, link);
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setOpen(false)}
            aria-current={active ? 'page' : undefined}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? 'bg-primary/15 text-primary-soft'
                : 'text-muted hover:bg-surface hover:text-foreground'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );

  const account = (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-surface-border bg-surface/60 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{admin.name}</p>
        <p className="truncate text-[10px] font-bold uppercase tracking-wider text-muted">
          {humanize(admin.role)}
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={signOut}>
        Sign out
      </Button>
    </div>
  );

  return (
    <>
      <aside className="hidden w-60 shrink-0 flex-col border-r border-surface-border bg-background/80 p-4 lg:flex">
        <Brand />
        <div className="mt-8 flex-1">{nav}</div>
        {account}
      </aside>

      <header className="flex items-center justify-between border-b border-surface-border bg-background/80 px-4 py-3 lg:hidden">
        <Brand />
        <button
          type="button"
          className="rounded-lg border border-surface-border px-3 py-1.5 text-sm text-muted"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-nav"
        >
          Menu
        </button>
      </header>
      {open && (
        <div id="mobile-nav" className="space-y-3 border-b border-surface-border bg-background p-4 lg:hidden">
          {nav}
          {account}
        </div>
      )}
    </>
  );
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white shadow-lg shadow-primary/30">
        R
      </span>
      <span className="text-sm font-semibold tracking-tight text-foreground">Railz Admin</span>
    </Link>
  );
}
