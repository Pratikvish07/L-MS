import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { findAccount, getUser } from '../lib/data';

type Status = 'loading' | 'signedOut' | 'denied' | 'admin';

/** The signed-in account, in the shape the CMS pages use. */
export interface CmsUser {
  uid: string;
  email: string;
}

interface AuthValue {
  status: Status;
  user: CmsUser | null;
  displayName: string;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);
const SESSION_KEY = 'lms-cms-session';

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}

function readSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeSession(uid: string | null) {
  try {
    if (uid) localStorage.setItem(SESSION_KEY, uid);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // The session then lasts until the tab is closed.
  }
}

/** CMS access is granted only to active static accounts with the admin role. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [uid, setUid] = useState<string | null>(readSession);
  const value = useMemo<AuthValue>(() => {
    const profile = uid ? getUser(uid) : null;
    const isAdmin = profile?.role === 'admin' && profile.active;
    return {
      status: !profile ? 'signedOut' : isAdmin ? 'admin' : 'denied',
      user: profile ? { uid: profile.uid, email: profile.email } : null,
      displayName: profile?.displayName || profile?.email || '',
      error: profile && !isAdmin ? 'This account does not have an active administrator profile.' : null,
      signIn: async (email, password) => {
        const account = findAccount(email, password);
        if (!account) throw new Error('Incorrect email or password.');
        writeSession(account.uid);
        setUid(account.uid);
      },
      signOut: async () => {
        writeSession(null);
        setUid(null);
      },
    };
  }, [uid]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
