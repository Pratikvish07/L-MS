const baseUrl = (import.meta.env.VITE_VIDEO_API_BASE_URL || 'https://nvqf.vocmanindia.com').replace(/\/+$/, '');

export interface ApiVideo {
  id: string | number;
  title: string;
  slug?: string;
  file_name?: string;
  video_path?: string;
  video_url: string;
  file_size?: string | number;
  duration?: number | string | null;
  mime_type?: string;
  created_at?: string;
  thumbnail_url?: string | null;
}

export async function getApiVideos(): Promise<ApiVideo[]> {
  const url = import.meta.env.DEV ? '/api/videos' : `${baseUrl}/api/videos`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.status === false) {
    throw new Error(payload?.message ?? payload?.error ?? `Video API request failed (${response.status}).`);
  }
  const videos = Array.isArray(payload) ? payload : payload?.data;
  if (!Array.isArray(videos)) throw new Error('Video API response did not include a video list.');
  return videos.filter((video: ApiVideo) => typeof video.video_url === 'string' && video.video_url);
}

export async function updateApiVideo(id: string, title: string, file: File): Promise<void> {
  if (file.size > 100 * 1024 * 1024) throw new Error('Video exceeds the 100 MB upload limit.');
  const form = new FormData();
  form.append('id', id);
  form.append('title', title);
  form.append('video', file);
  const endpoint = import.meta.env.DEV ? '/api/videos/video' : `${baseUrl}/api/videos/video`;
  const response = await fetch(`${endpoint}?id=${encodeURIComponent(id)}`, { method: 'POST', body: form });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.status === false) throw new Error(payload?.message ?? payload?.error ?? `Video update failed (${response.status}).`);
}

export async function deleteApiVideo(id: string): Promise<void> {
  const endpoint = import.meta.env.DEV ? '/api/videos/video' : `${baseUrl}/api/videos/video`;
  const response = await fetch(`${endpoint}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.status === false) throw new Error(payload?.message ?? payload?.error ?? `Video delete failed (${response.status}).`);
}