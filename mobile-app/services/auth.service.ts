import { STATIC_USERS, type StaticUser } from '@/constants/static-users';
import type { AppUser } from '@/types/auth.types';

import { loadSessionUid, saveSessionUid } from './session-store';

export interface SessionUser { uid: string; email: string; }
const listeners = new Set<(user: SessionUser | null) => void>();
// Restore the last signed-in user so a reload does not sign out.
const savedUid = loadSessionUid();
let currentUser: StaticUser | null = STATIC_USERS.find((item) => item.uid === savedUid) ?? null;
export function friendlyAuthError(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }

export async function signInWithEmail(email: string, password: string) {
  // Ignore spaces and invisible characters that autofill or paste can add around the input.
  const clean = (value: string) => value.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  const user = STATIC_USERS.find((item) => item.email === clean(email).toLowerCase() && item.password === clean(password));
  if (!user) throw new Error('Invalid email or password.');
  currentUser = user;
  saveSessionUid(user.uid);
  listeners.forEach((listener) => listener({ uid: user.uid, email: user.email }));
}
export async function signOut() { currentUser = null; saveSessionUid(null); listeners.forEach((listener) => listener(null)); }

export function onAuthChanged(callback: (user: SessionUser | null) => void, _onError: (error: Error) => void) {
  listeners.add(callback);
  callback(currentUser ? { uid: currentUser.uid, email: currentUser.email } : null);
  return () => listeners.delete(callback);
}

export function subscribeToProfile(uid: string, onProfile: (profile: AppUser | null) => void, _onError: (error: Error) => void) {
  const user = STATIC_USERS.find((item) => item.uid === uid);
  if (!user) onProfile(null);
  else { const { password: _password, ...data } = user; onProfile(data); }
  return () => undefined;
}
