'use client';

import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, updateProfile, type User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { auth, db } from './firebase';

export type PortalProfile = { uid: string; email: string; displayName: string; role: 'admin' | 'faculty' | 'mount' | 'student'; active: boolean };
type AuthContextValue = { user: User | null; profile: PortalProfile | null; loading: boolean; login: (email: string, password: string) => Promise<void>; register: (displayName: string, email: string, password: string) => Promise<void>; logout: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<PortalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => onAuthStateChanged(auth, async (next) => { setUser(next); if (!next) { setProfile(null); setLoading(false); return; } const snapshot = await getDoc(doc(db, 'users', next.uid)); setProfile(snapshot.exists() ? { uid: next.uid, email: next.email ?? '', ...snapshot.data() } as PortalProfile : null); setLoading(false); }), []);
  return <AuthContext.Provider value={{ user, profile, loading, login: async (email, password) => { await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password); }, register: async (displayName, email, password) => { const credential = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password); await updateProfile(credential.user, { displayName: displayName.trim() }); await setDoc(doc(db, 'users', credential.user.uid), { uid: credential.user.uid, email: email.trim().toLowerCase(), displayName: displayName.trim(), role: 'student', active: false, approvalStatus: 'pending', createdAt: new Date().toISOString() }); await signOut(auth); }, logout: () => signOut(auth) }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used inside AuthProvider.'); return value; }
