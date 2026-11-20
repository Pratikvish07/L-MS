import type { LocalRecording } from '@/types/recording.types';

// Browser recordings stay in memory only for the current upload session.
const recordings = new Map<string, { entry: LocalRecording; video: Blob; thumbnail?: Blob }>();
const videoUriFor = (sessionId: string) => `memory-video:${sessionId}`;
const thumbnailUriFor = (sessionId: string) => `memory-thumbnail:${sessionId}`;

export async function listLocalRecordings(): Promise<LocalRecording[]> {
  return [...recordings.values()].map(({ entry }) => entry);
}

export async function getLocalRecording(sessionId: string) {
  return recordings.get(sessionId)?.entry;
}

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
  recordings.set(entry.sessionId, { entry: saved, video });
  return saved;
}

export async function persistThumbnail(cacheUri: string, sessionId: string): Promise<string> {
  const thumbnail = await (await fetch(cacheUri)).blob();
  URL.revokeObjectURL(cacheUri);
  const stored = recordings.get(sessionId);
  if (stored) stored.thumbnail = thumbnail;
  return thumbnailUriFor(sessionId);
}

export async function updateLocalRecording(sessionId: string, patch: Partial<LocalRecording>) {
  const stored = recordings.get(sessionId);
  if (stored) stored.entry = { ...stored.entry, ...patch };
}

export async function removeLocalRecording(sessionId: string) {
  recordings.delete(sessionId);
}

export async function cleanupUploadedRecordings() {
  for (const [sessionId, stored] of recordings) {
    if (stored.entry.uploaded) recordings.delete(sessionId);
  }
}

export async function getVideoBlob(sessionId: string): Promise<Blob | undefined> {
  return recordings.get(sessionId)?.video;
}

export async function getThumbnailBlob(sessionId: string): Promise<Blob | undefined> {
  return recordings.get(sessionId)?.thumbnail;
}

export async function getPlayableUri(entry: LocalRecording): Promise<string> {
  const video = await getVideoBlob(entry.sessionId);
  if (!video) throw new Error('The recording is no longer available in this app session.');
  return URL.createObjectURL(video);
}

export function availableBytes(): number {
  return typeof navigator === 'undefined' ? 0 : Number.POSITIVE_INFINITY;
}
