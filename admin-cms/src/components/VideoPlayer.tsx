import { PlayCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { fetchObjectUrl } from '../lib/data';
import { formatBytes } from '../lib/format';
import type { Recording } from '../lib/types';

/**
 * Plays a lecture through an authenticated SDK download (Storage rules are
 * checked on each request). The file is fetched only when the admin presses
 * play, then held as an in-memory object URL until the page is left.
 */
export function VideoPlayer({ recording }: { recording: Recording }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  useEffect(() => {
    setUrl(null);
    setState('idle');
  }, [recording.storagePath]);

  const load = async () => {
    setState('loading');
    try {
      const filePath = recording.partFileIds?.[0] || recording.storagePath;
      setUrl(/^https?:\/\//i.test(filePath) ? filePath : await fetchObjectUrl(filePath));
      setState('idle');
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(
        code === 'storage/unauthorized'
          ? 'You do not have permission to view this video.'
          : code === 'storage/object-not-found'
            ? 'The video file is missing from storage.'
            : `Could not load the video. ${e instanceof Error ? e.message : ''}`,
      );
      setState('error');
    }
  };

  if (!recording.storagePath) {
    return (
      <div className="video-box">
        <p>No video uploaded yet ({recording.status.replace('_', ' ')}).</p>
      </div>
    );
  }

  if (url) {
    return (
      <div className="video-box">
        <video src={url} controls autoPlay aria-label={`Lecture video: ${recording.topic}`} />
      </div>
    );
  }

  return (
    <div className="video-box">
      {state === 'loading' ? (
        <div>
          <div className="spinner" role="status" aria-label="Loading video" />
          <p>Loading video ({formatBytes(recording.fileSizeBytes)})…</p>
        </div>
      ) : (
        <div style={{ padding: 16 }}>
          <button className="btn" onClick={load}>
            <PlayCircle size={18} /> Play video
          </button>
          {state === 'error' && <p className="error-text" style={{ color: '#fca5a5' }}>{error}</p>}
        </div>
      )}
    </div>
  );
}
