import { ArrowLeft, BookOpenCheck, CalendarDays, ClipboardCheck, Download, FileQuestion, FileText, ListChecks, Paperclip, Plus, Timer, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { PageHead } from '../components/Layout';
import { Modal } from '../components/Modal';
import { Pill, Spinner } from '../components/ui';
import {
  ASSESSMENT_FILE_TYPES, downloadCsv, MCQ_CSV_SAMPLE, newAssessmentId, parseMcqCsv, removeAssessmentFile, replaceQuestions, saveAssessment,
  friendlyError, subscribeSubjectAssessments, uploadAssessmentFile, type Assessment, type AssessmentFile, type AssessmentType, type McqQuestion,
} from '../lib/assessments';
import { subscribeCourse, subscribeCourseBatches, subscribeCourseEnrollments, subscribeCourseSubjects, type Course, type CourseBatch, type CourseSubject, type Enrollment } from '../lib/courses';
import { formatDate } from '../lib/format';
import { useStore } from '../lib/store';
import { MarksMatrix } from './MarksMatrix';

const message = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));
type Tab = 'test' | 'assignment' | 'marks';

/** Subject hub: Tests, Assignments and Marks for one subject of a course. */
export function SubjectPage() {
  const { courseId = '', subjectId = '' } = useParams<{ courseId: string; subjectId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [subject, setSubject] = useState<CourseSubject | null | undefined>(undefined);
  const [batches, setBatches] = useState<CourseBatch[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [assessments, setAssessments] = useState<Assessment[] | null>(null);
  const [tab, setTab] = useState<Tab>('test');
  const [editing, setEditing] = useState<Assessment | AssessmentType | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const onError = (cause: Error) => setError(friendlyError(cause));
    const stops = [
      subscribeCourse(courseId, setCourse, onError),
      subscribeCourseSubjects(courseId, (rows) => setSubject(rows.find((row) => row.id === subjectId) ?? null), onError),
      subscribeCourseBatches(courseId, setBatches, onError),
      subscribeCourseEnrollments(courseId, setEnrollments, onError),
      subscribeSubjectAssessments(subjectId, setAssessments, (cause) => { setAssessments([]); onError(cause); }),
    ];
    return () => stops.forEach((stop) => stop());
  }, [courseId, subjectId]);

  const back = <button className="btn btn-outline" onClick={() => navigate(`/courses/${courseId}`)}><ArrowLeft size={16} /> {course?.title ?? 'Course'}</button>;
  if (subject === undefined) return <Spinner />;
  if (subject === null) return <PageHead title="Subject not found">{back}</PageHead>;

  const tests = (assessments ?? []).filter((a) => a.type === 'test');
  const assignments = (assessments ?? []).filter((a) => a.type === 'assignment');
  const list = tab === 'test' ? tests : assignments;
  const batchName = (id: string) => batches.find((b) => b.id === id)?.name ?? 'Removed batch';

  return (
    <>
      <PageHead title={subject.name} subtitle={[course?.title, subject.code, subject.instructorName ? `Instructor: ${subject.instructorName}` : ''].filter(Boolean).join(' · ')}>{back}</PageHead>
      {error && <div className="alert" role="alert">{error}</div>}

      <div className="subject-actions">
        <button className={`action-tile${tab === 'test' ? ' active' : ''}`} onClick={() => setTab('test')}><FileQuestion size={22} aria-hidden /><strong>Tests</strong><small>{tests.length} created</small></button>
        <button className={`action-tile${tab === 'assignment' ? ' active' : ''}`} onClick={() => setTab('assignment')}><ClipboardCheck size={22} aria-hidden /><strong>Assignments</strong><small>{assignments.length} created</small></button>
        <button className={`action-tile${tab === 'marks' ? ' active' : ''}`} onClick={() => setTab('marks')}><ListChecks size={22} aria-hidden /><strong>Marks</strong><small>By batch and student</small></button>
      </div>

      {tab === 'marks' ? (
        <MarksMatrix assessments={assessments ?? []} batches={batches} enrollments={enrollments} />
      ) : (
        <section className="card card-pad">
          <div className="section-head">
            <h2>{tab === 'test' ? 'Tests' : 'Assignments'}</h2>
            <button className="btn" onClick={() => setEditing(tab)}><Plus size={16} /> {tab === 'test' ? 'New test' : 'New assignment'}</button>
          </div>
          {!assessments ? <Spinner /> : (
            <div className="lecture-grid">
              {list.map((a) => (
                <Link key={a.id} to={`/courses/${courseId}/subjects/${subjectId}/assessments/${a.id}`} className="lecture-card assessment-card">
                  <div className="lecture-top">
                    <span className={`icon-chip ${a.type === 'test' ? 'info' : 'ok'}`}>{a.type === 'test' ? <FileQuestion size={13} aria-hidden /> : <ClipboardCheck size={13} aria-hidden />} {a.type === 'test' ? 'Test' : 'Assignment'}</span>
                    {a.status === 'draft' ? <Pill tone="gray">Draft</Pill> : <Pill tone="green">Published</Pill>}
                  </div>
                  <strong className="lecture-title">{a.title}</strong>
                  <div className="lecture-meta">
                    {a.date && <span><CalendarDays size={13} aria-hidden /> {a.type === 'assignment' ? 'Due ' : ''}{formatDate(`${a.date}T12:00:00`)}</span>}
                    {a.type === 'test' && a.durationMinutes > 0 && <span><Timer size={13} aria-hidden /> {a.durationMinutes} min</span>}
                    <span>Max {a.maxMarks} marks</span>
                  </div>
                  {a.lectureTitle && <div className="lecture-meta"><span><BookOpenCheck size={13} aria-hidden /> Based on: {a.lectureTitle}</span></div>}
                  <div className="chips">{a.batchIds.map((id) => <span key={id} className="icon-chip">{batchName(id)}</span>)}</div>
                  <div className="lecture-foot">
                    <span className={`icon-chip${a.questionCount ? ' ok' : ''}`}><ListChecks size={14} aria-hidden /> {a.questionCount ? `${a.questionCount} MCQs` : 'No MCQs'}</span>
                    <span className={`icon-chip${a.files.length ? ' ok' : ''}`}><Paperclip size={14} aria-hidden /> {a.files.length ? `${a.files.length} files` : 'No files'}</span>
                  </div>
                </Link>
              ))}
              <button className="tile tile-add" onClick={() => setEditing(tab)}><Plus size={22} aria-hidden /><strong>{tab === 'test' ? 'New test' : 'New assignment'}</strong></button>
            </div>
          )}
        </section>
      )}

      {editing && <AssessmentModal course={course} subject={subject} batches={batches} assessment={typeof editing === 'string' ? null : editing} type={typeof editing === 'string' ? editing : editing.type} onClose={() => setEditing(null)} onCreated={(id) => navigate(`/courses/${courseId}/subjects/${subjectId}/assessments/${id}`)} />}
    </>
  );
}

