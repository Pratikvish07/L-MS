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
    let profileTimer: ReturnType<typeof setTimeout> | undefined;

    const unsubscribeAuth = onAuthChanged(
      (sessionUser) => {
        unsubscribeProfile?.();
        unsubscribeProfile = undefined;
        clearTimeout(profileTimer);

        if (!sessionUser) {
          setUser(null);
          setStatus('signedOut');
          return;
        }

        setStatus('loading');
        // The profile only counts when the server answers; if it never does, say so instead of loading forever.
        profileTimer = setTimeout(() => {
          setError('Could not reach the Finetution server to load your account. Check this phone’s internet connection, then reopen the app.');
          setStatus('unauthorized');
        }, 20_000);
        unsubscribeProfile = subscribeToProfile(
          sessionUser.uid,
          (profile, reason) => {
            clearTimeout(profileTimer);
            setUser(profile);
            const pending = profile?.role === 'student' && !profile.active;
            const inactive = profile && !profile.active && !pending ? `${profile.email} is switched off. In Admin → User Manager tick "Active" for it.` : null;
            setError(pending ? 'Your student registration is awaiting administrator approval.' : inactive ?? (profile ? null : `${sessionUser.email}: ${reason ?? 'Your account is not authorised for this app. Contact your administrator.'}`));
            setStatus(profile?.active ? 'signedIn' : 'unauthorized');
          },
          (profileError) => {
            clearTimeout(profileTimer);
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
      clearTimeout(profileTimer);
      unsubscribeProfile?.();
      unsubscribeAuth();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ status, user, error, signOut }), [status, user, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
