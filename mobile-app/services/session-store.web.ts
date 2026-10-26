/**
 * Browser version: remembers the signed-in static user across reloads.
 * Keep the exports identical to session-store.ts.
 */
const SESSION_KEY = 'lms-session-uid';

export function loadSessionUid(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function saveSessionUid(uid: string | null) {
  try {
    if (uid) localStorage.setItem(SESSION_KEY, uid);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // The user stays signed in until the tab is reloaded.
  }
}
