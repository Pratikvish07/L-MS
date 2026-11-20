import { getApp, getApps, initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

const firebaseApp = getApps().length ? getApp() : initializeApp({
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
});

export const firebaseAuth = getAuth(firebaseApp);
if (Platform.OS === 'web') void setPersistence(firebaseAuth, browserLocalPersistence);
/**
 * On Android/iOS the default streaming connection can stall silently in React Native
 * (writes never confirm, so spinners never end). Long polling is Firebase's documented fix.
 * initializeFirestore may only run once per app, so a fast refresh falls back to getFirestore.
 */
function createFirestore(): Firestore {
  if (Platform.OS === 'web') return getFirestore(firebaseApp);
  try {
    return initializeFirestore(firebaseApp, { experimentalForceLongPolling: true });
  } catch {
    return getFirestore(firebaseApp);
  }
}
export const firestore = createFirestore();
export const firebaseStorage = getStorage(firebaseApp);
