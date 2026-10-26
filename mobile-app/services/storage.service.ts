import { File } from 'expo-file-system';
import type { LocalRecording } from '@/types/recording.types';
import { persistCompressedVideo, updateLocalRecording } from './local-recordings.service';
import { markFailed, markPending, markUploaded, markUploading, setUploadProgress } from './recording.service';
import { cancelVideoUpload, uploadVideoToApi, VideoUploadCancelledError } from './video-upload.service';
import { compressVideo } from './video-compress';

/** The video service uses title as the user-facing name. Include the session
 * id so every lecture upload gets a distinct title, even when the topic is
 * reused by faculty. */
function videoTitle(entry: LocalRecording) {
  const topic = entry.metadata.topic.trim() || 'Lecture video';
  return `${topic} - ${entry.sessionId}`;
}

export type UploadStep = 'compressing' | 'uploading' | 'saving' | 'finalizing' | 'done';
export interface UploadCallbacks {
  onProgress?: (fraction: number, bytesTransferred: number, totalBytes: number) => void;
  onStep?: (step: UploadStep) => void;
  onCompressProgress?: (fraction: number) => void;
}

let cancelled = false;
export function cancelActiveUpload() { cancelled = true; cancelVideoUpload(); }
export function describeUploadError(error: unknown) { return error instanceof Error ? error.message : String(error); }

export async function uploadRecording(entry: LocalRecording, callbacks: UploadCallbacks = {}) {
  const sessionId = entry.sessionId;
  cancelled = false;
  try {
    const original = new File(entry.videoUri);
    if (!original.exists || (original.size ?? 0) <= 0) throw new Error('The recording file is missing on this phone.');
    await markUploading(sessionId).catch(() => undefined);
    let uploadUri = entry.compressedUri;
    let uploadSize = entry.compressedSizeBytes ?? 0;
    if (!uploadUri) {
      callbacks.onStep?.('compressing');
      const compressedUri = await compressVideo(entry.videoUri, entry.durationSeconds, callbacks.onCompressProgress);
      const compressed = await persistCompressedVideo(sessionId, compressedUri);
      uploadUri = compressed.uri;
      uploadSize = compressed.size;
      await updateLocalRecording(sessionId, { compressed: true, compressedUri: uploadUri, compressedSizeBytes: uploadSize });
    }
    const file = new File(uploadUri);
    const total = file.size || uploadSize;
    if (!file.exists || total <= 0) throw new Error('The compressed recording file is missing on this phone.');
    if (total > 100 * 1024 * 1024) throw new Error('The compressed video is still over 100 MB. Lower its bitrate or split the recording before retrying.');
    callbacks.onStep?.('uploading');
    let lastProgressWriteAt = 0;
    let lastProgressPercent = -1;
    const uploadResult = await uploadVideoToApi(
      videoTitle(entry),
      { uri: file.uri, name: file.name || `${sessionId}.mp4`, mimeType: 'video/mp4', size: total },
      file.name || `${sessionId}.mp4`,
      'video/mp4',
      { onProgress: (fraction, transferred, size) => {
        callbacks.onProgress?.(fraction, transferred, size);
        const percent = Math.floor(fraction * 100);
        const now = Date.now();
        if (percent !== lastProgressPercent && (now - lastProgressWriteAt >= 5_000 || percent === 100)) {
          lastProgressWriteAt = now;
          lastProgressPercent = percent;
          setUploadProgress(sessionId, percent).catch(() => undefined);
        }
      } },
    );
    callbacks.onStep?.('saving');
    await markUploaded(sessionId, { partFileIds: [uploadResult.path], videoApiId: uploadResult.id, thumbnailFileId: '', fileSizeBytes: uploadResult.size || total, mimeType: uploadResult.mimeType }).catch(() => undefined);
    await updateLocalRecording(sessionId, { uploaded: true, lastError: undefined });
    callbacks.onStep?.('done');
  } catch (error) {
    if (cancelled || error instanceof VideoUploadCancelledError) { await markPending(sessionId).catch(() => undefined); throw new UploadCancelledError(); }
    const message = describeUploadError(error);
    await updateLocalRecording(sessionId, { lastError: message }).catch(() => undefined);
    await markFailed(sessionId, message).catch(() => undefined);
    throw new Error(message);
  }
}

export class UploadCancelledError extends Error {
  constructor() { super('Upload cancelled. The recording is still saved on this phone.'); }
}
