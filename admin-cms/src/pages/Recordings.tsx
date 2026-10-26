import { Film, Pencil, Play, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { PageHead } from '../components/Layout';
import { formatDate, formatDuration } from '../lib/format';
import { deleteApiVideo, getApiVideos, updateApiVideo, type ApiVideo } from '../lib/video-api';

const PAGE_SIZE = 10;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

function displayDuration(duration: ApiVideo['duration']) {
  if (typeof duration === 'number') return formatDuration(duration);
  if (typeof duration === 'string' && duration) {
    const numeric = Number(duration);
    return Number.isFinite(numeric) ? formatDuration(numeric) : duration;
  }
  return '—';
}

export function RecordingsPage() {
  const [videos, setVideos] = useState<ApiVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [playing, setPlaying] = useState<ApiVideo | null>(null);
  const [editing, setEditing] = useState<ApiVideo | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      setVideos(await getApiVideos());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load videos from the video API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return videos;
    return videos.filter((video) => [video.title, video.file_name, video.slug, video.mime_type]
      .some((value) => value?.toLowerCase().includes(term)));
  }, [videos, search]);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const remove = async (video: ApiVideo) => {
    if (!window.confirm(`Delete "${video.title}" permanently?`)) return;
    setBusy(true);
    setError('');
    try {
      await deleteApiVideo(String(video.id));
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Video delete failed.');
    } finally {
      setBusy(false);
    }
  };

  const saveUpdate = async () => {
    if (!editing || !editFile || !editTitle.trim()) return;
    setBusy(true);
    setError('');
    try {
      await updateApiVideo(String(editing.id), editTitle.trim(), editFile);
      setEditing(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Video update failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title="All Recordings" subtitle="Videos available from the video service">
        <button className="btn btn-outline" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw size={16} /> {loading ? 'Loading videos…' : 'Refresh videos'}
        </button>
      </PageHead>

      {error && <div className="alert" role="alert">Video API: {error}</div>}

      <section className="card">
        <div className="toolbar">
          <div className="search">
            <Search size={16} aria-hidden />
            <input
              className="input"
              aria-label="Search videos"
              placeholder="Search by title, filename, or format"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            />
          </div>
          <span className="cell-sub">{visible.length} videos</span>
        </div>

        {loading ? <div className="spinner" role="status" aria-label="Loading videos" /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Thumbnail</th>
                  <th>Title</th>
                  <th>File</th>
                  <th>Date</th>
                  <th>Duration</th>
                  <th>Size</th>
                  <th>Format</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={8} className="empty">{videos.length ? 'No videos match your search.' : 'No videos returned by the video API.'}</td></tr>
                ) : rows.map((video) => (
                  <tr key={video.id}>
                    <td><div className="thumb">{video.thumbnail_url ? <img src={video.thumbnail_url} alt="" /> : <Film size={18} aria-hidden />}</div></td>
                    <td className="cell-title">{video.title || 'Untitled video'}</td>
                    <td title={video.file_name || video.video_path}>{video.file_name || video.video_path || '—'}</td>
                    <td>{formatDate(video.created_at || '')}</td>
                    <td>{displayDuration(video.duration)}</td>
                    <td>{video.file_size || '—'}</td>
                    <td>{video.mime_type || '—'}</td>
                    <td>
                      <div className="actions">
                        <button className="icon-btn" aria-label={`Play ${video.title}`} title="Play video" onClick={() => setPlaying(video)} disabled={!video.video_url}><Play size={15} /></button>
                        <button className="icon-btn" aria-label={`Update ${video.title}`} title="Update video" onClick={() => { setEditing(video); setEditTitle(video.title); setEditFile(null); }}><Pencil size={15} /></button>
                        <button className="icon-btn danger" aria-label={`Delete ${video.title}`} title="Delete video" onClick={() => void remove(video)} disabled={busy}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination">
          <div className="pages" role="navigation" aria-label="Pagination">
            <button aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>‹</button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
              <button key={pageNumber} className={pageNumber === currentPage ? 'active' : ''} aria-current={pageNumber === currentPage ? 'page' : undefined} onClick={() => setPage(pageNumber)}>{pageNumber}</button>
            ))}
            <button aria-label="Next page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>›</button>
          </div>
          <span>Showing {visible.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0} to {Math.min(currentPage * PAGE_SIZE, visible.length)} of {visible.length} videos</span>
        </div>
      </section>

      {playing && <div className="backdrop" role="presentation" onClick={() => setPlaying(null)}><section className="video-dialog" role="dialog" aria-modal="true" aria-label={playing.title} onClick={(event) => event.stopPropagation()}><button className="video-dialog-close" aria-label="Close video" onClick={() => setPlaying(null)}>×</button><video src={playing.video_url} controls autoPlay playsInline /><h2>{playing.title}</h2></section></div>}

      {editing && <div className="backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="Update video"><header className="modal-head"><h2>Update video</h2><button className="icon-btn" aria-label="Close" onClick={() => setEditing(null)}>×</button></header><div className="modal-body"><label className="field"><span>Title</span><input className="input" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} /></label><label className="field"><span>Replacement video (max 100 MB)</span><input className="input" type="file" accept="video/*" onChange={(event) => setEditFile(event.target.files?.[0] ?? null)} /></label>{editFile && editFile.size > MAX_VIDEO_BYTES && <div className="error-text">Video exceeds the 100 MB upload limit.</div>}</div><footer className="modal-foot"><button className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button><button className="btn" disabled={busy || !editTitle.trim() || !editFile || editFile.size > MAX_VIDEO_BYTES} onClick={() => void saveUpdate()}>{busy ? 'Updating…' : 'Update video'}</button></footer></section></div>}
    </>
  );
}