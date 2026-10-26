import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { onAuthChanged, signOut, subscribeToProfile } from '@/services/auth.service';
import type { AppUser } from '@/types/auth.types';

type AuthStatus = 'loading' | 'signedOut' | 'unauthorized' | 'signedIn';

export interface AuthContextValue {
  status: AuthStatus;
  user: AppUser | null;
  error: string | null;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AppUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthChanged(
      (sessionUser) => {
        unsubscribeProfile?.();
        unsubscribeProfile = undefined;

        if (!sessionUser) {
          setUser(null);
          setStatus('signedOut');
          return;
        }

        setStatus('loading');
        unsubscribeProfile = subscribeToProfile(
          sessionUser.uid,
          (profile) => {
            setUser(profile);
            const pending = profile?.role === 'student' && !profile.active;
            setError(pending ? 'Your student registration is awaiting administrator approval.' : profile ? null : 'Your account is not authorised for this app. Contact your administrator.');
            setStatus(profile?.active ? 'signedIn' : 'unauthorized');
          },
          (profileError) => {
            setUser(null);
            setError(profileError.message);
            setStatus('unauthorized');
          },
        );
      },
      (sessionError) => {
        setUser(null);
        setError(sessionError.message);
        setStatus('signedOut');
      },
    );

    return () => {
      unsubscribeProfile?.();
      unsubscribeAuth();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ status, user, error, signOut }), [status, user, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
