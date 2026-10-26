import { useEffect } from 'react';

type WakeLock = { release: () => Promise<void> };

/**
 * Browser version: best-effort Screen Wake Lock. Browsers may refuse it
 * (hidden tab, permissions, unsupported), which is not an error here.
 */
export function useScreenAwake() {
  useEffect(() => {
    const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLock> } }).wakeLock;
    if (!wakeLock) return;
    let lock: WakeLock | null = null;
    let active = true;
    wakeLock
      .request('screen')
      .then((l) => {
        if (active) lock = l;
        else l.release().catch(() => undefined);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      lock?.release().catch(() => undefined);
    };
  }, []);
}
