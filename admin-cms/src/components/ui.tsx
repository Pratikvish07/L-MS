import { Film } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { fetchObjectUrl } from '../lib/data';
import { initials, STATUS_LABEL } from '../lib/format';
import type { RecordingStatus } from '../lib/types';

const STATUS_CLASS: Record<RecordingStatus, string> = {
  ready: 'pill-gray',
  recording: 'pill-red',
  saved_locally: 'pill-amber',
  uploading: 'pill-blue',
  uploaded: 'pill-green',
  published: 'pill-green',
  failed: 'pill-red',
};

export function StatusPill({ status, progress }: { status: RecordingStatus; progress?: number }) {
  const label = status === 'uploading' && progress ? `Uploading ${progress}%` : STATUS_LABEL[status];
  return <span className={`pill ${STATUS_CLASS[status] ?? 'pill-gray'}`}>{label}</span>;
}

export function Pill({ tone, children }: { tone: 'green' | 'blue' | 'red' | 'amber' | 'gray'; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function Avatar({ name }: { name: string }) {
  return (
    <span className="avatar" aria-hidden>
      {initials(name) || '?'}
    </span>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <div className="spinner" role="status" aria-label={label} />;
}

// Thumbnails are small; cache object URLs for the session.
const thumbCache = new Map<string, Promise<string>>();

export function Thumbnail({ path, alt }: { path: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return;
    let active = true;
    if (!thumbCache.has(path)) thumbCache.set(path, fetchObjectUrl(path));
    thumbCache
      .get(path)!
      .then((u) => active && setUrl(u))
      .catch(() => thumbCache.delete(path));
    return () => {
      active = false;
    };
  }, [path]);

  return <div className="thumb">{url ? <img src={url} alt={alt} /> : <Film size={18} aria-hidden />}</div>;
}
