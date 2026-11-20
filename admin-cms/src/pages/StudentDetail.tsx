import { ArrowLeft, BookOpen, CalendarDays, CheckCircle2, Clock, Eye, Mail, Phone, PlayCircle, Receipt, ShieldCheck, ShieldOff, TicketPercent } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { PageHead } from '../components/Layout';
import { Avatar, Pill, Spinner } from '../components/ui';
import type { Enrollment } from '../lib/courses';
import { formatDate, formatDateTime } from '../lib/format';
import { useStore } from '../lib/store';
import { subscribeStudentMarks, type MarkEntry } from '../lib/assessments';
import { setStudentAccess, subscribeLectureViews, subscribeStudent, subscribeStudentEnrollments, type LectureView, type StudentProfile } from '../lib/students';
import type { Recording } from '../lib/types';
import { PreviewModal } from './Lectures';

const isUploaded = (r: Recording) => r.status === 'uploaded' || r.status === 'published';
const isVisibleToStudent = (r: Recording) => isUploaded(r) && r.publicationStatus === 'published';
const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const message = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

/** Admin view of one student: profile, enrolments, and per-subject learning progress. */
export function StudentDetailPage() {
  const { uid = '' } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const { recordings } = useStore();
  const [student, setStudent] = useState<StudentProfile | null | undefined>(undefined);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [views, setViews] = useState<LectureView[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [previewing, setPreviewing] = useState<Recording | null>(null);
  const [marks, setMarks] = useState<MarkEntry[]>([]);

  useEffect(() => {
    const onError = (cause: Error) => setError(cause.message);
    const stops = [subscribeStudent(uid, setStudent, onError), subscribeStudentEnrollments(uid, setEnrollments, onError), subscribeLectureViews(uid, setViews, () => setViews([])), subscribeStudentMarks(uid, setMarks, () => setMarks([]))];
    return () => stops.forEach((stop) => stop());
  }, [uid]);

  const viewByRecording = useMemo(() => new Map(views.map((view) => [view.recordingId, view])), [views]);
  const lastActivity = useMemo(() => [student?.lastActiveAt ?? '', ...views.map((view) => view.lastViewedAt)].filter(Boolean).sort().pop() ?? '', [student, views]);

  if (student === undefined) return <Spinner />;
  if (student === null) return <PageHead title="Student not found"><button className="btn btn-outline" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back</button></PageHead>;

  const toggleAccess = async () => {
    setBusy(true); setError('');
    try { await setStudentAccess(student.uid, !student.active); } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  };

  // All lectures this student can currently see, across their enrolments.
  const enrolledBatchIds = new Set(enrollments.map((item) => item.batchId));
  const available = recordings.filter((r) => enrolledBatchIds.has(r.batchId) && isVisibleToStudent(r));
  const watched = available.filter((r) => viewByRecording.has(r.id));
  const overall = percent(watched.length, available.length);

  return (
    <>
      <PageHead title={student.displayName || student.email} subtitle="Student dashboard">
        <button className="btn btn-outline" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back</button>
        <button className={student.active ? 'btn btn-soft-danger' : 'btn'} disabled={busy} onClick={() => void toggleAccess()}>
          {student.active ? <><ShieldOff size={14} /> Disable access</> : <><ShieldCheck size={14} /> {student.approvalStatus === 'pending' ? 'Approve' : 'Enable access'}</>}
        </button>
      </PageHead>
      {error && <div className="alert" role="alert">{error}</div>}

      <section className="card card-pad student-hero">
        <Avatar name={student.displayName || student.email} />
        <div className="student-id">
          <strong>{student.displayName}</strong>
          <span><Mail size={13} aria-hidden /> {student.email}</span>
          {student.phone && <span><Phone size={13} aria-hidden /> {student.phone}</span>}
        </div>
        <div className="student-facts">
          <div><span>Status</span>{student.active ? <Pill tone="green">Active</Pill> : student.approvalStatus === 'pending' ? <Pill tone="amber">Pending approval</Pill> : <Pill tone="gray">Disabled</Pill>}</div>
          <div><span>Joined</span><strong>{student.createdAt ? formatDate(student.createdAt) : '—'}</strong></div>
          <div><span>Last activity</span><strong>{lastActivity ? formatDateTime(lastActivity) : 'Not tracked yet'}</strong></div>
        </div>
      </section>

      <div className="lecture-stats">
        <div className="card"><BookOpen size={20} aria-hidden /><strong>{enrollments.length}</strong><span>Courses enrolled</span></div>
        <div className="card"><PlayCircle size={20} aria-hidden /><strong>{available.length}</strong><span>Lectures available</span></div>
        <div className="card"><Eye size={20} aria-hidden /><strong>{watched.length}</strong><span>Lectures watched</span></div>
      </div>

      <section className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="section-head"><h2>Overall progress</h2><strong>{overall}%</strong></div>
        <div className="progress-track" aria-label={`${overall}% of available lectures watched`}><span style={{ width: `${overall}%` }} /></div>
        {!views.length && <p className="cell-sub" style={{ marginBottom: 0 }}>Viewing is recorded once students use the student Website or app (next phase). Until then this shows what is available to them.</p>}
      </section>

      {enrollments.map((enrollment) => <EnrollmentProgress key={enrollment.id} enrollment={enrollment} recordings={recordings} viewByRecording={viewByRecording} onPreview={setPreviewing} />)}
      <StudentMarks marks={marks} />
      {!enrollments.length && <section className="card card-pad"><p className="cell-sub" style={{ margin: 0 }}>Not enrolled in any course. Enrol from <Link className="link" to="/courses">Courses</Link> → batch.</p></section>}
      {previewing && <PreviewModal recording={previewing} onClose={() => setPreviewing(null)} />}
    </>
  );
}

function EnrollmentProgress({ enrollment, recordings, viewByRecording, onPreview }: { enrollment: Enrollment; recordings: Recording[]; viewByRecording: Map<string, LectureView>; onPreview: (r: Recording) => void }) {
  const lectures = recordings.filter((r) => r.batchId === enrollment.batchId && isVisibleToStudent(r));
  const subjects = [...new Map(lectures.map((r) => [r.subjectId || r.subjectName, r.subjectName || 'Subject'])).entries()].sort((a, b) => a[1].localeCompare(b[1]));

  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <div className="enrol-head">
        <div>
          <h2><Link className="link" to={`/courses/${enrollment.courseId}`}>{enrollment.courseName}</Link> <span className="cell-sub">· <Link className="link" to={`/courses/${enrollment.courseId}/batches/${enrollment.batchId}`}>{enrollment.batchName}</Link></span></h2>
          <div className="lecture-meta"><span><CalendarDays size={13} aria-hidden /> Enrolled {enrollment.enrolledAt ? formatDate(enrollment.enrolledAt) : '—'}</span></div>
        </div>
        <div className="enrol-money">
          <span className="icon-chip"><Receipt size={13} aria-hidden /> <code>{enrollment.purchaseId}</code></span>
          {enrollment.couponCode && <span className="icon-chip ok"><TicketPercent size={13} aria-hidden /> {enrollment.couponCode}</span>}
        </div>
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>Subject</th><th>Lectures</th><th>Watched</th><th>Progress</th><th>Last watched</th></tr></thead>
        <tbody>
          {subjects.map(([subjectKey, subjectName]) => {
            const rows = lectures.filter((r) => (r.subjectId || r.subjectName) === subjectKey);
            const seen = rows.filter((r) => viewByRecording.has(r.id));
            const last = seen.map((r) => viewByRecording.get(r.id)!.lastViewedAt).sort().pop();
            const pct = percent(seen.length, rows.length);
            return (
              <tr key={subjectKey}>
                <td className="cell-title">{subjectName}</td>
                <td>
                  <div className="chips">{rows.map((r) => <button key={r.id} className={`lecture-dot${viewByRecording.has(r.id) ? ' seen' : ''}`} title={`${r.lectureNumber ? `L${r.lectureNumber} ` : ''}${r.topic}${viewByRecording.has(r.id) ? ' (watched)' : ''}`} onClick={() => onPreview(r)}>{r.lectureNumber ? `L${r.lectureNumber}` : '•'}</button>)}</div>
                </td>
                <td>{seen.length} / {rows.length}</td>
                <td style={{ minWidth: 140 }}><div className="progress-track small"><span style={{ width: `${pct}%` }} /></div><span className="cell-sub">{pct}%</span></td>
                <td>{last ? <span className="lecture-meta"><Clock size={13} aria-hidden /> {formatDateTime(last)}</span> : <span className="cell-sub">—</span>}</td>
              </tr>
            );
          })}
          {!subjects.length && <tr><td className="empty" colSpan={5}>No published lectures for this batch yet.</td></tr>}
        </tbody>
      </table></div>
      {lectures.some((r) => viewByRecording.get(r.id)?.completed) && <p className="cell-sub" style={{ padding: '0 16px 12px', margin: 0 }}><CheckCircle2 size={13} aria-hidden /> Green lecture tags are watched; click any tag to preview that lecture.</p>}
    </section>
  );
}

