import type { LocalRecording } from '@/types/recording.types';

/**
 * Browser version of the tripod's recording queue. Videos and thumbnails are
 * kept in IndexedDB (survives reloads) until the upload has been verified,
 * mirroring the Android app's document-directory storage.
 * Keep the exports identical to local-recordings.service.ts.
 */
const DB_NAME = 'lms-recorder';
const RECORDINGS = 'recordings';
const THUMBNAILS = 'thumbnails';

interface StoredRecording {
  sessionId: string;
  entry: LocalRecording;
  video: Blob;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RECORDINGS)) db.createObjectStore(RECORDINGS, { keyPath: 'sessionId' });
      if (!db.objectStoreNames.contains(THUMBNAILS)) db.createObjectStore(THUMBNAILS);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Browser storage (IndexedDB) is unavailable.'));
  });
  return dbPromise;
}

async function run<T>(store: string, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = op(db.transaction(store, mode).objectStore(store));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Browser storage request failed.'));
  });
}

const videoUriFor = (sessionId: string) => `idb:${sessionId}`;
const thumbnailUriFor = (sessionId: string) => `idb-thumb:${sessionId}`;

export async function listLocalRecordings(): Promise<LocalRecording[]> {
  const rows = await run<StoredRecording[]>(RECORDINGS, 'readonly', (s) => s.getAll());
  return rows.map((r) => r.entry).sort((a, b) => a.savedAt.localeCompare(b.savedAt));
}

export async function getLocalRecording(sessionId: string): Promise<LocalRecording | undefined> {
  const row = await run<StoredRecording | undefined>(RECORDINGS, 'readonly', (s) => s.get(sessionId));
  return row?.entry;
}

/** Copies the recorder's in-memory blob into IndexedDB and queues it. */
export async function persistRecording(
  cacheUri: string,
  entry: Omit<LocalRecording, 'videoUri' | 'fileSizeBytes' | 'savedAt'>,
): Promise<LocalRecording> {
  const video = await (await fetch(cacheUri)).blob();
  URL.revokeObjectURL(cacheUri);
  const saved: LocalRecording = {
    ...entry,
    videoUri: videoUriFor(entry.sessionId),
    fileSizeBytes: video.size,
    mimeType: video.type.split(';')[0] || 'video/webm',
    savedAt: new Date().toISOString(),
  };
  await run(RECORDINGS, 'readwrite', (s) => s.put({ sessionId: entry.sessionId, entry: saved, video } satisfies StoredRecording));
  return saved;
}

export async function persistThumbnail(cacheUri: string, sessionId: string): Promise<string> {
  const image = await (await fetch(cacheUri)).blob();
  URL.revokeObjectURL(cacheUri);
  await run(THUMBNAILS, 'readwrite', (s) => s.put(image, sessionId));
  return thumbnailUriFor(sessionId);
}

export async function updateLocalRecording(sessionId: string, patch: Partial<LocalRecording>) {
  const row = await run<StoredRecording | undefined>(RECORDINGS, 'readonly', (s) => s.get(sessionId));
  if (!row) return;
  await run(RECORDINGS, 'readwrite', (s) => s.put({ ...row, entry: { ...row.entry, ...patch } }));
}

/** Called only after the upload has been accepted by the video API. */
export async function removeLocalRecording(sessionId: string) {
  await run(RECORDINGS, 'readwrite', (s) => s.delete(sessionId));
  await run(THUMBNAILS, 'readwrite', (s) => s.delete(sessionId));
}

export async function cleanupUploadedRecordings() {
  const uploaded = (await listLocalRecordings()).filter((e) => e.uploaded);
  for (const entry of uploaded) await removeLocalRecording(entry.sessionId);
}

/** Web-only helpers used by storage.service.web.ts. */
export async function getVideoBlob(sessionId: string): Promise<Blob | undefined> {
  return (await run<StoredRecording | undefined>(RECORDINGS, 'readonly', (s) => s.get(sessionId)))?.video;
}

export async function getThumbnailBlob(sessionId: string): Promise<Blob | undefined> {
  return run<Blob | undefined>(THUMBNAILS, 'readonly', (s) => s.get(sessionId));
}

export async function getPlayableUri(entry: LocalRecording): Promise<string> {
  const video = await getVideoBlob(entry.sessionId);
  if (!video) throw new Error('The recording is no longer stored in this browser.');
  return URL.createObjectURL(video);
}

// Browser storage quota, refreshed in the background (the API is async).
let freeBytes = 0;
function refreshEstimate() {
  if (typeof navigator === 'undefined') return;
  navigator.storage
    ?.estimate?.()
    .then(({ quota = 0, usage = 0 }) => {
      freeBytes = Math.max(0, quota - usage);
    })
    .catch(() => undefined);
}
refreshEstimate();

export function availableBytes(): number {
  refreshEstimate();
  return freeBytes;
}
