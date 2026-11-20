import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut as firebaseSignOut, updateProfile } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import type { AppUser } from '@/types/auth.types';
import { firebaseAuth, firestore } from './firebase';

export interface SessionUser { uid: string; email: string; }
export function friendlyAuthError(error: unknown) {
  const code = (error as { code?: string }).code ?? '';
  if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') return 'Incorrect email or password.';
  if (code === 'auth/email-already-in-use') return 'An account with this email already exists.';
  if (code === 'auth/weak-password') return 'Password must be at least 6 characters.';
  if (code === 'auth/network-request-failed') return 'Could not reach Firebase. Check your connection.';
  return error instanceof Error ? error.message : 'Something went wrong.';
}

export async function signInWithEmail(email: string, password: string) {
  await signInWithEmailAndPassword(firebaseAuth, email.trim().toLowerCase(), password);
}
export async function signOut() { await firebaseSignOut(firebaseAuth); }

export function onAuthChanged(callback: (user: SessionUser | null) => void, onError: (error: Error) => void) {
  return onAuthStateChanged(firebaseAuth, (user) => callback(user ? { uid: user.uid, email: user.email ?? '' } : null), onError);
}

export async function registerStudent(input: { displayName: string; email: string; password: string }) {
  const credential = await createUserWithEmailAndPassword(firebaseAuth, input.email.trim().toLowerCase(), input.password);
  await updateProfile(credential.user, { displayName: input.displayName.trim() });
  await setDoc(doc(firestore, 'users', credential.user.uid), {
    uid: credential.user.uid,
    email: input.email.trim().toLowerCase(),
    displayName: input.displayName.trim(),
    role: 'student', active: false, approvalStatus: 'pending',
    degreeId: '', streamId: '', year: 0, batchId: '', batchName: '',
    createdAt: new Date().toISOString(),
  });
  await firebaseSignOut(firebaseAuth);
}

export const resetPassword = (email: string) => sendPasswordResetEmail(firebaseAuth, email.trim().toLowerCase());

export function subscribeToProfile(uid: string, onProfile: (profile: AppUser | null) => void, onError: (error: Error) => void) {
  return onSnapshot(doc(firestore, 'users', uid), (snapshot) => {
    const data = snapshot.data();
    if (!snapshot.exists() || !data || !['admin', 'faculty', 'mount', 'student'].includes(data.role)) { onProfile(null); return; }
    onProfile({ ...data, uid, email: String(data.email ?? ''), displayName: String(data.displayName ?? data.email ?? 'User'), active: data.active !== false } as AppUser);
  }, onError);
}
