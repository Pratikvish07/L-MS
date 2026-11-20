import { getApp, getApps, initializeApp } from 'firebase/app';
import { browserLocalPersistence, createUserWithEmailAndPassword, getAuth, setPersistence, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

const firebaseApp = getApps().length ? getApp() : initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

const firebaseConfig = firebaseApp.options;
const accountApp = getApps().find((item) => item.name === 'account-creator') ?? initializeApp(firebaseConfig, 'account-creator');
const accountAuth = getAuth(accountApp);

export const firebaseAuth = getAuth(firebaseApp);
void setPersistence(firebaseAuth, browserLocalPersistence);
export const firestore = getFirestore(firebaseApp);
export const firebaseStorage = getStorage(firebaseApp);
/** Must match setGlobalOptions({ region }) in functions/index.js. */
export const firebaseFunctions = getFunctions(firebaseApp, 'asia-south1');
export const isFirebaseConfigured = Boolean(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID);
export async function createManagedAccount(email: string, password: string) {
  const credential = await createUserWithEmailAndPassword(accountAuth, email.trim().toLowerCase(), password);
  await signOut(accountAuth).catch(() => undefined);
  return { uid: credential.user.uid, email: credential.user.email ?? email.trim().toLowerCase() };
}

/**
 * Finds the UID of an existing login by signing it in on the separate account-creator
 * instance (the admin stays signed in). Used to finish an enrolment whose login was
 * created earlier but whose profile was never saved.
 */
export async function existingAccountUid(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(accountAuth, email.trim().toLowerCase(), password);
  await signOut(accountAuth).catch(() => undefined);
  return credential.user.uid;
}

/**
 * Firestore writes wait silently until the server confirms them. When the project has hit its
 * daily write quota (free Spark plan: 20,000 writes/day) or the connection is blocked, the server
 * never confirms and the save spins forever. This gives up after `ms` with an explanation.
 */
export function confirmedWrite<T>(write: Promise<T>, ms = 20_000): Promise<T> {
  return Promise.race([
    write,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(
      'Firebase did not confirm the save. Most likely the project has reached its daily write limit (free Spark plan) or the connection to Firebase is blocked. Check Firebase console → Firestore → Usage, finish the Blaze upgrade, then try again.',
    )), ms)),
  ]);
}
