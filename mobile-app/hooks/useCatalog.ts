import { useEffect, useState } from 'react';

import { subscribeToClassrooms, subscribeToDegrees, subscribeToStreams, subscribeToSubjects } from '@/services/catalog.service';
import type { Classroom, Degree, Stream, Subject } from '@/types/catalog.types';

/** Classrooms and the degree → stream → year → subject structure managed in the Admin CMS. */
export function useCatalog() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [degrees, setDegrees] = useState<Degree[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loaded, setLoaded] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onError = (e: Error) => setError(e.message);
    // Count first snapshots so the form waits until all four lists are in.
    const once = <T,>(set: (v: T) => void) => {
      let first = true;
      return (value: T) => {
        set(value);
        if (first) {
          first = false;
          setLoaded((n) => n + 1);
        }
      };
    };
    const unsubs = [
      subscribeToClassrooms(once(setClassrooms), onError),
      subscribeToDegrees(once(setDegrees), onError),
      subscribeToStreams(once(setStreams), onError),
      subscribeToSubjects(once(setSubjects), onError),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  return { classrooms, degrees, streams, subjects, loading: loaded < 4 && !error, error };
}
