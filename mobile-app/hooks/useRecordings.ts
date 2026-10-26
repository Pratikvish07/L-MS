import { useEffect, useMemo, useState } from 'react';

import { subscribeToFacultyRecordings } from '@/services/recording.service';
import { PENDING_STATUSES, UPLOADED_STATUSES, type Recording } from '@/types/recording.types';
import { isSameLocalDay } from '@/utils/date';

export function useRecordings(facultyUid: string | undefined) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!facultyUid) return;
    setLoading(true);
    return subscribeToFacultyRecordings(
      facultyUid,
      (data) => {
        setRecordings(data);
        setError(null);
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
  }, [facultyUid]);

  const today = useMemo(() => {
    const items = recordings.filter((r) => isSameLocalDay(r.recordedAt));
    return {
      items,
      uploaded: items.filter((r) => UPLOADED_STATUSES.includes(r.status)).length,
      uploading: items.filter((r) => r.status === 'uploading').length,
      pending: items.filter((r) => PENDING_STATUSES.includes(r.status)).length,
    };
  }, [recordings]);

  return { recordings, today, loading, error };
}
