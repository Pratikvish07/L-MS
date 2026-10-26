import { useEffect, useState } from 'react';

import { subscribeToChapters } from '@/services/chapters.service';
import type { Chapter } from '@/types/catalog.types';

/** Live chapters (with topics) of one subject. */
export function useChapters(subjectId: string | undefined) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setChapters([]);
    if (!subjectId) return;
    setLoading(true);
    return subscribeToChapters(
      subjectId,
      (data) => {
        setChapters(data);
        setError(null);
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
  }, [subjectId]);

  return { chapters, loading, error };
}
