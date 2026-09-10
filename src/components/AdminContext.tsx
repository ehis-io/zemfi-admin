'use client';

import { createContext, useContext } from 'react';
import type { Admin } from '../lib/types';

export interface AdminSession {
  admin: Admin;
  signOut: () => void;
}

export const AdminContext = createContext<AdminSession | null>(null);

/** The signed-in admin. Only valid under <RequireAdmin>. */
export function useAdmin(): AdminSession {
  const session = useContext(AdminContext);
  if (!session) throw new Error('useAdmin must be used inside <RequireAdmin>');
  return session;
}