/** Every marked test and assignment for this student, newest first, with an overall percentage. */
function StudentMarks({ marks }: { marks: MarkEntry[] }) {
  const marked = marks.filter((m) => m.marks !== null).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const got = marked.reduce((sum, m) => sum + (m.marks ?? 0), 0);
  const max = marked.reduce((sum, m) => sum + m.maxMarks, 0);
  const overall = percent(got, max);
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <div className="enrol-head"><h2 style={{ margin: 0 }}>Marks</h2>{max > 0 && <strong>{got} / {max} · {overall}%</strong>}</div>
      <div className="table-wrap"><table>
        <thead><tr><th>Test / assignment</th><th>Subject</th><th>Marks</th><th>%</th><th>Remarks</th></tr></thead>
        <tbody>
          {marked.map((m) => <tr key={m.id}><td><Link className="cell-title link" to={`/courses/${m.courseId}/subjects/${m.subjectId}/assessments/${m.assessmentId}`}>{m.assessmentTitle}</Link> <span className={`icon-chip ${m.assessmentType === 'test' ? 'info' : 'ok'}`}>{m.assessmentType === 'test' ? 'Test' : 'Assignment'}</span></td><td>{m.subjectName}</td><td><strong>{m.marks}</strong> / {m.maxMarks}</td><td className={percent(m.marks ?? 0, m.maxMarks) < 40 ? 'mark-low' : ''}>{percent(m.marks ?? 0, m.maxMarks)}%</td><td className="cell-sub">{m.remarks || '—'}</td></tr>)}
          {!marked.length && <tr><td className="empty" colSpan={5}>No marks entered yet.</td></tr>}
        </tbody>
      </table></div>
    </section>
  );
}
