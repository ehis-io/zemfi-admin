'use client';

import React, { useEffect, useState } from 'react';
import { AdminContext } from './AdminContext';
import { Spinner } from './ui/Feedback';
import { api } from '../lib/api';
import { getToken, signOut } from '../lib/auth';
import type { Admin } from '../lib/types';

/**
 * Client-side gate for everything under /dashboard.
 *
 * The token lives in localStorage, which the server never sees, so this has
 * to run in the browser: no token means straight to /login, otherwise
 * GET /admin/me proves the token is still good (a 401 there clears it and
 * redirects via the api client) and gives the shell the admin's name/role.
 * Children render only once that check has passed.
 */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);

  useEffect(() => {
    if (!getToken()) {
      signOut();
      return;
    }
    let cancelled = false;
    api
      .get<Admin>('/admin/me')
      .then((me) => {
        if (!cancelled) setAdmin(me);
      })
      .catch(() => {
        // A 401 has already been handled by the api client. Anything else
        // (network, 5xx) still means we cannot vouch for the session.
        if (!cancelled) signOut();
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!admin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return <AdminContext.Provider value={{ admin, signOut }}>{children}</AdminContext.Provider>;
}
