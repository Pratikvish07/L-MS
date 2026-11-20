import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { firebaseAuth, firestore } from '../lib/firebase';

type Status = 'loading' | 'signedOut' | 'denied' | 'admin';
export interface CmsUser { uid: string; email: string; }
interface AdminProfile { email?: string; role?: string; isActive?: boolean; displayName?: string; }
interface AuthValue { status: Status; user: CmsUser | null; displayName: string; error: string | null; signIn: (email: string, password: string) => Promise<void>; signOut: () => Promise<void>; }
const AuthContext = createContext<AuthValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CmsUser | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onAuthStateChanged(firebaseAuth, async (account) => {
    if (!account) {
      setUser(null);
      setProfile(null);
      setError(null);
      setStatus('signedOut');
      return;
    }
    const nextUser = { uid: account.uid, email: account.email ?? '' };
    setUser(nextUser);
    setStatus('loading');
    try {
      const adminSnapshot = await getDoc(doc(firestore, 'admins', account.uid));
      const data = adminSnapshot.exists() ? adminSnapshot.data() as AdminProfile : null;
      setProfile(data);
      if (data?.role === 'admin' && data.isActive === true) {
        setError(null);
        setStatus('admin');
      } else {
        setError(`No active admin record found at Firestore admins/${account.uid}. It must have role "admin" and isActive: true.`);
        setStatus('denied');
      }
    } catch (cause) {
      setProfile(null);
      setError(cause instanceof Error ? cause.message : 'Could not verify Firebase administrator access.');
      setStatus('denied');
    }
  }), []);

  const value = useMemo<AuthValue>(() => ({
    status,
    user,
    displayName: profile?.displayName || profile?.email || user?.email || '',
    error,
    signIn: async (email, password) => {
      await signInWithEmailAndPassword(firebaseAuth, email.trim().toLowerCase(), password);
    },
    signOut: async () => {
      await firebaseSignOut(firebaseAuth);
    },
  }), [error, profile, status, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
