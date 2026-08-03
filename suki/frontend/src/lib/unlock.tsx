// Simple unlock context. Scaffolding for real auth. Kept in one module.
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

interface UnlockCtx {
  unlocked: boolean;
  unlock: (pin: string) => boolean;
  lock: () => void;
}

const DEFAULT_PIN = '1234';
const Ctx = createContext<UnlockCtx | null>(null);

export function UnlockProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);

  const unlock = useCallback((pin: string) => {
    const ok = pin === DEFAULT_PIN;
    if (ok) setUnlocked(true);
    return ok;
  }, []);
  const lock = useCallback(() => setUnlocked(false), []);

  const value = useMemo(() => ({ unlocked, unlock, lock }), [unlocked, unlock, lock]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUnlock(): UnlockCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useUnlock must be inside UnlockProvider');
  return v;
}

export const UNLOCK_PIN = DEFAULT_PIN;
