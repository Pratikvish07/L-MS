import { useEffect, useState } from 'react';

import { subscribeToRecording } from '@/services/recording.service';
import type { Recording } from '@/types/recording.types';

/** Live view of a single recordings/{sessionId} document. */
export function useRecording(sessionId: string | undefined) {
  const [recording, setRecording] = useState<Recording | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    return subscribeToRecording(
      sessionId,
      (data) => {
        setRecording(data);
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
  }, [sessionId]);

  return { recording, loading, error };
}
