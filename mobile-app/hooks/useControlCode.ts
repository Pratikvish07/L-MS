import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { createPairingCodeForMount, deletePairingCode } from '@/services/pairing.service';
import type { AppUser } from '@/types/auth.types';

/**
 * Mount phone: keeps a fresh 6-digit faculty control code on screen while
 * `enabled`, replacing it every 30 seconds (and immediately after it is used).
 */
export function useControlCode(mount: AppUser, deviceName: string, enabled: boolean, usedCode?: string) {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  // Latest profile without restarting rotation when the profile object is replaced.
  const mountRef = useRef(mount);
  useEffect(() => { mountRef.current = mount; }, [mount]);
  const mountUid = mount.uid;

  const rotate = useCallback(async () => {
    if (busyRef.current) return;
    // Every code is a Firestore write: do not rotate while the app/tab is in the background.
    if (AppState.currentState && AppState.currentState !== 'active') return;
    busyRef.current = true;
    setError(null);
    try {
      // A Firestore write waits forever when the server is unreachable; give up after 15 s so the
      // phone shows an error with Retry instead of an endless spinner.
      const created = await Promise.race([
        createPairingCodeForMount(mountRef.current, deviceName),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Could not reach Firebase to create a code. Check this phone’s internet connection, then tap Retry.')), 15_000)),
      ]);
      codeRef.current = created.code;
      setCode(created.code);
      setExpiresAt(created.expiresAt);
    } catch (e) {
      setError(explainCodeError(e, mountRef.current));
    } finally {
      busyRef.current = false;
      // The previous code is not deleted: it has expired (or was used) and is rejected anyway,
      // and skipping the delete halves the writes.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the account ID on purpose
  }, [mountUid, deviceName]);

  // Start/stop with `enabled`; remove the live code when hidden.
  useEffect(() => {
    if (!enabled) return;
    rotate();
    return () => {
      if (codeRef.current) deletePairingCode(codeRef.current);
      codeRef.current = null;
      setCode(null);
    };
  }, [enabled, rotate]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [enabled]);

  // New code on expiry, or as soon as a faculty member has used this one.
  useEffect(() => {
    if (!enabled || !code) return;
    if (now >= expiresAt || usedCode === code) rotate();
  }, [enabled, code, now, expiresAt, usedCode, rotate]);

  const secondsLeft = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  return { code, secondsLeft, error, rotate };
}

/** Turns a failed code write into an actionable message (permission errors explain what to fix). */
function explainCodeError(e: unknown, mount: AppUser) {
  const code = (e as { code?: string }).code ?? '';
  if (code !== 'permission-denied') return e instanceof Error ? e.message : 'Could not create a control code.';
  if (mount.role !== 'mount') {
    return `Firebase refused the code: ${mount.email} has role "${mount.role}", but only recorder (mount) or instructor accounts can create codes. In Admin → User Manager give it a recorder role (e.g. "Mount-Recorder").`;
  }
  if (!mount.active) {
    return `Firebase refused the code: ${mount.email} is not active. In Admin → User Manager tick "Active" for it.`;
  }
  return `Firebase refused the code even though ${mount.email} is an active recorder account. The security rules on Firebase are out of date: publish the latest firestore.rules (Firebase console → Firestore Database → Rules → Publish), wait a minute, then tap Retry.`;
}
