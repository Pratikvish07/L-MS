import { ArrowLeft, BookOpenCheck, CalendarDays, CheckCircle2, Download, Eye, FileText, Pencil, Save, Timer, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { PageHead } from '../components/Layout';
import { ConfirmDialog } from '../components/Modal';
import { Pill, Spinner } from '../components/ui';
import {
  csvCell, deleteAssessment, friendlyError, downloadCsv, filePreviewUrl, saveMarks, subscribeAssessment, subscribeAssessmentMarks, subscribeQuestions,
  type Assessment, type MarkEntry, type McqQuestion,
} from '../lib/assessments';
import { subscribeCourse, subscribeCourseBatches, subscribeCourseEnrollments, subscribeCourseSubjects, type Course, type CourseBatch, type CourseSubject, type Enrollment } from '../lib/courses';
import { formatBytes, formatDate } from '../lib/format';
import { AssessmentModal } from './SubjectPage';
import { SubmissionsPanel } from './Submissions';

const message = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));
interface Draft { marks: string; remarks: string; }

/** One test or assignment: details, files, MCQs, and marks entry per batch. */
export function AssessmentDetailPage() {
  const { courseId = '', subjectId = '', assessmentId = '' } = useParams<{ courseId: string; subjectId: string; assessmentId: string }>();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<Assessment | null | undefined>(undefined);
  const [course, setCourse] = useState<Course | null>(null);
  const [subject, setSubject] = useState<CourseSubject | null>(null);
  const [batches, setBatches] = useState<CourseBatch[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [questions, setQuestions] = useState<McqQuestion[]>([]);
  const [marks, setMarks] = useState<MarkEntry[]>([]);
  const [tab, setTab] = useState<'marks' | 'submissions' | 'questions' | 'files'>('marks');
  const [batchId, setBatchId] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const onError = (cause: Error) => setError(friendlyError(cause));
    const stops = [
      subscribeAssessment(assessmentId, setAssessment, (cause) => { setAssessment(null); onError(cause); }),
      subscribeCourse(courseId, setCourse, onError),
      subscribeCourseSubjects(courseId, (rows) => setSubject(rows.find((r) => r.id === subjectId) ?? null), onError),
      subscribeCourseBatches(courseId, setBatches, onError),
      subscribeCourseEnrollments(courseId, setEnrollments, onError),
      subscribeQuestions(assessmentId, setQuestions, () => setQuestions([])),
      subscribeAssessmentMarks(assessmentId, setMarks, onError),
    ];
    return () => stops.forEach((stop) => stop());
  }, [assessmentId, courseId, subjectId]);

  const activeBatch = batchId || assessment?.batchIds[0] || '';
  const students = useMemo(() => enrollments.filter((e) => e.batchId === activeBatch).sort((a, b) => a.studentName.localeCompare(b.studentName)), [enrollments, activeBatch]);
  const saved = useMemo(() => new Map(marks.map((m) => [m.studentUid, m])), [marks]);
  const draftFor = (uid: string): Draft => drafts[uid] ?? { marks: saved.get(uid)?.marks?.toString() ?? '', remarks: saved.get(uid)?.remarks ?? '' };
  const dirty = Object.keys(drafts).length > 0;

  const back = <button className="btn btn-outline" onClick={() => navigate(`/courses/${courseId}/subjects/${subjectId}`)}><ArrowLeft size={16} /> {subject?.name ?? 'Subject'}</button>;
  if (assessment === undefined) return <Spinner />;
  if (assessment === null) return <PageHead title="Not found">{back}</PageHead>;

  const batchMarks = students.map((s) => saved.get(s.studentUid)?.marks).filter((v): v is number => typeof v === 'number');
  const average = batchMarks.length ? Math.round((batchMarks.reduce((a, b) => a + b, 0) / batchMarks.length) * 10) / 10 : null;

  const setDraft = (uid: string, change: Partial<Draft>) => setDrafts((current) => ({ ...current, [uid]: { ...draftFor(uid), ...change } }));
  const saveAll = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const rows = students.filter((s) => drafts[s.studentUid]).map((s) => {
        const d = drafts[s.studentUid];
        return { studentUid: s.studentUid, studentName: s.studentName, studentEmail: s.studentEmail, batchId: activeBatch, marks: d.marks.trim() === '' ? null : Number(d.marks), remarks: d.remarks.trim() };
      });
      await saveMarks(assessment, rows);
      setDrafts({});
      setNotice(`Saved marks for ${rows.length} student${rows.length === 1 ? '' : 's'}.`);
    } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  };
  const importCsv = async (file: File | undefined) => {
    if (!file) return;
    setError(''); setNotice('');
    const lines = (await file.text()).replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
    const headers = lines.shift()?.toLowerCase().split(',').map((h) => h.trim().replace(/"/g, '')) ?? [];
    const ei = headers.indexOf('email');
    const mi = headers.indexOf('marks');
    const ri = headers.indexOf('remarks');
    if (ei < 0 || mi < 0) { setError('The marks CSV needs "email" and "marks" columns (download the sheet to get the format).'); return; }
    const byEmail = new Map(students.map((s) => [s.studentEmail.toLowerCase(), s]));
    const next: Record<string, Draft> = {};
    const unknown: string[] = [];
    for (const line of lines) {
      const cells = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      const student = byEmail.get((cells[ei] ?? '').toLowerCase());
      if (!student) { unknown.push(cells[ei] ?? ''); continue; }
      next[student.studentUid] = { marks: cells[mi] ?? '', remarks: ri >= 0 ? cells[ri] ?? '' : '' };
    }
    setDrafts((current) => ({ ...current, ...next }));
    setNotice(`${Object.keys(next).length} rows loaded. Review and press Save marks.${unknown.length ? ` Not in this batch: ${unknown.slice(0, 5).join(', ')}${unknown.length > 5 ? '…' : ''}` : ''}`);
  };
  const exportSheet = () => downloadCsv(`${assessment.title}-${batches.find((b) => b.id === activeBatch)?.name ?? ''}.csv`, ['name,email,marks,remarks', ...students.map((s) => [s.studentName, s.studentEmail, draftFor(s.studentUid).marks, draftFor(s.studentUid).remarks].map(csvCell).join(','))].join('\n'));
  const remove = async () => {
    setBusy(true);
    try { await deleteAssessment(assessment); navigate(`/courses/${courseId}/subjects/${subjectId}`); } catch (cause) { setError(message(cause)); setBusy(false); }
  };

  return (
    <>
      <PageHead title={assessment.title} subtitle={`${assessment.type === 'test' ? 'Test' : 'Assignment'} · ${subject?.name ?? assessment.subjectName} · ${course?.title ?? ''}`}>
        {back}
        <button className="btn btn-outline" onClick={() => setEditing(true)}><Pencil size={14} /> Edit</button>
        <button className="btn btn-soft-danger" onClick={() => setRemoving(true)}><Trash2 size={14} /> Delete</button>
      </PageHead>
      {error && <div className="alert" role="alert">{error}</div>}
      {notice && <div className="notice" role="status">{notice}</div>}

      <section className="card card-pad assessment-info">
        {assessment.status === 'draft' ? <Pill tone="gray">Draft</Pill> : <Pill tone="green">Published</Pill>}
        {assessment.date && <span><CalendarDays size={14} aria-hidden /> {assessment.type === 'assignment' ? 'Due ' : ''}{formatDate(`${assessment.date}T12:00:00`)}</span>}
        {assessment.durationMinutes > 0 && <span><Timer size={14} aria-hidden /> {assessment.durationMinutes} min</span>}
        <span><CheckCircle2 size={14} aria-hidden /> Max {assessment.maxMarks} marks</span>
        {assessment.lectureTitle && <span><BookOpenCheck size={14} aria-hidden /> Based on {assessment.lectureTitle}</span>}
        <span className="chips">{assessment.batchIds.map((id) => <span key={id} className="icon-chip">{batches.find((b) => b.id === id)?.name ?? 'Batch'}</span>)}</span>
        {assessment.instructions && <p className="cell-sub" style={{ flexBasis: '100%', margin: 0 }}>{assessment.instructions}</p>}
      </section>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'marks'} className={tab === 'marks' ? 'active' : ''} onClick={() => setTab('marks')}>Marks entry</button>
        <button role="tab" aria-selected={tab === 'questions'} className={tab === 'questions' ? 'active' : ''} onClick={() => setTab('questions')}>MCQs ({questions.length})</button>
        <button role="tab" aria-selected={tab === 'files'} className={tab === 'files' ? 'active' : ''} onClick={() => setTab('files')}>Files ({assessment.files.length})</button>
        <button role="tab" aria-selected={tab === 'submissions'} className={tab === 'submissions' ? 'active' : ''} onClick={() => setTab('submissions')}>Submissions</button>
      </div>

      {tab === 'marks' && (
        <section className="card">
          <div className="toolbar">
            <select className="input" style={{ maxWidth: 220 }} aria-label="Batch" value={activeBatch} onChange={(e) => { if (dirty && !window.confirm('Discard unsaved marks?')) return; setDrafts({}); setBatchId(e.target.value); }}>
              {assessment.batchIds.map((id) => <option key={id} value={id}>{batches.find((b) => b.id === id)?.name ?? 'Batch'}</option>)}
            </select>
            <span className="cell-sub" style={{ flex: 1 }}>{batchMarks.length}/{students.length} marked{average !== null ? ` · average ${average}/${assessment.maxMarks}` : ''}</span>
            <button className="btn btn-outline btn-sm" onClick={exportSheet} disabled={!students.length}><Download size={14} /> Download sheet</button>
            <label className="btn btn-outline btn-sm"><Upload size={14} /> Import CSV<input type="file" hidden accept=".csv,text/csv" onChange={(e) => { void importCsv(e.target.files?.[0]); e.target.value = ''; }} /></label>
            <button className="btn" disabled={!dirty || busy} onClick={() => void saveAll()}><Save size={14} /> {busy ? 'Saving…' : 'Save marks'}</button>
          </div>
          <div className="table-wrap"><table>
            <thead><tr><th>Student</th><th style={{ width: 150 }}>Marks (/{assessment.maxMarks})</th><th>Remarks</th><th>Status</th></tr></thead>
            <tbody>
              {students.map((s) => {
                const d = draftFor(s.studentUid);
                const value = d.marks.trim() === '' ? null : Number(d.marks);
                const invalid = value !== null && (Number.isNaN(value) || value < 0 || value > assessment.maxMarks);
                return (
                  <tr key={s.id}>
                    <td><div className="cell-title">{s.studentName}</div><div className="cell-sub">{s.studentEmail}</div></td>
                    <td><input className="input" style={invalid ? { borderColor: 'var(--red)' } : undefined} type="number" min={0} max={assessment.maxMarks} step="0.5" placeholder="—" aria-label={`Marks for ${s.studentName}`} value={d.marks} onChange={(e) => setDraft(s.studentUid, { marks: e.target.value })} /></td>
                    <td><input className="input" placeholder="Optional" aria-label={`Remarks for ${s.studentName}`} value={d.remarks} onChange={(e) => setDraft(s.studentUid, { remarks: e.target.value })} /></td>
                    <td>{drafts[s.studentUid] ? <Pill tone="amber">Unsaved</Pill> : saved.get(s.studentUid)?.marks != null ? <Pill tone="green">Saved</Pill> : <span className="cell-sub">Not marked</span>}</td>
                  </tr>
                );
              })}
              {!students.length && <tr><td className="empty" colSpan={4}>No students enrolled in this batch.</td></tr>}
            </tbody>
          </table></div>
        </section>
      )}

      {tab === 'questions' && (
        <section className="card card-pad">
          {questions.length ? <ol className="mcq-preview">{questions.map((q) => <li key={q.id}><strong>{q.text}</strong> <span className="cell-sub">({q.marks} mark{q.marks === 1 ? '' : 's'})</span><div className="chips">{q.options.map((o, j) => <span key={j} className={`icon-chip${j === q.correctIndex ? ' ok' : ''}`}>{String.fromCharCode(65 + j)}. {o}{j === q.correctIndex ? ' ✓' : ''}</span>)}</div></li>)}</ol>
            : <p className="cell-sub" style={{ margin: 0 }}>No MCQs. Use Edit → Upload MCQ CSV to add them.</p>}
        </section>
      )}

      {tab === 'submissions' && <SubmissionsPanel assessment={assessment} questions={questions} marks={marks} batchName={(id) => batches.find((b) => b.id === id)?.name ?? 'Batch'} />}

      {tab === 'files' && (
        <section className="card card-pad">
          {assessment.files.map((file) => (
            <div key={file.path} className="list-item" style={{ padding: '10px 0' }}>
              <FileText size={18} aria-hidden />
              <div className="grow"><div className="title">{file.name}</div><div className="cell-sub">{formatBytes(file.size)}</div></div>
              <a className="btn btn-outline btn-sm" href={filePreviewUrl(file)} target="_blank" rel="noreferrer"><Eye size={14} /> Preview</a>
              <a className="btn btn-outline btn-sm" href={file.url} target="_blank" rel="noreferrer" download={file.name}><Download size={14} /> Download</a>
            </div>
          ))}
          {!assessment.files.length && <p className="cell-sub" style={{ margin: 0 }}>No files. Use Edit → Upload files.</p>}
        </section>
      )}

      {editing && subject && <AssessmentModal course={course} subject={subject} batches={batches} assessment={assessment} type={assessment.type} onClose={() => setEditing(false)} />}
      {removing && <ConfirmDialog title={`Delete ${assessment.type}`} message={<>Delete <strong>{assessment.title}</strong> with its MCQs, files and all marks? This cannot be undone.</>} busy={busy} onConfirm={() => void remove()} onCancel={() => setRemoving(false)} />}
    </>
  );
}
