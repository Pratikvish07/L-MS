import { useCallback, useEffect, useRef, useState } from 'react';

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

  const rotate = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setError(null);
    const previous = codeRef.current;
    try {
      const created = await createPairingCodeForMount(mount, deviceName);
      codeRef.current = created.code;
      setCode(created.code);
      setExpiresAt(created.expiresAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create a control code.');
    } finally {
      busyRef.current = false;
      if (previous) deletePairingCode(previous);
    }
  }, [mount, deviceName]);

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
