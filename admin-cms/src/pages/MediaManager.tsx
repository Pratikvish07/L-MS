import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Film, Play, RefreshCw, Trash2, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';

import { PageHead } from '../components/Layout';
import { formatDate } from '../lib/format';
import { firebaseStorage, firestore } from '../lib/firebase';
import { deleteApiVideo, getApiVideos, uploadApiVideo, type ApiVideo } from '../lib/video-api';

const MAX_FILE_BYTES = 100 * 1024 * 1024;

export function MediaManagerPage() {
  const [videos, setVideos] = useState<ApiVideo[]>([]);
  const [assets, setAssets] = useState<{ id: string; name: string; url: string; kind: string; createdAt?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [playing, setPlaying] = useState<ApiVideo | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try { setVideos(await getApiVideos()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load media files.'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    void refresh();
    return onSnapshot(collection(firestore, 'mediaAssets'), (snapshot) => {
      setAssets(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as { id: string; name: string; url: string; kind: string; createdAt?: string }));
    }, (cause) => setError(cause.message));
  }, []);

  const upload = async () => {
    if (!title.trim() || !file) return setError('Enter a title and select a file.');
    setBusy(true); setError(''); setNotice('');
    try {
      if (file.type.startsWith('video/')) {
        await uploadApiVideo(title.trim(), file);
        setNotice('Video uploaded to video storage.');
        await refresh();
      } else {
        const id = doc(collection(firestore, 'mediaAssets')).id;
        const storageRef = ref(firebaseStorage, `media/${id}/${file.name}`);
        const result = await uploadBytes(storageRef, file, { contentType: file.type || 'application/octet-stream' });
        const url = await getDownloadURL(result.ref);
        await setDoc(doc(firestore, 'mediaAssets', id), { name: title.trim(), kind: file.type || 'file', url, fileName: file.name, size: file.size, storagePath: result.ref.fullPath, createdAt: new Date().toISOString() });
        setNotice('Media file uploaded to Firebase Storage.');
      }
      setTitle(''); setFile(null);
      const input = document.getElementById('media-file') as HTMLInputElement | null;
      if (input) input.value = '';
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Upload failed.'); }
    finally { setBusy(false); }
  };

  const removeVideo = async (video: ApiVideo) => {
    if (!window.confirm(`Delete “${video.title}” from video storage?`)) return;
    setBusy(true); setError('');
    try { await deleteApiVideo(String(video.id)); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not delete the video.'); }
    finally { setBusy(false); }
  };

  const removeAsset = async (asset: { id: string; name: string; storagePath?: string }) => {
    if (!window.confirm(`Delete media record “${asset.name}”?`)) return;
    try {
      if (asset.storagePath) await deleteObject(ref(firebaseStorage, asset.storagePath));
      await deleteDoc(doc(firestore, 'mediaAssets', asset.id));
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not delete media record.'); }
  };

  return <>
    <PageHead title="Media Manager" subtitle="Browse video files and manage media records">
      <button className="btn btn-outline" onClick={() => void refresh()} disabled={loading}><RefreshCw size={16} /> Refresh files</button>
    </PageHead>
    {error && <div className="alert" role="alert">{error}</div>}
    {notice && <div className="notice" role="status">{notice}</div>}
    <section className="card card-pad media-upload">
      <div><h2>New Upload</h2><p className="cell-sub">Videos are uploaded to the video API. Other file types can be recorded as Firebase media metadata.</p></div>
      <div className="media-upload-fields">
        <label className="field"><span>Title</span><input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Media title" /></label>
        <label className="field"><span>File</span><input id="media-file" className="input" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
        <button className="btn" disabled={busy || !title.trim() || !file || (file.type.startsWith('video/') && file.size > MAX_FILE_BYTES)} onClick={() => void upload()}><Upload size={16} />{busy ? 'Saving…' : 'Upload / Save'}</button>
      </div>
      {file && <small className={file.type.startsWith('video/') && file.size > MAX_FILE_BYTES ? 'error-text' : 'cell-sub'}>{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB{file.type.startsWith('video/') && file.size > MAX_FILE_BYTES ? ' · exceeds 100 MB limit' : ''}</small>}
    </section>
    <section className="card media-files">
      <div className="card-head"><h2>All Files</h2><span className="cell-sub">{videos.length + assets.length} records</span></div>
      {loading ? <div className="spinner" role="status" aria-label="Loading media" /> : <div className="table-wrap"><table><thead><tr><th>File</th><th>Name</th><th>Type</th><th>Size</th><th>Added</th><th>Actions</th></tr></thead><tbody>
        {videos.map((video) => <tr key={`video-${video.id}`}><td><div className="person"><div className="thumb">{video.thumbnail_url ? <img src={video.thumbnail_url} alt="" /> : <Film size={17} />}</div><span title={video.file_name}>{video.file_name || video.video_path || 'Video file'}</span></div></td><td className="cell-title">{video.title || 'Untitled'}</td><td>{video.mime_type || 'Video'}</td><td>{video.file_size || '—'}</td><td>{formatDate(video.created_at || '')}</td><td><div className="actions"><button className="icon-btn" aria-label={`Play ${video.title}`} title="Preview" onClick={() => setPlaying(video)}><Play size={14} /></button><button className="icon-btn danger" aria-label={`Delete ${video.title}`} title="Delete file" disabled={busy} onClick={() => void removeVideo(video)}><Trash2 size={14} /></button></div></td></tr>)}
        {assets.map((asset) => <tr key={`asset-${asset.id}`}><td><div className="thumb"><Film size={17} /></div></td><td className="cell-title">{asset.name}</td><td>{asset.kind}</td><td>{asset.url ? 'Remote' : 'Metadata only'}</td><td>{formatDate(asset.createdAt || '')}</td><td><button className="icon-btn danger" aria-label={`Delete ${asset.name}`} onClick={() => void removeAsset(asset)}><Trash2 size={14} /></button></td></tr>)}
        {!videos.length && !assets.length && <tr><td className="empty" colSpan={6}>No media records yet.</td></tr>}
      </tbody></table></div>}
    </section>
    {playing && <div className="backdrop" role="presentation" onClick={() => setPlaying(null)}><section className="video-dialog" role="dialog" aria-modal="true" aria-label={playing.title} onClick={(event) => event.stopPropagation()}><button className="video-dialog-close" aria-label="Close video" onClick={() => setPlaying(null)}>×</button><video src={playing.video_url} controls autoPlay playsInline /><h2>{playing.title}</h2></section></div>}
  </>;
}
