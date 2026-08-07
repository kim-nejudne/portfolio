import { createContext, useContext } from 'react';
import { Role } from '../../lib/session';

export interface StaffSession {
  role: Role | null;
  /** A demo session may read everything and change nothing. */
  readOnly: boolean;
  /**
   * Spread onto any control that writes. One place to express "this mutates",
   * so a read-only session cannot fire it and it reads as unavailable rather
   * than broken. The server enforces the same rule; this only mirrors it.
   */
  writeProps: { disabled?: true; title?: string };
  /** Appended to the className of a writing control. */
  writeClass: string;
  /** Surfaces a refused or failed write instead of logging where nobody looks. */
  reportActionError: (err: unknown, fallback: string) => void;
}

const StaffSessionContext = createContext<StaffSession | null>(null);

export const StaffSessionProvider = StaffSessionContext.Provider;

export function useStaffSession(): StaffSession {
  const ctx = useContext(StaffSessionContext);
  if (!ctx) throw new Error('useStaffSession must be used inside a StaffSessionProvider');
  return ctx;
}