/** Create / edit a test or assignment: details, batches, files, and (tests or assignments) MCQ CSV. */
export function AssessmentModal({ course, subject, batches, assessment, type, onClose, onCreated }: {
  course: Course | null; subject: CourseSubject; batches: CourseBatch[]; assessment: Assessment | null; type: AssessmentType; onClose: () => void; onCreated?: (id: string) => void;
}) {
  const { recordings } = useStore();
  const lectures = useMemo(() => recordings.filter((r) => r.subjectId === subject.id).sort((a, b) => (Number(a.lectureNumber) || 1e9) - (Number(b.lectureNumber) || 1e9)), [recordings, subject.id]);
  const [id] = useState(() => assessment?.id ?? newAssessmentId());
  const [title, setTitle] = useState(assessment?.title ?? '');
  const [instructions, setInstructions] = useState(assessment?.instructions ?? '');
  const [batchIds, setBatchIds] = useState<string[]>(assessment?.batchIds ?? (batches.length === 1 ? [batches[0].id] : []));
  const [date, setDate] = useState(assessment?.date ?? '');
  const [durationMinutes, setDuration] = useState(assessment?.durationMinutes ?? (type === 'test' ? 60 : 0));
  const [maxMarks, setMaxMarks] = useState(assessment?.maxMarks ?? (type === 'test' ? 50 : 10));
  const [lectureId, setLectureId] = useState(assessment?.lectureId ?? '');
  const [status, setStatus] = useState<'draft' | 'published'>(assessment?.status ?? 'published');
  const [files, setFiles] = useState<AssessmentFile[]>(assessment?.files ?? []);
  const [mcq, setMcq] = useState<{ questions: Omit<McqQuestion, 'id'>[]; errors: string[]; fileName: string } | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const target = { courseId: course?.id ?? subject.courseId, subjectId: subject.id };
  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setError('');
    try {
      for (const file of [...list]) {
        setUploading(`${file.name} 0%`);
        const saved = await uploadAssessmentFile(target, id, file, (f) => setUploading(`${file.name} ${Math.round(f * 100)}%`));
        setFiles((current) => [...current, saved]);
      }
    } catch (cause) { setError(`${message(cause)} Check that Firebase Storage is turned on and storage.rules are published.`); } finally { setUploading(null); }
  };
  const dropFile = async (file: AssessmentFile) => { setFiles((current) => current.filter((f) => f.path !== file.path)); await removeAssessmentFile(file); };
  const readMcq = async (file: File | undefined) => { if (file) setMcq({ ...parseMcqCsv(await file.text()), fileName: file.name }); };
  const mcqTotal = mcq?.questions.reduce((sum, q) => sum + q.marks, 0) ?? 0;

  const save = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!batchIds.length) { setError('Choose at least one batch.'); return; }
    if (mcq?.errors.length) { setError('Fix the MCQ file errors first (or remove the file).'); return; }
    const marks = mcq?.questions.length ? mcqTotal : Number(maxMarks);
    if (!(marks > 0)) { setError('Maximum marks must be more than 0.'); return; }
    setBusy(true); setError('');
    const lecture = lectures.find((r) => r.id === lectureId);
    try {
      await saveAssessment(id, {
        type, courseId: target.courseId, subjectId: subject.id, subjectName: subject.name, batchIds, title, instructions: instructions.trim(), date,
        durationMinutes: type === 'test' ? Number(durationMinutes) || 0 : 0, maxMarks: marks,
        lectureId: lecture?.id ?? '', lectureTitle: lecture ? `${lecture.lectureNumber ? `L${lecture.lectureNumber} ` : ''}${lecture.topic}` : '',
        files, questionCount: mcq?.questions.length ?? assessment?.questionCount ?? 0, status,
      }, !assessment);
      if (mcq?.questions.length) await replaceQuestions(id, mcq.questions);
      onClose();
      if (!assessment) onCreated?.(id);
    } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  };

  const noun = type === 'test' ? 'test' : 'assignment';
  return (
    <Modal wide title={assessment ? `Edit ${assessment.title}` : `New ${noun}`} onClose={onClose} footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn" disabled={busy || Boolean(uploading)} onClick={() => void save()}>{busy ? 'Saving…' : assessment ? 'Save' : `Create ${noun}`}</button></>}>
      {error && <div className="alert" role="alert">{error}</div>}
      <div className="form-grid">
        <label className="field full"><span>Title *</span><input className="input" autoFocus placeholder={type === 'test' ? 'e.g. Unit Test 1' : 'e.g. Assignment 1: Matrices'} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="field"><span>{type === 'test' ? 'Test date' : 'Due date'}</span><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        {type === 'test' ? <label className="field"><span>Duration (minutes)</span><input className="input" type="number" min={0} value={durationMinutes} onChange={(e) => setDuration(Number(e.target.value))} /></label>
          : <label className="field"><span>Based on lecture (optional)</span><select className="input" value={lectureId} onChange={(e) => setLectureId(e.target.value)}><option value="">Not linked to a lecture</option>{lectures.map((r) => <option key={r.id} value={r.id}>{r.lectureNumber ? `L${r.lectureNumber} · ` : ''}{r.topic}</option>)}</select></label>}
        <label className="field"><span>Maximum marks{mcq?.questions.length ? ' (from MCQs)' : ' *'}</span><input className="input" type="number" min={1} disabled={Boolean(mcq?.questions.length)} value={mcq?.questions.length ? mcqTotal : maxMarks} onChange={(e) => setMaxMarks(Number(e.target.value))} /></label>
        <label className="field"><span>Status</span><select className="input" value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}><option value="published">Published (visible to students)</option><option value="draft">Draft (hidden)</option></select></label>
        <div className="field full"><span>Batches *</span>
          <div className="chips">{batches.map((b) => <button type="button" key={b.id} className={`filter-chip${batchIds.includes(b.id) ? ' active' : ''}`} onClick={() => setBatchIds((cur) => (cur.includes(b.id) ? cur.filter((x) => x !== b.id) : [...cur, b.id]))}>{b.name}</button>)}{!batches.length && <span className="cell-sub">This course has no batches yet.</span>}</div>
        </div>
        <label className="field full"><span>Instructions</span><textarea className="input" style={{ minHeight: 70 }} value={instructions} onChange={(e) => setInstructions(e.target.value)} /></label>

        <div className="field full"><span>{type === 'test' ? 'Question paper' : 'Assignment files'} (Word / PDF)</span>
          <div className="upload-box">
            {files.map((file) => <div key={file.path} className="upload-row"><FileText size={16} aria-hidden /><span className="grow">{file.name}</span><a className="link" href={file.url} target="_blank" rel="noreferrer">Open</a><button type="button" className="icon-btn danger" aria-label={`Remove ${file.name}`} onClick={() => void dropFile(file)}><Trash2 size={13} /></button></div>)}
            {uploading && <div className="cell-sub">Uploading {uploading}</div>}
            <label className="btn btn-outline btn-sm"><Upload size={14} /> Upload files<input type="file" multiple hidden accept={ASSESSMENT_FILE_TYPES} onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} /></label>
          </div>
        </div>

        <div className="field full"><span>MCQ questions (CSV)</span>
          <div className="upload-box">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <label className="btn btn-outline btn-sm"><Upload size={14} /> Upload MCQ CSV<input type="file" hidden accept=".csv,text/csv" onChange={(e) => { void readMcq(e.target.files?.[0]); e.target.value = ''; }} /></label>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => downloadCsv('mcq-sample.csv', MCQ_CSV_SAMPLE)}><Download size={14} /> Download sample</button>
              {(assessment?.questionCount ?? 0) > 0 && !mcq ? <span className="cell-sub">{assessment?.questionCount} MCQs saved. Uploading a new file replaces them.</span> : null}
              {mcq && <span className="cell-sub">{mcq.fileName}: {mcq.questions.length} questions · {mcqTotal} marks <button type="button" className="link" onClick={() => setMcq(null)}>remove</button></span>}
            </div>
            <small className="cell-sub">Columns: question, optionA, optionB, optionC, optionD (up to optionF), correct (letter A–F), marks.</small>
            {mcq?.errors.length ? <div className="alert" style={{ margin: 0 }}>{mcq.errors.slice(0, 6).map((e) => <div key={e}>{e}</div>)}{mcq.errors.length > 6 && <div>…and {mcq.errors.length - 6} more</div>}</div> : null}
            {mcq?.questions.length ? <ol className="mcq-preview">{mcq.questions.slice(0, 5).map((q, i) => <li key={i}><strong>{q.text}</strong><div className="chips">{q.options.map((o, j) => <span key={j} className={`icon-chip${j === q.correctIndex ? ' ok' : ''}`}>{String.fromCharCode(65 + j)}. {o}</span>)}</div></li>)}{mcq.questions.length > 5 && <li className="cell-sub">…{mcq.questions.length - 5} more</li>}</ol> : null}
          </div>
        </div>
      </div>
    </Modal>
  );
}
