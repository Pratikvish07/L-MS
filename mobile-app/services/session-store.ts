import { File, Paths } from 'expo-file-system';

/**
 * Remembers the signed-in static user across app restarts (Android).
 * Keep the exports identical to session-store.web.ts.
 */
const sessionFile = () => new File(Paths.document, 'session.json');

export function loadSessionUid(): string | null {
  try {
    const file = sessionFile();
    if (!file.exists) return null;
    const { uid } = JSON.parse(file.textSync()) as { uid?: unknown };
    return typeof uid === 'string' ? uid : null;
  } catch {
    return null;
  }
}

export function saveSessionUid(uid: string | null) {
  try {
    const file = sessionFile();
    if (!uid) {
      if (file.exists) file.delete();
      return;
    }
    if (!file.exists) file.create();
    file.write(JSON.stringify({ uid }));
  } catch {
    // The user stays signed in until the app is closed.
  }
}
