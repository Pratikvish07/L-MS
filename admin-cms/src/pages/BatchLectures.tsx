import { ArrowLeft, CalendarDays, CheckCircle2, CloudOff, FileText, Loader2, PlayCircle, Search, TriangleAlert, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { PageHead } from '../components/Layout';
import { Spinner } from '../components/ui';
import { subscribeBatch, subscribeCourse, subscribeCourseSubjects, type Course, type CourseBatch, type CourseSubject } from '../lib/courses';
import { formatDate } from '../lib/format';
import { useStore } from '../lib/store';
import type { Recording } from '../lib/types';
import { PreviewModal } from './Lectures';

const isUploaded = (r: Recording) => r.status === 'uploaded' || r.status === 'published';
const lectureNo = (r: Recording) => Number.parseInt(r.lectureNumber, 10);

function VideoState({ recording }: { recording: Recording }) {
  if (isUploaded(recording)) return <span className="icon-chip ok" title="Video uploaded"><CheckCircle2 size={14} aria-hidden /> Uploaded</span>;
  if (recording.status === 'uploading') return <span className="icon-chip info" title="Uploading"><Loader2 size={14} aria-hidden /> {recording.uploadProgress}%</span>;
  if (recording.status === 'failed') return <span className="icon-chip bad" title={recording.errorMessage || 'Upload failed'}><TriangleAlert size={14} aria-hidden /> Failed</span>;
  return <span className="icon-chip warn" title="Video not uploaded yet"><CloudOff size={14} aria-hidden /> Not uploaded</span>;
}

/** All lectures of one batch as cards: lecture number, video state, notes, date; click to preview. */
export function BatchLecturesPage() {
  const { courseId = '', batchId = '' } = useParams<{ courseId: string; batchId: string }>();
  const navigate = useNavigate();
  const { recordings, loading } = useStore();
  const [course, setCourse] = useState<Course | null>(null);
  const [batch, setBatch] = useState<CourseBatch | null>(null);
  const [subjects, setSubjects] = useState<CourseSubject[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [status, setStatus] = useState<'all' | 'uploaded' | 'not-uploaded'>('all');
  const [search, setSearch] = useState('');
  const [previewing, setPreviewing] = useState<Recording | null>(null);

  useEffect(() => {
    const ignore = () => undefined;
    const stops = [subscribeCourse(courseId, setCourse, ignore), subscribeBatch(batchId, setBatch, ignore), subscribeCourseSubjects(courseId, setSubjects, ignore)];
    return () => stops.forEach((stop) => stop());
  }, [courseId, batchId]);

  const lectures = useMemo(() => recordings.filter((r) => r.batchId === batchId), [recordings, batchId]);
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return lectures
      .filter((r) => (!subjectId || r.subjectId === subjectId) && (status === 'all' || (status === 'uploaded') === isUploaded(r)) && (!term || `${r.topic} ${r.facultyName} ${r.lectureNumber}`.toLowerCase().includes(term)))
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName) || (lectureNo(a) || 1e9) - (lectureNo(b) || 1e9) || a.recordedAt.localeCompare(b.recordedAt));
  }, [lectures, subjectId, status, search]);

  // One section per subject, in subject order.
  const sections = useMemo(() => {
    const map = new Map<string, Recording[]>();
    for (const r of visible) map.set(r.subjectId || r.subjectName, [...(map.get(r.subjectId || r.subjectName) ?? []), r]);
    return [...map.entries()].map(([id, rows]) => ({ id, name: subjects.find((s) => s.id === id)?.name ?? rows[0].subjectName ?? 'Subject', rows }));
  }, [visible, subjects]);

  const uploaded = lectures.filter(isUploaded).length;
  const notes = lectures.reduce((sum, r) => sum + r.lectureNotes.length, 0);
  const count = (id: string) => lectures.filter((r) => r.subjectId === id).length;

  return (
    <>
      <PageHead title={`Lectures · ${batch?.name ?? 'Batch'}`} subtitle={course?.title ?? ''}>
        <button className="btn btn-outline" onClick={() => navigate(`/courses/${courseId}/batches/${batchId}`)}><ArrowLeft size={16} /> {batch?.name ?? 'Batch'}</button>
      </PageHead>

      <div className="lecture-stats">
        <div className="card"><PlayCircle size={20} aria-hidden /><strong>{lectures.length}</strong><span>Lectures</span></div>
        <div className="card"><CheckCircle2 size={20} aria-hidden /><strong>{uploaded}</strong><span>Videos uploaded</span></div>
        <div className="card"><CloudOff size={20} aria-hidden /><strong>{lectures.length - uploaded}</strong><span>Not uploaded</span></div>
        <div className="card"><FileText size={20} aria-hidden /><strong>{notes}</strong><span>Notes files</span></div>
      </div>

      <section className="card card-pad">
        <div className="lecture-filters">
          <div className="chips" role="tablist" aria-label="Subject">
            <button role="tab" aria-selected={!subjectId} className={`filter-chip${!subjectId ? ' active' : ''}`} onClick={() => setSubjectId('')}>All subjects <b>{lectures.length}</b></button>
            {subjects.map((s) => <button key={s.id} role="tab" aria-selected={subjectId === s.id} className={`filter-chip${subjectId === s.id ? ' active' : ''}`} onClick={() => setSubjectId(s.id)}>{s.name} <b>{count(s.id)}</b></button>)}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div className="search" style={{ minWidth: 220 }}><Search size={16} aria-hidden /><input className="input" aria-label="Search lectures" placeholder="Search lecture or instructor" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <div className="seg" role="tablist">{([['all', 'All'], ['uploaded', 'Uploaded'], ['not-uploaded', 'Not uploaded']] as const).map(([key, label]) => <button key={key} role="tab" aria-selected={status === key} className={status === key ? 'active' : ''} onClick={() => setStatus(key)}>{label}</button>)}</div>
          </div>
        </div>

        {loading ? <Spinner /> : sections.map((section) => (
          <div key={section.id} className="lecture-section">
            <h2>{section.name} <span className="cell-sub">· {section.rows.length} lecture{section.rows.length === 1 ? '' : 's'}</span></h2>
            <div className="lecture-grid">
              {section.rows.map((r) => (
                <button key={r.id} className="lecture-card" onClick={() => setPreviewing(r)} aria-label={`Preview lecture ${r.lectureNumber} ${r.topic}`}>
                  <div className="lecture-top">
                    <span className="lecture-no">{r.lectureNumber ? `L${r.lectureNumber}` : '—'}</span>
                    <VideoState recording={r} />
                  </div>
                  <strong className="lecture-title">{r.topic}</strong>
                  <div className="lecture-meta">
                    <span><CalendarDays size={13} aria-hidden /> {r.recordedAt ? formatDate(r.recordedAt) : 'No date'}</span>
                    {r.facultyName && <span><UserRound size={13} aria-hidden /> {r.facultyName}</span>}
                  </div>
                  <div className="lecture-foot">
                    <span className={`icon-chip${r.storagePath ? ' ok' : ''}`}><PlayCircle size={14} aria-hidden /> {r.storagePath ? 'Play video' : 'No video'}</span>
                    <span className={`icon-chip${r.lectureNotes.length ? ' ok' : ''}`}><FileText size={14} aria-hidden /> {r.lectureNotes.length ? `${r.lectureNotes.length} notes` : 'No notes'}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
        {!loading && !visible.length && <div className="empty">{lectures.length ? 'No lectures match these filters.' : 'No lectures yet for this batch. Instructors create them in the app.'}</div>}
      </section>
      {previewing && <PreviewModal recording={previewing} onClose={() => setPreviewing(null)} />}
    </>
  );
}
