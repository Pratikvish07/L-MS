import type { LocalRecording } from '@/types/recording.types';
import { getVideoBlob, updateLocalRecording } from './local-recordings.service.web';
import { markFailed, markPending, markUploaded, markUploading, setUploadProgress } from './recording.service';
import { cancelVideoUpload, uploadVideoToApi, VideoUploadCancelledError } from './video-upload.service';

function videoTitle(entry: LocalRecording) {
  const topic = entry.metadata.topic.trim() || 'Lecture video';
  return `${topic} - ${entry.sessionId}`;
}

/** Browser pipeline: the video stays in IndexedDB until the video API upload succeeds. */
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
  const { sessionId } = entry;
  cancelled = false;
  try {
    const video = await getVideoBlob(sessionId);
    if (!video) throw new Error('The recording is no longer stored in this browser.');
    await markUploading(sessionId).catch(() => undefined);
    callbacks.onStep?.('uploading');
    const extension = video.type === 'video/mp4' ? 'mp4' : 'webm';
    const mimeType = video.type || entry.mimeType || 'video/webm';
    let lastProgressWriteAt = 0;
    let lastProgressPercent = -1;
    const uploadResult = await uploadVideoToApi(
      videoTitle(entry),
      video,
      `${sessionId}.${extension}`,
      mimeType,
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
    if (cancelled) throw new UploadCancelledError();
    callbacks.onStep?.('saving');
    await markUploaded(sessionId, { partFileIds: [uploadResult.path], videoApiId: uploadResult.id, thumbnailFileId: '', fileSizeBytes: uploadResult.size || video.size, mimeType: uploadResult.mimeType }).catch(() => undefined);
    callbacks.onStep?.('finalizing');
    await updateLocalRecording(sessionId, { uploaded: true, lastError: undefined });
    callbacks.onStep?.('done');
  } catch (error) {
    if (cancelled || error instanceof UploadCancelledError || error instanceof VideoUploadCancelledError) {
      await markPending(sessionId).catch(() => undefined);
      throw new UploadCancelledError();
    }
    const message = describeUploadError(error);
    await updateLocalRecording(sessionId, { lastError: message }).catch(() => undefined);
    await markFailed(sessionId, message).catch(() => undefined);
    throw new Error(message);
  }
}

export class UploadCancelledError extends Error {
  constructor() { super('Upload cancelled. The recording is still saved in this browser.'); }
}
