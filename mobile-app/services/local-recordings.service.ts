import { File, Paths } from 'expo-file-system';
import type { LocalRecording } from '@/types/recording.types';

// Captured videos are referenced in memory only while the live API upload runs.
const recordings = new Map<string, LocalRecording>();

export async function listLocalRecordings(): Promise<LocalRecording[]> {
  return [...recordings.values()];
}

export async function getLocalRecording(sessionId: string) {
  return recordings.get(sessionId);
}

export async function persistRecording(
  cacheUri: string,
  entry: Omit<LocalRecording, 'videoUri' | 'fileSizeBytes' | 'savedAt'>,
): Promise<LocalRecording> {
  const file = new File(cacheUri);
  if (!file.exists) throw new Error('The camera recording file is missing.');
  const saved: LocalRecording = {
    ...entry,
    videoUri: cacheUri,
    fileSizeBytes: file.size ?? 0,
    savedAt: new Date().toISOString(),
  };
  recordings.set(entry.sessionId, saved);
  return saved;
}

export async function persistThumbnail(cacheUri: string, _sessionId: string): Promise<string> {
  return cacheUri;
}

export async function updateLocalRecording(sessionId: string, patch: Partial<LocalRecording>) {
  const entry = recordings.get(sessionId);
  if (entry) recordings.set(sessionId, { ...entry, ...patch });
}

export async function persistCompressedVideo(_sessionId: string, compressedUri: string) {
  const file = new File(compressedUri);
  if (!file.exists) throw new Error('The compressed recording file is missing.');
  return { uri: compressedUri, size: file.size ?? 0 };
}

export async function removeLocalRecording(sessionId: string) {
  const entry = recordings.get(sessionId);
  if (!entry) return;
  for (const uri of [entry.videoUri, entry.compressedUri, entry.thumbnailUri]) {
    if (!uri) continue;
    const file = new File(uri);
    if (file.exists) file.delete();
  }
  recordings.delete(sessionId);
}

export async function getPlayableUri(entry: LocalRecording): Promise<string> {
  return entry.compressedUri ?? entry.videoUri;
}

export async function cleanupUploadedRecordings() {
  for (const entry of recordings.values()) {
    if (entry.uploaded) await removeLocalRecording(entry.sessionId);
  }
}

export function availableBytes(): number {
  try { return Paths.availableDiskSpace; } catch { return 0; }
}
