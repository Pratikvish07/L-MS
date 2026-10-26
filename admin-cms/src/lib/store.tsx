import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import {
  subscribeChapters,
  subscribeClassrooms,
  subscribeDegrees,
  subscribeMountDevices,
  subscribeRecordings,
  subscribeStreams,
  subscribeSubjects,
  subscribeUsers,
  subscribeBatches,
} from './data';
import type { AppUser, Batch, Chapter, Classroom, Degree, MountDevice, Recording, Stream, Subject } from './types';

interface StoreValue {
  recordings: Recording[];
  users: AppUser[];
  batches: Batch[];
  classrooms: Classroom[];
  degrees: Degree[];
  streams: Stream[];
  subjects: Subject[];
  /** Chapters by subject ID. */
  chapters: Map<string, Chapter[]>;
  devices: MountDevice[];
  loading: boolean;
  error: string | null;
}

const StoreContext = createContext<StoreValue | null>(null);

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>.');
  return ctx;
}

/** One set of real-time listeners shared by every CMS page. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [degrees, setDegrees] = useState<Degree[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Map<string, Chapter[]>>(new Map());
  const [devices, setDevices] = useState<MountDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onError = (e: Error) => setError(e.message);
    const unsubs = [
      subscribeRecordings((r) => {
        setRecordings(r);
        setLoading(false);
      }, (e) => {
        onError(e);
        setLoading(false);
      }),
      subscribeUsers(setUsers, onError),
      subscribeBatches(setBatches, onError),
      subscribeClassrooms(setClassrooms, onError),
      subscribeDegrees(setDegrees, onError),
      subscribeStreams(setStreams, onError),
      subscribeSubjects(setSubjects, onError),
      subscribeChapters(setChapters, onError),
      subscribeMountDevices(setDevices, onError),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  return (
    <StoreContext.Provider value={{ recordings, users, batches, classrooms, degrees, streams, subjects, chapters, devices, loading, error }}>
      {children}
    </StoreContext.Provider>
  );
}
