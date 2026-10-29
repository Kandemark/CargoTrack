import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { endSession, loadSession, onSignedOut } from './session';

type Status = 'signedIn' | 'signedOut';

type Auth = {
  status: Status;
  markSignedIn: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);

/** `initial` comes from loadSession() before the first render. */
export function AuthProvider({ initial, children }: { initial: Status; children: ReactNode }) {
  const [status, setStatus] = useState<Status>(initial);

  useEffect(() => onSignedOut(() => setStatus('signedOut')), []);

  const value = useMemo<Auth>(
    () => ({
      status,
      markSignedIn: () => setStatus('signedIn'),
      signOut: endSession,
    }),
    [status],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}

export { loadSession };
