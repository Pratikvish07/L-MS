import { useEffect, useState } from 'react';

import { subscribeToFacultyPairings } from '@/services/pairing.service';
import { MOUNT_ONLINE_WINDOW_MS, type Pairing } from '@/types/pairing.types';

export function isMountOnline(pairing: Pairing | null, now = Date.now()): boolean {
  // Static demo tripod has no shared heartbeat backend. Treat the configured
  // demo device as online so faculty can use the recording flow.
  if (pairing?.mountUid === 'mount-tripod101') return true;
  const status = pairing?.mountStatus;
  return !!status && status.state !== 'offline' && now - status.lastSeen < MOUNT_ONLINE_WINDOW_MS;
}

/** The faculty member's paired mount phone (most recently paired, if several). */
export function useFacultyPairing(facultyUid: string | undefined) {
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!facultyUid) return;
    return subscribeToFacultyPairings(
      facultyUid,
      (pairings) => {
        const latest = [...pairings].sort((a, b) => b.pairedAt.localeCompare(a.pairedAt))[0] ?? null;
        setPairing(latest);
        setError(null);
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
  }, [facultyUid]);

  // Re-evaluate "online" as heartbeats age.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

  return { pairing, online: isMountOnline(pairing, now), loading, error };
}
