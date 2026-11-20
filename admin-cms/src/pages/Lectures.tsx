import { Eye, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { PageHead } from '../components/Layout';
import { Modal } from '../components/Modal';
import { Pill, Spinner } from '../components/ui';
import { dayKey, formatDate } from '../lib/format';
import { useStore } from '../lib/store';
import type { Recording } from '../lib/types';

const isUploaded = (recording: Recording) => recording.status === 'uploaded' || recording.status === 'published';
const unique = (rows: Recording[], key: (r: Recording) => [string, string]) => [...new Map(rows.map(key).filter(([id]) => id)).entries()].sort((a, b) => a[1].localeCompare(b[1]));

/** Every lecture an instructor created, uploaded or not, filterable by course/batch/subject, status and date. */
export function LecturesPage() {
  const { recordings, loading } = useStore();
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [status, setStatus] = useState<'all' | 'uploaded' | 'not-uploaded'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [previewing, setPreviewing] = useState<Recording | null>(null);

  const courses = useMemo(() => unique(recordings, (r) => [r.courseId, r.courseName || r.courseId]), [recordings]);
  const batches = useMemo(() => unique(recordings.filter((r) => !courseId || r.courseId === courseId), (r) => [r.batchId, r.batchName || r.batchId]), [recordings, courseId]);
  const subjects = useMemo(() => unique(recordings.filter((r) => (!courseId || r.courseId === courseId) && (!batchId || r.batchId === batchId)), (r) => [r.subjectId, r.subjectName || r.subjectId]), [recordings, courseId, batchId]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return recordings.filter((r) => {
      const day = r.recordedAt ? dayKey(r.recordedAt) : '';
      return (!courseId || r.courseId === courseId) && (!batchId || r.batchId === batchId) && (!subjectId || r.subjectId === subjectId)
        && (status === 'all' || (status === 'uploaded') === isUploaded(r))
        && (!from || day >= from) && (!to || day <= to)
        && (!term || `${r.topic} ${r.facultyName} ${r.subjectName}`.toLowerCase().includes(term));
    });
  }, [recordings, courseId, batchId, subjectId, status, from, to, search]);

  // Grouped by lecture date, newest first.
  const groups = useMemo(() => {
    const map = new Map<string, Recording[]>();
    for (const r of visible) { const key = r.recordedAt ? dayKey(r.recordedAt) : 'No date'; map.set(key, [...(map.get(key) ?? []), r]); }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [visible]);
  const uploadedCount = visible.filter(isUploaded).length;

  return (
    <>
      <PageHead title="Lectures" subtitle={`${visible.length} lectures · ${uploadedCount} uploaded · ${visible.length - uploadedCount} not uploaded`} />
      <section className="card">
        <div className="toolbar">
          <div className="search"><Search size={16} aria-hidden /><input className="input" aria-label="Search lectures" placeholder="Search lecture, instructor, subject" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div className="seg" role="tablist">{([['all', 'All'], ['uploaded', 'Uploaded'], ['not-uploaded', 'Not uploaded']] as const).map(([key, label]) => <button key={key} role="tab" aria-selected={status === key} className={status === key ? 'active' : ''} onClick={() => setStatus(key)}>{label}</button>)}</div>
        </div>
        <div className="toolbar">
          <select className="input" style={{ maxWidth: 220 }} aria-label="Course" value={courseId} onChange={(e) => { setCourseId(e.target.value); setBatchId(''); setSubjectId(''); }}><option value="">All courses</option>{courses.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
          <select className="input" style={{ maxWidth: 200 }} aria-label="Batch" value={batchId} onChange={(e) => { setBatchId(e.target.value); setSubjectId(''); }}><option value="">All batches</option>{batches.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
          <select className="input" style={{ maxWidth: 200 }} aria-label="Subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}><option value="">All subjects</option>{subjects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
          <label className="cell-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>From <input className="input" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="cell-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>To <input className="input" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        {loading ? <Spinner /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Lecture</th><th>Course · Batch · Subject</th><th>Instructor</th><th>Video</th><th>Preview</th></tr></thead>
            <tbody>
              {groups.map(([day, rows]) => [
                <tr key={`h-${day}`}><td colSpan={5} className="cell-sub" style={{ fontWeight: 700, background: 'var(--bg)' }}>{day === 'No date' ? day : formatDate(`${day}T12:00:00`)} · {rows.filter(isUploaded).length}/{rows.length} uploaded</td></tr>,
                ...rows.map((r) => (
                  <tr key={r.id}>
                    <td><Link className="cell-title link" to={`/recordings/${r.id}`}>{r.lectureNumber ? `${r.lectureNumber}. ` : ''}{r.topic}</Link></td>
                    <td>{[r.courseName, r.batchName, r.subjectName].filter(Boolean).join(' · ') || r.className || '—'}</td>
                    <td>{r.facultyName || '—'}</td>
                    <td>{isUploaded(r) ? <Pill tone="green">Uploaded</Pill> : r.status === 'failed' ? <Pill tone="red">Upload failed</Pill> : r.status === 'uploading' ? <Pill tone="blue">Uploading {r.uploadProgress}%</Pill> : <Pill tone="amber">Not uploaded</Pill>}</td>
                    <td><button className="btn btn-outline btn-sm" disabled={!r.storagePath} title={!r.storagePath ? 'No video yet' : undefined} onClick={() => setPreviewing(r)}><Eye size={14} /> Preview</button></td>
                  </tr>
                )),
              ])}
              {!visible.length && <tr><td className="empty" colSpan={5}>{recordings.length ? 'No lectures match these filters.' : 'No lectures yet. Instructors create them in the app.'}</td></tr>}
            </tbody>
          </table></div>
        )}
      </section>
      {previewing && <PreviewModal recording={previewing} onClose={() => setPreviewing(null)} />}
    </>
  );
}

export function PreviewModal({ recording, onClose }: { recording: Recording; onClose: () => void }) {
  return (
    <Modal wide title={`${recording.lectureNumber ? `${recording.lectureNumber}. ` : ''}${recording.topic}`} onClose={onClose} footer={<><Link className="btn btn-outline" to={`/recordings/${recording.id}`}>Open lecture</Link><button className="btn" onClick={onClose}>Close</button></>}>
      <p className="cell-sub" style={{ marginTop: 0 }}>{[recording.courseName, recording.batchName, recording.subjectName, recording.facultyName].filter(Boolean).join(' · ')}</p>
      {recording.storagePath ? <video key={recording.storagePath} className="preview-frame" controls preload="metadata" src={recording.storagePath} /> : <p className="cell-sub">The video is not uploaded yet.</p>}
    </Modal>
  );
}
