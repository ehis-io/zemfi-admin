'use client';

import React from 'react';
import { RequireAdmin } from './RequireAdmin';
import { Sidebar } from './Sidebar';
import { ToastProvider } from './ui/Toast';

/** Guard + nav + toasts around every /dashboard page. */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <RequireAdmin>
      <ToastProvider>
        <div className="flex min-h-screen flex-col lg:flex-row">
          <Sidebar />
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </ToastProvider>
    </RequireAdmin>
  );
}
