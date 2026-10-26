import { Directory, File, Paths } from 'expo-file-system';

import type { LocalRecording } from '@/types/recording.types';

/**
 * Persistent on-device storage for the mount phone. Videos live in the app's
 * document directory (not cache, which Android may purge) until the upload is
 * verified. The queue index is a small JSON file next to them.
 */

const recordingsDir = () => new Directory(Paths.document, 'recordings');
const queueFile = () => new File(recordingsDir(), 'queue.json');

function ensureDir() {
  const dir = recordingsDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export async function listLocalRecordings(): Promise<LocalRecording[]> {
  ensureDir();
  const file = queueFile();
  if (!file.exists) return [];
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed)) return [];
    // Drop entries whose video was removed outside the app.
    return (parsed as LocalRecording[]).filter((entry) => new File(entry.videoUri).exists);
  } catch {
    return [];
  }
}

async function writeQueue(entries: LocalRecording[]) {
  ensureDir();
  const file = queueFile();
  if (!file.exists) file.create();
  file.write(JSON.stringify(entries));
}

export async function getLocalRecording(sessionId: string) {
  return (await listLocalRecordings()).find((entry) => entry.sessionId === sessionId);
}

/** Moves the camera's cache file into persistent storage and records it in the queue. */
export async function persistRecording(
  cacheUri: string,
  entry: Omit<LocalRecording, 'videoUri' | 'fileSizeBytes' | 'savedAt'>,
): Promise<LocalRecording> {
  const dir = ensureDir();
  const source = new File(cacheUri);
  const target = new File(dir, `${entry.sessionId}.mp4`);
  if (target.exists) target.delete();
  source.move(target);

  const saved: LocalRecording = {
    ...entry,
    videoUri: target.uri,
    fileSizeBytes: target.size ?? 0,
    savedAt: new Date().toISOString(),
  };
  const queue = (await listLocalRecordings()).filter((e) => e.sessionId !== entry.sessionId);
  await writeQueue([...queue, saved]);
  return saved;
}

export async function persistThumbnail(cacheUri: string, sessionId: string): Promise<string> {
  const dir = ensureDir();
  const target = new File(dir, `${sessionId}.jpg`);
  if (target.exists) target.delete();
  new File(cacheUri).move(target);
  return target.uri;
}

export async function updateLocalRecording(sessionId: string, patch: Partial<LocalRecording>) {
  const queue = await listLocalRecordings();
  await writeQueue(queue.map((e) => (e.sessionId === sessionId ? { ...e, ...patch } : e)));
}

export async function persistCompressedVideo(sessionId: string, compressedUri: string) {
  const dir = ensureDir();
  const source = new File(compressedUri);
  const target = new File(dir, `${sessionId}-720p.mp4`);
  if (source.uri !== target.uri) {
    if (target.exists) target.delete();
    source.move(target);
  }
  return { uri: target.uri, size: target.size ?? 0 };
}

/** Called only after the upload has been accepted by the video API. */
export async function removeLocalRecording(sessionId: string) {
  const queue = await listLocalRecordings();
  const entry = queue.find((e) => e.sessionId === sessionId);
  if (entry) {
    for (const uri of [entry.videoUri, entry.compressedUri, entry.thumbnailUri]) {
      if (!uri) continue;
      const file = new File(uri);
      if (file.exists) file.delete();
    }
  }
  await writeQueue(queue.filter((e) => e.sessionId !== sessionId));
}

/** A URI the video player can open. */
export async function getPlayableUri(entry: LocalRecording): Promise<string> {
  return entry.compressedUri ?? entry.videoUri;
}

/** Deletes local copies whose upload has already been verified. */
export async function cleanupUploadedRecordings() {
  const uploaded = (await listLocalRecordings()).filter((e) => e.uploaded);
  for (const entry of uploaded) await removeLocalRecording(entry.sessionId);
}

export function availableBytes(): number {
  try {
    return Paths.availableDiskSpace;
  } catch {
    return 0;
  }
}
