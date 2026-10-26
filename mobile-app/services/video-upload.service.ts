import { config } from '@/constants/config';
import { Platform } from 'react-native';

export interface VideoUploadCallbacks {
  onProgress?: (fraction: number, bytesTransferred: number, totalBytes: number) => void;
}

export interface NativeVideoFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface VideoUploadResult {
  path: string;
  size: number;
  mimeType: string;
  id?: string;
}

export interface ApiVideo { id: string | number; title: string; video_url?: string; video_path?: string; duration?: number | string | null; file_size?: string | number; created_at?: string; mime_type?: string; }

export async function getVideosFromApi(): Promise<ApiVideo[]> {
  const response = await fetch(config.videoApiBaseUrl + '/api/videos', { headers: { Accept: 'application/json' } });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.status === false) throw new Error(payload?.message ?? payload?.error ?? `Video list failed (${response.status}).`);
  const rows = Array.isArray(payload) ? payload : payload?.data;
  if (!Array.isArray(rows)) throw new Error('Video API response did not include a video list.');
  return rows;
}

export class VideoUploadCancelledError extends Error {
  constructor() {
    super('Video upload cancelled.');
  }
}

let activeRequest: XMLHttpRequest | null = null;

export function cancelVideoUpload() {
  activeRequest?.abort();
}

export function uploadVideoToApi(
  title: string,
  video: Blob | NativeVideoFile,
  fileName: string,
  mimeType: string,
  callbacks: VideoUploadCallbacks = {},
): Promise<VideoUploadResult> {
  const size = video.size;
  if (size > config.maxVideoUploadBytes) {
    return Promise.reject(new Error('Video exceeds the 100 MB upload limit. Compress or trim the recording before retrying.'));
  }
  const form = new FormData();
  form.append('title', title);
  if ('uri' in video) {
    form.append('video', { uri: video.uri, name: video.name, type: video.mimeType } as unknown as Blob);
  } else {
    form.append('video', video, fileName);
  }

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    activeRequest = request;
    request.open('POST', config.videoUploadUrl);
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      callbacks.onProgress?.(event.total ? event.loaded / event.total : 0, event.loaded, event.total);
    };
    request.onload = () => {
      activeRequest = null;
      let payload: any;
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        reject(new Error(`Video API returned an invalid response (${request.status}).`));
        return;
      }
      if (request.status < 200 || request.status >= 300 || payload?.status === false) {
        reject(new Error(payload?.error ?? payload?.message ?? `Video upload failed (${request.status}).`));
        return;
      }

      const data = payload?.data ?? payload;
      const path = data?.video_url ?? data?.video_path ?? data?.videoPath ?? data?.url ?? data?.path;
      if (typeof path !== 'string' || !path) {
        reject(new Error('Video API response did not include a video path.'));
        return;
      }
      resolve({
        path: new URL(path, config.videoUploadUrl).toString(),
        size: Number(data?.file_size ?? data?.size ?? size) || size,
        mimeType: String(data?.mime_type ?? data?.mimeType ?? mimeType),
        id: data?.id == null ? undefined : String(data.id),
      });
    };
    request.onerror = () => {
      activeRequest = null;
      reject(new Error(
        Platform.OS === 'web'
          ? 'The live video API blocked this browser request. Allow http://localhost:8081 in the API CORS settings (including OPTIONS and POST), or upload from the Android app.'
          : 'Could not connect to the live video upload service. Check the phone network and try again.',
      ));
    };
    request.onabort = () => {
      activeRequest = null;
      reject(new VideoUploadCancelledError());
    };
    request.send(form);
  });
}
